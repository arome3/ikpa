/**
 * Optimizer Types
 *
 * Shared type definitions for the Opik optimization system.
 */

import { RecoveryTool, SlipSeverity } from './optimizer.constants';

// ==========================================
// FRAMING EXPERIMENT TYPES
// ==========================================

/**
 * Configuration for a framing A/B experiment
 */
export interface FramingExperimentConfig {
  /** Experiment name for tracking */
  name: string;
  /** Baseline prompt template */
  baselinePrompt: string;
  /** Variant prompt template to test */
  variantPrompt: string;
  /** Name of the dataset to use */
  datasetName: string;
  /** Metric to evaluate (e.g., 'CancellationRate') */
  metricName: string;
  /** Number of samples per evaluation round */
  nSamples: number;
  /** Maximum number of evaluation rounds */
  maxRounds: number;
}

/**
 * Result of a single variant evaluation
 */
export interface VariantEvaluationResult {
  prompt: string;
  score: number;
  sampleSize: number;
  scores: number[];
}

/**
 * Statistical analysis result
 */
export interface StatisticalAnalysisResult {
  /** Which variant won: 'baseline', 'variant', or null if inconclusive */
  winner: 'baseline' | 'variant' | null;
  /** Improvement percentage of variant over baseline */
  improvement: number;
  /** Confidence level (1 - p-value) */
  confidence: number;
  /** p-value from statistical test */
  pValue: number;
  /** Whether the result is statistically significant */
  isSignificant: boolean;
  /** Degrees of freedom for the test */
  degreesOfFreedom?: number;
  /** t-statistic from Welch's t-test */
  tStatistic?: number;
}

/**
 * Complete framing experiment result
 */
export interface FramingExperimentResult {
  /** Unique experiment identifier */
  experimentId: string;
  /** Baseline evaluation results */
  baseline: VariantEvaluationResult;
  /** Variant evaluation results */
  variant: VariantEvaluationResult;
  /** Statistical analysis */
  analysis: StatisticalAnalysisResult;
}

// ==========================================
// EVOLUTIONARY OPTIMIZER TYPES
// ==========================================

/**
 * Configuration for evolutionary prompt optimization
 */
export interface PopulationConfig {
  /** Size of the population */
  populationSize: number;
  /** Number of generations to evolve */
  generations: number;
  /** Percentage of population that survives to next generation */
  survivalRate: number;
  /** Probability of mutation */
  mutationRate: number;
  /** Number of top performers kept unchanged (elitism) */
  elitismCount: number;
}

/**
 * Individual in the prompt population
 */
export interface PromptIndividual {
  /** Unique identifier */
  id: string;
  /** The prompt text */
  prompt: string;
  /** Generation number */
  generation: number;
  /** Fitness score (higher is better) */
  fitness: number;
  /** IDs of parent prompts (empty for initial population) */
  parentIds: string[];
  /** Whether this individual is elite (protected from mutation) */
  isElite?: boolean;
}

/**
 * Result of a single generation
 */
export interface GenerationResult {
  /** Generation number */
  generation: number;
  /** All individuals in this generation */
  population: PromptIndividual[];
  /** Average fitness of the generation */
  averageFitness: number;
  /** Best fitness in the generation */
  bestFitness: number;
  /** Best individual in the generation */
  bestIndividual: PromptIndividual;
}

/**
 * Complete evolutionary optimization result
 */
export interface EvolutionResult {
  /** Unique experiment identifier */
  experimentId: string;
  /** Results for each generation */
  generations: GenerationResult[];
  /** The best prompt found */
  bestPrompt: PromptIndividual;
  /** Improvement from initial to final best */
  improvementPercentage: number;
  /** Fitness history (best fitness per generation) */
  fitnessHistory: number[];
}

/**
 * Dataset item for prompt evaluation
 */
export interface EvaluationDatasetItem {
  /** Input context for the prompt */
  input: Record<string, unknown>;
  /** Expected output (optional, for supervised learning) */
  expectedOutput?: string;
}

// ==========================================
// TOOL SELECTION (GEPA) TYPES
// ==========================================

/**
 * User profile features for tool recommendation
 */
export interface UserProfileFeatures {
  /** Income stability score (0-1) */
  incomeStability: number;
  /** Current savings rate (0-1) */
  savingsRate: number;
  /** Dependency ratio (0-1, percentage of income supporting others) */
  dependencyRatio: number;
  /** Severity of the financial slip */
  slipSeverity: SlipSeverity;
}

/**
 * Condition for a tool selection rule
 */
export interface ProfileCondition {
  /** Feature to check */
  feature: keyof UserProfileFeatures;
  /** Comparison operator */
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  /** Value to compare against */
  value: number | string | number[] | string[];
}

/**
 * Tool selection rule
 */
export interface ToolSelectionRule {
  /** Unique rule identifier */
  id: string;
  /** Conditions that must all match */
  condition: ProfileCondition[];
  /** Tool to recommend when conditions match */
  recommendedTool: RecoveryTool;
  /** Confidence score (0-1) */
  confidence: number;
  /** Number of samples this rule was derived from */
  sampleSize: number;
  /** Success rate of this rule */
  successRate: number;
}

/**
 * Optimized tool selection policy
 */
export interface OptimizedToolPolicy {
  /** Version identifier */
  version: string;
  /** Active rules in priority order */
  rules: ToolSelectionRule[];
  /** Default tool when no rules match */
  defaultTool: RecoveryTool;
  /** Policy metrics */
  metrics: {
    totalDataPoints: number;
    coveragePercentage: number;
    averageConfidence: number;
  };
}

/**
 * Tool selection history record
 */
export interface ToolSelectionRecord {
  /** User ID */
  userId: string;
  /** Recovery session ID */
  sessionId: string;
  /** Tool that was selected */
  selectedTool: RecoveryTool;
  /** User profile at time of selection */
  userProfile: UserProfileFeatures;
  /** Outcome of the selection */
  outcome: {
    /** Whether the recovery was successful */
    success: boolean;
    /** Recovery completion time (days) */
    recoveryDays?: number;
    /** Final goal probability */
    finalProbability?: number;
  };
}

/**
 * Pattern extracted from historical data
 */
export interface ExtractedPattern {
  /** Conditions that define this pattern */
  conditions: ProfileCondition[];
  /** Tool that performed best for this pattern */
  bestTool: RecoveryTool;
  /** Success rate for this tool in this pattern */
  successRate: number;
  /** Number of data points */
  sampleSize: number;
  /** Statistical confidence */
  confidence: number;
}

/**
 * Tool recommendation result
 */
export interface ToolRecommendation {
  /** Recommended tool */
  tool: RecoveryTool;
  /** Confidence in the recommendation */
  confidence: number;
  /** Rule that matched (if any) */
  matchedRuleId?: string;
  /** Alternative tools with their confidence */
  alternatives: Array<{ tool: RecoveryTool; confidence: number }>;
}

// ==========================================
// SHARED TYPES
// ==========================================

/**
 * Base experiment configuration
 */
export interface BaseExperimentConfig {
  /** Experiment name */
  name: string;
  /** Optional description */
  description?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Experiment status
 */
export type ExperimentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * Experiment type
 */
export type ExperimentType = 'FRAMING' | 'EVOLUTIONARY' | 'GEPA';
