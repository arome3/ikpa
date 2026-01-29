/**
 * Letter Optimizer Service Tests
 *
 * Tests evolutionary optimization logic, population management, and genetic operators.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { LetterOptimizerService } from '../letter-optimizer.service';
import { PopulationManager } from '../population-manager';
import { CrossoverMutationService } from '../crossover-mutation.service';
import { PrismaService } from '../../../../../../prisma/prisma.service';
import { OpikService } from '../../../opik.service';
import { AnthropicService } from '../../../../anthropic';
import { ToneEmpathyMetric } from '../../../metrics';
import { AlertService } from '../../alerting/alert.service';
import { PromptIndividual, EvaluationDatasetItem } from '../../interfaces';

describe('LetterOptimizerService', () => {
  let service: LetterOptimizerService;
  let mockPrisma: Partial<PrismaService>;
  let mockOpikService: Partial<OpikService>;
  let mockPopulationManager: Partial<PopulationManager>;
  let mockCrossoverMutation: Partial<CrossoverMutationService>;
  let mockAlertService: Partial<AlertService>;

  const mockPopulation: PromptIndividual[] = [
    { id: '1', prompt: 'Prompt 1', generation: 0, fitness: 3.5, parentIds: [] },
    { id: '2', prompt: 'Prompt 2', generation: 0, fitness: 4.2, parentIds: [] },
    { id: '3', prompt: 'Prompt 3', generation: 0, fitness: 2.8, parentIds: [] },
    { id: '4', prompt: 'Prompt 4', generation: 0, fitness: 3.9, parentIds: [] },
    { id: '5', prompt: 'Prompt 5', generation: 0, fitness: 4.5, parentIds: [] },
  ];

  const mockDataset: EvaluationDatasetItem[] = [
    { input: { name: 'Chidi', age: 28 } },
    { input: { name: 'Amara', age: 32 } },
  ];

  beforeEach(async () => {
    mockPrisma = {
      optimizerExperiment: {
        create: jest.fn().mockResolvedValue({ id: 'test-exp-1' }),
        update: jest.fn().mockResolvedValue({}),
      } as unknown as typeof mockPrisma.optimizerExperiment,
      promptGeneration: {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
      } as unknown as typeof mockPrisma.promptGeneration,
    };

    mockOpikService = {
      createTrace: jest.fn().mockReturnValue({
        trace: {},
        traceId: 'test-trace-1',
        traceName: 'test',
        startedAt: new Date(),
      }),
      createGeneralSpan: jest.fn().mockReturnValue({
        span: {},
        spanId: 'test-span-1',
      }),
      endTrace: jest.fn(),
      endSpan: jest.fn(),
      addFeedback: jest.fn().mockReturnValue(true),
      flush: jest.fn().mockResolvedValue(undefined),
    };

    mockPopulationManager = {
      initializePopulation: jest.fn().mockResolvedValue([...mockPopulation]),
      evaluatePopulation: jest.fn().mockImplementation(async (pop) => {
        // Sort by fitness descending
        return [...pop].sort((a, b) => b.fitness - a.fitness);
      }),
      selectSurvivors: jest.fn().mockImplementation((pop, rate) => {
        const count = Math.max(2, Math.ceil(pop.length * rate));
        return [...pop].sort((a, b) => b.fitness - a.fitness).slice(0, count);
      }),
      calculateMetrics: jest.fn().mockReturnValue({
        diversity: 0.5,
        stagnationCount: 0,
        improvementRate: 0.1,
        averageFitness: 3.5,
        fitnessStdDev: 0.8,
      }),
    };

    mockCrossoverMutation = {
      crossover: jest.fn().mockImplementation(async (p1, p2, gen) => ({
        id: `offspring-${gen}`,
        prompt: `Crossover of ${p1.id} and ${p2.id}`,
        generation: gen,
        fitness: 0,
        parentIds: [p1.id, p2.id],
      })),
      mutate: jest.fn().mockImplementation(async (ind) => ({
        ...ind,
        prompt: ind.prompt + ' (mutated)',
      })),
    };

    mockAlertService = {
      sendOptimizationFailure: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LetterOptimizerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OpikService, useValue: mockOpikService },
        { provide: PopulationManager, useValue: mockPopulationManager },
        { provide: CrossoverMutationService, useValue: mockCrossoverMutation },
        { provide: AlertService, useValue: mockAlertService },
      ],
    }).compile();

    service = module.get<LetterOptimizerService>(LetterOptimizerService);
  });

  describe('evolvePrompt', () => {
    it('should complete evolution with default config', async () => {
      const result = await service.evolvePrompt(
        'Base prompt {{name}}',
        mockDataset,
        { populationSize: 5, generations: 2, elitismCount: 1 },
      );

      expect(result.experimentId).toBeDefined();
      expect(result.generations.length).toBe(3); // Initial + 2 generations
      expect(result.bestPrompt).toBeDefined();
      expect(result.fitnessHistory.length).toBe(3);
    });

    it('should preserve elites across generations', async () => {
      const result = await service.evolvePrompt(
        'Base prompt',
        mockDataset,
        { populationSize: 5, generations: 2, elitismCount: 2, survivalRate: 0.4 },
      );

      // Population manager's selectSurvivors should be called for each generation
      expect(mockPopulationManager.selectSurvivors).toHaveBeenCalled();
    });

    it('should call crossover for offspring generation', async () => {
      await service.evolvePrompt(
        'Base prompt',
        mockDataset,
        { populationSize: 5, generations: 1, elitismCount: 1 },
      );

      // Crossover should be called for non-elite offspring
      expect(mockCrossoverMutation.crossover).toHaveBeenCalled();
    });

    it('should track improvement percentage', async () => {
      // Set up improving fitness over generations
      let fitnessMultiplier = 1;
      mockPopulationManager.evaluatePopulation = jest.fn().mockImplementation(async (pop) => {
        const evaluated = pop.map((ind: PromptIndividual, idx: number) => ({
          ...ind,
          fitness: (3 + idx * 0.3) * fitnessMultiplier,
        }));
        fitnessMultiplier += 0.2;
        return evaluated.sort((a: PromptIndividual, b: PromptIndividual) => b.fitness - a.fitness);
      });

      const result = await service.evolvePrompt(
        'Base prompt',
        mockDataset,
        { populationSize: 5, generations: 3 },
      );

      expect(result.improvementPercentage).toBeGreaterThanOrEqual(0);
      expect(result.fitnessHistory[result.fitnessHistory.length - 1]).toBeGreaterThanOrEqual(
        result.fitnessHistory[0],
      );
    });

    it('should record feedback to Opik for each generation', async () => {
      await service.evolvePrompt(
        'Base prompt',
        mockDataset,
        { populationSize: 5, generations: 2 },
      );

      // Should record feedback for initial generation + 2 more
      expect(mockOpikService.addFeedback).toHaveBeenCalledTimes(3);
    });

    it('should save generations to database', async () => {
      await service.evolvePrompt(
        'Base prompt',
        mockDataset,
        { populationSize: 5, generations: 2 },
      );

      // Should save initial + 2 generations
      expect(mockPrisma.promptGeneration?.createMany).toHaveBeenCalledTimes(3);
    });

    it('should handle evolution failure gracefully', async () => {
      mockPopulationManager.evaluatePopulation = jest.fn().mockRejectedValue(new Error('Evaluation failed'));

      await expect(
        service.evolvePrompt('Base prompt', mockDataset, { populationSize: 5, generations: 1 }),
      ).rejects.toThrow('Evaluation failed');

      expect(mockPrisma.optimizerExperiment?.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  describe('tournamentSelect', () => {
    it('should throw an error when population is empty', () => {
      const emptyPopulation: PromptIndividual[] = [];

      expect(() => {
        // Access private method for testing
        (service as unknown as { tournamentSelect: (pop: PromptIndividual[]) => PromptIndividual }).tournamentSelect(emptyPopulation);
      }).toThrow('Tournament selection failed: population is empty');
    });

    it('should return the single individual when population size is 1', () => {
      const singlePopulation: PromptIndividual[] = [
        { id: 'solo', prompt: 'Single prompt', generation: 0, fitness: 4.0, parentIds: [] },
      ];

      const result = (service as unknown as { tournamentSelect: (pop: PromptIndividual[]) => PromptIndividual }).tournamentSelect(singlePopulation);

      expect(result).toBe(singlePopulation[0]);
      expect(result.id).toBe('solo');
    });

    it('should return one of the individuals when population size is 2', () => {
      const twoPopulation: PromptIndividual[] = [
        { id: 'first', prompt: 'First prompt', generation: 0, fitness: 3.0, parentIds: [] },
        { id: 'second', prompt: 'Second prompt', generation: 0, fitness: 5.0, parentIds: [] },
      ];

      const result = (service as unknown as { tournamentSelect: (pop: PromptIndividual[]) => PromptIndividual }).tournamentSelect(twoPopulation);

      // Should return one of the two individuals (the one with higher fitness)
      expect(twoPopulation).toContainEqual(result);
    });

    it('should tend to select higher fitness individuals over multiple runs', () => {
      const population: PromptIndividual[] = [
        { id: 'low', prompt: 'Low fitness', generation: 0, fitness: 1.0, parentIds: [] },
        { id: 'medium', prompt: 'Medium fitness', generation: 0, fitness: 3.0, parentIds: [] },
        { id: 'high', prompt: 'High fitness', generation: 0, fitness: 5.0, parentIds: [] },
      ];

      const tournamentSelect = (service as unknown as { tournamentSelect: (pop: PromptIndividual[]) => PromptIndividual }).tournamentSelect.bind(service);

      // Run multiple selections and count how often each is selected
      const selectionCounts: Record<string, number> = { low: 0, medium: 0, high: 0 };
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const selected = tournamentSelect(population);
        selectionCounts[selected.id]++;
      }

      // Higher fitness individuals should be selected more often
      // The 'high' fitness should win against 'low' and 'medium'
      // The 'medium' fitness should win against 'low'
      expect(selectionCounts.high).toBeGreaterThan(selectionCounts.low);
      expect(selectionCounts.medium).toBeGreaterThan(selectionCounts.low);
    });

    it('should always select between two different individuals in tournament', () => {
      const population: PromptIndividual[] = [
        { id: '1', prompt: 'P1', generation: 0, fitness: 2.0, parentIds: [] },
        { id: '2', prompt: 'P2', generation: 0, fitness: 2.0, parentIds: [] },
        { id: '3', prompt: 'P3', generation: 0, fitness: 2.0, parentIds: [] },
      ];

      // This test verifies the tournament completes without infinite loop
      // even with equal fitness values
      const tournamentSelect = (service as unknown as { tournamentSelect: (pop: PromptIndividual[]) => PromptIndividual }).tournamentSelect.bind(service);

      for (let i = 0; i < 100; i++) {
        const result = tournamentSelect(population);
        expect(population).toContainEqual(result);
      }
    });
  });
});

describe('PopulationManager', () => {
  let manager: PopulationManager;
  let mockAnthropicService: Partial<AnthropicService>;
  let mockToneEmpathyMetric: Partial<ToneEmpathyMetric>;

  beforeEach(async () => {
    mockAnthropicService = {
      isAvailable: jest.fn().mockReturnValue(false),
      generate: jest.fn(),
    };

    mockToneEmpathyMetric = {
      score: jest.fn().mockResolvedValue({ score: 4, reason: 'Good empathy' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PopulationManager,
        { provide: AnthropicService, useValue: mockAnthropicService },
        { provide: ToneEmpathyMetric, useValue: mockToneEmpathyMetric },
      ],
    }).compile();

    manager = module.get<PopulationManager>(PopulationManager);
  });

  describe('initializePopulation', () => {
    it('should create population of specified size', async () => {
      const population = await manager.initializePopulation('Base prompt', 5);

      expect(population.length).toBe(5);
    });

    it('should include base prompt as first individual', async () => {
      const basePrompt = 'My unique base prompt';
      const population = await manager.initializePopulation(basePrompt, 5);

      expect(population[0].prompt).toBe(basePrompt);
    });

    it('should set generation to 0 for all individuals', async () => {
      const population = await manager.initializePopulation('Base prompt', 5);

      population.forEach((ind) => {
        expect(ind.generation).toBe(0);
      });
    });

    it('should initialize fitness to 0', async () => {
      const population = await manager.initializePopulation('Base prompt', 5);

      population.forEach((ind) => {
        expect(ind.fitness).toBe(0);
      });
    });

    it('should create unique IDs for each individual', async () => {
      const population = await manager.initializePopulation('Base prompt', 5);
      const ids = population.map((ind) => ind.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('selectSurvivors', () => {
    const population: PromptIndividual[] = [
      { id: '1', prompt: 'P1', generation: 0, fitness: 3.0, parentIds: [] },
      { id: '2', prompt: 'P2', generation: 0, fitness: 5.0, parentIds: [] },
      { id: '3', prompt: 'P3', generation: 0, fitness: 2.0, parentIds: [] },
      { id: '4', prompt: 'P4', generation: 0, fitness: 4.0, parentIds: [] },
      { id: '5', prompt: 'P5', generation: 0, fitness: 1.0, parentIds: [] },
    ];

    it('should select top performers by fitness', () => {
      const survivors = manager.selectSurvivors(population, 0.4); // Top 40% = 2

      expect(survivors.length).toBe(2);
      expect(survivors[0].fitness).toBe(5.0);
      expect(survivors[1].fitness).toBe(4.0);
    });

    it('should always keep at least 2 survivors', () => {
      const survivors = manager.selectSurvivors(population, 0.1); // Would be 0.5, rounds to 1

      expect(survivors.length).toBeGreaterThanOrEqual(2);
    });

    it('should sort survivors by fitness descending', () => {
      const survivors = manager.selectSurvivors(population, 0.6);

      for (let i = 1; i < survivors.length; i++) {
        expect(survivors[i - 1].fitness).toBeGreaterThanOrEqual(survivors[i].fitness);
      }
    });
  });
});

describe('CrossoverMutationService', () => {
  let service: CrossoverMutationService;
  let mockAnthropicService: Partial<AnthropicService>;

  beforeEach(async () => {
    mockAnthropicService = {
      isAvailable: jest.fn().mockReturnValue(false),
      generate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossoverMutationService,
        { provide: AnthropicService, useValue: mockAnthropicService },
      ],
    }).compile();

    service = module.get<CrossoverMutationService>(CrossoverMutationService);
  });

  describe('crossover', () => {
    const parent1: PromptIndividual = {
      id: 'p1',
      prompt: 'First prompt. Second sentence.',
      generation: 0,
      fitness: 4.0,
      parentIds: [],
    };

    const parent2: PromptIndividual = {
      id: 'p2',
      prompt: 'Different prompt. Another sentence.',
      generation: 0,
      fitness: 3.5,
      parentIds: [],
    };

    it('should create offspring with parent IDs', async () => {
      const offspring = await service.crossover(parent1, parent2, 1);

      expect(offspring.parentIds).toContain('p1');
      expect(offspring.parentIds).toContain('p2');
    });

    it('should set correct generation', async () => {
      const offspring = await service.crossover(parent1, parent2, 3);

      expect(offspring.generation).toBe(3);
    });

    it('should initialize fitness to 0', async () => {
      const offspring = await service.crossover(parent1, parent2, 1);

      expect(offspring.fitness).toBe(0);
    });

    it('should generate unique ID', async () => {
      const offspring1 = await service.crossover(parent1, parent2, 1);
      const offspring2 = await service.crossover(parent1, parent2, 1);

      expect(offspring1.id).not.toBe(offspring2.id);
    });
  });

  describe('mutate', () => {
    const individual: PromptIndividual = {
      id: 'ind1',
      prompt: 'Original prompt with some text.',
      generation: 1,
      fitness: 3.5,
      parentIds: ['p1', 'p2'],
    };

    it('should sometimes return unchanged individual (mutation rate)', async () => {
      // With 0 mutation rate, should never mutate
      const result = await service.mutate(individual, 0);

      expect(result).toBe(individual); // Same reference
    });

    it('should apply mutation when rate is 1', async () => {
      const result = await service.mutate(individual, 1);

      // Should be different (new ID or modified prompt)
      expect(result.id !== individual.id || result.prompt !== individual.prompt).toBe(true);
    });
  });

  describe('generateVariant', () => {
    it('should create variant without LLM available', async () => {
      const variant = await service.generateVariant('Base prompt');

      expect(variant).toBeDefined();
      expect(typeof variant).toBe('string');
    });
  });
});
