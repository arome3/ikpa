/**
 * Population Manager
 *
 * Manages the population lifecycle for evolutionary prompt optimization.
 * Handles initialization, evaluation, and selection of prompt individuals.
 *
 * Circuit Breaker Integration:
 * All LLM calls (variant generation, output generation, evaluation) are
 * wrapped with circuit breaker protection to prevent cascade failures
 * when the Anthropic API is slow or failing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AnthropicService } from '../../../anthropic';
import { ToneEmpathyMetric } from '../../metrics';
import {
  IPopulationManager,
  PromptIndividual,
  EvaluationDatasetItem,
  FitnessEvaluationResult,
  PopulationMetrics,
} from '../interfaces';
import { EVOLUTION_EVALUATION_TIMEOUT_MS, EVOLUTION_MAX_TOKENS } from '../optimizer.constants';
import { CircuitBreakerService } from '../circuit-breaker';

/**
 * Prompt for generating initial population variants
 */
const VARIANT_GENERATION_PROMPT = `You are an expert prompt engineer. Given a base prompt for writing emotional, empathetic letters from a user's future self, create a variant that:

1. Maintains the core message and intent
2. Adjusts tone to be more/less formal, warm, or encouraging
3. May restructure sections or change emphasis
4. Keeps the same template variables ({{name}}, {{age}}, etc.)

IMPORTANT: Return ONLY the variant prompt, no explanations.

Base prompt:
{BASE_PROMPT}

Create a meaningfully different variant:`;

/**
 * Neutral fitness score returned when evaluation fails with circuit breaker open
 */
const NEUTRAL_FITNESS_SCORE = 0.5;

@Injectable()
export class PopulationManager implements IPopulationManager {
  private readonly logger = new Logger(PopulationManager.name);

  constructor(
    private readonly anthropicService: AnthropicService,
    private readonly toneEmpathyMetric: ToneEmpathyMetric,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  /**
   * Initialize a population from a base prompt
   *
   * Creates variants using LLM to introduce diversity while
   * maintaining the core structure and intent.
   *
   * Circuit Breaker Fallback: Uses simple text variations
   */
  async initializePopulation(basePrompt: string, size: number): Promise<PromptIndividual[]> {
    const population: PromptIndividual[] = [];

    // First individual is always the base prompt
    population.push({
      id: randomUUID(),
      prompt: basePrompt,
      generation: 0,
      fitness: 0,
      parentIds: [],
      isElite: false,
    });

    // Generate variants for the rest of the population
    if (this.anthropicService.isAvailable()) {
      for (let i = 1; i < size; i++) {
        // Use circuit breaker for variant generation
        const result = await this.circuitBreaker.execute(
          'variant_generation',
          () => this.generateVariant(basePrompt),
          () => this.createSimpleVariant(basePrompt, i), // Fallback
        );

        if (result.usedFallback) {
          this.logger.debug(
            `Population init variant ${i} used fallback (circuit state: ${result.circuitState})`,
          );
        }

        population.push({
          id: randomUUID(),
          prompt: result.data ?? this.createSimpleVariant(basePrompt, i),
          generation: 0,
          fitness: 0,
          parentIds: [],
          isElite: false,
        });
      }
    } else {
      // AI not available, create simple variations
      for (let i = 1; i < size; i++) {
        population.push({
          id: randomUUID(),
          prompt: this.createSimpleVariant(basePrompt, i),
          generation: 0,
          fitness: 0,
          parentIds: [],
          isElite: false,
        });
      }
    }

    this.logger.log(`Initialized population with ${population.length} individuals`);
    return population;
  }

  /**
   * Evaluate fitness for all individuals in a population
   *
   * Uses ToneEmpathyMetric to score each prompt's output quality.
   * Circuit breaker protects against slow/failing LLM evaluations.
   */
  async evaluatePopulation(
    population: PromptIndividual[],
    dataset: EvaluationDatasetItem[],
  ): Promise<PromptIndividual[]> {
    const evaluatedPopulation: PromptIndividual[] = [];

    for (const individual of population) {
      const evaluation = await this.evaluateIndividual(individual, dataset);

      evaluatedPopulation.push({
        ...individual,
        fitness: evaluation.fitness,
      });
    }

    // Sort by fitness (descending)
    evaluatedPopulation.sort((a, b) => b.fitness - a.fitness);

    return evaluatedPopulation;
  }

  /**
   * Select survivors for the next generation
   *
   * Uses truncation selection - keeps top percentage of population.
   */
  selectSurvivors(population: PromptIndividual[], survivalRate: number): PromptIndividual[] {
    // Ensure population is sorted by fitness
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);

    // Calculate number of survivors
    const survivorCount = Math.max(2, Math.ceil(population.length * survivalRate));

    return sorted.slice(0, survivorCount);
  }

  /**
   * Calculate population diversity using prompt similarity
   *
   * Uses Jaccard similarity on word sets to measure how different
   * individuals are from each other. Returns a value between 0-1
   * where 1 means all prompts are completely different.
   *
   * @param population - Population to analyze
   * @returns Diversity score (0-1)
   */
  calculateDiversity(population: PromptIndividual[]): number {
    if (population.length < 2) {
      return 1; // Single individual = maximum diversity by definition
    }

    const prompts = population.map((ind) => ind.prompt);
    const wordSets = prompts.map((p) => new Set(this.tokenize(p)));

    let totalSimilarity = 0;
    let comparisons = 0;

    // Calculate pairwise Jaccard similarity
    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        const similarity = this.jaccardSimilarity(wordSets[i], wordSets[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    // Average similarity
    const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;

    // Diversity is inverse of similarity
    return 1 - avgSimilarity;
  }

  /**
   * Calculate all population metrics for adaptive parameter tuning
   *
   * @param population - Current population with fitness scores
   * @param previousBestFitness - Best fitness from previous generation
   * @param currentStagnationCount - Current stagnation count
   * @returns Population metrics
   */
  calculateMetrics(
    population: PromptIndividual[],
    previousBestFitness: number,
    currentStagnationCount: number,
  ): PopulationMetrics {
    // Calculate diversity
    const diversity = this.calculateDiversity(population);

    // Calculate fitness variance
    const fitnessValues = population.map((ind) => ind.fitness);
    const fitnessVariance = this.calculateVariance(fitnessValues);

    // Calculate improvement rate
    const currentBestFitness = Math.max(...fitnessValues);
    const improvementRate =
      previousBestFitness > 0
        ? (currentBestFitness - previousBestFitness) / previousBestFitness
        : currentBestFitness > 0
          ? 1
          : 0;

    // Update stagnation count
    const stagnationCount =
      currentBestFitness <= previousBestFitness ? currentStagnationCount + 1 : 0;

    return {
      diversity,
      fitnessVariance,
      improvementRate,
      stagnationCount,
    };
  }

  /**
   * Get circuit breaker health status for evaluation operations
   */
  getCircuitBreakerStatus(): {
    evaluation: string;
    variantGeneration: string;
  } {
    return {
      evaluation: this.circuitBreaker.getState('evaluation'),
      variantGeneration: this.circuitBreaker.getState('variant_generation'),
    };
  }

  /**
   * Tokenize a prompt into words for similarity comparison
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  /**
   * Calculate Jaccard similarity between two sets
   */
  private jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Calculate variance of a number array
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Evaluate a single individual against the dataset
   *
   * Circuit Breaker Fallback: Returns neutral score (0.5)
   */
  private async evaluateIndividual(
    individual: PromptIndividual,
    dataset: EvaluationDatasetItem[],
  ): Promise<FitnessEvaluationResult> {
    const scores: number[] = [];
    const errors: string[] = [];

    for (const item of dataset) {
      // Use circuit breaker for the entire evaluation pipeline
      const result = await this.circuitBreaker.execute(
        'evaluation',
        async () => {
          // Render the prompt with dataset item
          const renderedPrompt = this.renderPrompt(individual.prompt, item.input);

          // Generate output using the prompt
          const output = await this.generateOutput(renderedPrompt);

          // Evaluate with ToneEmpathyMetric
          const metricResult = await this.toneEmpathyMetric.score(
            { input: renderedPrompt, output: '' },
            output,
          );

          return metricResult.score;
        },
        () => NEUTRAL_FITNESS_SCORE, // Fallback: return neutral score
      );

      if (result.usedFallback) {
        this.logger.debug(
          `Evaluation for individual ${individual.id} used fallback ` +
            `(circuit state: ${result.circuitState})`,
        );
        errors.push(`Circuit breaker fallback used (state: ${result.circuitState})`);
      }

      scores.push(result.data ?? NEUTRAL_FITNESS_SCORE);
    }

    // Calculate average fitness
    const fitness = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      individualId: individual.id,
      fitness,
      evaluationCount: scores.length,
      detailedScores: scores,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Generate a variant of the base prompt using LLM
   */
  private async generateVariant(basePrompt: string): Promise<string> {
    if (!this.anthropicService.isAvailable()) {
      throw new Error('Anthropic service not available');
    }

    const prompt = VARIANT_GENERATION_PROMPT.replace('{BASE_PROMPT}', basePrompt);

    const response = await this.anthropicService.generate(
      prompt,
      EVOLUTION_MAX_TOKENS,
      'You are a prompt engineering expert. Create diverse variants while maintaining core intent.',
      EVOLUTION_EVALUATION_TIMEOUT_MS,
    );

    return response.content.trim();
  }

  /**
   * Create a simple variant without LLM (fallback)
   */
  private createSimpleVariant(basePrompt: string, index: number): string {
    const variations = [
      // More formal
      (p: string) =>
        p.replace(/you're/gi, 'you are').replace(/don't/gi, 'do not').replace(/can't/gi, 'cannot'),
      // More casual
      (p: string) =>
        p.replace(/you are/gi, "you're").replace(/do not/gi, "don't").replace(/cannot/gi, "can't"),
      // More encouraging
      (p: string) => p.replace(/Remember/gi, 'Always remember').replace(/Think/gi, 'Please think'),
      // More direct
      (p: string) =>
        p.replace(/Please /gi, '').replace(/always /gi, '').replace(/Remember/gi, 'Note'),
      // Add emphasis
      (p: string) =>
        p.replace(/important/gi, 'very important').replace(/good/gi, 'excellent'),
    ];

    const variation = variations[index % variations.length];
    return variation(basePrompt);
  }

  /**
   * Render a prompt template with input data
   */
  private renderPrompt(template: string, input: Record<string, unknown>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(input)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    return rendered;
  }

  /**
   * Generate output using the rendered prompt
   *
   * Note: This is called within the circuit breaker wrapper in evaluateIndividual
   */
  private async generateOutput(prompt: string): Promise<string> {
    if (!this.anthropicService.isAvailable()) {
      // Return a placeholder for testing
      return "Dear friend, I'm writing to you from the future to share what I've learned...";
    }

    const response = await this.anthropicService.generate(
      prompt,
      500,
      'You are writing a heartfelt letter from the future self to the present self.',
      EVOLUTION_EVALUATION_TIMEOUT_MS,
    );

    return response.content;
  }
}
