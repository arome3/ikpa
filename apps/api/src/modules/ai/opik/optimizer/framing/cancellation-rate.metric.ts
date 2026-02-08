/**
 * Cancellation Rate Metric
 *
 * Evaluates subscription cancellation decisions for A/B testing
 * the Shark Auditor framing (Monthly vs Annualized).
 *
 * This metric measures the rate at which the AI recommends cancellation
 * for zombie/unused subscriptions, which is the desired behavior.
 *
 * Higher score = more cancellations = better (for identifying zombie subscriptions)
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseMetric, MetricResult, DatasetItem } from '../../metrics';
import { AnthropicService } from '../../../anthropic';

/** Regular expressions to detect cancellation recommendations */
const CANCEL_PATTERNS = [
  /\bcancel\b/i,
  /\brecommend.*cancell?(?:ing|ation)\b/i,
  /\bshould.*cancel\b/i,
  /\bstop.*paying\b/i,
  /\bunsubscribe\b/i,
  /\bdiscontinue\b/i,
  /\bterminate.*subscription\b/i,
  /\bget.*rid.*of\b/i,
  /\bdon'?t.*keep\b/i,
  /\bnot.*worth\b/i,
];

/** Regular expressions to detect keep recommendations */
const KEEP_PATTERNS = [
  /\bkeep\b/i,
  /\bmaintain\b/i,
  /\bcontinue.*paying\b/i,
  /\bworth.*it\b/i,
  /\bvaluable\b/i,
  /\brecommend.*keeping\b/i,
  /\bshould.*keep\b/i,
];

@Injectable()
export class CancellationRateMetric extends BaseMetric {
  private readonly logger = new Logger(CancellationRateMetric.name);

  readonly name = 'CancellationRate';
  readonly description = 'Measures the rate of subscription cancellation recommendations';

  constructor(private readonly anthropicService: AnthropicService) {
    super();
  }

  /**
   * Score the LLM output for cancellation recommendation
   *
   * @param datasetItem - Input context with subscription details
   * @param llmOutput - LLM response to evaluate
   * @returns Score: 1 = cancel recommended, 0 = keep recommended, 0.5 = unclear
   */
  async score(_datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    const normalizedOutput = llmOutput.toLowerCase().trim();

    // Check for cancel patterns
    const cancelMatches = CANCEL_PATTERNS.filter((pattern) => pattern.test(normalizedOutput));
    const keepMatches = KEEP_PATTERNS.filter((pattern) => pattern.test(normalizedOutput));

    const cancelScore = cancelMatches.length;
    const keepScore = keepMatches.length;

    // Determine decision based on pattern matches
    if (cancelScore > keepScore) {
      return {
        score: 1,
        reason: `Cancellation recommended (${cancelScore} cancel signals, ${keepScore} keep signals)`,
        metadata: {
          cancelPatterns: cancelMatches.map((p) => p.source),
          keepPatterns: keepMatches.map((p) => p.source),
          decision: 'cancel',
        },
      };
    } else if (keepScore > cancelScore) {
      return {
        score: 0,
        reason: `Keep recommended (${keepScore} keep signals, ${cancelScore} cancel signals)`,
        metadata: {
          cancelPatterns: cancelMatches.map((p) => p.source),
          keepPatterns: keepMatches.map((p) => p.source),
          decision: 'keep',
        },
      };
    }

    // If unclear, use LLM to classify (only if AI service is available)
    if (this.anthropicService.isAvailable() && cancelScore === 0 && keepScore === 0) {
      try {
        const classification = await this.classifyWithLLM(llmOutput);
        return classification;
      } catch (error) {
        this.logger.warn(
          `LLM classification failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // Unclear/neutral response
    return {
      score: 0.5,
      reason: `Unclear recommendation (${cancelScore} cancel signals, ${keepScore} keep signals)`,
      metadata: {
        cancelPatterns: cancelMatches.map((p) => p.source),
        keepPatterns: keepMatches.map((p) => p.source),
        decision: 'unclear',
      },
    };
  }

  /**
   * Use LLM to classify ambiguous responses
   */
  private async classifyWithLLM(response: string): Promise<MetricResult> {
    const prompt = `Analyze this subscription review response and determine if it recommends CANCEL or KEEP.

Response to analyze:
"${response.substring(0, 500)}"

Reply with ONLY one word: CANCEL or KEEP`;

    const result = await this.anthropicService.generate(prompt, 10, 'You are a classifier.');
    const classification = result.content.trim().toUpperCase();

    if (classification === 'CANCEL') {
      return {
        score: 1,
        reason: 'LLM classified as cancellation recommendation',
        metadata: { decision: 'cancel', classifiedByLLM: true },
      };
    } else if (classification === 'KEEP') {
      return {
        score: 0,
        reason: 'LLM classified as keep recommendation',
        metadata: { decision: 'keep', classifiedByLLM: true },
      };
    }

    return {
      score: 0.5,
      reason: 'Could not determine recommendation',
      metadata: { decision: 'unclear', classifiedByLLM: true },
    };
  }

  /**
   * Calculate aggregate cancellation rate from multiple scores
   *
   * @param scores - Array of individual scores
   * @returns Cancellation rate (0-1)
   */
  static calculateCancellationRate(scores: number[]): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }
}
