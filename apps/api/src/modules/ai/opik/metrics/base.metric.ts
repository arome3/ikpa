/**
 * Base Metric Classes
 *
 * Abstract base classes for implementing evaluation metrics.
 *
 * @example
 * ```typescript
 * // Rule-based metric (no LLM)
 * class MyRuleMetric extends BaseMetric {
 *   readonly name = 'MyRule';
 *   readonly description = 'Checks something with rules';
 *
 *   async score(datasetItem, llmOutput) {
 *     return { score: checkRule(llmOutput) ? 1 : 0, reason: '...' };
 *   }
 * }
 *
 * // LLM-as-judge metric
 * class MyGEvalMetric extends GEvalMetric {
 *   readonly name = 'MyGEval';
 *   readonly description = 'Uses LLM to evaluate';
 *   readonly scale = 5;
 *
 *   async score(datasetItem, llmOutput) {
 *     const result = await this.callLLM(prompt);
 *     return { score: result.score, reason: result.reason };
 *   }
 * }
 * ```
 */

import { IMetric, IGEvalMetric, MetricResult, DatasetItem } from './interfaces';

/**
 * Abstract base class for all metrics
 *
 * Provides the common interface for rule-based metrics that don't require
 * LLM calls. Use for fast checks like pattern matching, keyword detection, etc.
 */
export abstract class BaseMetric implements IMetric {
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Evaluate the LLM output
   *
   * @param datasetItem - Input context and expected output
   * @param llmOutput - The LLM response to evaluate
   * @returns MetricResult with score and reason
   */
  abstract score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult>;

  /**
   * Get metric metadata for logging
   */
  getMetadata(): Record<string, unknown> {
    return {
      name: this.name,
      description: this.description,
      type: 'base',
    };
  }
}

/**
 * Abstract base class for G-Eval (LLM-as-judge) metrics
 *
 * Extends BaseMetric with a scale property for LLM-based evaluations.
 * G-Eval metrics use Claude to evaluate responses on a numeric scale.
 */
export abstract class GEvalMetric extends BaseMetric implements IGEvalMetric {
  /** Scale for the metric (e.g., 5 for 1-5 scale) */
  abstract readonly scale: number;

  /**
   * Get metric metadata including scale
   */
  override getMetadata(): Record<string, unknown> {
    return {
      ...super.getMetadata(),
      type: 'g-eval',
      scale: this.scale,
    };
  }

  /**
   * Normalize score to 0-1 range
   * Useful for aggregating scores across different scales
   *
   * @param score - Raw score on the metric's scale
   * @returns Normalized score between 0 and 1
   */
  normalizeScore(score: number): number {
    return (score - 1) / (this.scale - 1);
  }

  /**
   * Get default/neutral score for error cases
   * Returns middle of the scale with appropriate metadata
   */
  getDefaultResult(reason: string): MetricResult {
    const midpoint = Math.ceil(this.scale / 2);
    return {
      score: midpoint,
      reason,
      metadata: { isDefault: true },
    };
  }
}

/**
 * Helper to safely parse JSON from LLM response
 *
 * @param content - LLM response content
 * @param fallbackScore - Score to return if parsing fails
 * @returns Parsed result or fallback
 */
export function parseEvaluationResponse(
  content: string,
  fallbackScore: number,
): { score: number; reason: string } {
  try {
    // Try to find JSON in the response (may be wrapped in markdown)
    const jsonMatch = content.match(/\{[\s\S]*"score"[\s\S]*"reason"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: typeof parsed.score === 'number' ? parsed.score : fallbackScore,
        reason: typeof parsed.reason === 'string' ? parsed.reason : 'Unable to extract reason',
      };
    }

    // Try direct parse
    const parsed = JSON.parse(content);
    return {
      score: typeof parsed.score === 'number' ? parsed.score : fallbackScore,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'Unable to extract reason',
    };
  } catch {
    return {
      score: fallbackScore,
      reason: `Failed to parse evaluation response: ${content.substring(0, 100)}...`,
    };
  }
}
