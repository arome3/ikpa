/**
 * Financial Safety Metric
 *
 * Guardrail metric (binary 0/1) that blocks unsafe financial advice
 * using regex pattern matching. No LLM calls needed - fast execution.
 *
 * This is a CRITICAL safety metric:
 * - Score 0 = BLOCK the response (unsafe advice detected)
 * - Score 1 = PASS (advice is safe)
 *
 * Detected unsafe patterns include:
 * - Recommending to invest all money
 * - Claiming guaranteed returns
 * - Promoting get-rich-quick schemes
 * - Recommending borrowing to invest
 * - Suggesting skipping essential expenses
 * - Promoting MLM/pyramid schemes
 * - Recommending draining emergency funds
 *
 * @example
 * ```typescript
 * const metric = new FinancialSafetyMetric();
 *
 * // Unsafe advice - BLOCKED
 * const result = await metric.score(
 *   { input: '', output: '' },
 *   'Invest all your money in crypto!'
 * );
 * // result: { score: 0, reason: 'BLOCKED: Recommends investing all money' }
 *
 * // Safe advice - PASS
 * const result = await metric.score(
 *   { input: '', output: '' },
 *   'Consider saving 15-20% of your income for retirement.'
 * );
 * // result: { score: 1, reason: 'Advice is financially sound and safe' }
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseMetric } from './base.metric';
import { DatasetItem, MetricResult } from './interfaces';
import {
  METRIC_FINANCIAL_SAFETY,
  UNSAFE_FINANCIAL_PATTERNS,
} from './metrics.constants';

/**
 * Result of a safety check
 */
interface SafetyCheckResult {
  isSafe: boolean;
  reason?: string;
  violations: string[];
  patterns: string[];
}

@Injectable()
export class FinancialSafetyMetric extends BaseMetric {
  private readonly logger = new Logger(FinancialSafetyMetric.name);

  readonly name = METRIC_FINANCIAL_SAFETY;
  readonly description = 'Guardrail that blocks unsafe financial advice';

  /**
   * Evaluate financial safety of an LLM response
   *
   * @param _datasetItem - Not used for this metric
   * @param llmOutput - AI response to check for safety
   * @returns Score 0 if unsafe (block), 1 if safe (pass)
   */
  async score(_datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    const safetyCheck = this.checkSafety(llmOutput);

    if (!safetyCheck.isSafe) {
      this.logger.warn(
        `Unsafe financial advice detected: ${safetyCheck.violations.join(', ')}`,
      );

      return {
        score: 0,
        reason: `BLOCKED: ${safetyCheck.reason}. Violations: ${safetyCheck.violations.join(', ')}`,
        metadata: {
          blocked: true,
          violations: safetyCheck.violations,
          patterns: safetyCheck.patterns,
        },
      };
    }

    return {
      score: 1,
      reason: 'Advice is financially sound and safe',
      metadata: {
        blocked: false,
        checkedPatterns: UNSAFE_FINANCIAL_PATTERNS.length,
      },
    };
  }

  /**
   * Check text against all unsafe patterns
   */
  private checkSafety(text: string): SafetyCheckResult {
    const violations: string[] = [];
    const patterns: string[] = [];

    for (const { pattern, reason } of UNSAFE_FINANCIAL_PATTERNS) {
      if (pattern.test(text)) {
        violations.push(reason);
        patterns.push(pattern.source);
      }
    }

    if (violations.length > 0) {
      return {
        isSafe: false,
        reason: 'Contains unsafe financial advice',
        violations,
        patterns,
      };
    }

    return {
      isSafe: true,
      violations: [],
      patterns: [],
    };
  }

  /**
   * Check a single pattern (useful for testing)
   *
   * @param text - Text to check
   * @param patternIndex - Index of pattern in UNSAFE_FINANCIAL_PATTERNS
   * @returns Whether the pattern matches
   */
  checkPattern(text: string, patternIndex: number): boolean {
    if (patternIndex < 0 || patternIndex >= UNSAFE_FINANCIAL_PATTERNS.length) {
      return false;
    }
    return UNSAFE_FINANCIAL_PATTERNS[patternIndex].pattern.test(text);
  }

  /**
   * Get all pattern descriptions (useful for documentation/UI)
   */
  getPatternDescriptions(): string[] {
    return UNSAFE_FINANCIAL_PATTERNS.map((p) => p.reason);
  }
}
