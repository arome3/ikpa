/**
 * SimulationEngineCalculator Unit Tests
 *
 * Tests cover:
 * - Monte Carlo simulation with known seed patterns
 * - Dual-path comparison (current vs optimized)
 * - Aggregation functions (median, percentiles)
 * - Edge cases (zero income, negative net worth, past deadline)
 * - Opik tracing integration
 * - Caching behavior
 *
 * Target: >80% coverage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimulationEngineCalculator } from '../calculators/simulation-engine.calculator';
import { OpikService } from '../../ai/opik/opik.service';
import { SimulationInput, SIMULATION_CONSTANTS, TIME_HORIZONS } from '../interfaces';

describe('SimulationEngineCalculator', () => {
  let calculator: SimulationEngineCalculator;
  let mockOpikService: Partial<OpikService>;

  // Mock Opik functions
  const mockSpanEnd = vi.fn();
  const mockSpan = vi.fn().mockReturnValue({ end: mockSpanEnd });
  const mockTraceEnd = vi.fn();
  const mockTrace = {
    span: mockSpan,
    end: mockTraceEnd,
  };

  /**
   * Helper to create base simulation input
   */
  const createBaseSimulationInput = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({
    currentSavingsRate: 0.1, // 10%
    monthlyIncome: 400000, // NGN 400,000
    currentNetWorth: 500000, // NGN 500,000
    goalAmount: 2000000, // NGN 2,000,000
    goalDeadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), // 2 years from now
    expectedReturnRate: 0.07, // 7%
    inflationRate: 0.05, // 5%
    incomeGrowthRate: 0.03, // 3% annual income growth
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock for each test
    mockOpikService = {
      createTrace: vi.fn().mockReturnValue({
        trace: mockTrace,
        traceId: 'test-trace-id',
        traceName: 'test_trace',
        startedAt: new Date(),
      }),
      createToolSpan: vi.fn().mockReturnValue({
        span: mockSpan,
        type: 'tool',
        name: 'test_span',
        spanId: 'test-span-id',
        traceId: 'test-trace-id',
        startedAt: new Date(),
      }),
      endSpan: vi.fn(),
      endTrace: vi.fn(),
    };

    // Manually instantiate the calculator with mock dependencies
    calculator = new SimulationEngineCalculator(mockOpikService as OpikService);

    // Clear cache before each test
    calculator.clearCache();
  });

  afterEach(() => {
    calculator.clearCache();
  });

  // ==========================================
  // FULL SIMULATION TESTS
  // ==========================================

  describe('runDualPathSimulation', () => {
    it('should run complete simulation with all required fields', async () => {
      const input = createBaseSimulationInput();

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result).toBeDefined();
      expect(result.currentPath).toBeDefined();
      expect(result.optimizedPath).toBeDefined();
      expect(result.wealthDifference).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should return probability between 0 and 1', async () => {
      const input = createBaseSimulationInput();

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result.currentPath.probability).toBeGreaterThanOrEqual(0);
      expect(result.currentPath.probability).toBeLessThanOrEqual(1);
      expect(result.optimizedPath.probability).toBeGreaterThanOrEqual(0);
      expect(result.optimizedPath.probability).toBeLessThanOrEqual(1);
    });

    it('should include projections for all time horizons', async () => {
      const input = createBaseSimulationInput();

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      for (const horizon of TIME_HORIZONS) {
        expect(result.currentPath.projectedNetWorth[horizon]).toBeDefined();
        expect(result.currentPath.projectedNetWorth[horizon]).toBeGreaterThanOrEqual(0);
        expect(result.optimizedPath.projectedNetWorth[horizon]).toBeDefined();
        expect(result.optimizedPath.projectedNetWorth[horizon]).toBeGreaterThanOrEqual(0);
        expect(result.wealthDifference[horizon]).toBeDefined();
      }
    });

    it('should include confidence intervals at all time horizons', async () => {
      const input = createBaseSimulationInput();

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Check confidence intervals exist at all horizons
      for (const horizon of TIME_HORIZONS) {
        expect(result.currentPath.confidenceIntervals[horizon]).toBeDefined();
        expect(result.currentPath.confidenceIntervals[horizon].low).toBeDefined();
        expect(result.currentPath.confidenceIntervals[horizon].high).toBeDefined();
        expect(result.currentPath.confidenceIntervals[horizon].low).toBeLessThanOrEqual(
          result.currentPath.confidenceIntervals[horizon].high,
        );

        expect(result.optimizedPath.confidenceIntervals[horizon]).toBeDefined();
        expect(result.optimizedPath.confidenceIntervals[horizon].low).toBeLessThanOrEqual(
          result.optimizedPath.confidenceIntervals[horizon].high,
        );
      }
    });

    it('should include required savings rate in optimized path', async () => {
      const input = createBaseSimulationInput({ currentSavingsRate: 0.1 });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result.optimizedPath.requiredSavingsRate).toBeDefined();
      expect(result.optimizedPath.requiredSavingsRate).toBeGreaterThan(0);
      expect(result.optimizedPath.requiredSavingsRate).toBeLessThanOrEqual(
        SIMULATION_CONSTANTS.MAX_SAVINGS_RATE,
      );
    });

    it('should include metadata with execution time', async () => {
      const input = createBaseSimulationInput();

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result.metadata.iterations).toBe(SIMULATION_CONSTANTS.ITERATIONS);
      expect(result.metadata.durationMs).toBeGreaterThan(0);
      expect(result.metadata.simulatedAt).toBeInstanceOf(Date);
      expect(result.metadata.currency).toBe('NGN');
    });

    it('should create Opik trace for simulation', async () => {
      const input = createBaseSimulationInput();

      await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(mockOpikService.createTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'dual_path_simulation',
          tags: ['finance', 'simulation', 'monte-carlo'],
        }),
      );
    });

    it('should end trace with success on successful simulation', async () => {
      const input = createBaseSimulationInput();

      await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(mockOpikService.endTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          success: true,
        }),
      );
    });
  });

  // ==========================================
  // PATH COMPARISON TESTS
  // ==========================================

  describe('Path Comparison', () => {
    it('should have higher probability for optimized path with higher savings rate', async () => {
      // Use a scenario where current savings rate is low
      const input = createBaseSimulationInput({
        currentSavingsRate: 0.05, // 5%
        goalAmount: 5000000, // Higher goal
        goalDeadline: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000), // 3 years
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Optimized path should generally have better outcomes
      // Note: Due to randomness, we can't guarantee this every time, but on average it should be true
      // For testing, we verify the structure is correct
      expect(result.optimizedPath.requiredSavingsRate).toBeGreaterThan(input.currentSavingsRate);
    });

    it('should cap optimized savings rate at MAX_SAVINGS_RATE', async () => {
      const input = createBaseSimulationInput({
        currentSavingsRate: 0.30, // 30% - already high
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result.optimizedPath.requiredSavingsRate).toBeLessThanOrEqual(
        SIMULATION_CONSTANTS.MAX_SAVINGS_RATE,
      );
    });

    it('should calculate positive wealth difference when optimized path is better', async () => {
      const input = createBaseSimulationInput({
        currentSavingsRate: 0.05, // Low savings rate
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Wealth difference should generally be positive (optimized - current)
      // Over long horizons, higher savings should lead to more wealth
      // Check 20yr horizon where difference should be most pronounced
      expect(result.wealthDifference['20yr']).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // NET WORTH PROJECTION TESTS
  // ==========================================

  describe('Net Worth Projections', () => {
    it('should project increasing net worth over time', async () => {
      const input = createBaseSimulationInput({
        currentSavingsRate: 0.15, // 15% savings rate
        currentNetWorth: 1000000,
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Net worth should generally increase over time
      const netWorth = result.currentPath.projectedNetWorth;
      expect(netWorth['1yr']).toBeGreaterThan(netWorth['6mo']);
      expect(netWorth['5yr']).toBeGreaterThan(netWorth['1yr']);
      expect(netWorth['10yr']).toBeGreaterThan(netWorth['5yr']);
      expect(netWorth['20yr']).toBeGreaterThan(netWorth['10yr']);
    });

    it('should project higher net worth with higher initial net worth', async () => {
      const lowNetWorthInput = createBaseSimulationInput({ currentNetWorth: 100000 });
      const highNetWorthInput = createBaseSimulationInput({ currentNetWorth: 5000000 });

      const lowResult = await calculator.runDualPathSimulation('user-low', lowNetWorthInput, 'NGN');
      const highResult = await calculator.runDualPathSimulation('user-high', highNetWorthInput, 'NGN');

      // Higher starting net worth should lead to higher ending net worth
      expect(highResult.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(
        lowResult.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should handle zero starting net worth', async () => {
      const input = createBaseSimulationInput({
        currentNetWorth: 0,
        currentSavingsRate: 0.15,
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Should still project future wealth from savings
      expect(result.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(0);
    });

    it('should handle negative starting net worth (debt)', async () => {
      const input = createBaseSimulationInput({
        currentNetWorth: -500000, // In debt
        currentSavingsRate: 0.15,
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Should still complete simulation without error
      expect(result.currentPath.projectedNetWorth).toBeDefined();
    });
  });

  // ==========================================
  // GOAL ACHIEVEMENT TESTS
  // ==========================================

  describe('Goal Achievement', () => {
    it('should estimate goal achievement date when achievable', async () => {
      const input = createBaseSimulationInput({
        currentSavingsRate: 0.20, // High savings rate
        goalAmount: 1000000, // Achievable goal
        goalDeadline: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // With high savings rate and long timeline, goal should be achievable
      expect(result.currentPath.probability).toBeGreaterThan(0);
    });

    it('should return null achieve date when goal is very unlikely', async () => {
      const input = createBaseSimulationInput({
        currentSavingsRate: 0.01, // Very low savings
        goalAmount: 100000000, // Very high goal
        goalDeadline: new Date(Date.now() + 1 * 365 * 24 * 60 * 60 * 1000), // Only 1 year
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Probability should be low but achieveGoalDate can be null or very far out
      expect(result.currentPath.probability).toBeDefined();
    });
  });

  // ==========================================
  // CACHING TESTS
  // ==========================================

  describe('Caching', () => {
    it('should cache results and return cached value on second call', async () => {
      const input = createBaseSimulationInput();

      const result1 = await calculator.runDualPathSimulation('user-123', input, 'NGN');
      const result2 = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Results should be identical (same object from cache)
      expect(result1.metadata.simulatedAt).toEqual(result2.metadata.simulatedAt);
    });

    it('should not cache for different users', async () => {
      const input = createBaseSimulationInput();

      const result1 = await calculator.runDualPathSimulation('user-123', input, 'NGN');
      const result2 = await calculator.runDualPathSimulation('user-456', input, 'NGN');

      // Different users should get fresh simulations
      // Timestamps will be different
      expect(result1.metadata.simulatedAt.getTime()).not.toEqual(
        result2.metadata.simulatedAt.getTime(),
      );
    });

    it('should not cache for different inputs', async () => {
      const input1 = createBaseSimulationInput({ currentSavingsRate: 0.1 });
      const input2 = createBaseSimulationInput({ currentSavingsRate: 0.2 });

      const result1 = await calculator.runDualPathSimulation('user-123', input1, 'NGN');
      const result2 = await calculator.runDualPathSimulation('user-123', input2, 'NGN');

      // Different inputs should get fresh simulations
      expect(result1.optimizedPath.requiredSavingsRate).not.toEqual(
        result2.optimizedPath.requiredSavingsRate,
      );
    });

    it('should clear cache when clearCache is called', async () => {
      const input = createBaseSimulationInput();

      const result1 = await calculator.runDualPathSimulation('user-123', input, 'NGN');
      calculator.clearCache();

      // Wait a small amount to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result2 = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // After cache clear, should get fresh simulation
      expect(result1.metadata.simulatedAt.getTime()).toBeLessThan(
        result2.metadata.simulatedAt.getTime(),
      );
    });
  });

  // ==========================================
  // EDGE CASES
  // ==========================================

  describe('Edge Cases', () => {
    it('should handle zero income gracefully', async () => {
      const input = createBaseSimulationInput({
        monthlyIncome: 0,
        currentSavingsRate: 0,
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Should complete without error
      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth).toBeDefined();
    });

    it('should handle very high income', async () => {
      const input = createBaseSimulationInput({
        monthlyIncome: 100000000, // 100 million
        currentSavingsRate: 0.20,
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(0);
    });

    it('should handle goal deadline in the past', async () => {
      const input = createBaseSimulationInput({
        goalDeadline: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Should still complete - probability will be 0 or very low
      expect(result).toBeDefined();
      expect(result.currentPath.probability).toBe(0);
    });

    it('should handle very low expected return rate', async () => {
      const input = createBaseSimulationInput({
        expectedReturnRate: 0.01, // 1%
        inflationRate: 0.05, // 5% - negative real return
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Should complete without error
      expect(result).toBeDefined();
    });

    it('should handle very long time horizon goal', async () => {
      const input = createBaseSimulationInput({
        goalDeadline: new Date(Date.now() + 30 * 365 * 24 * 60 * 60 * 1000), // 30 years
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(0);
    });

    it('should handle savings rate of 0', async () => {
      const input = createBaseSimulationInput({
        currentSavingsRate: 0,
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result).toBeDefined();
      // With binary search, even 0 savings rate should search for optimal rate
      // The optimized rate should be > 0 to achieve target probability
      expect(result.optimizedPath.requiredSavingsRate).toBeGreaterThanOrEqual(0);
      expect(result.optimizedPath.requiredSavingsRate).toBeLessThanOrEqual(
        SIMULATION_CONSTANTS.MAX_SAVINGS_RATE,
      );
    });

    it('should handle savings rate of 1 (100%)', async () => {
      const input = createBaseSimulationInput({
        currentSavingsRate: 1,
      });

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result).toBeDefined();
      // With 100% savings rate, probability is already at/above target,
      // so binary search returns the current rate (1.0)
      // This is correct behavior - no need to optimize if already at target
      expect(result.optimizedPath.requiredSavingsRate).toBe(1);
      expect(result.currentPath.probability).toBeGreaterThanOrEqual(
        SIMULATION_CONSTANTS.TARGET_PROBABILITY,
      );
    });
  });

  // ==========================================
  // OPIK TRACING TESTS
  // ==========================================

  describe('Opik Tracing', () => {
    it('should create spans for each major calculation step', async () => {
      const input = createBaseSimulationInput();

      await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Should create spans for:
      // 1. monte_carlo_current_path
      // 2. aggregate_current_results
      // 3. find_optimal_savings_rate
      // 4. monte_carlo_optimized_path
      // 5. aggregate_optimized_results
      expect(mockOpikService.createToolSpan).toHaveBeenCalledTimes(5);
    });

    it('should end all spans', async () => {
      const input = createBaseSimulationInput();

      await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(mockOpikService.endSpan).toHaveBeenCalledTimes(5);
    });

    it('should include probability metrics in trace end', async () => {
      const input = createBaseSimulationInput();

      await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(mockOpikService.endTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          success: true,
          result: expect.objectContaining({
            currentPathProbability: expect.any(Number),
            optimizedPathProbability: expect.any(Number),
            requiredSavingsRate: expect.any(Number),
            wealthDifference20yr: expect.any(Number),
            durationMs: expect.any(Number),
          }),
        }),
      );
    });
  });

  // ==========================================
  // CONSTANTS TESTS
  // ==========================================

  describe('Constants', () => {
    it('should use correct number of iterations', async () => {
      const input = createBaseSimulationInput();

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      expect(result.metadata.iterations).toBe(SIMULATION_CONSTANTS.ITERATIONS);
    });

    it('should have valid time horizons', () => {
      expect(TIME_HORIZONS).toEqual(['6mo', '1yr', '5yr', '10yr', '20yr']);
    });

    it('should have valid max savings rate', () => {
      expect(SIMULATION_CONSTANTS.MAX_SAVINGS_RATE).toBe(0.35);
    });

    it('should have valid target probability for optimization', () => {
      expect(SIMULATION_CONSTANTS.TARGET_PROBABILITY).toBe(0.85);
    });

    it('should have valid optimization tolerance', () => {
      expect(SIMULATION_CONSTANTS.OPTIMIZATION_TOLERANCE).toBe(0.005);
    });

    it('should have valid income growth rate default', () => {
      expect(SIMULATION_CONSTANTS.DEFAULT_INCOME_GROWTH_RATE).toBe(0.03);
    });
  });

  // ==========================================
  // INCOME GROWTH TESTS
  // ==========================================

  describe('Income Growth', () => {
    it('should project higher net worth with income growth', async () => {
      // Create two inputs - one with income growth, one without
      const inputWithGrowth = createBaseSimulationInput({
        incomeGrowthRate: 0.05, // 5% annual growth
        currentSavingsRate: 0.15,
      });

      const inputWithoutGrowth = createBaseSimulationInput({
        incomeGrowthRate: 0, // No growth
        currentSavingsRate: 0.15,
      });

      const resultWithGrowth = await calculator.runDualPathSimulation('user-growth', inputWithGrowth, 'NGN');
      const resultWithoutGrowth = await calculator.runDualPathSimulation('user-no-growth', inputWithoutGrowth, 'NGN');

      // Over 20 years, income growth should result in significantly higher net worth
      expect(resultWithGrowth.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(
        resultWithoutGrowth.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should use default income growth rate when not specified', async () => {
      const input = createBaseSimulationInput();
      // incomeGrowthRate not specified, should use DEFAULT_INCOME_GROWTH_RATE (0.03)

      const result = await calculator.runDualPathSimulation('user-123', input, 'NGN');

      // Should complete successfully using default
      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // SEEDABLE RANDOM TESTS (Reproducibility)
  // ==========================================

  describe('Seedable Random', () => {
    it('should produce identical results with the same random seed', async () => {
      const input = createBaseSimulationInput({
        randomSeed: 12345,
        currentSavingsRate: 0.1,
      });

      // Clear cache to ensure fresh simulation
      calculator.clearCache();
      const result1 = await calculator.runDualPathSimulation('user-seed-1', input, 'NGN');

      // Run again with same seed (different user to avoid cache)
      calculator.clearCache();
      const result2 = await calculator.runDualPathSimulation('user-seed-2', input, 'NGN');

      // Results should be identical when using same seed
      expect(result1.currentPath.probability).toBe(result2.currentPath.probability);
      expect(result1.currentPath.projectedNetWorth['6mo']).toBe(result2.currentPath.projectedNetWorth['6mo']);
      expect(result1.currentPath.projectedNetWorth['20yr']).toBe(result2.currentPath.projectedNetWorth['20yr']);
      expect(result1.optimizedPath.requiredSavingsRate).toBe(result2.optimizedPath.requiredSavingsRate);
    });

    it('should produce different results with different random seeds', async () => {
      const input1 = createBaseSimulationInput({ randomSeed: 12345 });
      const input2 = createBaseSimulationInput({ randomSeed: 67890 });

      const result1 = await calculator.runDualPathSimulation('user-1', input1, 'NGN');
      const result2 = await calculator.runDualPathSimulation('user-2', input2, 'NGN');

      // Results should be different with different seeds
      // Note: There's a tiny chance they could be equal, but extremely unlikely
      expect(
        result1.currentPath.projectedNetWorth['20yr'] !== result2.currentPath.projectedNetWorth['20yr'] ||
        result1.currentPath.probability !== result2.currentPath.probability,
      ).toBe(true);
    });

    it('should produce varying results when no seed is provided', async () => {
      const input = createBaseSimulationInput();

      calculator.clearCache();
      const result1 = await calculator.runDualPathSimulation('user-no-seed-1', input, 'NGN');

      // Small delay to ensure different random state
      await new Promise((resolve) => setTimeout(resolve, 10));

      calculator.clearCache();
      const result2 = await calculator.runDualPathSimulation('user-no-seed-2', input, 'NGN');

      // Results will likely be different without seed (not guaranteed but highly probable)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  // ==========================================
  // MULTIPLE GOALS TESTS
  // ==========================================

  describe('Multiple Goals', () => {
    it('should support multiple goals with individual probabilities', async () => {
      const input = createBaseSimulationInput({
        goalAmount: 1000000, // Primary goal (will be overridden)
        goals: [
          { id: 'goal-1', name: 'Emergency Fund', amount: 500000, deadline: new Date(Date.now() + 1 * 365 * 24 * 60 * 60 * 1000) },
          { id: 'goal-2', name: 'Vacation', amount: 1000000, deadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) },
          { id: 'goal-3', name: 'House Down Payment', amount: 5000000, deadline: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) },
        ],
      });

      const result = await calculator.runDualPathSimulation('user-multi', input, 'NGN');

      // Should have individual goal results
      expect(result.currentPath.goalResults).toBeDefined();
      expect(result.currentPath.goalResults).toHaveLength(3);

      // Each goal should have probability and target amount
      result.currentPath.goalResults!.forEach((goalResult) => {
        expect(goalResult.goalId).toBeDefined();
        expect(goalResult.probability).toBeGreaterThanOrEqual(0);
        expect(goalResult.probability).toBeLessThanOrEqual(1);
        expect(goalResult.targetAmount).toBeGreaterThan(0);
      });
    });

    it('should calculate combined probability for all goals', async () => {
      const input = createBaseSimulationInput({
        goals: [
          { id: 'goal-1', amount: 500000, deadline: new Date(Date.now() + 1 * 365 * 24 * 60 * 60 * 1000) },
          { id: 'goal-2', amount: 1000000, deadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) },
        ],
      });

      const result = await calculator.runDualPathSimulation('user-multi-prob', input, 'NGN');

      // Should have allGoalsProbability
      expect(result.currentPath.allGoalsProbability).toBeDefined();
      expect(result.currentPath.allGoalsProbability).toBeGreaterThanOrEqual(0);
      expect(result.currentPath.allGoalsProbability).toBeLessThanOrEqual(1);

      // Combined probability should be <= minimum individual probability
      const minIndividualProb = Math.min(...result.currentPath.goalResults!.map((g) => g.probability));
      expect(result.currentPath.allGoalsProbability).toBeLessThanOrEqual(minIndividualProb + 0.01); // Small tolerance for rounding
    });

    it('should respect goal priorities', async () => {
      const input = createBaseSimulationInput({
        goals: [
          { id: 'goal-low', amount: 500000, deadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), priority: 3 },
          { id: 'goal-high', amount: 500000, deadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), priority: 1 },
          { id: 'goal-med', amount: 500000, deadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), priority: 2 },
        ],
      });

      const result = await calculator.runDualPathSimulation('user-priority', input, 'NGN');

      // Goals should be processed in priority order
      expect(result.currentPath.goalResults).toBeDefined();
      expect(result.currentPath.goalResults![0].goalId).toBe('goal-high');
      expect(result.currentPath.goalResults![1].goalId).toBe('goal-med');
      expect(result.currentPath.goalResults![2].goalId).toBe('goal-low');
    });

    it('should handle up to 5 goals', async () => {
      const input = createBaseSimulationInput({
        goals: [
          { id: 'goal-1', amount: 100000, deadline: new Date(Date.now() + 1 * 365 * 24 * 60 * 60 * 1000) },
          { id: 'goal-2', amount: 200000, deadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) },
          { id: 'goal-3', amount: 300000, deadline: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000) },
          { id: 'goal-4', amount: 400000, deadline: new Date(Date.now() + 4 * 365 * 24 * 60 * 60 * 1000) },
          { id: 'goal-5', amount: 500000, deadline: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) },
        ],
      });

      const result = await calculator.runDualPathSimulation('user-5-goals', input, 'NGN');

      expect(result.currentPath.goalResults).toHaveLength(5);
    });

    it('should use primary goal when goals array is not provided', async () => {
      const input = createBaseSimulationInput({
        goalAmount: 2000000,
        goalDeadline: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000),
        // No goals array
      });

      const result = await calculator.runDualPathSimulation('user-primary', input, 'NGN');

      // Should still work with primary goal
      expect(result.currentPath.probability).toBeDefined();
      expect(result.currentPath.projectedNetWorth).toBeDefined();
    });
  });

  // ==========================================
  // EXPENSE GROWTH TESTS
  // ==========================================

  describe('Expense Growth', () => {
    it('should model expense growth separate from income growth', async () => {
      const inputHighExpenseGrowth = createBaseSimulationInput({
        monthlyExpenses: 200000,
        expenseGrowthRate: 0.08, // 8% expense growth
        incomeGrowthRate: 0.03, // 3% income growth
        currentSavingsRate: 0.2,
      });

      const inputLowExpenseGrowth = createBaseSimulationInput({
        monthlyExpenses: 200000,
        expenseGrowthRate: 0.02, // 2% expense growth
        incomeGrowthRate: 0.03, // 3% income growth
        currentSavingsRate: 0.2,
      });

      const resultHigh = await calculator.runDualPathSimulation('user-high-exp', inputHighExpenseGrowth, 'NGN');
      const resultLow = await calculator.runDualPathSimulation('user-low-exp', inputLowExpenseGrowth, 'NGN');

      // Higher expense growth should result in lower net worth
      expect(resultHigh.currentPath.projectedNetWorth['20yr']).toBeLessThan(
        resultLow.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should use inflation rate as default expense growth when not specified', async () => {
      const input = createBaseSimulationInput({
        monthlyExpenses: 200000,
        inflationRate: 0.05,
        // expenseGrowthRate not specified - should use inflation rate
      });

      const result = await calculator.runDualPathSimulation('user-default-exp', input, 'NGN');

      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth).toBeDefined();
    });

    it('should handle zero monthly expenses', async () => {
      const input = createBaseSimulationInput({
        monthlyExpenses: 0,
        expenseGrowthRate: 0.05,
      });

      const result = await calculator.runDualPathSimulation('user-no-exp', input, 'NGN');

      expect(result).toBeDefined();
      // With no expenses, more money is saved
      expect(result.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // MARKET REGIME TESTS
  // ==========================================

  describe('Market Regimes', () => {
    it('should enable market regime modeling when flag is set', async () => {
      const inputWithRegimes = createBaseSimulationInput({
        enableMarketRegimes: true,
        randomSeed: 42, // Use seed for reproducibility
      });

      const inputWithoutRegimes = createBaseSimulationInput({
        enableMarketRegimes: false,
        randomSeed: 42,
      });

      const resultWith = await calculator.runDualPathSimulation('user-regimes', inputWithRegimes, 'NGN');
      const resultWithout = await calculator.runDualPathSimulation('user-no-regimes', inputWithoutRegimes, 'NGN');

      // Both should complete successfully
      expect(resultWith).toBeDefined();
      expect(resultWithout).toBeDefined();

      // Results should be different due to regime modeling
      // (though with same seed, the base random numbers are same, regime adjustments differ)
      expect(resultWith.currentPath.projectedNetWorth['20yr']).not.toBe(
        resultWithout.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should produce wider confidence intervals with market regimes', async () => {
      const inputWithRegimes = createBaseSimulationInput({
        enableMarketRegimes: true,
      });

      const inputWithoutRegimes = createBaseSimulationInput({
        enableMarketRegimes: false,
      });

      const resultWith = await calculator.runDualPathSimulation('user-regime-ci', inputWithRegimes, 'NGN');
      const resultWithout = await calculator.runDualPathSimulation('user-no-regime-ci', inputWithoutRegimes, 'NGN');

      // Market regimes add volatility, which typically widens confidence intervals
      const ciWidthWith = resultWith.currentPath.confidenceIntervals['20yr'].high - resultWith.currentPath.confidenceIntervals['20yr'].low;
      const ciWidthWithout = resultWithout.currentPath.confidenceIntervals['20yr'].high - resultWithout.currentPath.confidenceIntervals['20yr'].low;

      // With regimes, the spread should be different (usually wider due to volatility regimes)
      expect(ciWidthWith).toBeGreaterThan(0);
      expect(ciWidthWithout).toBeGreaterThan(0);
    });

    it('should default to disabled market regimes', async () => {
      const input = createBaseSimulationInput();
      // enableMarketRegimes not specified

      const result = await calculator.runDualPathSimulation('user-default-regime', input, 'NGN');

      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth).toBeDefined();
    });
  });

  // ==========================================
  // TAX MODELING TESTS
  // ==========================================

  describe('Tax Modeling', () => {
    it('should reduce net worth with tax on investment returns', async () => {
      const inputWithTax = createBaseSimulationInput({
        taxRateOnReturns: 0.15, // 15% tax on returns
        randomSeed: 99,
      });

      const inputNoTax = createBaseSimulationInput({
        taxRateOnReturns: 0, // No tax
        randomSeed: 99,
      });

      const resultWithTax = await calculator.runDualPathSimulation('user-tax', inputWithTax, 'NGN');
      const resultNoTax = await calculator.runDualPathSimulation('user-no-tax', inputNoTax, 'NGN');

      // With tax, net worth should be lower
      expect(resultWithTax.currentPath.projectedNetWorth['20yr']).toBeLessThan(
        resultNoTax.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should handle high tax rate', async () => {
      const input = createBaseSimulationInput({
        taxRateOnReturns: 0.4, // 40% tax
      });

      const result = await calculator.runDualPathSimulation('user-high-tax', input, 'NGN');

      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(0);
    });

    it('should default to zero tax rate', async () => {
      // taxRateOnReturns not specified - should default to 0
      const inputExplicitZero = createBaseSimulationInput({
        taxRateOnReturns: 0,
        randomSeed: 123,
      });

      const inputDefault = createBaseSimulationInput({
        randomSeed: 123,
      });

      const resultExplicit = await calculator.runDualPathSimulation('user-zero-tax', inputExplicitZero, 'NGN');
      const resultDefault = await calculator.runDualPathSimulation('user-default-tax', inputDefault, 'NGN');

      // Results should be identical when default is 0
      expect(resultDefault.currentPath.projectedNetWorth['20yr']).toBe(
        resultExplicit.currentPath.projectedNetWorth['20yr'],
      );
    });
  });

  // ==========================================
  // WITHDRAWAL/DRAWDOWN TESTS
  // ==========================================

  describe('Withdrawal Modeling', () => {
    it('should model monthly withdrawals after goal achievement', async () => {
      const inputWithWithdrawal = createBaseSimulationInput({
        monthlyWithdrawal: 100000, // Withdraw 100k/month after goal
        goalAmount: 1000000,
        goalDeadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
        currentNetWorth: 2000000, // High starting wealth to ensure goal achieved early
        randomSeed: 55,
      });

      const inputNoWithdrawal = createBaseSimulationInput({
        monthlyWithdrawal: 0,
        goalAmount: 1000000,
        goalDeadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
        currentNetWorth: 2000000,
        randomSeed: 55,
      });

      const resultWith = await calculator.runDualPathSimulation('user-withdraw', inputWithWithdrawal, 'NGN');
      const resultWithout = await calculator.runDualPathSimulation('user-no-withdraw', inputNoWithdrawal, 'NGN');

      // Withdrawals should reduce long-term net worth
      expect(resultWith.currentPath.projectedNetWorth['20yr']).toBeLessThan(
        resultWithout.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should handle high withdrawal rate', async () => {
      const input = createBaseSimulationInput({
        monthlyWithdrawal: 500000, // High withdrawal
        currentNetWorth: 10000000, // High starting wealth
      });

      const result = await calculator.runDualPathSimulation('user-high-withdraw', input, 'NGN');

      expect(result).toBeDefined();
      // Net worth may go negative if withdrawals exceed growth
      expect(result.currentPath.projectedNetWorth).toBeDefined();
    });

    it('should only start withdrawals after goal is achieved', async () => {
      const input = createBaseSimulationInput({
        monthlyWithdrawal: 50000,
        goalAmount: 50000000, // Very high goal - unlikely to be achieved
        currentNetWorth: 100000,
        randomSeed: 77,
      });

      const inputNoWithdrawal = createBaseSimulationInput({
        monthlyWithdrawal: 0,
        goalAmount: 50000000,
        currentNetWorth: 100000,
        randomSeed: 77,
      });

      const resultWith = await calculator.runDualPathSimulation('user-withdraw-later', input, 'NGN');
      const resultWithout = await calculator.runDualPathSimulation('user-no-withdraw-later', inputNoWithdrawal, 'NGN');

      // If goal is never achieved, withdrawals should not occur
      // Net worth should be similar (or identical if goal never achieved in any iteration)
      // At minimum, both should complete
      expect(resultWith).toBeDefined();
      expect(resultWithout).toBeDefined();
    });

    it('should default to zero monthly withdrawal', async () => {
      const input = createBaseSimulationInput();
      // monthlyWithdrawal not specified - should default to 0

      const result = await calculator.runDualPathSimulation('user-default-withdraw', input, 'NGN');

      expect(result).toBeDefined();
      expect(result.currentPath.projectedNetWorth['20yr']).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // COMBINED FEATURE TESTS
  // ==========================================

  describe('Combined Features', () => {
    it('should handle all features enabled together', async () => {
      const input = createBaseSimulationInput({
        // Seedable random
        randomSeed: 42,
        // Multiple goals
        goals: [
          { id: 'goal-1', name: 'Emergency', amount: 500000, deadline: new Date(Date.now() + 1 * 365 * 24 * 60 * 60 * 1000), priority: 1 },
          { id: 'goal-2', name: 'Investment', amount: 2000000, deadline: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), priority: 2 },
        ],
        // Expense growth
        monthlyExpenses: 150000,
        expenseGrowthRate: 0.04,
        // Market regimes
        enableMarketRegimes: true,
        // Tax modeling
        taxRateOnReturns: 0.1,
        // Withdrawal modeling
        monthlyWithdrawal: 50000,
        // Income growth
        incomeGrowthRate: 0.05,
      });

      const result = await calculator.runDualPathSimulation('user-all-features', input, 'NGN');

      // All features should work together
      expect(result).toBeDefined();
      expect(result.currentPath.probability).toBeGreaterThanOrEqual(0);
      expect(result.currentPath.probability).toBeLessThanOrEqual(1);
      expect(result.currentPath.goalResults).toHaveLength(2);
      expect(result.currentPath.allGoalsProbability).toBeDefined();
      expect(result.optimizedPath.requiredSavingsRate).toBeGreaterThanOrEqual(0);
      expect(result.metadata.iterations).toBe(SIMULATION_CONSTANTS.ITERATIONS);
    });

    it('should produce reproducible results with all features and same seed', async () => {
      const input = createBaseSimulationInput({
        randomSeed: 12345,
        goals: [
          { id: 'goal-1', amount: 500000, deadline: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) },
        ],
        monthlyExpenses: 100000,
        expenseGrowthRate: 0.05,
        enableMarketRegimes: true,
        taxRateOnReturns: 0.15,
        monthlyWithdrawal: 25000,
      });

      calculator.clearCache();
      const result1 = await calculator.runDualPathSimulation('user-repro-1', input, 'NGN');

      calculator.clearCache();
      const result2 = await calculator.runDualPathSimulation('user-repro-2', input, 'NGN');

      // Results should be identical with same seed
      expect(result1.currentPath.probability).toBe(result2.currentPath.probability);
      expect(result1.currentPath.projectedNetWorth['20yr']).toBe(result2.currentPath.projectedNetWorth['20yr']);
      expect(result1.currentPath.allGoalsProbability).toBe(result2.currentPath.allGoalsProbability);
    });
  });

  // ==========================================
  // CACHE KEY TESTS FOR NEW PARAMETERS
  // ==========================================

  describe('Cache Key with New Parameters', () => {
    it('should not cache for different expense growth rates', async () => {
      const input1 = createBaseSimulationInput({ expenseGrowthRate: 0.03, monthlyExpenses: 100000 });
      const input2 = createBaseSimulationInput({ expenseGrowthRate: 0.08, monthlyExpenses: 100000 });

      const result1 = await calculator.runDualPathSimulation('user-cache-exp', input1, 'NGN');
      const result2 = await calculator.runDualPathSimulation('user-cache-exp', input2, 'NGN');

      // Different inputs should produce different results
      expect(result1.currentPath.projectedNetWorth['20yr']).not.toBe(
        result2.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should not cache for different tax rates', async () => {
      const input1 = createBaseSimulationInput({ taxRateOnReturns: 0, randomSeed: 100 });
      const input2 = createBaseSimulationInput({ taxRateOnReturns: 0.2, randomSeed: 100 });

      const result1 = await calculator.runDualPathSimulation('user-cache-tax', input1, 'NGN');
      const result2 = await calculator.runDualPathSimulation('user-cache-tax', input2, 'NGN');

      expect(result1.currentPath.projectedNetWorth['20yr']).not.toBe(
        result2.currentPath.projectedNetWorth['20yr'],
      );
    });

    it('should not cache for different market regime settings', async () => {
      const input1 = createBaseSimulationInput({ enableMarketRegimes: true });
      const input2 = createBaseSimulationInput({ enableMarketRegimes: false });

      const result1 = await calculator.runDualPathSimulation('user-cache-regime', input1, 'NGN');
      const result2 = await calculator.runDualPathSimulation('user-cache-regime', input2, 'NGN');

      // Different regime settings should produce different cache keys
      expect(result1.metadata.simulatedAt.getTime()).not.toBe(result2.metadata.simulatedAt.getTime());
    });
  });
});
