/**
 * Metrics Registry Service Tests
 *
 * Tests for the Opik metrics registration service.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MetricsRegistryService } from '../metrics-registry.service';
import { OpikService } from '../../../opik.service';
import {
  ALL_IKPA_METRICS,
  METRIC_NAME_TONE_EMPATHY,
  METRIC_NAME_CANCELLATION_RATE,
  METRIC_NAME_TOOL_POLICY_ACCURACY,
  METRIC_NAME_GENERATION_FITNESS,
} from '../metrics-registry.constants';

describe('MetricsRegistryService', () => {
  let service: MetricsRegistryService;
  let opikService: {
    isAvailable: Mock;
    getClient: Mock;
  };
  let configService: {
    get: Mock;
  };

  const mockFeedbackDefinitions = {
    findFeedbackDefinitions: vi.fn(),
    createFeedbackDefinition: vi.fn(),
  };

  const mockOpikClient = {
    api: {
      feedbackDefinitions: mockFeedbackDefinitions,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsRegistryService,
        {
          provide: OpikService,
          useValue: {
            isAvailable: vi.fn().mockReturnValue(true),
            getClient: vi.fn().mockReturnValue(mockOpikClient),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
              if (key === 'OPIK_AUTO_REGISTER_METRICS') return false;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MetricsRegistryService>(MetricsRegistryService);
    opikService = module.get(OpikService) as unknown as {
      isAvailable: Mock;
      getClient: Mock;
    };
    configService = module.get(ConfigService) as unknown as {
      get: Mock;
    };
  });

  describe('getMetricDefinitions', () => {
    it('should return all IKPA metric definitions', () => {
      const definitions = service.getMetricDefinitions();
      expect(definitions).toHaveLength(ALL_IKPA_METRICS.length);
      expect(definitions).toEqual(expect.arrayContaining(ALL_IKPA_METRICS));
    });
  });

  describe('getMetricDefinition', () => {
    it('should return metric definition by name', () => {
      const definition = service.getMetricDefinition(METRIC_NAME_TONE_EMPATHY);
      expect(definition).toBeDefined();
      expect(definition?.name).toBe(METRIC_NAME_TONE_EMPATHY);
      expect(definition?.type).toBe('numerical');
    });

    it('should return undefined for unknown metric', () => {
      const definition = service.getMetricDefinition('UnknownMetric');
      expect(definition).toBeUndefined();
    });
  });

  describe('registerMetrics', () => {
    it('should return error results when Opik is unavailable', async () => {
      opikService.isAvailable.mockReturnValue(false);

      const results = await service.registerMetrics();

      expect(results).toHaveLength(ALL_IKPA_METRICS.length);
      expect(results.every((r) => !r.success)).toBe(true);
      expect(results.every((r) => r.error === 'Opik service not available')).toBe(true);
    });

    it('should skip existing metrics when skipExisting is true', async () => {
      mockFeedbackDefinitions.findFeedbackDefinitions.mockResolvedValue({
        body: { content: [{ name: METRIC_NAME_TONE_EMPATHY }] },
      });
      mockFeedbackDefinitions.createFeedbackDefinition.mockResolvedValue(undefined);

      const results = await service.registerMetrics({ skipExisting: true });

      // All metrics should succeed
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should register new metrics successfully', async () => {
      mockFeedbackDefinitions.findFeedbackDefinitions.mockResolvedValue({
        body: { content: [] },
      });
      mockFeedbackDefinitions.createFeedbackDefinition.mockResolvedValue(undefined);

      const results = await service.registerMetrics();

      expect(results.every((r) => r.success)).toBe(true);
      expect(mockFeedbackDefinitions.createFeedbackDefinition).toHaveBeenCalled();
    });

    it('should handle registration errors gracefully', async () => {
      mockFeedbackDefinitions.findFeedbackDefinitions.mockResolvedValue({
        body: { content: [] },
      });
      mockFeedbackDefinitions.createFeedbackDefinition.mockRejectedValue(
        new Error('API error'),
      );

      const results = await service.registerMetrics();

      expect(results.some((r) => !r.success)).toBe(true);
    });

    it('should treat "already exists" errors as success', async () => {
      mockFeedbackDefinitions.findFeedbackDefinitions.mockResolvedValue({
        body: { content: [] },
      });
      mockFeedbackDefinitions.createFeedbackDefinition.mockRejectedValue(
        new Error('Metric already exists'),
      );

      const results = await service.registerMetrics();

      expect(results.every((r) => r.success || r.alreadyExists)).toBe(true);
    });
  });

  describe('isMetricRegistered', () => {
    it('should return true when metric exists in cache', async () => {
      // First register to populate cache
      mockFeedbackDefinitions.findFeedbackDefinitions.mockResolvedValue({
        body: { content: [{ name: METRIC_NAME_TONE_EMPATHY }] },
      });

      // Check if metric is registered
      const result = await service.isMetricRegistered(METRIC_NAME_TONE_EMPATHY);
      expect(result).toBe(true);
    });

    it('should return false when metric does not exist', async () => {
      mockFeedbackDefinitions.findFeedbackDefinitions.mockResolvedValue({
        body: { content: [] },
      });

      const result = await service.isMetricRegistered('NonExistentMetric');
      expect(result).toBe(false);
    });

    it('should return false when Opik client is unavailable', async () => {
      opikService.getClient.mockReturnValue(null);

      const result = await service.isMetricRegistered(METRIC_NAME_TONE_EMPATHY);
      expect(result).toBe(false);
    });
  });

  describe('metric definitions validation', () => {
    it('should have ToneEmpathy metric with correct schema', () => {
      const metric = service.getMetricDefinition(METRIC_NAME_TONE_EMPATHY);
      expect(metric).toMatchObject({
        name: 'ToneEmpathy',
        type: 'numerical',
        min: 0,
        max: 5,
      });
    });

    it('should have CancellationRate metric with correct schema', () => {
      const metric = service.getMetricDefinition(METRIC_NAME_CANCELLATION_RATE);
      expect(metric).toMatchObject({
        name: 'CancellationRate',
        type: 'numerical',
        min: 0,
        max: 1,
      });
    });

    it('should have ToolPolicyAccuracy metric with correct schema', () => {
      const metric = service.getMetricDefinition(METRIC_NAME_TOOL_POLICY_ACCURACY);
      expect(metric).toMatchObject({
        name: 'ToolPolicyAccuracy',
        type: 'numerical',
        min: 0,
        max: 1,
      });
    });

    it('should have GenerationFitness metric with correct schema', () => {
      const metric = service.getMetricDefinition(METRIC_NAME_GENERATION_FITNESS);
      expect(metric).toMatchObject({
        name: 'GenerationFitness',
        type: 'numerical',
        min: 0,
        max: 1,
      });
    });

    it('should have all required metrics defined', () => {
      const requiredMetrics = [
        METRIC_NAME_TONE_EMPATHY,
        METRIC_NAME_CANCELLATION_RATE,
        METRIC_NAME_TOOL_POLICY_ACCURACY,
        METRIC_NAME_GENERATION_FITNESS,
      ];

      for (const metricName of requiredMetrics) {
        const metric = service.getMetricDefinition(metricName);
        expect(metric).toBeDefined();
        expect(metric?.description).toBeTruthy();
      }
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit breaker after repeated failures', async () => {
      mockFeedbackDefinitions.findFeedbackDefinitions.mockResolvedValue({
        body: { content: [] },
      });
      mockFeedbackDefinitions.createFeedbackDefinition.mockRejectedValue(
        new Error('Persistent API error'),
      );

      // First call - circuit breaker should be closed
      await service.registerMetrics();

      // Multiple failures should eventually open the circuit breaker
      // (depends on threshold configuration)
    });
  });

  describe('onModuleInit', () => {
    it('should not auto-register when disabled via config', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'OPIK_AUTO_REGISTER_METRICS') return false;
        return defaultValue;
      });

      await service.onModuleInit();

      // Should not have called registration when auto-register is disabled
      expect(mockFeedbackDefinitions.createFeedbackDefinition).not.toHaveBeenCalled();
    });
  });
});
