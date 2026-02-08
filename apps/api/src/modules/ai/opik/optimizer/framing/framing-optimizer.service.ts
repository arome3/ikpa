/**
 * Framing Optimizer Service
 *
 * A/B testing service for comparing prompt variants using Opik for evolution.
 * Uses Welch's t-test for statistical significance testing.
 *
 * Key Features:
 * - Runs controlled A/B experiments comparing baseline vs variant prompts
 * - Statistical analysis with Welch's t-test for unequal variances
 * - Full Opik tracing with feedback for experiment results
 * - Persists experiments to database for auditing
 * - Integrates with OpikExperimentService for A/B comparison UI
 *
 * @example
 * ```typescript
 * const result = await framingOptimizer.runExperiment({
 *   name: 'shark-auditor-framing',
 *   baselinePrompt: 'Monthly: {{monthly}}',
 *   variantPrompt: 'Annual: {{annual}}',
 *   datasetName: 'subscriptions',
 *   metricName: 'CancellationRate',
 *   nSamples: 100,
 *   maxRounds: 10,
 * });
 * ```
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { OpikService } from '../../opik.service';
import { AnthropicService } from '../../../anthropic';
import { CancellationRateMetric } from './cancellation-rate.metric';
import { AlertService } from '../alerting/alert.service';
import { OpikExperimentService } from '../opik-experiment';
import {
  IFramingOptimizer,
  FramingExperimentConfig,
  FramingExperimentResult,
  VariantEvaluationResult,
  StatisticalAnalysisResult,
  FramingDatasetItem,
} from '../interfaces';
import {
  TRACE_FRAMING_EXPERIMENT,
  SPAN_BASELINE_EVALUATION,
  SPAN_VARIANT_EVALUATION,
  SPAN_STATISTICAL_ANALYSIS,
  FEEDBACK_EXPERIMENT_WINNER,
  FEEDBACK_IMPROVEMENT_PERCENTAGE,
  SIGNIFICANCE_THRESHOLD,
} from '../optimizer.constants';

/**
 * Sample dataset for subscription framing experiments
 * In production, this would be loaded from a database or external source
 */
const SAMPLE_SUBSCRIPTION_DATASET: FramingDatasetItem[] = [
  { name: 'Netflix', monthly: '₦4,400', annual: '₦52,800', category: 'STREAMING' },
  { name: 'Spotify', monthly: '₦1,200', annual: '₦14,400', category: 'STREAMING' },
  { name: 'YouTube Premium', monthly: '₦900', annual: '₦10,800', category: 'STREAMING' },
  { name: 'Amazon Prime', monthly: '₦2,300', annual: '₦27,600', category: 'STREAMING' },
  { name: 'Showmax', monthly: '₦2,900', annual: '₦34,800', category: 'STREAMING' },
  { name: 'Gym Membership', monthly: '₦15,000', annual: '₦180,000', category: 'FITNESS' },
  { name: 'Headspace', monthly: '₦1,800', annual: '₦21,600', category: 'SOFTWARE' },
  { name: 'Dropbox', monthly: '₦1,500', annual: '₦18,000', category: 'CLOUD_STORAGE' },
  { name: 'Adobe CC', monthly: '₦12,000', annual: '₦144,000', category: 'SOFTWARE' },
  { name: 'VPN Service', monthly: '₦800', annual: '₦9,600', category: 'VPN' },
];

@Injectable()
export class FramingOptimizerService implements IFramingOptimizer {
  private readonly logger = new Logger(FramingOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly anthropicService: AnthropicService,
    private readonly cancellationMetric: CancellationRateMetric,
    private readonly alertService: AlertService,
    @Optional()
    private readonly opikExperimentService?: OpikExperimentService,
  ) {}

  /**
   * Run an A/B experiment comparing baseline and variant prompts
   *
   * If OpikExperimentService is available, creates an Opik experiment for
   * A/B comparison UI visualization. Links all evaluation traces to the
   * experiment and records variant results for aggregation.
   */
  async runExperiment(config: FramingExperimentConfig): Promise<FramingExperimentResult> {
    const experimentId = randomUUID();
    const startTime = Date.now();

    this.logger.log(`Starting framing experiment: ${config.name} (${experimentId})`);

    // Create Opik experiment for A/B comparison UI (if service available)
    let opikExperimentId: string | null = null;
    if (this.opikExperimentService) {
      try {
        opikExperimentId = await this.opikExperimentService.createExperiment({
          name: config.name,
          hypothesis: `Testing if variant framing "${config.variantPrompt.substring(0, 50)}..." outperforms baseline "${config.baselinePrompt.substring(0, 50)}..."`,
          baselineDescription: config.baselinePrompt,
          variantDescription: config.variantPrompt,
          type: 'framing',
          metadata: {
            datasetName: config.datasetName,
            metricName: config.metricName,
            nSamples: config.nSamples,
            maxRounds: config.maxRounds,
          },
          tags: ['framing', 'shark-auditor', config.metricName],
        });
        this.logger.debug(`Created Opik experiment: ${opikExperimentId}`);
      } catch (error) {
        this.logger.warn(
          `Failed to create Opik experiment: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
        // Continue without Opik experiment - fallback to basic tracing
      }
    }

    // Create database record
    await this.prisma.optimizerExperiment.create({
      data: {
        id: experimentId,
        type: 'FRAMING',
        name: config.name,
        config: {
          ...config,
          opikExperimentId, // Store link to Opik experiment
        } as unknown as Prisma.InputJsonValue,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Get experiment tags if available (currently unused, reserved for future tagging)
    // const _baselineTags = opikExperimentId && this.opikExperimentService
    //   ? this.opikExperimentService.getExperimentTags(opikExperimentId, 'baseline')
    //   : [];
    // const _variantTags = opikExperimentId && this.opikExperimentService
    //   ? this.opikExperimentService.getExperimentTags(opikExperimentId, 'variant')
    //   : [];

    // Create Opik trace with experiment metadata
    const trace = this.opikService.createTrace({
      name: TRACE_FRAMING_EXPERIMENT,
      input: {
        experimentId,
        opikExperimentId,
        config,
      },
      metadata: {
        experimentType: 'framing',
        nSamples: config.nSamples,
        maxRounds: config.maxRounds,
        opikExperimentId,
      },
      tags: [
        'optimizer',
        'framing',
        'ab-test',
        ...(opikExperimentId ? [`experiment:${opikExperimentId}`] : []),
      ],
    });

    try {
      // Evaluate baseline prompt
      const baselineSpan = trace
        ? this.opikService.createGeneralSpan({
            trace: trace.trace,
            name: SPAN_BASELINE_EVALUATION,
            input: { prompt: config.baselinePrompt },
            metadata: {
              variant: 'baseline',
              opikExperimentId,
            },
          })
        : null;

      const baseline = await this.evaluatePrompt(
        config.baselinePrompt,
        config.datasetName,
        config.nSamples,
      );

      if (baselineSpan) {
        this.opikService.endSpan(baselineSpan, {
          output: { score: baseline.score, sampleSize: baseline.sampleSize },
        });

        // Link baseline trace to Opik experiment
        if (opikExperimentId && this.opikExperimentService) {
          await this.opikExperimentService.linkTraceToExperiment(
            baselineSpan.traceId,
            opikExperimentId,
            'baseline',
          );
        }
      }

      // Record baseline results to Opik experiment
      if (opikExperimentId && this.opikExperimentService) {
        await this.opikExperimentService.recordVariantResult(opikExperimentId, 'baseline', {
          score: baseline.score,
          sampleSize: baseline.sampleSize,
          traceIds: trace ? [trace.traceId] : [],
          scores: baseline.scores,
        });
      }

      // Evaluate variant prompt
      const variantSpan = trace
        ? this.opikService.createGeneralSpan({
            trace: trace.trace,
            name: SPAN_VARIANT_EVALUATION,
            input: { prompt: config.variantPrompt },
            metadata: {
              variant: 'variant',
              opikExperimentId,
            },
          })
        : null;

      const variant = await this.evaluatePrompt(
        config.variantPrompt,
        config.datasetName,
        config.nSamples,
      );

      if (variantSpan) {
        this.opikService.endSpan(variantSpan, {
          output: { score: variant.score, sampleSize: variant.sampleSize },
        });

        // Link variant trace to Opik experiment
        if (opikExperimentId && this.opikExperimentService) {
          await this.opikExperimentService.linkTraceToExperiment(
            variantSpan.traceId,
            opikExperimentId,
            'variant',
          );
        }
      }

      // Record variant results to Opik experiment
      if (opikExperimentId && this.opikExperimentService) {
        await this.opikExperimentService.recordVariantResult(opikExperimentId, 'variant', {
          score: variant.score,
          sampleSize: variant.sampleSize,
          traceIds: trace ? [trace.traceId] : [],
          scores: variant.scores,
        });
      }

      // Perform statistical analysis
      const analysisSpan = trace
        ? this.opikService.createGeneralSpan({
            trace: trace.trace,
            name: SPAN_STATISTICAL_ANALYSIS,
            input: {
              baselineScores: baseline.scores,
              variantScores: variant.scores,
            },
            metadata: { opikExperimentId },
          })
        : null;

      const analysis = this.performStatisticalAnalysis(baseline.scores, variant.scores);

      if (analysisSpan) {
        this.opikService.endSpan(analysisSpan, {
          output: analysis as unknown as Record<string, unknown>,
        });
      }

      // Complete Opik experiment with analysis
      if (opikExperimentId && this.opikExperimentService) {
        await this.opikExperimentService.completeExperiment(opikExperimentId, {
          winner: analysis.winner,
          pValue: analysis.pValue,
          improvement: analysis.improvement,
          isSignificant: analysis.isSignificant,
          confidence: analysis.confidence,
          tStatistic: analysis.tStatistic,
          degreesOfFreedom: analysis.degreesOfFreedom,
        });
      }

      // Record feedback to Opik
      if (trace) {
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: FEEDBACK_EXPERIMENT_WINNER,
          value: analysis.winner === 'variant' ? 1 : analysis.winner === 'baseline' ? 0 : 0.5,
          category: 'custom',
          comment: `Winner: ${analysis.winner || 'inconclusive'}, p-value: ${analysis.pValue.toFixed(4)}`,
        });

        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: FEEDBACK_IMPROVEMENT_PERCENTAGE,
          value: analysis.improvement,
          category: 'custom',
          comment: `Variant ${analysis.improvement >= 0 ? 'improved' : 'decreased'} by ${Math.abs(analysis.improvement).toFixed(2)}%`,
        });
      }

      const result: FramingExperimentResult = {
        experimentId,
        baseline,
        variant,
        analysis,
      };

      // Update database record
      const durationMs = Date.now() - startTime;
      await this.prisma.optimizerExperiment.update({
        where: { id: experimentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: {
            ...result,
            opikExperimentId,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      this.opikService.endTrace(trace, {
        success: true,
        result: { ...result, durationMs, opikExperimentId },
      });

      this.logger.log(
        `Framing experiment completed: ${config.name}, ` +
          `winner=${analysis.winner || 'inconclusive'}, improvement=${analysis.improvement.toFixed(2)}%` +
          (opikExperimentId ? ` (Opik: ${opikExperimentId})` : ''),
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.optimizerExperiment.update({
        where: { id: experimentId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: errorMessage,
        },
      });

      // Cancel Opik experiment on failure
      if (opikExperimentId && this.opikExperimentService) {
        try {
          await this.opikExperimentService.cancelExperiment(opikExperimentId, errorMessage);
        } catch (cancelError) {
          this.logger.warn(
            `Failed to cancel Opik experiment: ${cancelError instanceof Error ? cancelError.message : 'Unknown'}`,
          );
        }
      }

      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`Framing experiment failed: ${errorMessage}`);

      // Send alert for the failure
      await this.alertService.sendOptimizationFailure(
        experimentId,
        'FRAMING',
        error instanceof Error ? error : errorMessage,
        {
          experimentName: config.name,
          nSamples: config.nSamples,
          maxRounds: config.maxRounds,
          opikExperimentId,
        },
      );

      throw error;
    } finally {
      await this.opikService.flush();
    }
  }

  /**
   * Evaluate a single prompt against a dataset
   */
  async evaluatePrompt(
    prompt: string,
    datasetName: string,
    nSamples: number,
  ): Promise<VariantEvaluationResult> {
    const dataset = this.getDataset(datasetName);
    const samples = this.sampleDataset(dataset, nSamples);
    const scores: number[] = [];

    for (const item of samples) {
      try {
        const renderedPrompt = this.renderPrompt(prompt, item);
        const response = await this.generateResponse(renderedPrompt);
        const result = await this.cancellationMetric.score(
          { input: renderedPrompt, output: '' },
          response,
        );
        scores.push(result.score);
      } catch (error) {
        this.logger.warn(
          `Evaluation failed for item ${item.name}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
        // Skip failed evaluations
      }
    }

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      prompt,
      score: avgScore,
      sampleSize: scores.length,
      scores,
    };
  }

  /**
   * Perform Welch's t-test for statistical significance
   *
   * Welch's t-test is used because it doesn't assume equal variances
   * between the two samples, making it more robust.
   */
  performStatisticalAnalysis(
    baselineScores: number[],
    variantScores: number[],
  ): StatisticalAnalysisResult {
    const n1 = baselineScores.length;
    const n2 = variantScores.length;

    if (n1 < 2 || n2 < 2) {
      return {
        winner: null,
        improvement: 0,
        confidence: 0,
        pValue: 1,
        isSignificant: false,
      };
    }

    // Calculate means
    const mean1 = baselineScores.reduce((a, b) => a + b, 0) / n1;
    const mean2 = variantScores.reduce((a, b) => a + b, 0) / n2;

    // Calculate variances
    const var1 = baselineScores.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
    const var2 = variantScores.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);

    // Welch's t-statistic
    const se = Math.sqrt(var1 / n1 + var2 / n2);
    if (se === 0) {
      return {
        winner: mean2 > mean1 ? 'variant' : mean1 > mean2 ? 'baseline' : null,
        improvement: mean1 > 0 ? ((mean2 - mean1) / mean1) * 100 : 0,
        confidence: 1,
        pValue: 0,
        isSignificant: mean1 !== mean2,
      };
    }

    const tStatistic = (mean2 - mean1) / se;

    // Welch-Satterthwaite degrees of freedom
    const df =
      Math.pow(var1 / n1 + var2 / n2, 2) /
      (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

    // Calculate two-tailed p-value using accurate t-distribution approximation
    const pValue = this.calculateTwoTailedPValue(Math.abs(tStatistic), df);

    // Determine winner
    const isSignificant = pValue < SIGNIFICANCE_THRESHOLD;
    let winner: 'baseline' | 'variant' | null = null;
    if (isSignificant) {
      winner = mean2 > mean1 ? 'variant' : 'baseline';
    }

    // Calculate improvement percentage
    const improvement = mean1 > 0 ? ((mean2 - mean1) / mean1) * 100 : 0;

    return {
      winner,
      improvement,
      confidence: 1 - pValue,
      pValue,
      isSignificant,
      degreesOfFreedom: df,
      tStatistic,
    };
  }

  /**
   * Calculate two-tailed p-value from t-distribution
   *
   * Uses the regularized incomplete beta function:
   * p-value = I_{df/(df+t²)}(df/2, 1/2)
   *
   * This is the standard formula for t-distribution CDF.
   */
  private calculateTwoTailedPValue(t: number, df: number): number {
    if (df <= 0) return 1;
    if (t === 0) return 1;

    // For t-distribution: P(T > |t|) = I_x(a, b) where x = df/(df+t²), a = df/2, b = 0.5
    const x = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;

    // Use regularized incomplete beta function
    const pValue = this.regularizedIncompleteBeta(a, b, x);

    // Return two-tailed p-value (already two-tailed due to symmetry of t-distribution)
    return pValue;
  }

  /**
   * Regularized incomplete beta function I_x(a, b)
   *
   * Uses the continued fraction representation with proper convergence handling.
   * Based on Numerical Recipes algorithm.
   */
  private regularizedIncompleteBeta(a: number, b: number, x: number): number {
    // Handle edge cases
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // For numerical stability, use symmetry relation when appropriate
    // I_x(a,b) = 1 - I_{1-x}(b,a)
    if (x > (a + 1) / (a + b + 2)) {
      return 1 - this.regularizedIncompleteBeta(b, a, 1 - x);
    }

    // Calculate the log of the beta function prefix
    const logBetaPrefix = this.logGamma(a + b) - this.logGamma(a) - this.logGamma(b) +
      a * Math.log(x) + b * Math.log(1 - x);

    // Use continued fraction (Lentz's method)
    const cf = this.betaContinuedFraction(a, b, x);

    return Math.exp(logBetaPrefix) * cf / a;
  }

  /**
   * Continued fraction for incomplete beta function
   * Uses modified Lentz's algorithm for numerical stability
   */
  private betaContinuedFraction(a: number, b: number, x: number): number {
    const maxIterations = 200;
    const epsilon = 1e-14;
    const tiny = 1e-30;

    // First term
    let c = 1;
    let d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= maxIterations; m++) {
      const m2 = 2 * m;

      // Even step: d_{2m}
      let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      h *= d * c;

      // Odd step: d_{2m+1}
      aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;

      // Check for convergence
      if (Math.abs(del - 1) < epsilon) {
        return h;
      }
    }

    // If we didn't converge, log a warning and return best estimate
    this.logger.warn(`Beta continued fraction did not converge for a=${a}, b=${b}, x=${x}`);
    return h;
  }

  /**
   * Log gamma function using Lanczos approximation
   * Accurate to ~15 decimal places
   */
  private logGamma(x: number): number {
    if (x <= 0) return Infinity;

    // Lanczos approximation coefficients (g=7)
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7,
    ];

    // Reflection formula for x < 0.5
    if (x < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * x)) - this.logGamma(1 - x);
    }

    x -= 1;
    let sum = c[0];
    for (let i = 1; i < g + 2; i++) {
      sum += c[i] / (x + i);
    }

    const t = x + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
  }

  /**
   * Get dataset by name
   */
  private getDataset(datasetName: string): FramingDatasetItem[] {
    // In production, this would load from database or external source
    if (datasetName === 'subscription_decisions' || datasetName === 'subscriptions') {
      return SAMPLE_SUBSCRIPTION_DATASET;
    }
    return SAMPLE_SUBSCRIPTION_DATASET;
  }

  /**
   * Sample items from dataset with randomization
   *
   * Uses Fisher-Yates shuffle for unbiased random sampling.
   * Repeats dataset if nSamples > dataset.length.
   */
  private sampleDataset(dataset: FramingDatasetItem[], nSamples: number): FramingDatasetItem[] {
    if (dataset.length === 0) return [];

    // Create a pool of items to sample from (repeat dataset if needed)
    const pool: FramingDatasetItem[] = [];
    while (pool.length < nSamples) {
      // Shuffle the dataset before adding to pool for randomness
      const shuffled = this.shuffleArray([...dataset]);
      pool.push(...shuffled);
    }

    // Take exactly nSamples from the shuffled pool
    return pool.slice(0, nSamples);
  }

  /**
   * Fisher-Yates shuffle for unbiased randomization
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Render a prompt template with item data
   */
  private renderPrompt(template: string, item: FramingDatasetItem): string {
    return template
      .replace(/\{\{name\}\}/g, item.name)
      .replace(/\{\{monthly\}\}/g, item.monthly)
      .replace(/\{\{annual\}\}/g, item.annual)
      .replace(/\{\{category\}\}/g, item.category || 'OTHER');
  }

  /**
   * Generate a response using the AI service
   */
  private async generateResponse(prompt: string): Promise<string> {
    if (!this.anthropicService.isAvailable()) {
      // Return a mock response for testing when AI is unavailable
      return 'This subscription should be reviewed. Consider whether you use it regularly.';
    }

    const response = await this.anthropicService.generate(
      prompt,
      200,
      'You are a financial advisor helping users review their subscriptions. ' +
        'Analyze the subscription and recommend whether to KEEP or CANCEL it. Be decisive.',
    );

    return response.content;
  }
}
