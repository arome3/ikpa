/**
 * Opik Experiment Service Tests
 *
 * Tests the OpikExperimentService for A/B experiment management and
 * Opik integration for comparison UI visualization.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OpikExperimentService } from '../opik-experiment.service';
import { PrismaService } from '../../../../../../prisma/prisma.service';
import { OpikService } from '../../../opik.service';
import {
  CreateExperimentConfig,
  OpikExperiment,
  VariantType,
} from '../opik-experiment.interface';

describe('OpikExperimentService', () => {
  let service: OpikExperimentService;
  let prismaService: jest.Mocked<PrismaService>;
  let opikService: jest.Mocked<OpikService>;

  const mockPrismaService = {
    optimizerExperiment: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockOpikService = {
    createTrace: jest.fn(),
    endTrace: jest.fn(),
    addFeedback: jest.fn(),
    flush: jest.fn(),
    getExperimentTags: jest.fn(),
    getExperimentMetadata: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpikExperimentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OpikService,
          useValue: mockOpikService,
        },
      ],
    }).compile();

    service = module.get<OpikExperimentService>(OpikExperimentService);
    prismaService = module.get(PrismaService);
    opikService = module.get(OpikService);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockOpikService.createTrace.mockReturnValue({
      traceId: 'mock-trace-id',
      trace: { span: jest.fn(), end: jest.fn() },
      traceName: 'mock-trace',
      startedAt: new Date(),
    });
    mockOpikService.flush.mockResolvedValue(undefined);
    mockPrismaService.optimizerExperiment.create.mockResolvedValue({
      id: 'test-experiment-id',
      name: 'Test Experiment',
      status: 'CREATED',
    });
  });

  describe('createExperiment', () => {
    const validConfig: CreateExperimentConfig = {
      name: 'test-experiment',
      hypothesis: 'Variant improves conversion',
      baselineDescription: 'Monthly: ₦4,400',
      variantDescription: 'Annual: ₦52,800 (save 20%)',
      type: 'framing',
    };

    it('should create an experiment successfully', async () => {
      const experimentId = await service.createExperiment(validConfig);

      expect(experimentId).toBeDefined();
      expect(typeof experimentId).toBe('string');
      expect(experimentId.length).toBe(36); // UUID format
    });

    it('should create an Opik trace for the experiment', async () => {
      await service.createExperiment(validConfig);

      expect(mockOpikService.createTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'opik_experiment',
          input: expect.objectContaining({
            name: validConfig.name,
            hypothesis: validConfig.hypothesis,
          }),
          tags: expect.arrayContaining(['experiment', 'ab-test', 'framing']),
        }),
      );
    });

    it('should persist experiment to database', async () => {
      await service.createExperiment(validConfig);

      expect(mockPrismaService.optimizerExperiment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'FRAMING',
          name: validConfig.name,
          status: 'CREATED',
        }),
      });
    });

    it('should use default type when not specified', async () => {
      const configWithoutType: CreateExperimentConfig = {
        name: 'test-experiment',
        hypothesis: 'Test hypothesis',
        baselineDescription: 'Baseline',
        variantDescription: 'Variant',
      };

      await service.createExperiment(configWithoutType);

      expect(mockPrismaService.optimizerExperiment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'FRAMING',
        }),
      });
    });

    it('should include custom metadata and tags', async () => {
      const configWithMeta: CreateExperimentConfig = {
        ...validConfig,
        metadata: { custom: 'value' },
        tags: ['custom-tag'],
      };

      await service.createExperiment(configWithMeta);

      expect(mockOpikService.createTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['custom-tag']),
        }),
      );
    });
  });

  describe('recordVariantResult', () => {
    const mockExperiment: OpikExperiment = {
      id: 'exp-123',
      name: 'Test Experiment',
      hypothesis: 'Test hypothesis',
      baselineDescription: 'Baseline',
      variantDescription: 'Variant',
      type: 'framing',
      status: 'running',
      createdAt: new Date(),
      rootTraceId: 'trace-123',
    };

    beforeEach(() => {
      // Mock getExperiment by setting up the cache
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        type: 'FRAMING',
        status: 'CREATED',
        config: {
          hypothesis: 'Test hypothesis',
          baselineDescription: 'Baseline',
          variantDescription: 'Variant',
        },
        result: null,
        startedAt: new Date(),
        completedAt: null,
      });
      mockPrismaService.optimizerExperiment.update.mockResolvedValue({});
    });

    it('should record baseline results', async () => {
      await service.recordVariantResult('exp-123', 'baseline', {
        score: 0.75,
        sampleSize: 50,
        traceIds: ['trace-1', 'trace-2'],
        scores: [0.7, 0.8],
      });

      expect(mockPrismaService.optimizerExperiment.update).toHaveBeenCalledWith({
        where: { id: 'exp-123' },
        data: expect.objectContaining({
          status: 'RUNNING',
          result: expect.objectContaining({
            baselineResults: expect.objectContaining({
              variant: 'baseline',
              score: 0.75,
              sampleSize: 50,
            }),
          }),
        }),
      });
    });

    it('should record variant results', async () => {
      await service.recordVariantResult('exp-123', 'variant', {
        score: 0.85,
        sampleSize: 50,
        traceIds: ['trace-3', 'trace-4'],
        scores: [0.8, 0.9],
      });

      expect(mockPrismaService.optimizerExperiment.update).toHaveBeenCalledWith({
        where: { id: 'exp-123' },
        data: expect.objectContaining({
          status: 'RUNNING',
          result: expect.objectContaining({
            variantResults: expect.objectContaining({
              variant: 'variant',
              score: 0.85,
              sampleSize: 50,
            }),
          }),
        }),
      });
    });

    it('should throw error for non-existent experiment', async () => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue(null);

      await expect(
        service.recordVariantResult('non-existent', 'baseline', {
          score: 0.5,
          sampleSize: 10,
          traceIds: [],
        }),
      ).rejects.toThrow('Experiment not found');
    });

    it('should aggregate multiple results correctly', async () => {
      // Record first result
      await service.recordVariantResult('exp-123', 'baseline', {
        score: 0.7,
        sampleSize: 50,
        traceIds: ['trace-1'],
        scores: [0.7],
      });

      // Update mock to return the updated experiment
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        type: 'FRAMING',
        status: 'RUNNING',
        config: {
          hypothesis: 'Test hypothesis',
          baselineDescription: 'Baseline',
          variantDescription: 'Variant',
        },
        result: {
          baselineResults: {
            variant: 'baseline',
            score: 0.7,
            sampleSize: 50,
            traceIds: ['trace-1'],
            scores: [0.7],
          },
        },
        startedAt: new Date(),
        completedAt: null,
      });

      // Record second result (should aggregate)
      await service.recordVariantResult('exp-123', 'baseline', {
        score: 0.8,
        sampleSize: 50,
        traceIds: ['trace-2'],
        scores: [0.8],
      });

      // Verify aggregation occurred
      expect(mockPrismaService.optimizerExperiment.update).toHaveBeenLastCalledWith({
        where: { id: 'exp-123' },
        data: expect.objectContaining({
          result: expect.objectContaining({
            baselineResults: expect.objectContaining({
              sampleSize: 100, // Aggregated
              traceIds: expect.arrayContaining(['trace-1', 'trace-2']),
            }),
          }),
        }),
      });
    });
  });

  describe('completeExperiment', () => {
    beforeEach(() => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        type: 'FRAMING',
        status: 'RUNNING',
        config: {
          hypothesis: 'Test hypothesis',
          baselineDescription: 'Baseline',
          variantDescription: 'Variant',
        },
        result: {
          baselineResults: {
            variant: 'baseline',
            score: 0.7,
            sampleSize: 100,
            traceIds: [],
            stdDev: 0.1,
          },
          variantResults: {
            variant: 'variant',
            score: 0.85,
            sampleSize: 100,
            traceIds: [],
            stdDev: 0.12,
          },
        },
        startedAt: new Date(),
        completedAt: null,
      });
      mockPrismaService.optimizerExperiment.update.mockResolvedValue({});
    });

    it('should complete experiment with winning variant', async () => {
      await service.completeExperiment('exp-123', {
        winner: 'variant',
        pValue: 0.02,
        improvement: 21.4,
        isSignificant: true,
      });

      expect(mockPrismaService.optimizerExperiment.update).toHaveBeenCalledWith({
        where: { id: 'exp-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          result: expect.objectContaining({
            analysis: expect.objectContaining({
              winner: 'variant',
              isSignificant: true,
              recommendation: 'adopt_variant',
            }),
          }),
        }),
      });
    });

    it('should complete experiment with inconclusive results', async () => {
      await service.completeExperiment('exp-123', {
        winner: null,
        pValue: 0.15,
        improvement: 5.2,
        isSignificant: false,
      });

      expect(mockPrismaService.optimizerExperiment.update).toHaveBeenCalledWith({
        where: { id: 'exp-123' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          result: expect.objectContaining({
            analysis: expect.objectContaining({
              winner: null,
              isSignificant: false,
            }),
          }),
        }),
      });
    });

    it('should add feedback to Opik trace', async () => {
      await service.completeExperiment('exp-123', {
        winner: 'variant',
        pValue: 0.02,
        improvement: 21.4,
        isSignificant: true,
      });

      expect(mockOpikService.addFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ExperimentComplete',
          value: 1, // Significant
        }),
      );
    });

    it('should throw error for non-existent experiment', async () => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue(null);

      await expect(
        service.completeExperiment('non-existent', {
          winner: null,
          pValue: 0.5,
          improvement: 0,
          isSignificant: false,
        }),
      ).rejects.toThrow('Experiment not found');
    });
  });

  describe('linkTraceToExperiment', () => {
    beforeEach(() => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        type: 'FRAMING',
        status: 'RUNNING',
        config: {
          hypothesis: 'Test hypothesis',
          baselineDescription: 'Baseline',
          variantDescription: 'Variant',
        },
        result: {
          baselineResults: {
            variant: 'baseline',
            score: 0.7,
            sampleSize: 50,
            traceIds: ['existing-trace'],
          },
        },
        startedAt: new Date(),
        completedAt: null,
      });
    });

    it('should link trace to experiment', async () => {
      await service.linkTraceToExperiment('new-trace-id', 'exp-123', 'baseline');

      // Verify the experiment was fetched
      expect(mockPrismaService.optimizerExperiment.findUnique).toHaveBeenCalledWith({
        where: { id: 'exp-123' },
      });
    });

    it('should throw error for non-existent experiment', async () => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue(null);

      await expect(
        service.linkTraceToExperiment('trace-id', 'non-existent', 'baseline'),
      ).rejects.toThrow('Experiment not found');
    });
  });

  describe('getExperimentComparison', () => {
    beforeEach(() => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        type: 'FRAMING',
        status: 'COMPLETED',
        config: {
          hypothesis: 'Test hypothesis',
          baselineDescription: 'Baseline',
          variantDescription: 'Variant',
        },
        result: {
          baselineResults: {
            variant: 'baseline',
            score: 0.7,
            sampleSize: 100,
            traceIds: [],
            stdDev: 0.1,
            confidenceInterval: { lower: 0.68, upper: 0.72 },
          },
          variantResults: {
            variant: 'variant',
            score: 0.85,
            sampleSize: 100,
            traceIds: [],
            stdDev: 0.12,
            confidenceInterval: { lower: 0.82, upper: 0.88 },
          },
          analysis: {
            winner: 'variant',
            improvement: 21.4,
            pValue: 0.02,
            isSignificant: true,
            confidence: 0.98,
            summary: 'Variant wins',
            recommendation: 'adopt_variant',
          },
        },
        startedAt: new Date(),
        completedAt: new Date(),
      });
    });

    it('should return comparison data', async () => {
      const comparison = await service.getExperimentComparison('exp-123');

      expect(comparison).toBeDefined();
      expect(comparison?.baseline.score).toBe(0.7);
      expect(comparison?.variant.score).toBe(0.85);
      expect(comparison?.comparison.absoluteDifference).toBeCloseTo(0.15);
      expect(comparison?.comparison.isSignificant).toBe(true);
      expect(comparison?.comparison.winner).toBe('variant');
    });

    it('should return null for non-existent experiment', async () => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue(null);

      const comparison = await service.getExperimentComparison('non-existent');

      expect(comparison).toBeNull();
    });

    it('should include timeline data', async () => {
      const comparison = await service.getExperimentComparison('exp-123');

      expect(comparison?.timeline).toBeDefined();
      expect(Array.isArray(comparison?.timeline)).toBe(true);
    });
  });

  describe('cancelExperiment', () => {
    beforeEach(() => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        type: 'FRAMING',
        status: 'RUNNING',
        config: {
          hypothesis: 'Test hypothesis',
          baselineDescription: 'Baseline',
          variantDescription: 'Variant',
        },
        result: null,
        startedAt: new Date(),
        completedAt: null,
      });
      mockPrismaService.optimizerExperiment.update.mockResolvedValue({});
    });

    it('should cancel a running experiment', async () => {
      await service.cancelExperiment('exp-123', 'User requested cancellation');

      expect(mockPrismaService.optimizerExperiment.update).toHaveBeenCalledWith({
        where: { id: 'exp-123' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          completedAt: expect.any(Date),
          error: 'User requested cancellation',
        }),
      });
    });

    it('should throw error for non-existent experiment', async () => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelExperiment('non-existent', 'reason'),
      ).rejects.toThrow('Experiment not found');
    });

    it('should throw error for already completed experiment', async () => {
      mockPrismaService.optimizerExperiment.findUnique.mockResolvedValue({
        id: 'exp-123',
        name: 'Test Experiment',
        type: 'FRAMING',
        status: 'COMPLETED',
        config: {},
        result: {},
        startedAt: new Date(),
        completedAt: new Date(),
      });

      await expect(
        service.cancelExperiment('exp-123', 'reason'),
      ).rejects.toThrow('Cannot cancel a completed experiment');
    });
  });

  describe('listExperiments', () => {
    const mockExperiments = [
      {
        id: 'exp-1',
        name: 'Experiment 1',
        type: 'FRAMING',
        status: 'COMPLETED',
        config: { hypothesis: 'H1' },
        result: null,
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-02'),
      },
      {
        id: 'exp-2',
        name: 'Experiment 2',
        type: 'FRAMING',
        status: 'RUNNING',
        config: { hypothesis: 'H2' },
        result: null,
        startedAt: new Date('2024-01-03'),
        completedAt: null,
      },
    ];

    beforeEach(() => {
      mockPrismaService.optimizerExperiment.findMany.mockResolvedValue(mockExperiments);
    });

    it('should list experiments', async () => {
      const experiments = await service.listExperiments();

      expect(experiments).toHaveLength(2);
      expect(mockPrismaService.optimizerExperiment.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      await service.listExperiments({ status: 'completed' });

      expect(mockPrismaService.optimizerExperiment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        }),
      );
    });

    it('should apply pagination', async () => {
      await service.listExperiments({ limit: 10, offset: 20 });

      expect(mockPrismaService.optimizerExperiment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });

    it('should apply sorting', async () => {
      await service.listExperiments({ sortBy: 'name', sortOrder: 'asc' });

      expect(mockPrismaService.optimizerExperiment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('getExperimentTags', () => {
    it('should return correct tags for baseline variant', () => {
      const tags = service.getExperimentTags('exp-123', 'baseline');

      expect(tags).toContain('experiment:exp-123');
      expect(tags).toContain('variant:baseline');
      expect(tags).toContain('ab-test');
    });

    it('should return correct tags for variant', () => {
      const tags = service.getExperimentTags('exp-123', 'variant');

      expect(tags).toContain('experiment:exp-123');
      expect(tags).toContain('variant:variant');
      expect(tags).toContain('ab-test');
    });
  });

  describe('getExperimentMetadata', () => {
    it('should return correct metadata', () => {
      const metadata = service.getExperimentMetadata('exp-123', 'baseline');

      expect(metadata.experiment).toBeDefined();
      expect((metadata.experiment as Record<string, unknown>).id).toBe('exp-123');
      expect((metadata.experiment as Record<string, unknown>).variant).toBe('baseline');
      expect((metadata.experiment as Record<string, unknown>).linkedAt).toBeDefined();
    });
  });
});
