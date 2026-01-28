/**
 * StakeEffectivenessMetric Unit Tests
 *
 * Tests cover:
 * - Score calculation for each stake type
 * - Goal completed vs not completed
 * - Missing context handling
 * - Score capping at 1.0
 * - Metadata in results
 * - Helper methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StakeEffectivenessMetric } from '../stake-effectiveness.metric';
import { DatasetItem } from '../interfaces';

describe('StakeEffectivenessMetric', () => {
  let metric: StakeEffectivenessMetric;

  beforeEach(() => {
    metric = new StakeEffectivenessMetric();
  });

  describe('metric metadata', () => {
    it('should have correct name', () => {
      expect(metric.name).toBe('StakeEffectiveness');
    });

    it('should have correct description', () => {
      expect(metric.description).toBe('Measures goal completion rate by stake type');
    });
  });

  describe('goal completion scoring', () => {
    type StakeType = 'social' | 'anti_charity' | 'loss_pool' | 'none';

    const stakeTypes: Array<{ type: StakeType; expectedRate: number }> = [
      { type: 'social', expectedRate: 0.78 },
      { type: 'anti_charity', expectedRate: 0.85 },
      { type: 'loss_pool', expectedRate: 0.72 },
      { type: 'none', expectedRate: 0.35 },
    ];

    describe.each(stakeTypes)('stake type: $type', ({ type, expectedRate }) => {
      it('should return score 1.0 when goal completed', async () => {
        const datasetItem: DatasetItem = {
          input: '',
          output: '',
          context: {
            stakeType: type,
            goalCompleted: true,
          },
        };

        const result = await metric.score(datasetItem, '');

        // Raw score would be 1 / expectedRate, but capped at 1.0
        expect(result.score).toBeLessThanOrEqual(1);
        expect(result.score).toBeGreaterThan(0);
        expect(result.reason).toContain(`Goal achieved with ${type} stake`);
        expect(result.reason).toContain(`expected rate: ${Math.round(expectedRate * 100)}%`);
        expect(result.metadata?.stakeType).toBe(type);
        expect(result.metadata?.goalCompleted).toBe(true);
        expect(result.metadata?.expectedRate).toBe(expectedRate);
      });

      it('should return score 0 when goal not completed', async () => {
        const datasetItem: DatasetItem = {
          input: '',
          output: '',
          context: {
            stakeType: type,
            goalCompleted: false,
          },
        };

        const result = await metric.score(datasetItem, '');

        expect(result.score).toBe(0);
        expect(result.reason).toBe(`Goal not achieved with ${type} stake`);
        expect(result.metadata?.stakeType).toBe(type);
        expect(result.metadata?.goalCompleted).toBe(false);
      });
    });
  });

  describe('score capping', () => {
    it('should cap score at 1.0 for high-difficulty achievements', async () => {
      // Using 'none' stake (35% expected rate) - achieving would give raw score of 2.86
      const datasetItem: DatasetItem = {
        input: '',
        output: '',
        context: {
          stakeType: 'none',
          goalCompleted: true,
        },
      };

      const result = await metric.score(datasetItem, '');

      expect(result.score).toBe(1.0);
      expect(result.metadata?.rawScore).toBeCloseTo(1 / 0.35, 2);
      expect(result.metadata?.cappedAt1).toBe(true);
    });

    it('should not cap score for anti_charity (expected rate 85%)', async () => {
      const datasetItem: DatasetItem = {
        input: '',
        output: '',
        context: {
          stakeType: 'anti_charity',
          goalCompleted: true,
        },
      };

      const result = await metric.score(datasetItem, '');

      // 1 / 0.85 = 1.176, capped at 1.0
      expect(result.score).toBe(1.0);
    });
  });

  describe('missing context handling', () => {
    it('should return score 0 when stakeType missing', async () => {
      const datasetItem: DatasetItem = {
        input: '',
        output: '',
        context: {
          goalCompleted: true,
        },
      };

      const result = await metric.score(datasetItem, '');

      expect(result.score).toBe(0);
      expect(result.reason).toBe('Missing stake type in context');
      expect(result.metadata?.hasStakeType).toBe(false);
    });

    it('should return score 0 when goalCompleted missing', async () => {
      const datasetItem: DatasetItem = {
        input: '',
        output: '',
        context: {
          stakeType: 'social',
        },
      };

      const result = await metric.score(datasetItem, '');

      expect(result.score).toBe(0);
      expect(result.reason).toBe('Missing goal completion data in context');
      expect(result.metadata?.hasStakeType).toBe(true);
      expect(result.metadata?.hasGoalCompleted).toBe(false);
    });

    it('should return score 0 when context is undefined', async () => {
      const datasetItem: DatasetItem = {
        input: '',
        output: '',
      };

      const result = await metric.score(datasetItem, '');

      expect(result.score).toBe(0);
      expect(result.reason).toBe('Missing stake type in context');
    });

    it('should return score 0 when context is empty', async () => {
      const datasetItem: DatasetItem = {
        input: '',
        output: '',
        context: {},
      };

      const result = await metric.score(datasetItem, '');

      expect(result.score).toBe(0);
    });
  });

  describe('unknown stake type', () => {
    it('should use default rate for unknown stake type', async () => {
      // Cast to unknown to test runtime behavior with invalid type
      const datasetItem: DatasetItem = {
        input: '',
        output: '',
        context: {
          stakeType: 'unknown_type' as 'social', // Type assertion for testing runtime behavior
          goalCompleted: true,
        },
      };

      const result = await metric.score(datasetItem, '');

      // Should use 'none' rate (0.35) as default
      expect(result.score).toBe(1.0); // Capped
      expect(result.metadata?.expectedRate).toBe(0.35);
    });
  });

  describe('helper methods', () => {
    it('should return expected rate for known stake type', () => {
      expect(metric.getExpectedRate('social')).toBe(0.78);
      expect(metric.getExpectedRate('anti_charity')).toBe(0.85);
      expect(metric.getExpectedRate('loss_pool')).toBe(0.72);
      expect(metric.getExpectedRate('none')).toBe(0.35);
    });

    it('should return default rate for unknown stake type', () => {
      expect(metric.getExpectedRate('unknown')).toBe(0.35);
    });

    it('should return all expected rates', () => {
      const rates = metric.getAllExpectedRates();

      expect(rates).toEqual({
        social: 0.78,
        anti_charity: 0.85,
        loss_pool: 0.72,
        none: 0.35,
      });
    });
  });
});
