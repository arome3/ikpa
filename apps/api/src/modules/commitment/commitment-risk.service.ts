/**
 * Commitment Risk Assessment Service
 *
 * Evaluates active commitments that may be at risk when GPS detects overspending.
 * Integrated into the GPS recalculate flow to surface "Stakes at Risk" warnings.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommitmentStatus, StakeType } from '@prisma/client';

export interface CommitmentRiskAssessment {
  hasActiveCommitment: boolean;
  contracts: Array<{
    id: string;
    goalId: string;
    goalName: string;
    stakeType: StakeType;
    stakeAmount: number | null;
    daysRemaining: number;
    deadline: Date;
  }>;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  totalStakeAtRisk: number;
  message: string;
}

@Injectable()
export class CommitmentRiskService {
  private readonly logger = new Logger(CommitmentRiskService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assess commitment risk for a user when budget overspend is detected
   */
  async assessCommitmentRisk(userId: string, affectedGoalId?: string): Promise<CommitmentRiskAssessment> {
    const now = new Date();

    // Find all active commitment contracts for this user
    const whereClause: Record<string, unknown> = {
      userId,
      status: { in: [CommitmentStatus.ACTIVE, CommitmentStatus.PENDING_VERIFICATION] },
      deadline: { gte: now },
    };

    if (affectedGoalId) {
      whereClause.goalId = affectedGoalId;
    }

    const contracts = await this.prisma.commitmentContract.findMany({
      where: whereClause,
      include: {
        goal: { select: { name: true } },
      },
      orderBy: { deadline: 'asc' },
    });

    if (contracts.length === 0) {
      return {
        hasActiveCommitment: false,
        contracts: [],
        riskLevel: 'none',
        totalStakeAtRisk: 0,
        message: '',
      };
    }

    const enrichedContracts = contracts.map((c) => {
      const daysRemaining = Math.max(0, Math.ceil((c.deadline.getTime() - now.getTime()) / 86400000));
      return {
        id: c.id,
        goalId: c.goalId,
        goalName: c.goal?.name || 'Unknown Goal',
        stakeType: c.stakeType,
        stakeAmount: c.stakeAmount ? Number(c.stakeAmount) : null,
        daysRemaining,
        deadline: c.deadline,
      };
    });

    const totalStakeAtRisk = enrichedContracts.reduce((sum, c) => sum + (c.stakeAmount || 0), 0);

    // Calculate risk level based on urgency and stake amount
    const minDaysRemaining = Math.min(...enrichedContracts.map((c) => c.daysRemaining));
    const hasMonetaryStakes = enrichedContracts.some((c) => c.stakeAmount && c.stakeAmount > 0);

    let riskLevel: CommitmentRiskAssessment['riskLevel'] = 'low';
    if (hasMonetaryStakes && minDaysRemaining <= 7) {
      riskLevel = 'high';
    } else if (hasMonetaryStakes && minDaysRemaining <= 14) {
      riskLevel = 'medium';
    } else if (!hasMonetaryStakes) {
      riskLevel = 'low';
    }

    // Generate message
    const message = this.generateRiskMessage(enrichedContracts, riskLevel, totalStakeAtRisk);

    this.logger.log(
      `[assessCommitmentRisk] User ${userId}: ${enrichedContracts.length} active commitments, ` +
        `risk=${riskLevel}, total stake=${totalStakeAtRisk}`,
    );

    return {
      hasActiveCommitment: true,
      contracts: enrichedContracts,
      riskLevel,
      totalStakeAtRisk,
      message,
    };
  }

  private generateRiskMessage(
    contracts: CommitmentRiskAssessment['contracts'],
    riskLevel: string,
    totalStakeAtRisk: number,
  ): string {
    const contractCount = contracts.length;
    const nearest = contracts[0];

    if (riskLevel === 'high') {
      return `${contractCount} stake${contractCount > 1 ? 's' : ''} at risk! ` +
        `${nearest.goalName} commitment deadline is in ${nearest.daysRemaining} day${nearest.daysRemaining !== 1 ? 's' : ''}` +
        (totalStakeAtRisk > 0 ? ` — ${totalStakeAtRisk.toLocaleString()} at stake.` : '.');
    }

    if (riskLevel === 'medium') {
      return `Overspending may affect ${contractCount} active commitment${contractCount > 1 ? 's' : ''}. ` +
        `Nearest deadline: ${nearest.daysRemaining} days.`;
    }

    return `You have ${contractCount} active commitment${contractCount > 1 ? 's' : ''} that could be impacted by this overspend.`;
  }
}
