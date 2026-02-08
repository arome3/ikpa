/**
 * Streak Service
 *
 * Tracks consecutive commitment successes and manages trust bonus eligibility.
 * 3+ consecutive successes = 10% trust bonus on LOSS_POOL stakes.
 *
 * Tier interaction:
 * - GOLD (100%) increments streak
 * - SILVER/BRONZE (partial) neither increments nor resets
 * - NONE (full failure) resets streak to 0
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const TRUST_BONUS_THRESHOLD = 3;
const TRUST_BONUS_RATE = 10; // 10% bonus

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create a streak record for a user
   */
  async getOrCreateStreak(userId: string) {
    let streak = await this.prisma.commitmentStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      streak = await this.prisma.commitmentStreak.create({
        data: { userId },
      });
    }

    return streak;
  }

  /**
   * Update streak after commitment resolution
   * @param succeeded - true for GOLD tier, false for NONE tier. null for SILVER/BRONZE (no change)
   */
  async updateStreak(
    userId: string,
    succeeded: boolean | null,
  ): Promise<{ currentStreak: number; bonusEligible: boolean }> {
    const streak = await this.getOrCreateStreak(userId);

    // SILVER/BRONZE: no change to streak
    if (succeeded === null) {
      return {
        currentStreak: streak.currentStreak,
        bonusEligible: streak.currentStreak >= TRUST_BONUS_THRESHOLD,
      };
    }

    if (succeeded) {
      const newCurrent = streak.currentStreak + 1;
      const newLongest = Math.max(streak.longestStreak, newCurrent);
      const newRate = newCurrent >= TRUST_BONUS_THRESHOLD ? TRUST_BONUS_RATE : 0;

      await this.prisma.commitmentStreak.update({
        where: { userId },
        data: {
          currentStreak: newCurrent,
          longestStreak: newLongest,
          lastSucceededAt: new Date(),
          trustBonusRate: newRate,
        },
      });

      this.logger.log(`[updateStreak] User ${userId}: streak ${newCurrent}, bonus ${newRate}%`);

      return {
        currentStreak: newCurrent,
        bonusEligible: newCurrent >= TRUST_BONUS_THRESHOLD,
      };
    } else {
      // Full failure resets streak
      await this.prisma.commitmentStreak.update({
        where: { userId },
        data: {
          currentStreak: 0,
          trustBonusRate: 0,
        },
      });

      this.logger.log(`[updateStreak] User ${userId}: streak reset to 0`);

      return { currentStreak: 0, bonusEligible: false };
    }
  }

  /**
   * Calculate trust bonus for a new commitment
   */
  async calculateTrustBonus(
    userId: string,
    stakeAmount: number,
  ): Promise<{ eligible: boolean; bonusAmount: number; bonusRate: number }> {
    const streak = await this.getOrCreateStreak(userId);

    if (streak.currentStreak >= TRUST_BONUS_THRESHOLD) {
      const bonusRate = Number(streak.trustBonusRate) || TRUST_BONUS_RATE;
      const bonusAmount = Math.floor((stakeAmount * bonusRate) / 100);
      return { eligible: true, bonusAmount, bonusRate };
    }

    return { eligible: false, bonusAmount: 0, bonusRate: 0 };
  }
}
