/**
 * Metrics Service
 *
 * Orchestrates multi-metric evaluation with Opik tracing integration.
 * Runs evaluations in parallel where possible with graceful degradation.
 *
 * Features:
 * - Runs multiple metrics in parallel
 * - Creates Opik spans for each evaluation
 * - Adds feedback scores to traces
 * - Selective metric execution via options
 * - Safety metric blocking (FinancialSafety)
 * - A/B testing support for different criteria
 * - Batch evaluation with rate limiting
 *
 * @example
 * ```typescript
 * // Evaluate a response with all metrics
 * const result = await metricsService.evaluate(
 *   { input: 'I want to buy a phone', output: '', context: { userAction: 'saved' } },
 *   'Consider waiting 48 hours...',
 *   { metrics: ['all'] },
 *   trace
 * );
 *
 * // Evaluate with specific metrics
 * const result = await metricsService.evaluate(
 *   datasetItem,
 *   llmOutput,
 *   { metrics: ['ToneEmpathy', 'FinancialSafety'] },
 *   trace
 * );
 *
 * // Batch evaluation
 * const results = await metricsService.evaluateBatch(
 *   datasetItems,
 *   llmOutputs,
 *   { metrics: ['all'], concurrency: 5 }
 * );
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { OpikService } from '../opik.service';
import { TrackedTrace, TrackedSpan } from '../interfaces';
import { InterventionSuccessMetric } from './intervention-success.metric';
import { ToneEmpathyMetric } from './tone-empathy.metric';
import { CulturalSensitivityMetric } from './cultural-sensitivity.metric';
import { FinancialSafetyMetric } from './financial-safety.metric';
import { StakeEffectivenessMetric } from './stake-effectiveness.metric';
import { DatasetItem, MetricResult, IMetric } from './interfaces';
import { llmSemaphore } from './metrics.utils';
import { ABTestManager, ABTestVariant } from './ab-testing';
import {
  METRIC_INTERVENTION_SUCCESS,
  METRIC_TONE_EMPATHY,
  METRIC_CULTURAL_SENSITIVITY,
  METRIC_FINANCIAL_SAFETY,
  METRIC_STAKE_EFFECTIVENESS,
  SPAN_EVAL_METRICS,
  SPAN_EVAL_INTERVENTION_SUCCESS,
  SPAN_EVAL_TONE_EMPATHY,
  SPAN_EVAL_CULTURAL_SENSITIVITY,
  SPAN_EVAL_FINANCIAL_SAFETY,
  SPAN_EVAL_STAKE_EFFECTIVENESS,
  FEEDBACK_INTERVENTION_SUCCESS,
  FEEDBACK_TONE_EMPATHY,
  FEEDBACK_CULTURAL_SENSITIVITY,
  FEEDBACK_FINANCIAL_SAFETY,
  FEEDBACK_STAKE_EFFECTIVENESS,
} from './metrics.constants';

/**
 * Options for metric evaluation
 */
export interface EvaluationOptions {
  /**
   * Which metrics to run.
   * - 'all': Run all metrics
   * - Array of metric names: Run only specified metrics
   */
  metrics: 'all' | string[];

  /**
   * Whether to create Opik spans for evaluations
   * @default true
   */
  createSpans?: boolean;

  /**
   * Whether to add feedback to the trace
   * @default true
   */
  addFeedback?: boolean;

  /**
   * Whether to throw if safety metric fails
   * @default false
   */
  throwOnUnsafe?: boolean;

  /**
   * A/B test ID to route evaluation to different criteria
   * Used with ABTestManager to select variant
   */
  abTestId?: string;

  /**
   * Identifier for A/B test variant selection (e.g., user ID, trace ID)
   * Required if abTestId is provided
   */
  abTestIdentifier?: string;
}

/**
 * Options for batch evaluation
 */
export interface BatchEvaluationOptions extends Omit<EvaluationOptions, 'abTestIdentifier'> {
  /**
   * Maximum concurrent evaluations
   * Respects the global semaphore limit
   * @default 5
   */
  concurrency?: number;
}

/**
 * Result of a single batch evaluation item
 */
export interface BatchEvaluationResult {
  /** Index of this item in the original array */
  index: number;

  /** Whether evaluation succeeded */
  success: boolean;

  /** Evaluation result if successful */
  result?: EvaluationResult;

  /** Error message if failed */
  error?: string;
}

/**
 * Result of multi-metric evaluation
 */
export interface EvaluationResult {
  /** Whether all metrics passed (safety metrics can cause failure) */
  success: boolean;

  /** Individual metric results */
  results: Record<string, MetricResult>;

  /** Aggregated scores for dashboard */
  aggregated: {
    /** Average normalized score across all metrics */
    averageScore: number;
    /** Number of metrics that passed */
    passCount: number;
    /** Number of metrics that failed/blocked */
    failCount: number;
    /** Total metrics evaluated */
    totalCount: number;
  };

  /** If blocked by safety metric, the reason */
  blockedReason?: string;
}

/**
 * Metric with its configuration
 */
interface MetricConfig {
  metric: IMetric;
  spanName: string;
  feedbackName: string;
  isBlocker: boolean;
  normalizeScale?: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly metricConfigs: Map<string, MetricConfig>;
  private readonly abTestManager: ABTestManager;

  constructor(
    private readonly opikService: OpikService,
    private readonly interventionSuccessMetric: InterventionSuccessMetric,
    private readonly toneEmpathyMetric: ToneEmpathyMetric,
    private readonly culturalSensitivityMetric: CulturalSensitivityMetric,
    private readonly financialSafetyMetric: FinancialSafetyMetric,
    private readonly stakeEffectivenessMetric: StakeEffectivenessMetric,
  ) {
    // Initialize A/B test manager
    this.abTestManager = new ABTestManager();
    // Initialize metric configurations
    this.metricConfigs = new Map([
      [
        METRIC_INTERVENTION_SUCCESS,
        {
          metric: this.interventionSuccessMetric,
          spanName: SPAN_EVAL_INTERVENTION_SUCCESS,
          feedbackName: FEEDBACK_INTERVENTION_SUCCESS,
          isBlocker: false,
          normalizeScale: 1, // Already 0-1
        },
      ],
      [
        METRIC_TONE_EMPATHY,
        {
          metric: this.toneEmpathyMetric,
          spanName: SPAN_EVAL_TONE_EMPATHY,
          feedbackName: FEEDBACK_TONE_EMPATHY,
          isBlocker: false,
          normalizeScale: 5, // 1-5 scale
        },
      ],
      [
        METRIC_CULTURAL_SENSITIVITY,
        {
          metric: this.culturalSensitivityMetric,
          spanName: SPAN_EVAL_CULTURAL_SENSITIVITY,
          feedbackName: FEEDBACK_CULTURAL_SENSITIVITY,
          isBlocker: false,
          normalizeScale: 5, // 1-5 scale
        },
      ],
      [
        METRIC_FINANCIAL_SAFETY,
        {
          metric: this.financialSafetyMetric,
          spanName: SPAN_EVAL_FINANCIAL_SAFETY,
          feedbackName: FEEDBACK_FINANCIAL_SAFETY,
          isBlocker: true, // This metric can block responses
          normalizeScale: 1, // Already 0-1
        },
      ],
      [
        METRIC_STAKE_EFFECTIVENESS,
        {
          metric: this.stakeEffectivenessMetric,
          spanName: SPAN_EVAL_STAKE_EFFECTIVENESS,
          feedbackName: FEEDBACK_STAKE_EFFECTIVENESS,
          isBlocker: false,
          normalizeScale: 1, // Already 0-1
        },
      ],
    ]);
  }

  /**
   * Evaluate an LLM output with multiple metrics
   *
   * @param datasetItem - Input context for evaluation
   * @param llmOutput - The LLM response to evaluate
   * @param options - Evaluation options
   * @param trace - Optional Opik trace to attach spans/feedback
   * @returns Combined evaluation result
   */
  async evaluate(
    datasetItem: DatasetItem,
    llmOutput: string,
    options: EvaluationOptions,
    trace?: TrackedTrace,
  ): Promise<EvaluationResult> {
    const {
      metrics,
      createSpans = true,
      addFeedback = true,
      throwOnUnsafe = false,
    } = options;

    // Determine which metrics to run
    const metricsToRun = this.getMetricsToRun(metrics);

    // Create parent span if trace provided
    let parentSpan: TrackedSpan | null = null;
    if (trace && createSpans) {
      parentSpan = this.safeCreateSpan(trace, SPAN_EVAL_METRICS, {
        metricsCount: metricsToRun.length,
        metrics: metricsToRun.map((m) => m.metric.name),
      });
    }

    // Run all metrics in parallel
    const results: Record<string, MetricResult> = {};
    let blockedReason: string | undefined;

    const evaluationPromises = metricsToRun.map(async (config) => {
      const { metric, spanName, feedbackName, isBlocker, normalizeScale } = config;

      try {
        // Create span for this metric
        let metricSpan: TrackedSpan | null = null;
        if (trace && createSpans) {
          metricSpan = this.safeCreateSpan(trace, spanName, {
            metric: metric.name,
          });
        }

        // Run evaluation
        const result = await metric.score(datasetItem, llmOutput);
        results[metric.name] = result;

        // Check if blocker metric failed
        if (isBlocker && result.score === 0) {
          blockedReason = result.reason;
        }

        // End metric span
        if (metricSpan) {
          this.safeEndSpan(metricSpan, {
            score: result.score,
            reason: result.reason,
            metadata: result.metadata,
          });
        }

        // Add feedback to trace
        if (trace && addFeedback) {
          const normalizedScore = this.normalizeScore(
            result.score,
            normalizeScale || 1,
          );
          this.safeAddFeedback(trace.traceId, feedbackName, normalizedScore, result.reason);
        }
      } catch (error) {
        this.logger.error(
          `Failed to evaluate metric ${metric.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        results[metric.name] = {
          score: 0,
          reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: { error: true },
        };
      }
    });

    await Promise.all(evaluationPromises);

    // End parent span
    if (parentSpan) {
      this.safeEndSpan(parentSpan, {
        results: Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, { score: v.score, reason: v.reason }]),
        ),
        blocked: !!blockedReason,
      });
    }

    // Calculate aggregated scores
    const aggregated = this.calculateAggregated(results, metricsToRun);

    const evaluationResult: EvaluationResult = {
      success: !blockedReason,
      results,
      aggregated,
      blockedReason,
    };

    // Throw if safety metric failed and throwOnUnsafe is true
    if (throwOnUnsafe && blockedReason) {
      throw new Error(`Unsafe response blocked: ${blockedReason}`);
    }

    return evaluationResult;
  }

  /**
   * Evaluate with just the safety metrics (fast check)
   */
  async checkSafety(llmOutput: string): Promise<MetricResult> {
    return this.financialSafetyMetric.score({ input: '', output: '' }, llmOutput);
  }

  /**
   * Evaluate just tone empathy
   */
  async evaluateTone(
    datasetItem: DatasetItem,
    llmOutput: string,
  ): Promise<MetricResult> {
    return this.toneEmpathyMetric.score(datasetItem, llmOutput);
  }

  /**
   * Evaluate just cultural sensitivity
   */
  async evaluateCultural(
    datasetItem: DatasetItem,
    llmOutput: string,
  ): Promise<MetricResult> {
    return this.culturalSensitivityMetric.score(datasetItem, llmOutput);
  }

  /**
   * Get available metric names
   */
  getAvailableMetrics(): string[] {
    return Array.from(this.metricConfigs.keys());
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): IMetric | undefined {
    return this.metricConfigs.get(name)?.metric;
  }

  // ==========================================
  // BATCH EVALUATION
  // ==========================================

  /**
   * Evaluate multiple items in a batch
   *
   * Runs evaluations in parallel with proper rate limiting (respects semaphore).
   * Returns results in the same order as inputs.
   * Handles partial failures gracefully.
   *
   * @param items - Array of dataset items to evaluate
   * @param llmOutputs - Array of LLM outputs corresponding to items
   * @param options - Batch evaluation options
   * @returns Array of results in same order as inputs
   */
  async evaluateBatch(
    items: DatasetItem[],
    llmOutputs: string[],
    options?: BatchEvaluationOptions,
  ): Promise<BatchEvaluationResult[]> {
    // Validate inputs
    if (items.length !== llmOutputs.length) {
      throw new Error(
        `Items and outputs length mismatch: ${items.length} items vs ${llmOutputs.length} outputs`,
      );
    }

    if (items.length === 0) {
      return [];
    }

    const {
      metrics = 'all',
      createSpans = false,
      addFeedback = false,
      throwOnUnsafe = false,
      abTestId,
      concurrency = 5,
    } = options ?? {};

    this.logger.log(
      `Starting batch evaluation of ${items.length} items with concurrency ${concurrency}`,
    );

    // Create a results array with slots for each item
    const results: BatchEvaluationResult[] = new Array(items.length);

    // Process items in batches respecting concurrency
    const processBatch = async (startIndex: number): Promise<void> => {
      const batchPromises: Promise<void>[] = [];

      for (
        let i = startIndex;
        i < Math.min(startIndex + concurrency, items.length);
        i++
      ) {
        const index = i;
        const item = items[index];
        const llmOutput = llmOutputs[index];

        // Use semaphore to respect global rate limiting
        const promise = llmSemaphore.withPermit(async () => {
          try {
            const evalOptions: EvaluationOptions = {
              metrics,
              createSpans,
              addFeedback,
              throwOnUnsafe,
              abTestId,
              abTestIdentifier: `batch-${index}`,
            };

            const result = await this.evaluate(item, llmOutput, evalOptions);

            results[index] = {
              index,
              success: true,
              result,
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
              `Batch evaluation failed for item ${index}: ${errorMessage}`,
            );

            results[index] = {
              index,
              success: false,
              error: errorMessage,
            };
          }
        });

        batchPromises.push(promise);
      }

      await Promise.all(batchPromises);
    };

    // Process all batches
    for (let i = 0; i < items.length; i += concurrency) {
      await processBatch(i);
    }

    this.logger.log(
      `Batch evaluation completed: ${results.filter((r) => r.success).length}/${items.length} succeeded`,
    );

    return results;
  }

  // ==========================================
  // A/B TESTING SUPPORT
  // ==========================================

  /**
   * Get the A/B test manager instance
   *
   * Use this to register tests, track results, and get statistics.
   *
   * @returns The ABTestManager instance
   */
  getABTestManager(): ABTestManager {
    return this.abTestManager;
  }

  /**
   * Select A/B test variant for an evaluation
   *
   * @param testId - A/B test identifier
   * @param identifier - User/trace identifier for deterministic selection
   * @returns Selected variant or undefined if test not found/disabled
   */
  selectABTestVariant(testId: string, identifier: string): ABTestVariant | undefined {
    return this.abTestManager.selectVariant(testId, identifier);
  }

  /**
   * Track A/B test result after evaluation
   *
   * @param testId - A/B test identifier
   * @param variantId - Selected variant ID
   * @param result - Evaluation result to track
   */
  trackABTestResult(
    testId: string,
    variantId: string,
    result: EvaluationResult,
  ): void {
    this.abTestManager.trackResult(testId, variantId, {
      score: result.aggregated.averageScore,
      passed: result.success,
      metadata: {
        passRate: result.aggregated.passCount / result.aggregated.totalCount,
        blockedReason: result.blockedReason,
      },
    });
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Get list of metrics to run based on options
   */
  private getMetricsToRun(metrics: 'all' | string[]): MetricConfig[] {
    if (metrics === 'all') {
      return Array.from(this.metricConfigs.values());
    }

    return metrics
      .map((name) => this.metricConfigs.get(name))
      .filter((config): config is MetricConfig => config !== undefined);
  }

  /**
   * Normalize score to 0-1 range
   */
  private normalizeScore(score: number, scale: number): number {
    if (scale === 1) {
      return score;
    }
    // For 1-5 scale, normalize to 0-1
    return (score - 1) / (scale - 1);
  }

  /**
   * Calculate aggregated scores
   */
  private calculateAggregated(
    results: Record<string, MetricResult>,
    metricsRun: MetricConfig[],
  ): EvaluationResult['aggregated'] {
    let totalNormalized = 0;
    let passCount = 0;
    let failCount = 0;

    for (const config of metricsRun) {
      const result = results[config.metric.name];
      if (!result) continue;

      const normalizedScore = this.normalizeScore(
        result.score,
        config.normalizeScale || 1,
      );
      totalNormalized += normalizedScore;

      // For blockers, 0 is fail. For others, below 0.5 normalized is fail
      if (config.isBlocker) {
        if (result.score === 0) {
          failCount++;
        } else {
          passCount++;
        }
      } else {
        if (normalizedScore >= 0.5) {
          passCount++;
        } else {
          failCount++;
        }
      }
    }

    const totalCount = metricsRun.length;
    const averageScore = totalCount > 0 ? totalNormalized / totalCount : 0;

    return {
      averageScore,
      passCount,
      failCount,
      totalCount,
    };
  }

  // ==========================================
  // SAFE TRACING HELPERS
  // ==========================================

  /**
   * Safely create a span (doesn't throw on error)
   */
  private safeCreateSpan(
    trace: TrackedTrace,
    name: string,
    input: Record<string, unknown>,
  ): TrackedSpan | null {
    try {
      return this.opikService.createToolSpan({
        trace: trace.trace,
        name,
        input,
        metadata: { type: 'evaluation' },
      });
    } catch (error) {
      this.logger.warn(`Failed to create span ${name}: ${error}`);
      return null;
    }
  }

  /**
   * Safely end a span
   */
  private safeEndSpan(span: TrackedSpan | null, output: Record<string, unknown>): void {
    if (!span) return;
    try {
      this.opikService.endSpan(span, { output, metadata: {} });
    } catch (error) {
      this.logger.warn(`Failed to end span: ${error}`);
    }
  }

  /**
   * Safely add feedback to trace
   */
  private safeAddFeedback(
    traceId: string,
    name: string,
    value: number,
    comment?: string,
  ): void {
    try {
      this.opikService.addFeedback({
        traceId,
        name,
        value,
        category: 'quality',
        comment,
        source: 'llm-as-judge',
      });
    } catch (error) {
      this.logger.warn(`Failed to add feedback ${name}: ${error}`);
    }
  }
}
