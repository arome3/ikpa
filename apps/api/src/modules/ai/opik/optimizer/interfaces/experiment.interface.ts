/**
 * Experiment Interface
 *
 * Interfaces for framing A/B test experiments.
 */

import {
  FramingExperimentConfig,
  FramingExperimentResult,
  VariantEvaluationResult,
  StatisticalAnalysisResult,
} from '../optimizer.types';

/**
 * Interface for framing optimizer service
 */
export interface IFramingOptimizer {
  /**
   * Run an A/B experiment comparing baseline and variant prompts
   *
   * @param config - Experiment configuration
   * @returns Experiment result with statistical analysis
   */
  runExperiment(config: FramingExperimentConfig): Promise<FramingExperimentResult>;

  /**
   * Evaluate a single prompt against a dataset
   *
   * @param prompt - The prompt to evaluate
   * @param datasetName - Name of the dataset
   * @param nSamples - Number of samples to evaluate
   * @returns Evaluation result with scores
   */
  evaluatePrompt(
    prompt: string,
    datasetName: string,
    nSamples: number,
  ): Promise<VariantEvaluationResult>;

  /**
   * Perform statistical analysis comparing two sets of scores
   *
   * @param baselineScores - Scores from baseline variant
   * @param variantScores - Scores from variant
   * @returns Statistical analysis result
   */
  performStatisticalAnalysis(
    baselineScores: number[],
    variantScores: number[],
  ): StatisticalAnalysisResult;
}

/**
 * Dataset item for framing experiments
 */
export interface FramingDatasetItem {
  /** Subscription name */
  name: string;
  /** Monthly cost */
  monthly: string;
  /** Annual cost */
  annual: string;
  /** Category */
  category?: string;
  /** Expected decision (for supervised evaluation) */
  expectedDecision?: 'keep' | 'cancel';
}

/**
 * Framing evaluation context
 */
export interface FramingEvaluationContext {
  /** Rendered prompt */
  prompt: string;
  /** Dataset item */
  item: FramingDatasetItem;
  /** Model response */
  response: string;
  /** Evaluation score */
  score: number;
}

// Re-export for convenience
export type {
  FramingExperimentConfig,
  FramingExperimentResult,
  VariantEvaluationResult,
  StatisticalAnalysisResult,
};
