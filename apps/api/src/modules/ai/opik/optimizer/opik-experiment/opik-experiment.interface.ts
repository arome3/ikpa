/**
 * Opik Experiment Interfaces
 *
 * Type definitions for the Opik Experiments integration that enables
 * A/B comparison UI for framing experiments.
 */

import { StatisticalAnalysisResult } from '../optimizer.types';

// ==========================================
// EXPERIMENT CONFIGURATION
// ==========================================

/**
 * Configuration for creating a new experiment
 */
export interface CreateExperimentConfig {
  /** Human-readable experiment name */
  name: string;

  /** Hypothesis being tested */
  hypothesis: string;

  /** Description of the baseline/control variant */
  baselineDescription: string;

  /** Description of the variant being tested */
  variantDescription: string;

  /** Optional experiment type (defaults to 'framing') */
  type?: ExperimentType;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Optional tags for filtering */
  tags?: string[];
}

/**
 * Supported experiment types
 */
export type ExperimentType = 'framing' | 'prompt' | 'model' | 'parameter' | 'custom';

/**
 * Experiment status values
 */
export type ExperimentStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Variant types for A/B experiments
 */
export type VariantType = 'baseline' | 'variant';

// ==========================================
// EXPERIMENT STATE
// ==========================================

/**
 * Full experiment state stored in Opik via traces
 */
export interface OpikExperiment {
  /** Unique experiment identifier */
  id: string;

  /** Experiment name */
  name: string;

  /** Hypothesis being tested */
  hypothesis: string;

  /** Baseline description */
  baselineDescription: string;

  /** Variant description */
  variantDescription: string;

  /** Experiment type */
  type: ExperimentType;

  /** Current status */
  status: ExperimentStatus;

  /** Creation timestamp */
  createdAt: Date;

  /** Start timestamp (when first trace was recorded) */
  startedAt?: Date;

  /** Completion timestamp */
  completedAt?: Date;

  /** Opik trace ID for the experiment root trace */
  rootTraceId: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Tags */
  tags?: string[];

  /** Baseline variant results (populated during experiment) */
  baselineResults?: VariantResults;

  /** Test variant results (populated during experiment) */
  variantResults?: VariantResults;

  /** Final analysis (populated when experiment completes) */
  analysis?: ExperimentAnalysis;
}

/**
 * Results for a single variant
 */
export interface VariantResults {
  /** Variant type */
  variant: VariantType;

  /** Average score across all samples */
  score: number;

  /** Number of samples evaluated */
  sampleSize: number;

  /** Individual trace IDs linked to this variant */
  traceIds: string[];

  /** Raw scores for statistical analysis */
  scores?: number[];

  /** Standard deviation */
  stdDev?: number;

  /** Confidence interval (95%) */
  confidenceInterval?: {
    lower: number;
    upper: number;
  };
}

/**
 * Experiment analysis results
 */
export interface ExperimentAnalysis extends StatisticalAnalysisResult {
  /** Summary of the analysis */
  summary: string;

  /** Recommendation based on results */
  recommendation: 'adopt_variant' | 'keep_baseline' | 'run_longer' | 'inconclusive';

  /** Effect size (Cohen's d) */
  effectSize?: number;

  /** Effect size interpretation */
  effectSizeInterpretation?: 'negligible' | 'small' | 'medium' | 'large';

  /** Minimum detectable effect achieved */
  mdeAchieved?: boolean;

  /** Estimated sample size needed for significance (if not yet significant) */
  estimatedSampleSizeNeeded?: number;
}

// ==========================================
// RECORDING INPUTS
// ==========================================

/**
 * Input for recording a variant result
 */
export interface RecordVariantResultInput {
  /** Experiment ID */
  experimentId: string;

  /** Which variant this result is for */
  variant: VariantType;

  /** Result data */
  result: {
    /** Score for this evaluation */
    score: number;

    /** Number of samples in this batch */
    sampleSize: number;

    /** Trace IDs associated with this evaluation */
    traceIds: string[];

    /** Optional raw scores for detailed analysis */
    scores?: number[];
  };
}

/**
 * Input for completing an experiment
 */
export interface CompleteExperimentInput {
  /** Experiment ID */
  experimentId: string;

  /** Analysis results */
  analysis: {
    /** Winning variant (null if inconclusive) */
    winner: VariantType | null;

    /** p-value from statistical test */
    pValue: number;

    /** Improvement percentage */
    improvement: number;

    /** Whether result is statistically significant */
    isSignificant: boolean;

    /** Optional additional metrics */
    confidence?: number;
    effectSize?: number;
    tStatistic?: number;
    degreesOfFreedom?: number;
  };
}

/**
 * Input for linking a trace to an experiment
 */
export interface LinkTraceInput {
  /** Trace ID to link */
  traceId: string;

  /** Experiment ID to link to */
  experimentId: string;

  /** Variant this trace belongs to */
  variant: VariantType;

  /** Optional metadata about this trace's role */
  metadata?: Record<string, unknown>;
}

// ==========================================
// QUERY INTERFACES
// ==========================================

/**
 * Options for listing experiments
 */
export interface ListExperimentsOptions {
  /** Filter by status */
  status?: ExperimentStatus;

  /** Filter by type */
  type?: ExperimentType;

  /** Filter by tags (any match) */
  tags?: string[];

  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort field */
  sortBy?: 'createdAt' | 'completedAt' | 'name';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Experiment comparison data for UI
 */
export interface ExperimentComparison {
  /** Experiment details */
  experiment: OpikExperiment;

  /** Baseline metrics */
  baseline: {
    score: number;
    sampleSize: number;
    stdDev?: number;
    confidenceInterval?: { lower: number; upper: number };
  };

  /** Variant metrics */
  variant: {
    score: number;
    sampleSize: number;
    stdDev?: number;
    confidenceInterval?: { lower: number; upper: number };
  };

  /** Comparison metrics */
  comparison: {
    absoluteDifference: number;
    relativeDifference: number;
    pValue: number;
    isSignificant: boolean;
    confidenceLevel: number;
    winner: VariantType | null;
    recommendation: string;
  };

  /** Timeline data for visualization */
  timeline?: ExperimentTimelineEntry[];
}

/**
 * Timeline entry for experiment progress visualization
 */
export interface ExperimentTimelineEntry {
  /** Timestamp */
  timestamp: Date;

  /** Event type */
  event: 'created' | 'started' | 'baseline_result' | 'variant_result' | 'completed' | 'failed';

  /** Associated variant (if applicable) */
  variant?: VariantType;

  /** Running metrics at this point */
  metrics?: {
    baselineScore?: number;
    baselineSamples?: number;
    variantScore?: number;
    variantSamples?: number;
  };
}

// ==========================================
// SERVICE INTERFACE
// ==========================================

/**
 * Interface for the Opik Experiment Service
 */
export interface IOpikExperimentService {
  /**
   * Create a new experiment
   */
  createExperiment(config: CreateExperimentConfig): Promise<string>;

  /**
   * Record a variant result
   */
  recordVariantResult(
    experimentId: string,
    variant: VariantType,
    result: RecordVariantResultInput['result'],
  ): Promise<void>;

  /**
   * Complete an experiment with final analysis
   */
  completeExperiment(experimentId: string, analysis: CompleteExperimentInput['analysis']): Promise<void>;

  /**
   * Link a trace to an experiment
   */
  linkTraceToExperiment(traceId: string, experimentId: string, variant: VariantType): Promise<void>;

  /**
   * Get experiment by ID
   */
  getExperiment(experimentId: string): Promise<OpikExperiment | null>;

  /**
   * List experiments with filtering
   */
  listExperiments(options?: ListExperimentsOptions): Promise<OpikExperiment[]>;

  /**
   * Get comparison data for an experiment
   */
  getExperimentComparison(experimentId: string): Promise<ExperimentComparison | null>;

  /**
   * Cancel a running experiment
   */
  cancelExperiment(experimentId: string, reason?: string): Promise<void>;
}
