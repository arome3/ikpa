/**
 * A/B Testing Unit Tests
 *
 * Tests cover:
 * - Test registration and validation
 * - Deterministic variant selection
 * - Result tracking
 * - Comparison statistics
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ABTestManager,
  ABTestConfig,
} from '../ab-testing';

describe('ABTestManager', () => {
  let manager: ABTestManager;

  const validConfig: ABTestConfig = {
    name: 'test-experiment',
    variants: [
      { id: 'control', weight: 50, criteria: { threshold: 0.7 } },
      { id: 'treatment', weight: 50, criteria: { threshold: 0.85 } },
    ],
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ABTestManager();
  });

  describe('registerTest()', () => {
    it('should register a valid test', () => {
      manager.registerTest(validConfig);

      const test = manager.getTest('test-experiment');
      expect(test).toBeDefined();
      expect(test?.name).toBe('test-experiment');
      expect(test?.variants).toHaveLength(2);
    });

    it('should update existing test when re-registering', () => {
      manager.registerTest(validConfig);

      const updatedConfig = {
        ...validConfig,
        variants: [
          { id: 'control', weight: 70, criteria: {} },
          { id: 'treatment', weight: 30, criteria: {} },
        ],
      };
      manager.registerTest(updatedConfig);

      const test = manager.getTest('test-experiment');
      expect(test?.variants[0].weight).toBe(70);
    });

    it('should throw if name is empty', () => {
      expect(() =>
        manager.registerTest({ ...validConfig, name: '' }),
      ).toThrow('A/B test name is required');
    });

    it('should throw if less than 2 variants', () => {
      expect(() =>
        manager.registerTest({
          ...validConfig,
          variants: [{ id: 'only', weight: 100, criteria: {} }],
        }),
      ).toThrow('A/B test must have at least 2 variants');
    });

    it('should throw if variant has empty ID', () => {
      expect(() =>
        manager.registerTest({
          ...validConfig,
          variants: [
            { id: '', weight: 50, criteria: {} },
            { id: 'b', weight: 50, criteria: {} },
          ],
        }),
      ).toThrow('Variant ID is required');
    });

    it('should throw if duplicate variant IDs', () => {
      expect(() =>
        manager.registerTest({
          ...validConfig,
          variants: [
            { id: 'same', weight: 50, criteria: {} },
            { id: 'same', weight: 50, criteria: {} },
          ],
        }),
      ).toThrow('Duplicate variant ID');
    });

    it('should throw if variant weight is not positive', () => {
      expect(() =>
        manager.registerTest({
          ...validConfig,
          variants: [
            { id: 'a', weight: 0, criteria: {} },
            { id: 'b', weight: 50, criteria: {} },
          ],
        }),
      ).toThrow('Variant weight must be positive');
    });
  });

  describe('unregisterTest()', () => {
    it('should unregister an existing test', () => {
      manager.registerTest(validConfig);

      const result = manager.unregisterTest('test-experiment');

      expect(result).toBe(true);
      expect(manager.getTest('test-experiment')).toBeUndefined();
    });

    it('should return false for non-existent test', () => {
      const result = manager.unregisterTest('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getAllTests()', () => {
    it('should return all registered tests', () => {
      manager.registerTest(validConfig);
      manager.registerTest({
        ...validConfig,
        name: 'another-test',
      });

      const tests = manager.getAllTests();

      expect(tests).toHaveLength(2);
      expect(tests.map((t) => t.name)).toContain('test-experiment');
      expect(tests.map((t) => t.name)).toContain('another-test');
    });

    it('should return empty array when no tests', () => {
      expect(manager.getAllTests()).toHaveLength(0);
    });
  });

  describe('setTestEnabled()', () => {
    it('should enable/disable a test', () => {
      manager.registerTest(validConfig);

      manager.setTestEnabled('test-experiment', false);
      expect(manager.getTest('test-experiment')?.enabled).toBe(false);

      manager.setTestEnabled('test-experiment', true);
      expect(manager.getTest('test-experiment')?.enabled).toBe(true);
    });

    it('should return false for non-existent test', () => {
      const result = manager.setTestEnabled('nonexistent', true);
      expect(result).toBe(false);
    });
  });

  describe('selectVariant()', () => {
    it('should return undefined for non-existent test', () => {
      const variant = manager.selectVariant('nonexistent', 'user-1');
      expect(variant).toBeUndefined();
    });

    it('should return undefined for disabled test', () => {
      manager.registerTest({ ...validConfig, enabled: false });

      const variant = manager.selectVariant('test-experiment', 'user-1');
      expect(variant).toBeUndefined();
    });

    it('should return undefined for test not yet started', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      manager.registerTest({
        ...validConfig,
        startDate: futureDate,
      });

      const variant = manager.selectVariant('test-experiment', 'user-1');
      expect(variant).toBeUndefined();
    });

    it('should return undefined for test that has ended', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      manager.registerTest({
        ...validConfig,
        endDate: pastDate,
      });

      const variant = manager.selectVariant('test-experiment', 'user-1');
      expect(variant).toBeUndefined();
    });

    it('should select a variant for valid test', () => {
      manager.registerTest(validConfig);

      const variant = manager.selectVariant('test-experiment', 'user-1');

      expect(variant).toBeDefined();
      expect(['control', 'treatment']).toContain(variant?.id);
    });

    it('should be deterministic for same identifier', () => {
      manager.registerTest(validConfig);

      const variant1 = manager.selectVariant('test-experiment', 'user-123');
      const variant2 = manager.selectVariant('test-experiment', 'user-123');

      expect(variant1?.id).toBe(variant2?.id);
    });

    it('should select different variants for different identifiers', () => {
      manager.registerTest(validConfig);

      // Test many identifiers to verify distribution
      const variants = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const variant = manager.selectVariant('test-experiment', `user-${i}`);
        if (variant) variants.add(variant.id);
      }

      // Should have both variants represented
      expect(variants.size).toBe(2);
    });

    it('should respect variant weights', () => {
      manager.registerTest({
        ...validConfig,
        variants: [
          { id: 'heavy', weight: 90, criteria: {} },
          { id: 'light', weight: 10, criteria: {} },
        ],
      });

      // Test distribution over many selections
      let heavyCount = 0;
      for (let i = 0; i < 1000; i++) {
        const variant = manager.selectVariant('test-experiment', `user-${i}`);
        if (variant?.id === 'heavy') heavyCount++;
      }

      // Should be roughly 90% (allow for variance)
      const heavyRatio = heavyCount / 1000;
      expect(heavyRatio).toBeGreaterThan(0.8);
      expect(heavyRatio).toBeLessThan(0.98);
    });
  });

  describe('trackResult()', () => {
    it('should track result for valid test and variant', () => {
      manager.registerTest(validConfig);

      manager.trackResult('test-experiment', 'control', {
        score: 4.5,
        passed: true,
      });

      const results = manager.exportResults('test-experiment');
      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(4.5);
      expect(results[0].passed).toBe(true);
    });

    it('should not track result for non-existent test', () => {
      manager.trackResult('nonexistent', 'control', {
        score: 4.5,
        passed: true,
      });

      const results = manager.exportResults('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should not track result for non-existent variant', () => {
      manager.registerTest(validConfig);

      manager.trackResult('test-experiment', 'invalid-variant', {
        score: 4.5,
        passed: true,
      });

      const results = manager.exportResults('test-experiment');
      expect(results).toHaveLength(0);
    });

    it('should include metadata in tracked results', () => {
      manager.registerTest(validConfig);

      manager.trackResult('test-experiment', 'control', {
        score: 4.5,
        passed: true,
        metadata: { userId: 'user-123', traceId: 'trace-456' },
      });

      const results = manager.exportResults('test-experiment');
      expect(results[0].metadata).toEqual({
        userId: 'user-123',
        traceId: 'trace-456',
      });
    });

    it('should limit results to maxResultsPerTest', () => {
      const limitedManager = new ABTestManager({ maxResultsPerTest: 10 });
      limitedManager.registerTest(validConfig);

      // Track 15 results
      for (let i = 0; i < 15; i++) {
        limitedManager.trackResult('test-experiment', 'control', {
          score: i,
          passed: true,
        });
      }

      const results = limitedManager.exportResults('test-experiment');
      expect(results).toHaveLength(10);
      // Should keep most recent (scores 5-14)
      expect(results[0].score).toBe(5);
    });
  });

  describe('getComparisonStats()', () => {
    beforeEach(() => {
      manager.registerTest(validConfig);

      // Add results for control variant
      for (let i = 0; i < 50; i++) {
        manager.trackResult('test-experiment', 'control', {
          score: 3 + Math.random() * 2, // 3-5 range
          passed: Math.random() > 0.3, // ~70% pass rate
        });
      }

      // Add results for treatment variant
      for (let i = 0; i < 50; i++) {
        manager.trackResult('test-experiment', 'treatment', {
          score: 3.5 + Math.random() * 1.5, // 3.5-5 range
          passed: Math.random() > 0.2, // ~80% pass rate
        });
      }
    });

    it('should return undefined for non-existent test', () => {
      const stats = manager.getComparisonStats('nonexistent');
      expect(stats).toBeUndefined();
    });

    it('should return stats for each variant', () => {
      const stats = manager.getComparisonStats('test-experiment');

      expect(stats).toBeDefined();
      expect(stats?.variants).toHaveLength(2);
      expect(stats?.variants.map((v) => v.variantId)).toContain('control');
      expect(stats?.variants.map((v) => v.variantId)).toContain('treatment');
    });

    it('should calculate correct counts', () => {
      const stats = manager.getComparisonStats('test-experiment');

      expect(stats?.totalEvaluations).toBe(100);

      const controlStats = stats?.variants.find((v) => v.variantId === 'control');
      expect(controlStats?.count).toBe(50);
    });

    it('should calculate pass rate correctly', () => {
      const stats = manager.getComparisonStats('test-experiment');

      for (const variant of stats?.variants ?? []) {
        expect(variant.passRate).toBeGreaterThanOrEqual(0);
        expect(variant.passRate).toBeLessThanOrEqual(1);
        expect(variant.passCount + variant.failCount).toBe(variant.count);
      }
    });

    it('should calculate average score', () => {
      const stats = manager.getComparisonStats('test-experiment');

      for (const variant of stats?.variants ?? []) {
        expect(variant.averageScore).toBeGreaterThan(0);
        expect(variant.averageScore).toBeLessThanOrEqual(5);
      }
    });

    it('should filter by since date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const stats = manager.getComparisonStats('test-experiment', futureDate);

      expect(stats?.totalEvaluations).toBe(0);
    });

    it('should report not significant with insufficient data', () => {
      // Only 100 samples total, need 100 per variant
      const stats = manager.getComparisonStats('test-experiment');
      expect(stats?.isSignificant).toBe(false);
    });

    it('should determine significance with enough data', () => {
      // Add many more results to reach significance threshold
      for (let i = 0; i < 500; i++) {
        manager.trackResult('test-experiment', 'control', {
          score: 3,
          passed: false, // Always fail for control
        });
        manager.trackResult('test-experiment', 'treatment', {
          score: 5,
          passed: true, // Always pass for treatment
        });
      }

      const stats = manager.getComparisonStats('test-experiment');

      // With such extreme difference and enough data, should be significant
      expect(stats?.isSignificant).toBe(true);
      expect(stats?.winningVariant).toBe('treatment');
    });
  });

  describe('exportResults()', () => {
    it('should return empty array for non-existent test', () => {
      const results = manager.exportResults('nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return all tracked results', () => {
      manager.registerTest(validConfig);

      manager.trackResult('test-experiment', 'control', { score: 1, passed: true });
      manager.trackResult('test-experiment', 'treatment', { score: 2, passed: false });

      const results = manager.exportResults('test-experiment');
      expect(results).toHaveLength(2);
    });
  });

  describe('clearResults()', () => {
    it('should clear all results for a test', () => {
      manager.registerTest(validConfig);
      manager.trackResult('test-experiment', 'control', { score: 1, passed: true });

      manager.clearResults('test-experiment');

      const results = manager.exportResults('test-experiment');
      expect(results).toHaveLength(0);
    });
  });
});
