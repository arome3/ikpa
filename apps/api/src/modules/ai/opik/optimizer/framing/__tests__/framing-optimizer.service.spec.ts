/**
 * Framing Optimizer Service Tests
 *
 * Tests statistical analysis, A/B testing logic, and Opik integration.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FramingOptimizerService } from '../framing-optimizer.service';
import { CancellationRateMetric } from '../cancellation-rate.metric';
import { PrismaService } from '../../../../../../prisma/prisma.service';
import { OpikService } from '../../../opik.service';
import { AnthropicService } from '../../../../anthropic';
import { SIGNIFICANCE_THRESHOLD } from '../../optimizer.constants';

describe('FramingOptimizerService', () => {
  let service: FramingOptimizerService;
  let mockPrisma: Partial<PrismaService>;
  let mockOpikService: Partial<OpikService>;
  let mockAnthropicService: Partial<AnthropicService>;
  let mockCancellationMetric: Partial<CancellationRateMetric>;

  beforeEach(async () => {
    mockPrisma = {
      optimizerExperiment: {
        create: jest.fn().mockResolvedValue({ id: 'test-exp-1' }),
        update: jest.fn().mockResolvedValue({}),
      } as unknown as typeof mockPrisma.optimizerExperiment,
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

    mockAnthropicService = {
      isAvailable: jest.fn().mockReturnValue(false),
      generate: jest.fn(),
    };

    mockCancellationMetric = {
      score: jest.fn().mockResolvedValue({ score: 0.5, reason: 'test' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FramingOptimizerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OpikService, useValue: mockOpikService },
        { provide: AnthropicService, useValue: mockAnthropicService },
        { provide: CancellationRateMetric, useValue: mockCancellationMetric },
      ],
    }).compile();

    service = module.get<FramingOptimizerService>(FramingOptimizerService);
  });

  describe('performStatisticalAnalysis', () => {
    it('should return inconclusive result for empty arrays', () => {
      const result = service.performStatisticalAnalysis([], []);

      expect(result.winner).toBeNull();
      expect(result.isSignificant).toBe(false);
      expect(result.pValue).toBe(1);
    });

    it('should return inconclusive for single-element arrays', () => {
      const result = service.performStatisticalAnalysis([0.5], [0.6]);

      expect(result.winner).toBeNull();
      expect(result.isSignificant).toBe(false);
    });

    it('should detect significant difference when variant is clearly better', () => {
      // Baseline: low cancellation rate
      const baselineScores = [0.1, 0.2, 0.1, 0.15, 0.2, 0.1, 0.15, 0.2, 0.1, 0.15];
      // Variant: high cancellation rate
      const variantScores = [0.8, 0.9, 0.85, 0.9, 0.8, 0.85, 0.9, 0.8, 0.85, 0.9];

      const result = service.performStatisticalAnalysis(baselineScores, variantScores);

      expect(result.winner).toBe('variant');
      expect(result.isSignificant).toBe(true);
      expect(result.pValue).toBeLessThan(SIGNIFICANCE_THRESHOLD);
      expect(result.improvement).toBeGreaterThan(0);
    });

    it('should detect significant difference when baseline is better', () => {
      // Baseline: high cancellation rate
      const baselineScores = [0.8, 0.9, 0.85, 0.9, 0.8, 0.85, 0.9, 0.8, 0.85, 0.9];
      // Variant: low cancellation rate
      const variantScores = [0.1, 0.2, 0.1, 0.15, 0.2, 0.1, 0.15, 0.2, 0.1, 0.15];

      const result = service.performStatisticalAnalysis(baselineScores, variantScores);

      expect(result.winner).toBe('baseline');
      expect(result.isSignificant).toBe(true);
      expect(result.improvement).toBeLessThan(0); // Negative improvement means variant is worse
    });

    it('should return inconclusive for similar distributions', () => {
      // Similar means
      const baselineScores = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.52, 0.48, 0.51, 0.49];
      const variantScores = [0.51, 0.49, 0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.52, 0.48];

      const result = service.performStatisticalAnalysis(baselineScores, variantScores);

      expect(result.winner).toBeNull();
      expect(result.isSignificant).toBe(false);
      expect(result.pValue).toBeGreaterThan(SIGNIFICANCE_THRESHOLD);
    });

    it('should calculate improvement percentage correctly', () => {
      const baselineScores = [0.4, 0.4, 0.4, 0.4, 0.4];
      const variantScores = [0.6, 0.6, 0.6, 0.6, 0.6];

      const result = service.performStatisticalAnalysis(baselineScores, variantScores);

      // Improvement = (0.6 - 0.4) / 0.4 * 100 = 50%
      expect(result.improvement).toBeCloseTo(50, 0);
    });

    it('should handle identical scores', () => {
      const scores = [0.5, 0.5, 0.5, 0.5, 0.5];

      const result = service.performStatisticalAnalysis(scores, scores);

      expect(result.winner).toBeNull();
      expect(result.improvement).toBe(0);
    });

    it('should handle high variance distributions', () => {
      // High variance baseline
      const baselineScores = [0.1, 0.9, 0.2, 0.8, 0.15, 0.85, 0.25, 0.75, 0.3, 0.7];
      // High variance variant (slightly higher mean)
      const variantScores = [0.2, 0.95, 0.3, 0.85, 0.25, 0.9, 0.35, 0.8, 0.4, 0.75];

      const result = service.performStatisticalAnalysis(baselineScores, variantScores);

      // With high variance, even moderate differences may not be significant
      expect(result.degreesOfFreedom).toBeGreaterThan(0);
      expect(result.tStatistic).toBeDefined();
    });

    it('should calculate degrees of freedom using Welch-Satterthwaite', () => {
      const baselineScores = [0.3, 0.35, 0.25, 0.4, 0.3, 0.35, 0.25, 0.4];
      const variantScores = [0.6, 0.65, 0.55, 0.7, 0.6, 0.65, 0.55, 0.7];

      const result = service.performStatisticalAnalysis(baselineScores, variantScores);

      // Welch's df should be close to n1 + n2 - 2 for equal variances
      expect(result.degreesOfFreedom).toBeGreaterThan(0);
      expect(result.degreesOfFreedom).toBeLessThanOrEqual(14); // n1 + n2 - 2
    });
  });

  describe('evaluatePrompt', () => {
    it('should return scores for all samples', async () => {
      mockCancellationMetric.score = jest.fn().mockResolvedValue({ score: 1, reason: 'cancel' });

      const result = await service.evaluatePrompt(
        'Test prompt {{name}}',
        'subscriptions',
        5,
      );

      expect(result.scores.length).toBe(5);
      expect(result.sampleSize).toBe(5);
      expect(result.score).toBe(1); // Average of all 1s
    });

    it('should calculate average score correctly', async () => {
      let callCount = 0;
      mockCancellationMetric.score = jest.fn().mockImplementation(async () => {
        callCount++;
        return { score: callCount <= 3 ? 1 : 0, reason: 'test' };
      });

      const result = await service.evaluatePrompt(
        'Test prompt {{name}}',
        'subscriptions',
        5,
      );

      // 3 ones and 2 zeros = 3/5 = 0.6
      expect(result.score).toBe(0.6);
    });
  });
});

describe('CancellationRateMetric', () => {
  let metric: CancellationRateMetric;
  let mockAnthropicService: Partial<AnthropicService>;

  beforeEach(async () => {
    mockAnthropicService = {
      isAvailable: jest.fn().mockReturnValue(false),
      generate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationRateMetric,
        { provide: AnthropicService, useValue: mockAnthropicService },
      ],
    }).compile();

    metric = module.get<CancellationRateMetric>(CancellationRateMetric);
  });

  describe('score', () => {
    it('should detect cancel recommendation', async () => {
      const result = await metric.score(
        { input: 'Netflix', output: '' },
        'You should cancel this subscription as you rarely use it.',
      );

      expect(result.score).toBe(1);
      expect(result.metadata?.decision).toBe('cancel');
    });

    it('should detect keep recommendation', async () => {
      const result = await metric.score(
        { input: 'Netflix', output: '' },
        'Keep this subscription, it provides good value.',
      );

      expect(result.score).toBe(0);
      expect(result.metadata?.decision).toBe('keep');
    });

    it('should return unclear for ambiguous responses', async () => {
      const result = await metric.score(
        { input: 'Netflix', output: '' },
        'This subscription costs money every month.',
      );

      expect(result.score).toBe(0.5);
      expect(result.metadata?.decision).toBe('unclear');
    });

    it('should detect multiple cancel patterns', async () => {
      const result = await metric.score(
        { input: 'Netflix', output: '' },
        "You should cancel and unsubscribe. Don't keep paying for this.",
      );

      expect(result.score).toBe(1);
    });

    it('should handle mixed signals correctly', async () => {
      // More keep signals than cancel
      const result = await metric.score(
        { input: 'Netflix', output: '' },
        'This is valuable, you should keep it. Maintain the subscription.',
      );

      expect(result.score).toBe(0);
    });
  });

  describe('calculateCancellationRate', () => {
    it('should calculate average correctly', () => {
      const scores = [1, 1, 0, 1, 0];
      const rate = CancellationRateMetric.calculateCancellationRate(scores);

      expect(rate).toBe(0.6);
    });

    it('should return 0 for empty array', () => {
      const rate = CancellationRateMetric.calculateCancellationRate([]);

      expect(rate).toBe(0);
    });

    it('should return 1 for all cancels', () => {
      const scores = [1, 1, 1, 1, 1];
      const rate = CancellationRateMetric.calculateCancellationRate(scores);

      expect(rate).toBe(1);
    });

    it('should return 0 for all keeps', () => {
      const scores = [0, 0, 0, 0, 0];
      const rate = CancellationRateMetric.calculateCancellationRate(scores);

      expect(rate).toBe(0);
    });
  });
});
