/**
 * MetricsService Unit Tests
 *
 * Tests cover:
 * - Multi-metric evaluation
 * - Selective metric execution
 * - Opik span/feedback integration
 * - Safety metric blocking
 * - Aggregated score calculation
 * - Graceful error handling
 * - Batch evaluation
 * - A/B testing integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsService, EvaluationOptions, BatchEvaluationOptions } from '../metrics.service';
import { OpikService } from '../../opik.service';
import { InterventionSuccessMetric } from '../intervention-success.metric';
import { ToneEmpathyMetric } from '../tone-empathy.metric';
import { CulturalSensitivityMetric } from '../cultural-sensitivity.metric';
import { FinancialSafetyMetric } from '../financial-safety.metric';
import { StakeEffectivenessMetric } from '../stake-effectiveness.metric';
import { AnthropicService } from '../../../anthropic';
import { DatasetItem } from '../interfaces';
import { ABTestConfig } from '../ab-testing';
import { resetGlobalMetricsCache } from '../local-cache';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockOpikService: Partial<OpikService>;
  let mockAnthropicService: Partial<AnthropicService>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global local cache to prevent test pollution
    resetGlobalMetricsCache();

    mockOpikService = {
      createToolSpan: vi.fn().mockReturnValue({
        span: {},
        spanId: 'test-span-id',
        traceId: 'test-trace-id',
        name: 'test-span',
        type: 'tool',
        startedAt: new Date(),
      }),
      endSpan: vi.fn(),
      addFeedback: vi.fn(),
    };

    mockAnthropicService = {
      isAvailable: vi.fn().mockReturnValue(true),
      generate: vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 4, reason: 'Good response' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    };

    // Create metrics directly
    const interventionSuccessMetric = new InterventionSuccessMetric();
    const toneEmpathyMetric = new ToneEmpathyMetric(mockAnthropicService as AnthropicService);
    const culturalSensitivityMetric = new CulturalSensitivityMetric(mockAnthropicService as AnthropicService);
    const financialSafetyMetric = new FinancialSafetyMetric();
    const stakeEffectivenessMetric = new StakeEffectivenessMetric();

    // Create service
    service = new MetricsService(
      mockOpikService as OpikService,
      interventionSuccessMetric,
      toneEmpathyMetric,
      culturalSensitivityMetric,
      financialSafetyMetric,
      stakeEffectivenessMetric,
    );
  });

  describe('evaluate()', () => {
    it('should run all metrics when metrics="all"', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a phone',
        output: '',
        context: {
          userAction: 'saved',
          stakeType: 'social',
          goalCompleted: true,
        },
      };
      const llmOutput = 'Consider waiting 48 hours before making this purchase.';
      const options: EvaluationOptions = { metrics: 'all', createSpans: false, addFeedback: false };

      const result = await service.evaluate(datasetItem, llmOutput, options);

      expect(result.success).toBe(true);
      expect(Object.keys(result.results)).toHaveLength(5);
      expect(result.results.InterventionSuccess).toBeDefined();
      expect(result.results.ToneEmpathy).toBeDefined();
      expect(result.results.CulturalSensitivity).toBeDefined();
      expect(result.results.FinancialSafety).toBeDefined();
      expect(result.results.StakeEffectiveness).toBeDefined();
    });

    it('should run only specified metrics', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = {
        metrics: ['ToneEmpathy', 'FinancialSafety'],
        createSpans: false,
        addFeedback: false,
      };

      const result = await service.evaluate(datasetItem, 'Safe response', options);

      expect(Object.keys(result.results)).toHaveLength(2);
      expect(result.results.ToneEmpathy).toBeDefined();
      expect(result.results.FinancialSafety).toBeDefined();
      expect(result.results.InterventionSuccess).toBeUndefined();
    });

    it('should block when FinancialSafety fails', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = { metrics: 'all', createSpans: false, addFeedback: false };
      const unsafeOutput = 'You should invest all your money in this!';

      const result = await service.evaluate(datasetItem, unsafeOutput, options);

      expect(result.success).toBe(false);
      expect(result.blockedReason).toContain('BLOCKED');
      expect(result.results.FinancialSafety.score).toBe(0);
    });

    it('should throw when throwOnUnsafe is true and safety fails', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = {
        metrics: ['FinancialSafety'],
        throwOnUnsafe: true,
        createSpans: false,
        addFeedback: false,
      };
      const unsafeOutput = 'Invest all your money now!';

      await expect(service.evaluate(datasetItem, unsafeOutput, options)).rejects.toThrow(
        'Unsafe response blocked',
      );
    });

    it('should calculate aggregated scores correctly', async () => {
      const datasetItem: DatasetItem = {
        input: 'Test',
        output: '',
        context: { userAction: 'saved' },
      };
      const options: EvaluationOptions = {
        metrics: ['InterventionSuccess', 'FinancialSafety'],
        createSpans: false,
        addFeedback: false,
      };

      const result = await service.evaluate(datasetItem, 'Safe response', options);

      expect(result.aggregated.totalCount).toBe(2);
      expect(result.aggregated.passCount).toBe(2); // Both should pass
      expect(result.aggregated.failCount).toBe(0);
      expect(result.aggregated.averageScore).toBe(1); // Both scores are 1
    });
  });

  describe('Opik integration', () => {
    const mockTrace = {
      trace: { id: 'trace-1', span: vi.fn(), end: vi.fn() },
      traceId: 'trace-1',
      traceName: 'test-trace',
      startedAt: new Date(),
    };

    it('should create spans when createSpans=true', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: true,
        addFeedback: false,
      };

      await service.evaluate(datasetItem, 'Safe', options, mockTrace);

      // Should create parent span + metric span
      expect(mockOpikService.createToolSpan).toHaveBeenCalledTimes(2);
      expect(mockOpikService.endSpan).toHaveBeenCalledTimes(2);
    });

    it('should add feedback when addFeedback=true', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: false,
        addFeedback: true,
      };

      await service.evaluate(datasetItem, 'Safe', options, mockTrace);

      expect(mockOpikService.addFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'trace-1',
          name: 'FinancialSafety',
          value: 1, // Normalized score
          category: 'quality',
          source: 'llm-as-judge',
        }),
      );
    });

    it('should not create spans when no trace provided', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: true,
        addFeedback: true,
      };

      await service.evaluate(datasetItem, 'Safe', options); // No trace

      expect(mockOpikService.createToolSpan).not.toHaveBeenCalled();
      expect(mockOpikService.addFeedback).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue when individual metric fails', async () => {
      // Make ToneEmpathy throw
      (mockAnthropicService.generate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('API error'));

      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = {
        metrics: ['ToneEmpathy', 'FinancialSafety'],
        createSpans: false,
        addFeedback: false,
      };

      const result = await service.evaluate(datasetItem, 'Safe response', options);

      // FinancialSafety should still succeed
      expect(result.results.FinancialSafety.score).toBe(1);
      // ToneEmpathy should have error result (returns default score 3, not 0)
      expect(result.results.ToneEmpathy.score).toBe(3); // Default/neutral score for G-Eval
      expect(result.results.ToneEmpathy.metadata?.error).toBe(true);
    });

    it('should handle span creation errors gracefully', async () => {
      (mockOpikService.createToolSpan as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('Span creation failed');
      });

      const mockTrace = {
        trace: { id: 'trace-1', span: vi.fn(), end: vi.fn() },
        traceId: 'trace-1',
        traceName: 'test-trace',
        startedAt: new Date(),
      };

      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const options: EvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: true,
        addFeedback: false,
      };

      // Should not throw
      const result = await service.evaluate(datasetItem, 'Safe', options, mockTrace);
      expect(result.success).toBe(true);
    });
  });

  describe('convenience methods', () => {
    it('should check safety with checkSafety()', async () => {
      const result = await service.checkSafety('Consider saving 15% of income.');

      expect(result.score).toBe(1);
      expect(result.reason).toBe('Advice is financially sound and safe');
    });

    it('should evaluate tone with evaluateTone()', async () => {
      const datasetItem: DatasetItem = { input: 'I overspent', output: '' };

      const result = await service.evaluateTone(
        datasetItem,
        "Let's recalculate your route.",
      );

      expect(result.score).toBe(4); // From mock
    });

    it('should evaluate cultural sensitivity with evaluateCultural()', async () => {
      const datasetItem: DatasetItem = {
        input: 'I send money home',
        output: '',
        context: { country: 'US' },
      };

      const result = await service.evaluateCultural(
        datasetItem,
        'Your Social Capital Investment matters.',
      );

      expect(result.score).toBe(4); // From mock
    });
  });

  describe('utility methods', () => {
    it('should return available metrics', () => {
      const metrics = service.getAvailableMetrics();

      expect(metrics).toContain('InterventionSuccess');
      expect(metrics).toContain('ToneEmpathy');
      expect(metrics).toContain('CulturalSensitivity');
      expect(metrics).toContain('FinancialSafety');
      expect(metrics).toContain('StakeEffectiveness');
      expect(metrics).toHaveLength(5);
    });

    it('should return metric by name', () => {
      const metric = service.getMetric('ToneEmpathy');

      expect(metric).toBeDefined();
      expect(metric?.name).toBe('ToneEmpathy');
    });

    it('should return undefined for unknown metric', () => {
      const metric = service.getMetric('UnknownMetric');

      expect(metric).toBeUndefined();
    });
  });

  describe('evaluateBatch()', () => {
    it('should evaluate multiple items in batch', async () => {
      const items: DatasetItem[] = [
        { input: 'Test 1', output: '', context: { userAction: 'saved' } },
        { input: 'Test 2', output: '', context: { userAction: 'saved' } },
        { input: 'Test 3', output: '', context: { userAction: 'saved' } },
      ];
      const outputs = ['Safe response 1', 'Safe response 2', 'Safe response 3'];
      const options: BatchEvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: false,
        addFeedback: false,
        concurrency: 2,
      };

      const results = await service.evaluateBatch(items, outputs, options);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.result?.results.FinancialSafety)).toBe(true);
    });

    it('should return results in same order as inputs', async () => {
      const items: DatasetItem[] = [
        { input: 'Test A', output: '' },
        { input: 'Test B', output: '' },
        { input: 'Test C', output: '' },
      ];
      const outputs = ['Output A', 'Output B', 'Output C'];
      const options: BatchEvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: false,
        addFeedback: false,
      };

      const results = await service.evaluateBatch(items, outputs, options);

      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);
    });

    it('should throw if items and outputs length mismatch', async () => {
      const items: DatasetItem[] = [{ input: 'Test', output: '' }];
      const outputs = ['Output 1', 'Output 2'];

      await expect(service.evaluateBatch(items, outputs)).rejects.toThrow(
        'Items and outputs length mismatch',
      );
    });

    it('should return empty array for empty inputs', async () => {
      const results = await service.evaluateBatch([], []);
      expect(results).toHaveLength(0);
    });

    it('should handle partial failures gracefully', async () => {
      const items: DatasetItem[] = [
        { input: 'Test 1', output: '' },
        { input: 'Test 2', output: '' },
        { input: 'Test 3', output: '' },
      ];
      // One unsafe output should not affect others
      const outputs = [
        'Safe response',
        'You should invest all your money!', // Unsafe
        'Safe response',
      ];
      const options: BatchEvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: false,
        addFeedback: false,
      };

      const results = await service.evaluateBatch(items, outputs, options);

      expect(results).toHaveLength(3);
      // All complete (even unsafe one - it just reports blocked)
      expect(results.every((r) => r.success)).toBe(true);
      expect(results[0].result?.success).toBe(true);
      expect(results[1].result?.success).toBe(false); // Blocked by safety
      expect(results[2].result?.success).toBe(true);
    });

    it('should use default concurrency of 5', async () => {
      const items: DatasetItem[] = Array(10)
        .fill(null)
        .map((_, i) => ({ input: `Test ${i}`, output: '' }));
      const outputs = Array(10).fill('Safe response');

      const results = await service.evaluateBatch(items, outputs, {
        metrics: ['FinancialSafety'],
        createSpans: false,
        addFeedback: false,
      });

      expect(results).toHaveLength(10);
    });
  });

  describe('A/B testing integration', () => {
    const testConfig: ABTestConfig = {
      name: 'tone-strictness',
      variants: [
        { id: 'control', weight: 50, criteria: { threshold: 0.7 } },
        { id: 'strict', weight: 50, criteria: { threshold: 0.85 } },
      ],
      enabled: true,
    };

    it('should expose ABTestManager', () => {
      const manager = service.getABTestManager();
      expect(manager).toBeDefined();
    });

    it('should register and select A/B test variant', () => {
      const manager = service.getABTestManager();
      manager.registerTest(testConfig);

      const variant = service.selectABTestVariant('tone-strictness', 'user-123');

      expect(variant).toBeDefined();
      expect(['control', 'strict']).toContain(variant?.id);
    });

    it('should track A/B test results', async () => {
      const manager = service.getABTestManager();
      manager.registerTest(testConfig);

      // Run evaluation
      const datasetItem: DatasetItem = {
        input: 'Test',
        output: '',
        context: { userAction: 'saved' },
      };
      const options: EvaluationOptions = {
        metrics: ['FinancialSafety'],
        createSpans: false,
        addFeedback: false,
      };

      const result = await service.evaluate(datasetItem, 'Safe response', options);

      // Track result
      service.trackABTestResult('tone-strictness', 'control', result);

      // Verify result was tracked
      const stats = manager.getComparisonStats('tone-strictness');
      expect(stats?.totalEvaluations).toBe(1);
    });

    it('should return undefined for non-existent A/B test', () => {
      const variant = service.selectABTestVariant('nonexistent', 'user-123');
      expect(variant).toBeUndefined();
    });

    it('should be deterministic for same identifier', () => {
      const manager = service.getABTestManager();
      manager.registerTest(testConfig);

      const variant1 = service.selectABTestVariant('tone-strictness', 'user-456');
      const variant2 = service.selectABTestVariant('tone-strictness', 'user-456');

      expect(variant1?.id).toBe(variant2?.id);
    });
  });
});
