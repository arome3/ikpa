/**
 * Metric Interfaces
 *
 * Type definitions for G-Eval metrics that evaluate IKPA AI agent responses.
 * These metrics power the Opik optimizer loop and ensure quality standards.
 */

/**
 * Result of a metric evaluation
 */
export interface MetricResult {
  /** Score value (scale depends on metric type) */
  score: number;
  /** Explanation of the score */
  reason: string;
  /** Additional metadata about the evaluation */
  metadata?: Record<string, unknown>;
}

/**
 * Dataset item for evaluation
 * Contains the user input, expected output, and context
 */
export interface DatasetItem {
  /** User input/query that triggered the AI response */
  input: string;
  /** Expected or reference output (if available) */
  output: string;
  /** User action after receiving the response */
  userAction?: 'saved' | 'spent';
  /** Additional context for evaluation */
  context?: EvaluationContext;
}

/**
 * Evaluation context with typed fields
 */
export interface EvaluationContext {
  /** User's action after intervention */
  userAction?: 'saved' | 'spent';
  /** Type of stake used in commitment */
  stakeType?: 'social' | 'anti_charity' | 'loss_pool' | 'none';
  /** Whether goal was completed */
  goalCompleted?: boolean;
  /** User's country/region */
  country?: string;
  /** User's cultural context */
  culture?: string;
  /** User's currency code */
  currency?: string;
  /** Additional context fields */
  [key: string]: unknown;
}

/**
 * Interface for all metric implementations
 */
export interface IMetric {
  /** Metric name for identification */
  readonly name: string;
  /** Description of what this metric evaluates */
  readonly description: string;

  /**
   * Evaluate an LLM output against the dataset item
   *
   * @param datasetItem - The input context and expected output
   * @param llmOutput - The actual LLM response to evaluate
   * @returns MetricResult with score and explanation
   */
  score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult>;
}

/**
 * Interface for G-Eval (LLM-as-judge) metrics
 */
export interface IGEvalMetric extends IMetric {
  /** Scale for the metric (e.g., 5 for 1-5 scale) */
  readonly scale: number;
}

/**
 * Metric type classification
 */
export type MetricType =
  | 'binary'      // 0 or 1 (pass/fail)
  | 'g-eval'      // LLM-as-judge (1-5 scale typically)
  | 'weighted'    // Weighted score (0-1)
  | 'guardrail';  // Safety check (0 = block, 1 = pass)

/**
 * Metric configuration
 */
export interface MetricConfig {
  /** Metric type */
  type: MetricType;
  /** Whether this metric can block responses */
  isBlocker: boolean;
  /** Threshold for blocking (if applicable) */
  blockThreshold?: number;
  /** Weight for aggregated scoring */
  weight?: number;
}
