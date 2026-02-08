/**
 * Upgrade Service
 *
 * Bridges Future Self micro-commitments to full Commitment Device Engine contracts.
 * After a user maintains a 3-day streak on a micro-commitment, they become eligible
 * to upgrade to a staked contract with real consequences.
 *
 * This is the behavioral bridge: small daily pledges → proven consistency → high-stakes contract.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import { CommitmentService } from './commitment.service';
import {
  StakeType,
  VerificationMethod,
  GoalStatus,
  FutureSelfCommitmentStatus,
  RefereeRelationship,
} from '@prisma/client';
import { COMMITMENT_CONSTANTS } from './constants';

/** Minimum streak days required to offer upgrade */
const UPGRADE_STREAK_THRESHOLD = 3;

/** Suggested stake is ~30x daily amount (approximately a month's commitment) */
const STAKE_DAILY_MULTIPLIER = 30;

export interface UpgradeEligibility {
  eligible: boolean;
  reason: string;
  suggestedStakeType: 'SOCIAL' | 'ANTI_CHARITY' | 'LOSS_POOL';
  suggestedAmount: number;
  dailyAmount: number;
  streakDays: number;
  linkedGoals: Array<{ id: string; name: string; targetAmount: number }>;
}

@Injectable()
export class UpgradeService {
  private readonly logger = new Logger(UpgradeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly commitmentService: CommitmentService,
  ) {}

  /**
   * Check if a micro-commitment is eligible for upgrade to a staked contract.
   *
   * Eligibility criteria:
   * 1. Micro-commitment exists and belongs to user
   * 2. Status is ACTIVE
   * 3. Streak >= 3 days
   * 4. Not already upgraded
   * 5. User has at least one active goal
   */
  async checkUpgradeEligibility(
    userId: string,
    microCommitmentId: string,
  ): Promise<UpgradeEligibility> {
    const commitment = await this.prisma.futureSelfCommitment.findFirst({
      where: { id: microCommitmentId, userId },
    });

    if (!commitment) {
      return this.ineligible('Micro-commitment not found', 0, 0);
    }

    if (commitment.status !== FutureSelfCommitmentStatus.ACTIVE) {
      return this.ineligible(
        `Commitment is ${commitment.status.toLowerCase()}, must be active`,
        Number(commitment.dailyAmount),
        commitment.streakDays,
      );
    }

    if (commitment.upgradedToContractId) {
      return this.ineligible(
        'Already upgraded to a staked contract',
        Number(commitment.dailyAmount),
        commitment.streakDays,
      );
    }

    if (commitment.streakDays < UPGRADE_STREAK_THRESHOLD) {
      return this.ineligible(
        `Need ${UPGRADE_STREAK_THRESHOLD} days of consistency (currently ${commitment.streakDays})`,
        Number(commitment.dailyAmount),
        commitment.streakDays,
      );
    }

    // Get user's active goals
    const goals = await this.prisma.goal.findMany({
      where: { userId, status: GoalStatus.ACTIVE },
      select: { id: true, name: true, targetAmount: true },
      orderBy: { priority: 'desc' },
    });

    if (goals.length === 0) {
      return this.ineligible(
        'No active goals to create a commitment for',
        Number(commitment.dailyAmount),
        commitment.streakDays,
      );
    }

    const dailyAmount = Number(commitment.dailyAmount);
    const suggestedAmount = Math.round(dailyAmount * STAKE_DAILY_MULTIPLIER);

    // Suggest stake type based on amount: small amounts → SOCIAL, larger → ANTI_CHARITY
    const suggestedStakeType: 'SOCIAL' | 'ANTI_CHARITY' | 'LOSS_POOL' =
      suggestedAmount < COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT
        ? 'SOCIAL'
        : suggestedAmount > COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT * 5
          ? 'ANTI_CHARITY'
          : 'LOSS_POOL';

    return {
      eligible: true,
      reason: `${commitment.streakDays}-day streak! You've proven consistency. Ready for real stakes?`,
      suggestedStakeType,
      suggestedAmount: Math.max(suggestedAmount, COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT),
      dailyAmount,
      streakDays: commitment.streakDays,
      linkedGoals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: Number(g.targetAmount),
      })),
    };
  }

  /**
   * Upgrade a micro-commitment to a full staked contract.
   *
   * Flow:
   * 1. Verify eligibility
   * 2. Create CommitmentContract via CommitmentService
   * 3. Link micro-commitment to contract via upgradedToContractId
   * 4. Log Opik feedback for commitment_conversion
   */
  async upgradeToContract(
    userId: string,
    microCommitmentId: string,
    input: {
      goalId: string;
      stakeType: string;
      stakeAmount?: number;
      antiCharityCause?: string;
      antiCharityUrl?: string;
      verificationMethod: string;
      deadline: string;
      refereeEmail?: string;
      refereeName?: string;
      refereeRelationship?: string;
    },
  ): Promise<{ contractId: string; message: string }> {
    const trace = this.opikService.createTrace({
      name: 'commitment_upgrade',
      input: { userId, microCommitmentId, goalId: input.goalId },
      metadata: { operation: 'upgradeToContract' },
      tags: ['commitment', 'upgrade', 'conversion'],
    });

    try {
      // Verify eligibility
      const eligibility = await this.checkUpgradeEligibility(userId, microCommitmentId);
      if (!eligibility.eligible) {
        throw new Error(`Not eligible for upgrade: ${eligibility.reason}`);
      }

      // Create the full contract
      const { commitment: contract } = await this.commitmentService.createCommitment(userId, {
        goalId: input.goalId,
        stakeType: input.stakeType as StakeType,
        stakeAmount: input.stakeAmount,
        antiCharityCause: input.antiCharityCause,
        antiCharityUrl: input.antiCharityUrl,
        verificationMethod: input.verificationMethod as VerificationMethod,
        deadline: new Date(input.deadline),
        refereeEmail: input.refereeEmail,
        refereeName: input.refereeName,
        refereeRelationship: input.refereeRelationship as RefereeRelationship | undefined,
      });

      // Link the micro-commitment to the new contract
      await this.prisma.futureSelfCommitment.update({
        where: { id: microCommitmentId },
        data: { upgradedToContractId: contract.id },
      });

      // Log Opik feedback for conversion tracking
      if (trace) {
        try {
          this.opikService.addFeedback({
            traceId: trace.traceId,
            name: 'commitment_conversion',
            value: 1,
            category: 'engagement',
            comment: `Upgraded from ${eligibility.streakDays}-day streak to ${input.stakeType} contract`,
            source: 'system',
          });
        } catch {
          // Feedback is best-effort
        }
      }

      if (trace) this.opikService.endTrace(trace, {
        success: true,
        result: {
          contractId: contract.id,
          stakeType: input.stakeType,
          streakDays: eligibility.streakDays,
        },
      });

      this.logger.log(
        `[upgradeToContract] Upgraded micro-commitment ${microCommitmentId} to contract ${contract.id}`,
      );

      return {
        contractId: contract.id,
        message: `Your ${eligibility.streakDays}-day streak earned you a real commitment contract! Stakes are now active.`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (trace) this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[upgradeToContract] Failed: ${errorMessage}`);
      throw error;
    }
  }

  private ineligible(
    reason: string,
    dailyAmount: number,
    streakDays: number,
  ): UpgradeEligibility {
    return {
      eligible: false,
      reason,
      suggestedStakeType: 'SOCIAL',
      suggestedAmount: 0,
      dailyAmount,
      streakDays,
      linkedGoals: [],
    };
  }
}
