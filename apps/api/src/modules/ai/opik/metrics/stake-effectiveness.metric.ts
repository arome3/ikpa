/**
 * Stake Effectiveness Metric
 *
 * Weighted score metric (0-1) that measures goal completion rate
 * by stake type, normalized by expected success rates.
 *
 * The score rewards goal completion more when using less effective
 * stake types (beating the odds) and provides context for expected
 * vs actual performance.
 *
 * Expected success rates by stake type:
 * - anti_charity: 85% (highest - money goes to disliked cause)
 * - social: 78% (moderate - public accountability)
 * - loss_pool: 72% (good - shared loss pool)
 * - none: 35% (baseline - no commitment device)
 *
 * @example
 * ```typescript
 * const metric = new StakeEffectivenessMetric();
 *
 * // Goal achieved with social stake
 * const result = await metric.score(
 *   { input: '', output: '', context: { stakeType: 'social', goalCompleted: true } },
 *   ''
 * );
 * // result: { score: 1.0, reason: 'Goal achieved with social stake (expected rate: 78%)' }
 *
 * // Goal achieved with no stake (beats the odds)
 * const result = await metric.score(
 *   { input: '', output: '', context: { stakeType: 'none', goalCompleted: true } },
 *   ''
 * );
 * // result: { score: 1.0, reason: 'Goal achieved with none stake (expected rate: 35%)' }
 * // Note: Raw score would be 2.86 but capped at 1.0
 * ```
 */

import { Injectable } from '@nestjs/common';
import { BaseMetric } from './base.metric';
import { DatasetItem, MetricResult } from './interfaces';
import {
  METRIC_STAKE_EFFECTIVENESS,
  STAKE_SUCCESS_RATES,
} from './metrics.constants';

@Injectable()
export class StakeEffectivenessMetric extends BaseMetric {
  readonly name = METRIC_STAKE_EFFECTIVENESS;
  readonly description = 'Measures goal completion rate by stake type';

  /**
   * Evaluate stake effectiveness based on goal completion
   *
   * @param datasetItem - Contains stakeType and goalCompleted in context
   * @param _llmOutput - Not used for this metric
   * @returns Weighted score 0-1
   */
  async score(datasetItem: DatasetItem, _llmOutput: string): Promise<MetricResult> {
    const context = datasetItem.context;

    // Validate required context
    if (!context?.stakeType) {
      return {
        score: 0,
        reason: 'Missing stake type in context',
        metadata: {
          hasStakeType: false,
          hasGoalCompleted: context?.goalCompleted !== undefined,
        },
      };
    }

    if (context.goalCompleted === undefined) {
      return {
        score: 0,
        reason: 'Missing goal completion data in context',
        metadata: {
          hasStakeType: true,
          stakeType: context.stakeType,
          hasGoalCompleted: false,
        },
      };
    }

    const stakeType = context.stakeType as string;
    const goalCompleted = Boolean(context.goalCompleted);

    // Get expected success rate (default to 'none' if unknown stake type)
    const expectedRate = STAKE_SUCCESS_RATES[stakeType] ?? STAKE_SUCCESS_RATES.none;
    const actualSuccess = goalCompleted ? 1.0 : 0.0;

    // Calculate weighted score
    // If goal achieved, score is inversely proportional to expected rate
    // (harder to achieve = higher relative score)
    const rawScore = actualSuccess * (1 / expectedRate);
    const score = Math.min(1.0, rawScore); // Cap at 1.0

    if (goalCompleted) {
      return {
        score,
        reason: `Goal achieved with ${stakeType} stake (expected rate: ${Math.round(expectedRate * 100)}%)`,
        metadata: {
          stakeType,
          goalCompleted: true,
          expectedRate,
          rawScore,
          cappedAt1: rawScore > 1,
        },
      };
    }

    return {
      score: 0,
      reason: `Goal not achieved with ${stakeType} stake`,
      metadata: {
        stakeType,
        goalCompleted: false,
        expectedRate,
      },
    };
  }

  /**
   * Get expected success rate for a stake type
   *
   * @param stakeType - Type of stake
   * @returns Expected success rate (0-1)
   */
  getExpectedRate(stakeType: string): number {
    return STAKE_SUCCESS_RATES[stakeType] ?? STAKE_SUCCESS_RATES.none;
  }

  /**
   * Get all stake types and their expected rates
   */
  getAllExpectedRates(): Record<string, number> {
    return { ...STAKE_SUCCESS_RATES };
  }
}
