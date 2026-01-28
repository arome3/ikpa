/**
 * Intervention Success Metric
 *
 * Binary metric (0/1) that measures whether the user saved instead of spent
 * after receiving an IKPA intervention.
 *
 * This metric doesn't require LLM calls - it simply checks the user's
 * recorded action in the dataset context.
 *
 * @example
 * ```typescript
 * const metric = new InterventionSuccessMetric();
 *
 * // User saved
 * const result = await metric.score(
 *   { input: 'I want to buy a new phone', output: '', context: { userAction: 'saved' } },
 *   'Consider waiting 48 hours before making this purchase.'
 * );
 * // result: { score: 1, reason: 'User chose to save instead of spend' }
 *
 * // User spent
 * const result = await metric.score(
 *   { input: 'I want to buy a new phone', output: '', context: { userAction: 'spent' } },
 *   'Consider waiting 48 hours before making this purchase.'
 * );
 * // result: { score: 0, reason: 'User proceeded with spending' }
 * ```
 */

import { Injectable } from '@nestjs/common';
import { BaseMetric } from './base.metric';
import { DatasetItem, MetricResult } from './interfaces';
import { METRIC_INTERVENTION_SUCCESS } from './metrics.constants';

@Injectable()
export class InterventionSuccessMetric extends BaseMetric {
  readonly name = METRIC_INTERVENTION_SUCCESS;
  readonly description = 'Measures whether user saved instead of spent after intervention';

  /**
   * Evaluate intervention success based on user action
   *
   * @param datasetItem - Contains userAction in context
   * @param _llmOutput - Not used for this metric
   * @returns Score of 1 if saved, 0 if spent or unknown
   */
  async score(datasetItem: DatasetItem, _llmOutput: string): Promise<MetricResult> {
    const userAction = datasetItem.context?.userAction ?? datasetItem.userAction;

    // No action recorded
    if (!userAction) {
      return {
        score: 0,
        reason: 'No user action recorded',
        metadata: {
          hasAction: false,
        },
      };
    }

    // User saved - intervention successful
    if (userAction === 'saved') {
      return {
        score: 1,
        reason: 'User chose to save instead of spend',
        metadata: {
          action: 'saved',
          interventionSuccessful: true,
        },
      };
    }

    // User spent - intervention not successful
    return {
      score: 0,
      reason: 'User proceeded with spending',
      metadata: {
        action: 'spent',
        interventionSuccessful: false,
      },
    };
  }
}
