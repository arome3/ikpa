/**
 * Zombie Detector Calculator
 *
 * Analyzes subscription usage patterns to identify "zombie" subscriptions -
 * services the user is paying for but no longer actively using.
 *
 * @module ZombieDetectorCalculator
 */

import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { Subscription } from '../interfaces';
import { ZOMBIE_THRESHOLD_DAYS } from '../constants';

/**
 * Result of zombie analysis for a single subscription
 */
export interface ZombieAnalysisResult {
  id: string;
  status: SubscriptionStatus;
  daysSinceLastUsage: number | null;
  isZombie: boolean;
}

/**
 * Calculator for detecting zombie (unused) subscriptions
 *
 * Analyzes usage patterns to identify subscriptions that haven't
 * been used within the zombie threshold period (default: 90 days).
 */
@Injectable()
export class ZombieDetectorCalculator {
  private readonly logger = new Logger(ZombieDetectorCalculator.name);

  /**
   * Analyze subscriptions to detect zombies
   *
   * A zombie subscription is one that:
   * - Has no usage in the last 90 days (configurable)
   * - Continues to charge the user
   *
   * @param userId - User ID for tracing
   * @param subscriptions - Subscriptions to analyze
   * @returns Analysis results with updated status and usage info
   *
   * @example
   * ```typescript
   * const results = await zombieDetector.analyze(userId, subscriptions);
   * // Returns: [{ id: 'sub-1', status: 'ZOMBIE', daysSinceLastUsage: 120 }]
   * ```
   */
  async analyze(
    userId: string,
    subscriptions: Subscription[],
  ): Promise<ZombieAnalysisResult[]> {
    this.logger.debug(
      `Analyzing ${subscriptions.length} subscriptions for zombies (user: ${userId})`,
    );

    const results: ZombieAnalysisResult[] = [];
    let zombieCount = 0;

    for (const subscription of subscriptions) {
      // Skip already cancelled subscriptions
      if (subscription.status === SubscriptionStatus.CANCELLED) {
        results.push({
          id: subscription.id,
          status: SubscriptionStatus.CANCELLED,
          daysSinceLastUsage: this.calculateDaysSinceLastUsage(
            subscription.lastUsageDate,
          ),
          isZombie: false,
        });
        continue;
      }

      // Calculate days since last usage
      const daysSinceLastUsage = this.calculateDaysSinceLastUsage(
        subscription.lastUsageDate,
      );

      // Determine status based on usage
      const status = this.determineStatus(
        subscription.lastUsageDate,
        subscription.lastChargeDate,
      );

      const isZombie = status === SubscriptionStatus.ZOMBIE;
      if (isZombie) {
        zombieCount++;
      }

      results.push({
        id: subscription.id,
        status,
        daysSinceLastUsage,
        isZombie,
      });

      this.logger.debug(
        `Subscription ${subscription.id} (${subscription.name}): ` +
          `status=${status}, daysSinceUsage=${daysSinceLastUsage ?? 'unknown'}`,
      );
    }

    this.logger.log(
      `Zombie analysis complete: ${zombieCount}/${subscriptions.length} zombies detected`,
    );

    return results;
  }

  /**
   * Calculate days since last usage
   *
   * @param lastUsageDate - Date of last usage (null if unknown)
   * @returns Days since last usage, or null if unknown
   */
  calculateDaysSinceLastUsage(lastUsageDate: Date | null): number | null {
    if (!lastUsageDate) {
      return null;
    }

    const now = new Date();
    const diffMs = now.getTime() - lastUsageDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Determine subscription status based on usage patterns
   *
   * @param lastUsageDate - Date of last usage
   * @param lastChargeDate - Date of last charge
   * @returns Determined status
   */
  determineStatus(
    lastUsageDate: Date | null,
    lastChargeDate: Date | null,
  ): SubscriptionStatus {
    // If we don't have usage data, status is unknown
    if (!lastUsageDate) {
      // If we have recent charges but no usage data, it's suspicious
      if (lastChargeDate) {
        const daysSinceCharge = this.calculateDaysSinceLastUsage(lastChargeDate);
        if (daysSinceCharge !== null && daysSinceCharge < 60) {
          // Recent charge but no usage data - mark as unknown
          return SubscriptionStatus.UNKNOWN;
        }
      }
      return SubscriptionStatus.UNKNOWN;
    }

    // Calculate days since last usage
    const daysSinceUsage = this.calculateDaysSinceLastUsage(lastUsageDate);

    if (daysSinceUsage === null) {
      return SubscriptionStatus.UNKNOWN;
    }

    // Zombie if unused for longer than threshold
    if (daysSinceUsage > ZOMBIE_THRESHOLD_DAYS) {
      return SubscriptionStatus.ZOMBIE;
    }

    // Active if used within threshold
    return SubscriptionStatus.ACTIVE;
  }

  /**
   * Calculate zombie detection metrics
   *
   * @param results - Analysis results
   * @returns Metrics for Opik tracking
   */
  calculateMetrics(results: ZombieAnalysisResult[]): {
    totalAnalyzed: number;
    zombieCount: number;
    activeCount: number;
    unknownCount: number;
    zombieRate: number;
  } {
    const totalAnalyzed = results.length;
    const zombieCount = results.filter((r) => r.isZombie).length;
    const activeCount = results.filter(
      (r) => r.status === SubscriptionStatus.ACTIVE,
    ).length;
    const unknownCount = results.filter(
      (r) => r.status === SubscriptionStatus.UNKNOWN,
    ).length;
    const zombieRate = totalAnalyzed > 0 ? zombieCount / totalAnalyzed : 0;

    return {
      totalAnalyzed,
      zombieCount,
      activeCount,
      unknownCount,
      zombieRate,
    };
  }

  /**
   * Get zombie threshold in days
   *
   * @returns The number of days of inactivity that qualifies as "zombie"
   */
  getZombieThresholdDays(): number {
    return ZOMBIE_THRESHOLD_DAYS;
  }
}
