/**
 * Population Interface
 *
 * Interfaces for evolutionary prompt optimization.
 */

import {
  PopulationConfig,
  PromptIndividual,
  GenerationResult,
  EvolutionResult,
  EvaluationDatasetItem,
} from '../optimizer.types';

/**
 * Interface for letter (evolutionary) optimizer service
 */
export interface ILetterOptimizer {
  /**
   * Evolve a prompt using evolutionary optimization
   *
   * @param basePrompt - Starting prompt to evolve
   * @param dataset - Dataset for fitness evaluation
   * @param config - Population configuration
   * @returns Evolution result with best prompt
   */
  evolvePrompt(
    basePrompt: string,
    dataset: EvaluationDatasetItem[],
    config: Partial<PopulationConfig>,
  ): Promise<EvolutionResult>;
}

/**
 * Interface for population management
 */
export interface IPopulationManager {
  /**
   * Initialize a population from a base prompt
   *
   * @param basePrompt - The seed prompt
   * @param size - Population size
   * @returns Initial population
   */
  initializePopulation(basePrompt: string, size: number): Promise<PromptIndividual[]>;

  /**
   * Evaluate fitness for all individuals in a population
   *
   * @param population - Population to evaluate
   * @param dataset - Dataset for evaluation
   * @returns Population with fitness scores updated
   */
  evaluatePopulation(
    population: PromptIndividual[],
    dataset: EvaluationDatasetItem[],
  ): Promise<PromptIndividual[]>;

  /**
   * Select survivors for the next generation
   *
   * @param population - Current population
   * @param survivalRate - Percentage to keep
   * @returns Selected survivors
   */
  selectSurvivors(population: PromptIndividual[], survivalRate: number): PromptIndividual[];
}

/**
 * Interface for crossover and mutation operations
 */
export interface ICrossoverMutation {
  /**
   * Generate offspring through crossover of two parents
   *
   * @param parent1 - First parent
   * @param parent2 - Second parent
   * @param generation - Generation number for offspring
   * @returns Offspring individual
   */
  crossover(
    parent1: PromptIndividual,
    parent2: PromptIndividual,
    generation: number,
  ): Promise<PromptIndividual>;

  /**
   * Apply mutation to an individual
   *
   * @param individual - Individual to mutate
   * @param mutationRate - Probability of mutation
   * @returns Mutated individual (or original if no mutation)
   */
  mutate(individual: PromptIndividual, mutationRate: number): Promise<PromptIndividual>;

  /**
   * Generate a variant of the base prompt using LLM
   *
   * @param basePrompt - Prompt to create variant from
   * @returns Variant prompt text
   */
  generateVariant(basePrompt: string): Promise<string>;
}

/**
 * Population metrics for adaptive parameter tuning
 *
 * Tracks key indicators that inform how genetic algorithm
 * parameters should be adjusted during evolution.
 */
export interface PopulationMetrics {
  /** Population diversity (0-1), how different individuals are from each other */
  diversity: number;
  /** Variance in fitness scores across the population */
  fitnessVariance: number;
  /** Rate of fitness improvement compared to previous generation */
  improvementRate: number;
  /** Number of consecutive generations without improvement */
  stagnationCount: number;
}

/**
 * Configuration for adaptive parameter bounds
 *
 * Defines the min/max limits for parameters that will be
 * dynamically adjusted based on population metrics.
 */
export interface AdaptiveConfig {
  /** Bounds for mutation rate adjustment */
  mutationRateBounds: { min: number; max: number };
  /** Bounds for survival rate adjustment */
  survivalRateBounds: { min: number; max: number };
  /** Number of stagnant generations before increasing exploration */
  stagnationThreshold: number;
  /** Minimum diversity level before triggering parameter adjustment */
  diversityThreshold: number;
}

/**
 * Runtime adaptive parameters that change during evolution
 */
export interface AdaptiveParameters {
  /** Current mutation rate (adjusted based on metrics) */
  mutationRate: number;
  /** Current survival rate (adjusted based on metrics) */
  survivalRate: number;
}

/**
 * Fitness evaluation result
 */
export interface FitnessEvaluationResult {
  /** Individual ID */
  individualId: string;
  /** Calculated fitness score */
  fitness: number;
  /** Number of evaluations performed */
  evaluationCount: number;
  /** Detailed scores per dataset item */
  detailedScores?: number[];
  /** Any errors during evaluation */
  errors?: string[];
}

/**
 * Generation evolution context
 */
export interface GenerationContext {
  /** Current generation number */
  generation: number;
  /** Parent population */
  parents: PromptIndividual[];
  /** Offspring created */
  offspring: PromptIndividual[];
  /** Elite individuals preserved */
  elites: PromptIndividual[];
}

// Re-export for convenience
export type {
  PopulationConfig,
  PromptIndividual,
  GenerationResult,
  EvolutionResult,
  EvaluationDatasetItem,
};
