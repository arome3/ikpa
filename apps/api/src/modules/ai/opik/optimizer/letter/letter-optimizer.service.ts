/**
 * Letter Optimizer Service
 *
 * Evolutionary optimizer for Future Self letter prompts.
 * Uses genetic algorithms with LLM-based crossover and mutation
 * to evolve prompts that maximize ToneEmpathy scores.
 *
 * Key Features:
 * - Population-based optimization with configurable parameters
 * - LLM-powered genetic operators (crossover, mutation)
 * - ToneEmpathy fitness function
 * - Elitism to preserve best performers
 * - Full Opik tracing with generation-level feedback
 *
 * @example
 * ```typescript
 * const result = await letterOptimizer.evolvePrompt(
 *   BASE_LETTER_PROMPT,
 *   evaluationDataset,
 *   { populationSize: 10, generations: 5 }
 * );
 * console.log(result.bestPrompt.prompt);
 * // Evolved prompt with 44% improvement
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { OpikService } from '../../opik.service';
import { PopulationManager } from './population-manager';
import { CrossoverMutationService } from './crossover-mutation.service';
import { AlertService } from '../alerting/alert.service';
import {
  ILetterOptimizer,
  PopulationConfig,
  PromptIndividual,
  GenerationResult,
  EvolutionResult,
  EvaluationDatasetItem,
  PopulationMetrics,
  AdaptiveConfig,
  AdaptiveParameters,
} from '../interfaces';
import {
  TRACE_EVOLUTIONARY_OPTIMIZATION,
  FEEDBACK_GENERATION_FITNESS,
  DEFAULT_POPULATION_SIZE,
  DEFAULT_GENERATIONS,
  DEFAULT_SURVIVAL_RATE,
  DEFAULT_MUTATION_RATE,
  DEFAULT_ELITISM_COUNT,
  DEFAULT_ADAPTIVE_CONFIG,
  ADAPTIVE_MUTATION_INCREASE_FACTOR,
  ADAPTIVE_MUTATION_DECREASE_FACTOR,
  ADAPTIVE_SURVIVAL_DECREASE_FACTOR,
  ADAPTIVE_GOOD_IMPROVEMENT_THRESHOLD,
} from '../optimizer.constants';

@Injectable()
export class LetterOptimizerService implements ILetterOptimizer {
  private readonly logger = new Logger(LetterOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly populationManager: PopulationManager,
    private readonly crossoverMutation: CrossoverMutationService,
    private readonly alertService: AlertService,
  ) {}

  /**
   * Evolve a prompt using evolutionary optimization
   */
  async evolvePrompt(
    basePrompt: string,
    dataset: EvaluationDatasetItem[],
    config: Partial<PopulationConfig> = {},
  ): Promise<EvolutionResult> {
    const experimentId = randomUUID();
    const startTime = Date.now();

    // Merge with defaults
    const fullConfig: PopulationConfig = {
      populationSize: config.populationSize ?? DEFAULT_POPULATION_SIZE,
      generations: config.generations ?? DEFAULT_GENERATIONS,
      survivalRate: config.survivalRate ?? DEFAULT_SURVIVAL_RATE,
      mutationRate: config.mutationRate ?? DEFAULT_MUTATION_RATE,
      elitismCount: config.elitismCount ?? DEFAULT_ELITISM_COUNT,
    };

    this.logger.log(
      `Starting evolutionary optimization: ${experimentId} ` +
        `(pop=${fullConfig.populationSize}, gen=${fullConfig.generations})`,
    );

    // Create database record
    await this.prisma.optimizerExperiment.create({
      data: {
        id: experimentId,
        type: 'EVOLUTIONARY',
        name: `letter-evolution-${experimentId.slice(0, 8)}`,
        config: fullConfig as unknown as Record<string, unknown>,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Create Opik trace
    const trace = this.opikService.createTrace({
      name: TRACE_EVOLUTIONARY_OPTIMIZATION,
      input: {
        experimentId,
        basePromptLength: basePrompt.length,
        datasetSize: dataset.length,
        config: fullConfig,
      },
      metadata: {
        experimentType: 'evolutionary',
        populationSize: fullConfig.populationSize,
        generations: fullConfig.generations,
      },
      tags: ['optimizer', 'evolutionary', 'letter'],
    });

    try {
      // Initialize population
      let population = await this.populationManager.initializePopulation(
        basePrompt,
        fullConfig.populationSize,
      );

      // Evaluate initial population
      population = await this.populationManager.evaluatePopulation(population, dataset);

      const generations: GenerationResult[] = [];
      const fitnessHistory: number[] = [];
      const metricsHistory: PopulationMetrics[] = [];

      // Initialize adaptive parameters
      let adaptiveParams: AdaptiveParameters = {
        mutationRate: fullConfig.mutationRate,
        survivalRate: fullConfig.survivalRate,
      };
      let stagnationCount = 0;

      // Record initial generation
      const initialGen = this.createGenerationResult(0, population);
      generations.push(initialGen);
      fitnessHistory.push(initialGen.bestFitness);

      // Calculate and record initial metrics
      const initialMetrics = this.populationManager.calculateMetrics(
        population,
        0, // No previous best fitness
        0, // No stagnation yet
      );
      metricsHistory.push(initialMetrics);

      // Save initial generation to database
      await this.saveGeneration(experimentId, population);

      // Record initial fitness to Opik
      this.recordGenerationFitness(trace, 0, initialGen);
      this.recordAdaptiveMetrics(trace, 0, initialMetrics, adaptiveParams);

      // Evolve through generations
      for (let gen = 1; gen <= fullConfig.generations; gen++) {
        // Create span for this generation
        const genSpan = trace
          ? this.opikService.createGeneralSpan({
              trace: trace.trace,
              name: `generation_${gen}`,
              input: {
                generation: gen,
                populationSize: population.length,
                previousBestFitness: fitnessHistory[fitnessHistory.length - 1],
                adaptiveParams: { ...adaptiveParams },
              },
            })
          : null;

        // Select survivors using adaptive survival rate
        const survivors = this.populationManager.selectSurvivors(
          population,
          adaptiveParams.survivalRate,
        );

        // Identify elites (protect from mutation)
        const elites = survivors.slice(0, fullConfig.elitismCount).map((ind) => ({
          ...ind,
          generation: gen,
          isElite: true,
        }));

        // Generate offspring through crossover and mutation using adaptive mutation rate
        const offspring = await this.generateOffspring(
          survivors,
          fullConfig.populationSize - elites.length,
          gen,
          adaptiveParams.mutationRate,
        );

        // New population = elites + offspring
        population = [...elites, ...offspring];

        // Evaluate new population
        population = await this.populationManager.evaluatePopulation(population, dataset);

        // Record generation results
        const genResult = this.createGenerationResult(gen, population);
        generations.push(genResult);
        fitnessHistory.push(genResult.bestFitness);

        // Calculate population metrics for adaptive tuning
        const previousBestFitness = fitnessHistory[fitnessHistory.length - 2];
        const metrics = this.populationManager.calculateMetrics(
          population,
          previousBestFitness,
          stagnationCount,
        );
        metricsHistory.push(metrics);
        stagnationCount = metrics.stagnationCount;

        // Adapt parameters based on metrics
        adaptiveParams = this.adaptParameters(metrics, adaptiveParams);

        // Save to database
        await this.saveGeneration(experimentId, population);

        // Record to Opik
        this.recordGenerationFitness(trace, gen, genResult);
        this.recordAdaptiveMetrics(trace, gen, metrics, adaptiveParams);

        if (genSpan) {
          this.opikService.endSpan(genSpan, {
            output: {
              bestFitness: genResult.bestFitness,
              averageFitness: genResult.averageFitness,
              eliteCount: elites.length,
              offspringCount: offspring.length,
              metrics: {
                diversity: metrics.diversity,
                stagnationCount: metrics.stagnationCount,
                improvementRate: metrics.improvementRate,
              },
              adaptiveParams: { ...adaptiveParams },
            },
          });
        }

        this.logger.debug(
          `Generation ${gen}: best=${genResult.bestFitness.toFixed(2)}, ` +
            `avg=${genResult.averageFitness.toFixed(2)}, ` +
            `diversity=${metrics.diversity.toFixed(3)}, ` +
            `mutation=${adaptiveParams.mutationRate.toFixed(3)}`,
        );
      }

      // Find overall best individual
      const allIndividuals = generations.flatMap((g) => g.population);
      const bestPrompt = allIndividuals.reduce((best, ind) =>
        ind.fitness > best.fitness ? ind : best,
      );

      // Calculate improvement
      const initialBest = generations[0].bestFitness;
      const finalBest = bestPrompt.fitness;
      const improvementPercentage =
        initialBest > 0 ? ((finalBest - initialBest) / initialBest) * 100 : 0;

      const result: EvolutionResult = {
        experimentId,
        generations,
        bestPrompt,
        improvementPercentage,
        fitnessHistory,
      };

      // Update database
      const durationMs = Date.now() - startTime;
      await this.prisma.optimizerExperiment.update({
        where: { id: experimentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: result as unknown as Record<string, unknown>,
        },
      });

      this.opikService.endTrace(trace, {
        success: true,
        result: {
          bestFitness: bestPrompt.fitness,
          improvementPercentage,
          generationsCompleted: fullConfig.generations,
          durationMs,
        },
      });

      this.logger.log(
        `Evolutionary optimization completed: ${experimentId}, ` +
          `best fitness=${bestPrompt.fitness.toFixed(2)}, ` +
          `improvement=${improvementPercentage.toFixed(2)}%`,
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

      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`Evolutionary optimization failed: ${errorMessage}`);

      // Send alert for the failure
      await this.alertService.sendOptimizationFailure(
        experimentId,
        'EVOLUTIONARY',
        error instanceof Error ? error : errorMessage,
        {
          populationSize: fullConfig.populationSize,
          generations: fullConfig.generations,
          datasetSize: dataset.length,
        },
      );

      throw error;
    } finally {
      await this.opikService.flush();
    }
  }

  /**
   * Generate offspring through crossover and mutation
   */
  private async generateOffspring(
    parents: PromptIndividual[],
    count: number,
    generation: number,
    mutationRate: number,
  ): Promise<PromptIndividual[]> {
    const offspring: PromptIndividual[] = [];

    for (let i = 0; i < count; i++) {
      // Select two parents (tournament selection)
      const parent1 = this.tournamentSelect(parents);
      const parent2 = this.tournamentSelect(parents);

      // Crossover
      let child = await this.crossoverMutation.crossover(parent1, parent2, generation);

      // Mutation
      child = await this.crossoverMutation.mutate(child, mutationRate);

      offspring.push(child);
    }

    return offspring;
  }

  /**
   * Tournament selection
   *
   * Select a parent by picking two different random individuals and
   * returning the one with higher fitness.
   *
   * Edge cases:
   * - Empty population: throws an error (cannot select from nothing)
   * - Population size 1: returns the single individual (no tournament needed)
   * - Population size 2+: performs standard tournament selection
   *
   * @param population - Array of individuals to select from
   * @returns The winning individual from the tournament
   * @throws Error if population is empty
   */
  private tournamentSelect(population: PromptIndividual[]): PromptIndividual {
    // Handle empty population - this is an error condition
    if (population.length === 0) {
      throw new Error(
        'Tournament selection failed: population is empty. ' +
          'Ensure population is initialized before selection.',
      );
    }

    // Handle single individual - no tournament needed, just return it
    if (population.length === 1) {
      return population[0];
    }

    // Standard tournament selection for population size >= 2
    const idx1 = Math.floor(Math.random() * population.length);
    let idx2 = Math.floor(Math.random() * population.length);

    // Ensure we pick two different individuals for proper tournament
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * population.length);
    }

    return population[idx1].fitness >= population[idx2].fitness
      ? population[idx1]
      : population[idx2];
  }

  /**
   * Create a generation result summary
   */
  private createGenerationResult(generation: number, population: PromptIndividual[]): GenerationResult {
    const sortedPop = [...population].sort((a, b) => b.fitness - a.fitness);
    const totalFitness = population.reduce((sum, ind) => sum + ind.fitness, 0);

    return {
      generation,
      population: sortedPop,
      averageFitness: totalFitness / population.length,
      bestFitness: sortedPop[0].fitness,
      bestIndividual: sortedPop[0],
    };
  }

  /**
   * Save generation to database
   */
  private async saveGeneration(
    experimentId: string,
    population: PromptIndividual[],
  ): Promise<void> {
    await this.prisma.promptGeneration.createMany({
      data: population.map((ind) => ({
        experimentId,
        generation: ind.generation,
        prompt: ind.prompt,
        fitness: ind.fitness,
        parentIds: ind.parentIds,
        isElite: ind.isElite ?? false,
        evaluationCount: 1,
      })),
    });
  }

  /**
   * Record generation fitness to Opik
   */
  private recordGenerationFitness(
    trace: { traceId: string } | null,
    generation: number,
    result: GenerationResult,
  ): void {
    if (!trace) return;

    this.opikService.addFeedback({
      traceId: trace.traceId,
      name: `${FEEDBACK_GENERATION_FITNESS}_gen${generation}`,
      value: result.bestFitness,
      category: 'evolution',
      comment: `Generation ${generation}: best=${result.bestFitness.toFixed(2)}, avg=${result.averageFitness.toFixed(2)}`,
    });
  }

  /**
   * Adapt GA parameters based on population metrics
   *
   * Adjusts mutation and survival rates to balance exploration vs exploitation:
   * - High stagnation -> increase mutation (more exploration)
   * - Low diversity -> increase mutation, decrease survival (inject new genes)
   * - Good improvement -> slightly decrease mutation (exploit current direction)
   *
   * @param metrics - Current population metrics
   * @param currentParams - Current adaptive parameters
   * @param adaptiveConfig - Bounds and thresholds for adaptation
   * @returns Adjusted parameters
   */
  adaptParameters(
    metrics: PopulationMetrics,
    currentParams: AdaptiveParameters,
    adaptiveConfig: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG,
  ): AdaptiveParameters {
    let { mutationRate, survivalRate } = currentParams;
    const { mutationRateBounds, survivalRateBounds, stagnationThreshold, diversityThreshold } =
      adaptiveConfig;

    // If stagnation detected, increase mutation to escape local optima
    if (metrics.stagnationCount >= stagnationThreshold) {
      mutationRate = Math.min(
        mutationRate * ADAPTIVE_MUTATION_INCREASE_FACTOR,
        mutationRateBounds.max,
      );
      this.logger.debug(
        `Stagnation detected (${metrics.stagnationCount} generations), ` +
          `increasing mutation rate to ${mutationRate.toFixed(3)}`,
      );
    }

    // If diversity is too low, increase mutation and decrease survival
    if (metrics.diversity < diversityThreshold) {
      mutationRate = Math.min(
        mutationRate * ADAPTIVE_MUTATION_INCREASE_FACTOR,
        mutationRateBounds.max,
      );
      survivalRate = Math.max(
        survivalRate * ADAPTIVE_SURVIVAL_DECREASE_FACTOR,
        survivalRateBounds.min,
      );
      this.logger.debug(
        `Low diversity (${metrics.diversity.toFixed(3)}), ` +
          `mutation=${mutationRate.toFixed(3)}, survival=${survivalRate.toFixed(3)}`,
      );
    }

    // If improvement is good and no stagnation, slightly decrease mutation
    if (
      metrics.improvementRate > ADAPTIVE_GOOD_IMPROVEMENT_THRESHOLD &&
      metrics.stagnationCount === 0
    ) {
      mutationRate = Math.max(
        mutationRate * ADAPTIVE_MUTATION_DECREASE_FACTOR,
        mutationRateBounds.min,
      );
      this.logger.debug(
        `Good improvement (${(metrics.improvementRate * 100).toFixed(1)}%), ` +
          `decreasing mutation rate to ${mutationRate.toFixed(3)}`,
      );
    }

    // Ensure values are within bounds
    mutationRate = Math.max(mutationRateBounds.min, Math.min(mutationRate, mutationRateBounds.max));
    survivalRate = Math.max(survivalRateBounds.min, Math.min(survivalRate, survivalRateBounds.max));

    return { mutationRate, survivalRate };
  }

  /**
   * Record adaptive parameters to Opik trace
   */
  private recordAdaptiveMetrics(
    trace: { traceId: string } | null,
    generation: number,
    metrics: PopulationMetrics,
    params: AdaptiveParameters,
  ): void {
    if (!trace) return;

    this.opikService.addFeedback({
      traceId: trace.traceId,
      name: `adaptive_metrics_gen${generation}`,
      value: metrics.diversity,
      category: 'adaptive',
      comment:
        `Gen ${generation}: diversity=${metrics.diversity.toFixed(3)}, ` +
        `stagnation=${metrics.stagnationCount}, ` +
        `improvement=${(metrics.improvementRate * 100).toFixed(1)}%, ` +
        `mutation=${params.mutationRate.toFixed(3)}, survival=${params.survivalRate.toFixed(3)}`,
    });
  }
}
