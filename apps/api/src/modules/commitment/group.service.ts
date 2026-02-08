/**
 * Group Accountability Service
 *
 * Provides social reinforcement layer on top of individual CommitmentContracts.
 * Research: Matthews (2015) found group accountability increases goal achievement
 * from ~35% (solo) to 76%. Kullgren RCT showed hybrid individual+group incentives
 * outperform either alone.
 *
 * Key design decisions:
 * - Categorical progress only ("on track"/"behind") — never raw amounts (Beshears 401k study)
 * - No stake redistribution between members — avoids peer-to-peer betting regulation
 * - 2-5 member cap — Dunbar's social group research + Kullgren trial optimum
 * - Group bonus is a badge, not money — avoids Survivor Pool problem
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupStatus, GroupRole, CommitmentStatus } from '@prisma/client';
import { GROUP_CONSTANTS } from './constants';
import type {
  GroupInfo,
  GroupMemberProgress,
  GroupDashboard,
  GroupProgressCategory,
  GroupOutcomeResult,
} from './interfaces';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new accountability group.
   * Generates an 8-char hex invite code and adds the creator as OWNER.
   */
  async createGroup(
    userId: string,
    input: { name: string; description?: string; sharedGoalAmount?: number; sharedGoalLabel?: string },
  ): Promise<{ id: string; name: string; inviteCode: string; status: string; maxMembers: number }> {
    const inviteCode = randomBytes(4).toString('hex'); // 8 hex chars

    const group = await this.prisma.commitmentGroup.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        inviteCode,
        createdBy: userId,
        sharedGoalAmount: input.sharedGoalAmount ?? null,
        sharedGoalLabel: input.sharedGoalLabel ?? null,
        members: {
          create: {
            userId,
            role: GroupRole.OWNER,
          },
        },
      },
    });

    this.logger.log(`Group "${group.name}" created by ${userId} (code: ${inviteCode})`);

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      status: group.status,
      maxMembers: group.maxMembers,
    };
  }

  /**
   * Join a group via invite code.
   * Validates: code exists, group is FORMING/ACTIVE, not full, user not already a member.
   */
  async joinGroup(
    userId: string,
    inviteCode: string,
  ): Promise<{ success: boolean; groupId: string; groupName: string; memberCount: number }> {
    const group = await this.prisma.commitmentGroup.findUnique({
      where: { inviteCode },
      include: {
        members: { where: { leftAt: null } },
      },
    });

    if (!group) {
      throw new NotFoundException('Invalid invite code');
    }

    if (group.status !== GroupStatus.FORMING && group.status !== GroupStatus.ACTIVE) {
      throw new BadRequestException('This group is no longer accepting members');
    }

    const activeMembers = group.members;
    if (activeMembers.length >= group.maxMembers) {
      throw new BadRequestException(
        `Group is full (${activeMembers.length}/${group.maxMembers} members)`,
      );
    }

    const alreadyMember = activeMembers.some((m) => m.userId === userId);
    if (alreadyMember) {
      throw new BadRequestException('You are already a member of this group');
    }

    await this.prisma.commitmentGroupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: GroupRole.MEMBER,
      },
    });

    // If we hit min members and group is still FORMING, transition to ACTIVE
    const newCount = activeMembers.length + 1;
    if (newCount >= GROUP_CONSTANTS.MIN_MEMBERS && group.status === GroupStatus.FORMING) {
      await this.prisma.commitmentGroup.update({
        where: { id: group.id },
        data: { status: GroupStatus.ACTIVE },
      });
    }

    this.logger.log(`User ${userId} joined group "${group.name}" (${newCount}/${group.maxMembers})`);

    return {
      success: true,
      groupId: group.id,
      groupName: group.name,
      memberCount: newCount,
    };
  }

  /**
   * Leave a group. If the owner leaves, disband the group.
   */
  async leaveGroup(userId: string, groupId: string): Promise<void> {
    const member = await this.prisma.commitmentGroupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });

    if (!member) {
      throw new NotFoundException('You are not an active member of this group');
    }

    // Mark member as left
    await this.prisma.commitmentGroupMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });

    // If owner leaves, disband
    if (member.role === GroupRole.OWNER) {
      await this.prisma.commitmentGroup.update({
        where: { id: groupId },
        data: { status: GroupStatus.DISBANDED },
      });
      this.logger.log(`Group ${groupId} disbanded (owner left)`);
    } else {
      this.logger.log(`User ${userId} left group ${groupId}`);
    }
  }

  /**
   * Link an existing CommitmentContract to the user's group membership.
   * Validates ownership of both the membership and the contract.
   */
  async linkContract(userId: string, groupId: string, contractId: string): Promise<void> {
    const member = await this.prisma.commitmentGroupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });

    if (!member) {
      throw new NotFoundException('You are not an active member of this group');
    }

    if (member.contractId) {
      throw new BadRequestException('You already have a contract linked to this group');
    }

    // Verify the contract belongs to this user
    const contract = await this.prisma.commitmentContract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found or does not belong to you');
    }

    await this.prisma.commitmentGroupMember.update({
      where: { id: member.id },
      data: { contractId },
    });

    this.logger.log(`User ${userId} linked contract ${contractId} to group ${groupId}`);
  }

  /**
   * Get the group dashboard with categorical member progress.
   * Never exposes raw financial amounts — only "on track", "behind", etc.
   */
  async getGroupDashboard(userId: string, groupId: string): Promise<GroupDashboard> {
    const group = await this.prisma.commitmentGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, name: true } },
            contract: {
              select: {
                id: true,
                status: true,
                deadline: true,
                stakeType: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Verify calling user is a member
    const callerMember = group.members.find((m) => m.userId === userId);
    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Get encouragement counts per member
    const encouragementCounts = await this.prisma.groupEncouragement.groupBy({
      by: ['toUserId'],
      where: { groupId },
      _count: true,
    });
    const encouragementMap = new Map(encouragementCounts.map(e => [e.toUserId, e._count]));

    // Get recent encouragements
    const recentEncouragements = await this.prisma.groupEncouragement.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
      },
    });

    // Get reaction summaries per member
    const reactions = await this.prisma.groupReaction.findMany({
      where: { groupId },
    });
    const reactionsByTarget = new Map<string, Map<string, { count: number; userIds: Set<string> }>>();
    for (const r of reactions) {
      if (!reactionsByTarget.has(r.targetId)) {
        reactionsByTarget.set(r.targetId, new Map());
      }
      const emojiMap = reactionsByTarget.get(r.targetId)!;
      if (!emojiMap.has(r.emoji)) {
        emojiMap.set(r.emoji, { count: 0, userIds: new Set() });
      }
      const entry = emojiMap.get(r.emoji)!;
      entry.count++;
      entry.userIds.add(r.userId);
    }

    // Build member progress list
    const members: GroupMemberProgress[] = group.members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      role: m.role,
      hasContract: !!m.contract,
      progress: this.categorizeProgress(m.contract),
      groupBonusAwarded: m.groupBonusAwarded,
      joinedAt: m.joinedAt,
      encouragementCount: encouragementMap.get(m.user.id) || 0,
      reactions: (() => {
        const memberReactions = reactionsByTarget.get(m.user.id);
        if (!memberReactions) return [];
        return Array.from(memberReactions.entries()).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          myReaction: data.userIds.has(userId),
        }));
      })(),
    }));

    const membersWithContracts = group.members.filter((m) => m.contract);
    const resolvedStatuses: CommitmentStatus[] = [CommitmentStatus.SUCCEEDED, CommitmentStatus.FAILED, CommitmentStatus.CANCELLED];
    const allResolved =
      membersWithContracts.length > 0 &&
      membersWithContracts.every((m) => resolvedStatuses.includes(m.contract!.status));
    const allSucceeded =
      membersWithContracts.length > 0 &&
      membersWithContracts.every((m) => m.contract!.status === CommitmentStatus.SUCCEEDED);

    const groupBonusAwarded = group.members.some((m) => m.groupBonusAwarded);

    const groupInfo: GroupInfo = {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      status: group.status,
      memberCount: group.members.length,
      maxMembers: group.maxMembers,
      myRole: callerMember.role,
      createdAt: group.createdAt,
    };

    // Get shared goal progress if configured
    const sharedGoal = await this.getSharedGoalProgress(groupId);

    return {
      group: groupInfo,
      members,
      allResolved,
      allSucceeded,
      groupBonusAwarded,
      sharedGoal,
      recentEncouragements: recentEncouragements.map(e => ({
        id: e.id,
        fromName: e.fromUser.name,
        toName: e.toUser.name,
        message: e.message,
        createdAt: e.createdAt,
      })),
    };
  }

  /**
   * Get all groups the user is a member of.
   */
  async getMyGroups(userId: string): Promise<GroupInfo[]> {
    const memberships = await this.prisma.commitmentGroupMember.findMany({
      where: { userId, leftAt: null },
      include: {
        group: {
          include: {
            members: { where: { leftAt: null }, select: { id: true } },
          },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      inviteCode: m.group.inviteCode,
      status: m.group.status,
      memberCount: m.group.members.length,
      maxMembers: m.group.maxMembers,
      myRole: m.role,
      createdAt: m.group.createdAt,
    }));
  }

  /**
   * Disband a group (owner only).
   */
  async disbandGroup(userId: string, groupId: string): Promise<void> {
    const member = await this.prisma.commitmentGroupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });

    if (!member) {
      throw new NotFoundException('You are not an active member of this group');
    }

    if (member.role !== GroupRole.OWNER) {
      throw new ForbiddenException('Only the group owner can disband the group');
    }

    await this.prisma.commitmentGroup.update({
      where: { id: groupId },
      data: { status: GroupStatus.DISBANDED },
    });

    this.logger.log(`Group ${groupId} disbanded by owner ${userId}`);
  }

  /**
   * Resolve group outcome. Called by cron when all member contracts are resolved.
   * Awards group bonus badge if all members succeeded.
   */
  async resolveGroupOutcome(groupId: string): Promise<GroupOutcomeResult> {
    const group = await this.prisma.commitmentGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            contract: { select: { status: true } },
          },
        },
      },
    });

    if (!group) {
      return { groupId, allSucceeded: false, bonusAwarded: false, membersResolved: 0 };
    }

    const membersWithContracts = group.members.filter((m) => m.contract);
    const resolvedStatuses: CommitmentStatus[] = [CommitmentStatus.SUCCEEDED, CommitmentStatus.FAILED, CommitmentStatus.CANCELLED];
    const allResolved = membersWithContracts.every((m) =>
      resolvedStatuses.includes(m.contract!.status),
    );

    if (!allResolved || membersWithContracts.length === 0) {
      return { groupId, allSucceeded: false, bonusAwarded: false, membersResolved: membersWithContracts.length };
    }

    const allSucceeded = membersWithContracts.every(
      (m) => m.contract!.status === CommitmentStatus.SUCCEEDED,
    );

    // Award group bonus badge to all active members if all succeeded
    if (allSucceeded) {
      await this.prisma.commitmentGroupMember.updateMany({
        where: { groupId, leftAt: null },
        data: { groupBonusAwarded: true },
      });
      this.logger.log(`Group ${groupId}: ALL members succeeded! Group bonus awarded.`);
    }

    // Transition group to COMPLETED
    await this.prisma.commitmentGroup.update({
      where: { id: groupId },
      data: { status: GroupStatus.COMPLETED },
    });

    return {
      groupId,
      allSucceeded,
      bonusAwarded: allSucceeded,
      membersResolved: membersWithContracts.length,
    };
  }

  /**
   * Get all ACTIVE groups that need outcome resolution.
   * Used by the cron job.
   */
  async getGroupsPendingResolution(): Promise<string[]> {
    const groups = await this.prisma.commitmentGroup.findMany({
      where: { status: GroupStatus.ACTIVE },
      include: {
        members: {
          where: { leftAt: null, contractId: { not: null } },
          include: {
            contract: { select: { status: true } },
          },
        },
      },
    });

    const resolvedStatuses: CommitmentStatus[] = [CommitmentStatus.SUCCEEDED, CommitmentStatus.FAILED, CommitmentStatus.CANCELLED];

    return groups
      .filter((g) => {
        const membersWithContracts = g.members.filter((m) => m.contract);
        return (
          membersWithContracts.length > 0 &&
          membersWithContracts.every((m) => resolvedStatuses.includes(m.contract!.status))
        );
      })
      .map((g) => g.id);
  }

  private readonly ALLOWED_EMOJIS = ['thumbsup', 'fire', 'clap', 'heart', 'star'];

  /**
   * Get collective progress toward the shared group goal.
   * Sums goal.currentAmount across all active members with linked contracts.
   */
  async getSharedGoalProgress(groupId: string): Promise<{
    target: number;
    current: number;
    percentage: number;
    currency: string;
    label: string | null;
  } | null> {
    const group = await this.prisma.commitmentGroup.findUnique({
      where: { id: groupId },
      select: {
        sharedGoalAmount: true,
        sharedGoalCurrency: true,
        sharedGoalLabel: true,
        members: {
          where: { leftAt: null, contractId: { not: null } },
          include: {
            contract: {
              select: {
                goal: { select: { currentAmount: true } },
              },
            },
          },
        },
      },
    });

    if (!group || !group.sharedGoalAmount) return null;

    const target = Number(group.sharedGoalAmount);
    const current = group.members.reduce((sum, m) => {
      const goalAmount = m.contract?.goal?.currentAmount;
      return sum + (goalAmount ? Number(goalAmount) : 0);
    }, 0);
    const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

    return {
      target,
      current,
      percentage,
      currency: group.sharedGoalCurrency || 'NGN',
      label: group.sharedGoalLabel,
    };
  }

  /**
   * Send an encouragement message to a group member.
   * Rate limited: max 5 per user per group per day.
   */
  async sendEncouragement(
    userId: string,
    groupId: string,
    toUserId: string,
    message?: string,
  ): Promise<{ id: string }> {
    // Can't encourage yourself
    if (userId === toUserId) {
      throw new BadRequestException('You cannot send encouragement to yourself');
    }

    // Verify both are active members
    const members = await this.prisma.commitmentGroupMember.findMany({
      where: { groupId, leftAt: null, userId: { in: [userId, toUserId] } },
    });
    if (members.length < 2) {
      throw new NotFoundException('Both users must be active members of this group');
    }

    // Rate limit: max 5 per day
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.groupEncouragement.count({
      where: { groupId, fromUserId: userId, createdAt: { gte: dayAgo } },
    });
    if (recentCount >= 5) {
      throw new BadRequestException('You can send a maximum of 5 encouragements per day in this group');
    }

    const encouragement = await this.prisma.groupEncouragement.create({
      data: {
        groupId,
        fromUserId: userId,
        toUserId,
        message: message || 'You got this!',
      },
    });

    this.logger.log(`[encouragement] ${userId} → ${toUserId} in group ${groupId}`);
    return { id: encouragement.id };
  }

  /**
   * Toggle a reaction on a group member's progress.
   */
  async toggleReaction(
    userId: string,
    groupId: string,
    targetId: string,
    emoji: string,
  ): Promise<{ added: boolean }> {
    if (!this.ALLOWED_EMOJIS.includes(emoji)) {
      throw new BadRequestException(`Emoji must be one of: ${this.ALLOWED_EMOJIS.join(', ')}`);
    }

    // Verify both are members
    const members = await this.prisma.commitmentGroupMember.findMany({
      where: { groupId, leftAt: null, userId: { in: [userId, targetId] } },
    });
    if (members.length < 2 && userId !== targetId) {
      throw new NotFoundException('Both users must be active members of this group');
    }

    // Toggle: exists → delete, not exists → create
    const existing = await this.prisma.groupReaction.findUnique({
      where: {
        groupId_userId_targetId_emoji: { groupId, userId, targetId, emoji },
      },
    });

    if (existing) {
      await this.prisma.groupReaction.delete({ where: { id: existing.id } });
      return { added: false };
    }

    await this.prisma.groupReaction.create({
      data: { groupId, userId, targetId, emoji },
    });
    return { added: true };
  }

  /**
   * Get weekly progress timeline for a group.
   */
  async getGroupTimeline(
    userId: string,
    groupId: string,
  ): Promise<{ weeks: Array<{ weekStart: string; onTrack: number; behind: number; completed: number; failed: number }> }> {
    // Verify membership
    const member = await this.prisma.commitmentGroupMember.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Get all member contracts with audit logs
    const group = await this.prisma.commitmentGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { leftAt: null },
          include: {
            contract: {
              select: {
                status: true,
                deadline: true,
                createdAt: true,
                auditLogs: {
                  select: { action: true, newStatus: true, createdAt: true },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Build weekly buckets
    const membersWithContracts = group.members.filter(m => m.contract);
    if (membersWithContracts.length === 0) {
      // Return current snapshot
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return {
        weeks: [{
          weekStart: weekStart.toISOString().split('T')[0],
          onTrack: group.members.length,
          behind: 0,
          completed: 0,
          failed: 0,
        }],
      };
    }

    // Find the earliest contract creation date
    const earliestDate = membersWithContracts.reduce((min, m) => {
      const d = new Date(m.contract!.createdAt);
      return d < min ? d : min;
    }, new Date());

    // Generate weeks from earliest to now
    const weeks: Array<{ weekStart: string; onTrack: number; behind: number; completed: number; failed: number }> = [];
    const now = new Date();
    const current = new Date(earliestDate);
    current.setDate(current.getDate() - current.getDay()); // Start of week

    while (current <= now) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let onTrack = 0, behind = 0, completed = 0, failed = 0;

      for (const m of membersWithContracts) {
        const contract = m.contract!;
        // Determine status at this point in time
        const relevantLogs = contract.auditLogs.filter(l => new Date(l.createdAt) <= weekEnd);
        const lastLog = relevantLogs[relevantLogs.length - 1];

        if (lastLog?.newStatus === 'SUCCEEDED') {
          completed++;
        } else if (lastLog?.newStatus === 'FAILED' || lastLog?.newStatus === 'CANCELLED') {
          failed++;
        } else if (new Date(contract.deadline) < weekEnd) {
          behind++;
        } else {
          onTrack++;
        }
      }

      weeks.push({
        weekStart: current.toISOString().split('T')[0],
        onTrack,
        behind,
        completed,
        failed,
      });

      current.setDate(current.getDate() + 7);
    }

    return { weeks };
  }

  /**
   * Categorize contract progress into a privacy-safe category.
   * Never exposes raw financial amounts to peers.
   */
  private categorizeProgress(
    contract: { status: CommitmentStatus; deadline: Date; stakeType: string } | null,
  ): GroupProgressCategory {
    if (!contract) return 'pending';
    if (contract.status === CommitmentStatus.SUCCEEDED) return 'completed';
    if (contract.status === CommitmentStatus.FAILED) return 'failed';
    if (contract.status === CommitmentStatus.CANCELLED) return 'failed';

    // For active contracts, check if deadline is approaching
    const now = new Date();
    const deadline = new Date(contract.deadline);
    const totalDuration = deadline.getTime() - now.getTime();

    // If more than 50% of time remains, they're on track
    // This is a simple heuristic; in production you'd use successProbability
    if (totalDuration > 0) {
      return 'on_track';
    }

    return 'behind';
  }
}
