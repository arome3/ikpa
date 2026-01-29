/**
 * Opik Experiment Service
 *
 * Integrates with Opik's tracing to enable A/B comparison UI for framing experiments.
 * Since Opik SDK may not have native Experiments API, this service uses trace tags
 * to group experiment variants and stores experiment metadata in dedicated traces.
 *
 * Key Features:
 * - Create and manage A/B experiments with Opik tracing
 * - Link evaluation traces to experiments via tags and metadata
 * - Record and aggregate variant results
 * - Generate comparison data for UI visualization
 * - Persist experiment state to database for durability
 *
 * @example
 * ```typescript
 * // Create a new experiment
 * const experimentId = await experimentService.createExperiment({
 *   name: 'monthly-vs-annual-framing',
 *   hypothesis: 'Annual cost framing reduces cancellation intent',
 *   baselineDescription: 'Monthly cost display: "₦4,400/month"',
 *   variantDescription: 'Annual cost display: "₦52,800/year (save 20%)"',
 * });
 *
 * // Link evaluation traces
 * await experimentService.linkTraceToExperiment(traceId, experimentId, 'baseline');
 *
 * // Record results
 * await experimentService.recordVariantResult(experimentId, 'baseline', {
 *   score: 0.72,
 *   sampleSize: 50,
 *   traceIds: [...],
 * });
 *
 * // Complete experiment
 * await experimentService.completeExperiment(experimentId, {
 *   winner: 'variant',
 *   pValue: 0.023,
 *   improvement: 15.5,
 *   isSignificant: true,
 * });
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { OpikService } from '../../opik.service';
import {
  CreateExperimentConfig,
  CompleteExperimentInput,
  RecordVariantResultInput,
  LinkTraceInput,
  OpikExperiment,
  ExperimentComparison,
  ExperimentAnalysis,
  ListExperimentsOptions,
  VariantType,
  VariantResults,
  ExperimentStatus,
  ExperimentTimelineEntry,
  IOpikExperimentService,
} from './opik-experiment.interface';

// ==========================================
// CONSTANTS
// ==========================================

/** Trace name for experiment root traces */
const TRACE_EXPERIMENT_ROOT = 'opik_experiment';

/** Tag prefix for experiment traces */
const TAG_EXPERIMENT_PREFIX = 'experiment:';

/** Tag prefix for variant identification */
const TAG_VARIANT_PREFIX = 'variant:';

/** Feedback name for experiment completion */
const FEEDBACK_EXPERIMENT_COMPLETE = 'ExperimentComplete';

/** Significance threshold for p-value */
const SIGNIFICANCE_THRESHOLD = 0.05;

/** Minimum samples for reliable results */
const MIN_SAMPLES_FOR_SIGNIFICANCE = 30;

/** Effect size thresholds (Cohen's d) */
const EFFECT_SIZE_THRESHOLDS = {
  negligible: 0.2,
  small: 0.5,
  medium: 0.8,
  large: Infinity,
};

@Injectable()
export class OpikExperimentService implements IOpikExperimentService {
  private readonly logger = new Logger(OpikExperimentService.name);

  /**
   * In-memory cache of active experiments for fast lookup
   * Experiments are also persisted to database for durability
   */
  private readonly experimentCache = new Map<string, OpikExperiment>();

  /**
   * Cache of trace-to-experiment links for quick reference
   */
  private readonly traceLinkCache = new Map<string, { experimentId: string; variant: VariantType }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
  ) {}

  // ==========================================
  // PUBLIC METHODS
  // ==========================================

  /**
   * Create a new experiment
   *
   * Creates an Opik trace to represent the experiment and stores metadata
   * for later comparison and analysis.
   */
  async createExperiment(config: CreateExperimentConfig): Promise<string> {
    const experimentId = randomUUID();
    const now = new Date();

    this.logger.log(`Creating experiment: ${config.name} (${experimentId})`);

    // Create Opik trace for the experiment
    const trace = this.opikService.createTrace({
      name: TRACE_EXPERIMENT_ROOT,
      input: {
        experimentId,
        name: config.name,
        hypothesis: config.hypothesis,
        baselineDescription: config.baselineDescription,
        variantDescription: config.variantDescription,
        type: config.type || 'framing',
      },
      metadata: {
        experimentType: 'ab_test',
        isExperimentRoot: true,
        ...config.metadata,
      },
      tags: [
        `${TAG_EXPERIMENT_PREFIX}${experimentId}`,
        'experiment',
        'ab-test',
        config.type || 'framing',
        ...(config.tags || []),
      ],
    });

    // Build experiment state
    const experiment: OpikExperiment = {
      id: experimentId,
      name: config.name,
      hypothesis: config.hypothesis,
      baselineDescription: config.baselineDescription,
      variantDescription: config.variantDescription,
      type: config.type || 'framing',
      status: 'created',
      createdAt: now,
      rootTraceId: trace?.traceId || experimentId,
      metadata: config.metadata,
      tags: config.tags,
    };

    // Persist to database
    await this.prisma.optimizerExperiment.create({
      data: {
        id: experimentId,
        type: (config.type || 'FRAMING').toUpperCase(),
        name: config.name,
        config: {
          hypothesis: config.hypothesis,
          baselineDescription: config.baselineDescription,
          variantDescription: config.variantDescription,
          metadata: config.metadata,
          tags: config.tags,
        },
        status: 'CREATED',
        startedAt: now,
      },
    });

    // Cache the experiment
    this.experimentCache.set(experimentId, experiment);

    // Note: We don't end the trace here - it stays open until experiment completes

    this.logger.log(`Experiment created: ${config.name} (${experimentId})`);

    return experimentId;
  }

  /**
   * Record a variant result
   *
   * Aggregates results for a variant and updates the experiment state.
   */
  async recordVariantResult(
    experimentId: string,
    variant: VariantType,
    result: RecordVariantResultInput['result'],
  ): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    this.logger.debug(
      `Recording ${variant} result for experiment ${experimentId}: ` +
        `score=${result.score.toFixed(4)}, samples=${result.sampleSize}`,
    );

    // Create span for this result recording
    const rootTrace = this.opikService.createTrace({
      name: `${TRACE_EXPERIMENT_ROOT}_result`,
      input: {
        experimentId,
        variant,
        score: result.score,
        sampleSize: result.sampleSize,
      },
      tags: [
        `${TAG_EXPERIMENT_PREFIX}${experimentId}`,
        `${TAG_VARIANT_PREFIX}${variant}`,
        'experiment-result',
      ],
    });

    // Get existing results or initialize
    const existingResults = variant === 'baseline' ? experiment.baselineResults : experiment.variantResults;

    // Aggregate results
    const updatedResults: VariantResults = this.aggregateVariantResults(
      existingResults,
      variant,
      result,
    );

    // Update experiment state
    if (variant === 'baseline') {
      experiment.baselineResults = updatedResults;
    } else {
      experiment.variantResults = updatedResults;
    }

    // Update status to running if this is the first result
    if (experiment.status === 'created') {
      experiment.status = 'running';
      experiment.startedAt = new Date();
    }

    // Persist to database
    await this.prisma.optimizerExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'RUNNING',
        result: {
          baselineResults: experiment.baselineResults,
          variantResults: experiment.variantResults,
        },
      },
    });

    // Update cache
    this.experimentCache.set(experimentId, experiment);

    // End the result trace
    this.opikService.endTrace(rootTrace, {
      success: true,
      result: {
        variant,
        aggregatedScore: updatedResults.score,
        totalSamples: updatedResults.sampleSize,
      },
    });

    await this.opikService.flush();
  }

  /**
   * Complete an experiment with final analysis
   *
   * Records the final analysis results and ends the experiment trace.
   */
  async completeExperiment(
    experimentId: string,
    analysis: CompleteExperimentInput['analysis'],
  ): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    this.logger.log(
      `Completing experiment ${experimentId}: winner=${analysis.winner || 'inconclusive'}, ` +
        `improvement=${analysis.improvement.toFixed(2)}%, p-value=${analysis.pValue.toFixed(4)}`,
    );

    // Build full analysis
    const fullAnalysis = this.buildFullAnalysis(experiment, analysis);

    // Update experiment state
    experiment.status = 'completed';
    experiment.completedAt = new Date();
    experiment.analysis = fullAnalysis;

    // Create completion trace
    const completionTrace = this.opikService.createTrace({
      name: `${TRACE_EXPERIMENT_ROOT}_complete`,
      input: {
        experimentId,
        analysis: fullAnalysis,
      },
      tags: [
        `${TAG_EXPERIMENT_PREFIX}${experimentId}`,
        'experiment-complete',
        fullAnalysis.isSignificant ? 'significant' : 'not-significant',
        `winner:${analysis.winner || 'none'}`,
      ],
    });

    // Add feedback for the completion
    if (completionTrace) {
      this.opikService.addFeedback({
        traceId: completionTrace.traceId,
        name: FEEDBACK_EXPERIMENT_COMPLETE,
        value: analysis.isSignificant ? 1 : 0,
        category: 'experiment' as const,
        comment: fullAnalysis.summary,
      });
    }

    // Persist to database
    await this.prisma.optimizerExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: {
          baselineResults: experiment.baselineResults,
          variantResults: experiment.variantResults,
          analysis: fullAnalysis,
        },
      },
    });

    // Update cache
    this.experimentCache.set(experimentId, experiment);

    // End completion trace
    this.opikService.endTrace(completionTrace, {
      success: true,
      result: fullAnalysis,
    });

    await this.opikService.flush();

    this.logger.log(`Experiment completed: ${experiment.name} - ${fullAnalysis.recommendation}`);
  }

  /**
   * Link a trace to an experiment
   *
   * Associates an evaluation trace with an experiment variant for aggregation.
   */
  async linkTraceToExperiment(
    traceId: string,
    experimentId: string,
    variant: VariantType,
  ): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    this.logger.debug(
      `Linking trace ${traceId} to experiment ${experimentId} as ${variant}`,
    );

    // Cache the link
    this.traceLinkCache.set(traceId, { experimentId, variant });

    // Add the trace ID to the variant's trace list
    const variantResults =
      variant === 'baseline' ? experiment.baselineResults : experiment.variantResults;

    if (variantResults) {
      if (!variantResults.traceIds.includes(traceId)) {
        variantResults.traceIds.push(traceId);
      }
    }

    // Update experiment cache
    this.experimentCache.set(experimentId, experiment);

    // Note: We can't directly add tags to existing traces via the SDK,
    // but the link is maintained in our cache and can be used for analysis
  }

  /**
   * Get experiment by ID
   *
   * Returns the experiment from cache or loads from database.
   */
  async getExperiment(experimentId: string): Promise<OpikExperiment | null> {
    // Check cache first
    if (this.experimentCache.has(experimentId)) {
      return this.experimentCache.get(experimentId)!;
    }

    // Load from database
    const dbExperiment = await this.prisma.optimizerExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!dbExperiment) {
      return null;
    }

    // Reconstruct experiment from database
    const config = dbExperiment.config as Record<string, unknown>;
    const result = dbExperiment.result as Record<string, unknown> | null;

    const experiment: OpikExperiment = {
      id: dbExperiment.id,
      name: dbExperiment.name,
      hypothesis: (config.hypothesis as string) || '',
      baselineDescription: (config.baselineDescription as string) || '',
      variantDescription: (config.variantDescription as string) || '',
      type: (dbExperiment.type?.toLowerCase() as OpikExperiment['type']) || 'framing',
      status: this.mapDbStatus(dbExperiment.status),
      createdAt: dbExperiment.startedAt,
      startedAt: dbExperiment.startedAt,
      completedAt: dbExperiment.completedAt || undefined,
      rootTraceId: dbExperiment.id,
      metadata: config.metadata as Record<string, unknown>,
      tags: config.tags as string[],
      baselineResults: result?.baselineResults as VariantResults | undefined,
      variantResults: result?.variantResults as VariantResults | undefined,
      analysis: result?.analysis as ExperimentAnalysis | undefined,
    };

    // Cache for future access
    this.experimentCache.set(experimentId, experiment);

    return experiment;
  }

  /**
   * List experiments with filtering
   */
  async listExperiments(options: ListExperimentsOptions = {}): Promise<OpikExperiment[]> {
    const {
      status,
      type,
      tags,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status.toUpperCase();
    }
    if (type) {
      where.type = type.toUpperCase();
    }

    // Query database
    const dbExperiments = await this.prisma.optimizerExperiment.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: {
        [sortBy === 'createdAt' ? 'startedAt' : sortBy]: sortOrder,
      },
    });

    // Map to OpikExperiment format
    const experiments = dbExperiments.map((dbExp) => {
      const config = dbExp.config as Record<string, unknown>;
      const result = dbExp.result as Record<string, unknown> | null;

      return {
        id: dbExp.id,
        name: dbExp.name,
        hypothesis: (config.hypothesis as string) || '',
        baselineDescription: (config.baselineDescription as string) || '',
        variantDescription: (config.variantDescription as string) || '',
        type: (dbExp.type?.toLowerCase() as OpikExperiment['type']) || 'framing',
        status: this.mapDbStatus(dbExp.status),
        createdAt: dbExp.startedAt,
        startedAt: dbExp.startedAt,
        completedAt: dbExp.completedAt || undefined,
        rootTraceId: dbExp.id,
        metadata: config.metadata as Record<string, unknown>,
        tags: config.tags as string[],
        baselineResults: result?.baselineResults as VariantResults | undefined,
        variantResults: result?.variantResults as VariantResults | undefined,
        analysis: result?.analysis as ExperimentAnalysis | undefined,
      } as OpikExperiment;
    });

    // Filter by tags if specified
    if (tags && tags.length > 0) {
      return experiments.filter((exp) =>
        tags.some((tag) => exp.tags?.includes(tag)),
      );
    }

    return experiments;
  }

  /**
   * Get comparison data for an experiment
   *
   * Returns formatted data for A/B comparison UI visualization.
   */
  async getExperimentComparison(experimentId: string): Promise<ExperimentComparison | null> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      return null;
    }

    const baseline = experiment.baselineResults || {
      variant: 'baseline' as const,
      score: 0,
      sampleSize: 0,
      traceIds: [],
    };

    const variant = experiment.variantResults || {
      variant: 'variant' as const,
      score: 0,
      sampleSize: 0,
      traceIds: [],
    };

    // Calculate comparison metrics
    const absoluteDifference = variant.score - baseline.score;
    const relativeDifference =
      baseline.score > 0 ? ((variant.score - baseline.score) / baseline.score) * 100 : 0;

    const analysis = experiment.analysis;
    const pValue = analysis?.pValue ?? 1;
    const isSignificant = analysis?.isSignificant ?? false;
    const winner = analysis?.winner ?? null;

    // Generate timeline
    const timeline = this.generateTimeline(experiment);

    // Generate recommendation text
    const recommendation = this.generateRecommendationText(experiment);

    return {
      experiment,
      baseline: {
        score: baseline.score,
        sampleSize: baseline.sampleSize,
        stdDev: baseline.stdDev,
        confidenceInterval: baseline.confidenceInterval,
      },
      variant: {
        score: variant.score,
        sampleSize: variant.sampleSize,
        stdDev: variant.stdDev,
        confidenceInterval: variant.confidenceInterval,
      },
      comparison: {
        absoluteDifference,
        relativeDifference,
        pValue,
        isSignificant,
        confidenceLevel: 1 - pValue,
        winner,
        recommendation,
      },
      timeline,
    };
  }

  /**
   * Cancel a running experiment
   */
  async cancelExperiment(experimentId: string, reason?: string): Promise<void> {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    if (experiment.status === 'completed') {
      throw new Error('Cannot cancel a completed experiment');
    }

    this.logger.log(`Cancelling experiment ${experimentId}: ${reason || 'No reason provided'}`);

    // Update experiment state
    experiment.status = 'cancelled';
    experiment.completedAt = new Date();

    // Create cancellation trace
    const cancelTrace = this.opikService.createTrace({
      name: `${TRACE_EXPERIMENT_ROOT}_cancel`,
      input: {
        experimentId,
        reason,
      },
      tags: [
        `${TAG_EXPERIMENT_PREFIX}${experimentId}`,
        'experiment-cancelled',
      ],
    });

    // Persist to database
    await this.prisma.optimizerExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        error: reason,
      },
    });

    // Update cache
    this.experimentCache.set(experimentId, experiment);

    // End cancellation trace
    this.opikService.endTrace(cancelTrace, {
      success: true,
      result: { cancelled: true, reason },
    });

    await this.opikService.flush();
  }

  /**
   * Get experiment metadata tags for a trace
   *
   * Returns the tags that should be added to evaluation traces to link them
   * to an experiment.
   */
  getExperimentTags(experimentId: string, variant: VariantType): string[] {
    return [
      `${TAG_EXPERIMENT_PREFIX}${experimentId}`,
      `${TAG_VARIANT_PREFIX}${variant}`,
      'ab-test',
    ];
  }

  /**
   * Get experiment metadata for trace input/metadata
   *
   * Returns metadata that should be included in evaluation traces.
   */
  getExperimentMetadata(experimentId: string, variant: VariantType): Record<string, unknown> {
    return {
      experiment: {
        id: experimentId,
        variant,
        linkedAt: new Date().toISOString(),
      },
    };
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  /**
   * Aggregate variant results
   */
  private aggregateVariantResults(
    existing: VariantResults | undefined,
    variant: VariantType,
    newResult: RecordVariantResultInput['result'],
  ): VariantResults {
    if (!existing) {
      // Initialize new results
      const stdDev = this.calculateStdDev(newResult.scores || [newResult.score]);
      const ci = this.calculateConfidenceInterval(
        newResult.score,
        stdDev,
        newResult.sampleSize,
      );

      return {
        variant,
        score: newResult.score,
        sampleSize: newResult.sampleSize,
        traceIds: [...newResult.traceIds],
        scores: newResult.scores || [newResult.score],
        stdDev,
        confidenceInterval: ci,
      };
    }

    // Combine scores
    const allScores = [...(existing.scores || []), ...(newResult.scores || [newResult.score])];
    const totalSamples = existing.sampleSize + newResult.sampleSize;

    // Calculate weighted average score
    const combinedScore =
      (existing.score * existing.sampleSize + newResult.score * newResult.sampleSize) /
      totalSamples;

    // Calculate new statistics
    const stdDev = this.calculateStdDev(allScores);
    const ci = this.calculateConfidenceInterval(combinedScore, stdDev, totalSamples);

    return {
      variant,
      score: combinedScore,
      sampleSize: totalSamples,
      traceIds: [...existing.traceIds, ...newResult.traceIds],
      scores: allScores,
      stdDev,
      confidenceInterval: ci,
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(scores: number[]): number {
    if (scores.length < 2) return 0;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const squaredDiffs = scores.map((s) => Math.pow(s - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (scores.length - 1);

    return Math.sqrt(variance);
  }

  /**
   * Calculate 95% confidence interval
   */
  private calculateConfidenceInterval(
    mean: number,
    stdDev: number,
    sampleSize: number,
  ): { lower: number; upper: number } {
    if (sampleSize < 2) {
      return { lower: mean, upper: mean };
    }

    // z-score for 95% CI
    const zScore = 1.96;
    const marginOfError = zScore * (stdDev / Math.sqrt(sampleSize));

    return {
      lower: mean - marginOfError,
      upper: mean + marginOfError,
    };
  }

  /**
   * Build full analysis from partial analysis input
   */
  private buildFullAnalysis(
    experiment: OpikExperiment,
    analysis: CompleteExperimentInput['analysis'],
  ): ExperimentAnalysis {
    const baselineSamples = experiment.baselineResults?.sampleSize || 0;
    const variantSamples = experiment.variantResults?.sampleSize || 0;
    const totalSamples = baselineSamples + variantSamples;

    // Calculate effect size (Cohen's d)
    let effectSize: number | undefined;
    let effectSizeInterpretation: ExperimentAnalysis['effectSizeInterpretation'];

    if (
      experiment.baselineResults?.stdDev &&
      experiment.variantResults?.stdDev &&
      (experiment.baselineResults.stdDev > 0 || experiment.variantResults.stdDev > 0)
    ) {
      const pooledStdDev = Math.sqrt(
        (Math.pow(experiment.baselineResults.stdDev, 2) +
          Math.pow(experiment.variantResults.stdDev, 2)) /
          2,
      );

      if (pooledStdDev > 0) {
        effectSize =
          ((experiment.variantResults?.score || 0) - (experiment.baselineResults?.score || 0)) /
          pooledStdDev;

        const absEffect = Math.abs(effectSize);
        if (absEffect < EFFECT_SIZE_THRESHOLDS.negligible) {
          effectSizeInterpretation = 'negligible';
        } else if (absEffect < EFFECT_SIZE_THRESHOLDS.small) {
          effectSizeInterpretation = 'small';
        } else if (absEffect < EFFECT_SIZE_THRESHOLDS.medium) {
          effectSizeInterpretation = 'medium';
        } else {
          effectSizeInterpretation = 'large';
        }
      }
    }

    // Determine recommendation
    let recommendation: ExperimentAnalysis['recommendation'];
    let summary: string;

    if (!analysis.isSignificant) {
      if (totalSamples < MIN_SAMPLES_FOR_SIGNIFICANCE * 2) {
        recommendation = 'run_longer';
        summary = `Results not yet significant (p=${analysis.pValue.toFixed(4)}). Need more samples for reliable conclusion.`;
      } else {
        recommendation = 'inconclusive';
        summary = `No significant difference detected between variants (p=${analysis.pValue.toFixed(4)}). Consider keeping baseline or re-evaluating hypothesis.`;
      }
    } else if (analysis.winner === 'variant') {
      recommendation = 'adopt_variant';
      summary = `Variant shows significant improvement of ${analysis.improvement.toFixed(2)}% (p=${analysis.pValue.toFixed(4)}). Recommend adopting the variant.`;
    } else {
      recommendation = 'keep_baseline';
      summary = `Baseline performs better by ${Math.abs(analysis.improvement).toFixed(2)}% (p=${analysis.pValue.toFixed(4)}). Recommend keeping the baseline.`;
    }

    // Estimate sample size needed if not significant
    let estimatedSampleSizeNeeded: number | undefined;
    if (!analysis.isSignificant && effectSize && Math.abs(effectSize) > 0.1) {
      // Power analysis approximation for two-sample t-test (80% power, alpha=0.05)
      const minEffect = Math.abs(effectSize);
      estimatedSampleSizeNeeded = Math.ceil(
        2 * Math.pow((1.96 + 0.84) / minEffect, 2),
      );
    }

    return {
      winner: analysis.winner,
      improvement: analysis.improvement,
      confidence: analysis.confidence || 1 - analysis.pValue,
      pValue: analysis.pValue,
      isSignificant: analysis.isSignificant,
      degreesOfFreedom: analysis.degreesOfFreedom,
      tStatistic: analysis.tStatistic,
      summary,
      recommendation,
      effectSize,
      effectSizeInterpretation,
      mdeAchieved: effectSize !== undefined && Math.abs(effectSize) >= 0.2,
      estimatedSampleSizeNeeded,
    };
  }

  /**
   * Generate experiment timeline
   */
  private generateTimeline(experiment: OpikExperiment): ExperimentTimelineEntry[] {
    const timeline: ExperimentTimelineEntry[] = [];

    // Created event
    timeline.push({
      timestamp: experiment.createdAt,
      event: 'created',
    });

    // Started event
    if (experiment.startedAt && experiment.startedAt !== experiment.createdAt) {
      timeline.push({
        timestamp: experiment.startedAt,
        event: 'started',
      });
    }

    // Add result events (simplified - in production would track each result)
    if (experiment.baselineResults) {
      timeline.push({
        timestamp: experiment.startedAt || experiment.createdAt,
        event: 'baseline_result',
        variant: 'baseline',
        metrics: {
          baselineScore: experiment.baselineResults.score,
          baselineSamples: experiment.baselineResults.sampleSize,
        },
      });
    }

    if (experiment.variantResults) {
      timeline.push({
        timestamp: experiment.startedAt || experiment.createdAt,
        event: 'variant_result',
        variant: 'variant',
        metrics: {
          variantScore: experiment.variantResults.score,
          variantSamples: experiment.variantResults.sampleSize,
        },
      });
    }

    // Completion event
    if (experiment.completedAt) {
      timeline.push({
        timestamp: experiment.completedAt,
        event: experiment.status === 'failed' ? 'failed' : 'completed',
        metrics: {
          baselineScore: experiment.baselineResults?.score,
          baselineSamples: experiment.baselineResults?.sampleSize,
          variantScore: experiment.variantResults?.score,
          variantSamples: experiment.variantResults?.sampleSize,
        },
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return timeline;
  }

  /**
   * Generate recommendation text for UI
   */
  private generateRecommendationText(experiment: OpikExperiment): string {
    if (!experiment.analysis) {
      if (experiment.status === 'running') {
        return 'Experiment in progress. Collect more data before making a decision.';
      }
      return 'Experiment not yet analyzed.';
    }

    return experiment.analysis.summary;
  }

  /**
   * Map database status to interface status
   */
  private mapDbStatus(dbStatus: string): ExperimentStatus {
    const statusMap: Record<string, ExperimentStatus> = {
      CREATED: 'created',
      PENDING: 'created',
      RUNNING: 'running',
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELLED: 'cancelled',
    };

    return statusMap[dbStatus] || 'created';
  }
}
