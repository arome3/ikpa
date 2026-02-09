/**
 * CashFlowScoreCalculator Unit Tests
 *
 * Tests cover:
 * - Individual component scoring functions at boundary values
 * - Weighted score calculation
 * - Edge cases (zero income, zero expenses, etc.)
 * - Opik tracing integration
 * - Full calculation flow
 *
 * Target: >80% coverage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { CashFlowScoreCalculator } from '../calculators/cash-flow-score.calculator';
import { OpikService } from '../../ai/opik/opik.service';
import { FinancialData } from '../interfaces';

describe('CashFlowScoreCalculator', () => {
  let calculator: CashFlowScoreCalculator;
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
   * Helper to create base financial data
   * All values set to neutral defaults
   */
  const createBaseFinancialData = (overrides: Partial<FinancialData> = {}): FinancialData => ({
    monthlyIncome: new Decimal(100000),
    monthlyExpenses: new Decimal(70000),
    monthlySavings: new Decimal(30000),
    monthlyDebtPayments: new Decimal(10000),
    totalFamilySupport: new Decimal(5000),
    emergencyFund: new Decimal(300000),
    liquidSavings: new Decimal(400000),
    totalInvestments: new Decimal(0),
    totalDebt: new Decimal(50000),
    netIncome: new Decimal(95000),
    last6MonthsIncome: [100000, 100000, 100000, 100000, 100000, 100000],
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
    calculator = new CashFlowScoreCalculator(mockOpikService as OpikService);
  });

  // ==========================================
  // FULL CALCULATION TESTS
  // ==========================================

  describe('calculate', () => {
    it('should calculate Cash Flow Score with all components', async () => {
      const data = createBaseFinancialData();

      const result = await calculator.calculate('user-123', data);

      expect(result).toBeDefined();
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(100);
      expect(result.components).toBeDefined();
      expect(result.components.savingsRate).toBeDefined();
      expect(result.components.runwayMonths).toBeDefined();
      expect(result.components.debtToIncome).toBeDefined();
      expect(result.components.incomeStability).toBeDefined();
      expect(result.components.dependencyRatio).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include calculation string showing formula', async () => {
      const data = createBaseFinancialData();

      const result = await calculator.calculate('user-123', data);

      expect(result.calculation).toBeDefined();
      expect(result.calculation).toContain('*0.3'); // savingsRate weight
      expect(result.calculation).toContain('*0.25'); // runwayMonths weight
      expect(result.calculation).toContain('*0.2'); // debtToIncome weight
      expect(result.calculation).toContain('*0.15'); // incomeStability weight
      expect(result.calculation).toContain('*0.1'); // dependencyRatio weight
    });

    it('should create Opik trace for calculation', async () => {
      const data = createBaseFinancialData();

      await calculator.calculate('user-123', data);

      expect(mockOpikService.createTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cash_flow_score_calculation',
          input: { userId: 'user-123' },
          tags: ['finance', 'score', 'calculation'],
        }),
      );
    });

    it('should end trace with success on successful calculation', async () => {
      const data = createBaseFinancialData();

      const result = await calculator.calculate('user-123', data);

      expect(mockOpikService.endTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          success: true,
          result: expect.objectContaining({
            finalScore: result.finalScore,
          }),
        }),
      );
    });

    it('should clamp final score between 0 and 100', async () => {
      // Create data that would theoretically produce extreme scores
      const lowScoreData = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlyExpenses: new Decimal(150000), // Spending more than earning
        monthlySavings: new Decimal(-50000), // Negative savings
        monthlyDebtPayments: new Decimal(60000), // 60% of income
        emergencyFund: new Decimal(0),
        totalFamilySupport: new Decimal(50000), // High family support
        last6MonthsIncome: [50000, 150000, 30000, 200000, 80000, 40000], // High variance
      });

      const result = await calculator.calculate('user-123', lowScoreData);

      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================
  // SAVINGS RATE SCORING TESTS
  // ==========================================

  describe('Savings Rate Score (30% weight)', () => {
    it('should score 100 for savings rate >= 20%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlySavings: new Decimal(20000), // Exactly 20%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.savingsRate.value).toBeCloseTo(20, 0);
      expect(result.components.savingsRate.score).toBe(100);
    });

    it('should score 80 for savings rate 15-20%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlySavings: new Decimal(15000), // 15%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.savingsRate.value).toBeCloseTo(15, 0);
      expect(result.components.savingsRate.score).toBe(80);
    });

    it('should score 60 for savings rate 10-15%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlySavings: new Decimal(12000), // 12%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.savingsRate.value).toBeCloseTo(12, 0);
      expect(result.components.savingsRate.score).toBe(60);
    });

    it('should score 40 for savings rate 5-10%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlySavings: new Decimal(7000), // 7%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.savingsRate.value).toBeCloseTo(7, 0);
      expect(result.components.savingsRate.score).toBe(40);
    });

    it('should score 20 for savings rate 0-5%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlySavings: new Decimal(3000), // 3%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.savingsRate.value).toBeCloseTo(3, 0);
      expect(result.components.savingsRate.score).toBe(20);
    });

    it('should score 20 for zero income', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(0),
        monthlySavings: new Decimal(0),
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.savingsRate.value).toBe(0);
      expect(result.components.savingsRate.score).toBe(20);
    });
  });

  // ==========================================
  // RUNWAY MONTHS SCORING TESTS
  // ==========================================

  describe('Runway Months Score (25% weight)', () => {
    it('should score 100 for runway >= 9 months', async () => {
      const data = createBaseFinancialData({
        emergencyFund: new Decimal(900000),
        monthlyExpenses: new Decimal(100000), // 9 months runway
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.runwayMonths.value).toBeCloseTo(9, 0);
      expect(result.components.runwayMonths.score).toBe(100);
    });

    it('should score 80 for runway 6-9 months', async () => {
      const data = createBaseFinancialData({
        emergencyFund: new Decimal(700000),
        monthlyExpenses: new Decimal(100000), // 7 months
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.runwayMonths.value).toBeCloseTo(7, 0);
      expect(result.components.runwayMonths.score).toBe(80);
    });

    it('should score 60 for runway 3-6 months', async () => {
      const data = createBaseFinancialData({
        emergencyFund: new Decimal(400000),
        monthlyExpenses: new Decimal(100000), // 4 months
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.runwayMonths.value).toBeCloseTo(4, 0);
      expect(result.components.runwayMonths.score).toBe(60);
    });

    it('should score 40 for runway 1-3 months', async () => {
      const data = createBaseFinancialData({
        emergencyFund: new Decimal(200000),
        monthlyExpenses: new Decimal(100000), // 2 months
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.runwayMonths.value).toBeCloseTo(2, 0);
      expect(result.components.runwayMonths.score).toBe(40);
    });

    it('should score 20 for runway < 1 month', async () => {
      const data = createBaseFinancialData({
        emergencyFund: new Decimal(50000),
        monthlyExpenses: new Decimal(100000), // 0.5 months
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.runwayMonths.value).toBeCloseTo(0.5, 1);
      expect(result.components.runwayMonths.score).toBe(20);
    });

    it('should score 100 with 24 months cap for zero expenses', async () => {
      const data = createBaseFinancialData({
        emergencyFund: new Decimal(100000),
        monthlyExpenses: new Decimal(0),
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.runwayMonths.value).toBe(24);
      expect(result.components.runwayMonths.score).toBe(100);
    });
  });

  // ==========================================
  // DEBT-TO-INCOME SCORING TESTS (INVERSE)
  // ==========================================

  describe('Debt-to-Income Score (20% weight)', () => {
    it('should score 100 for DTI <= 10%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlyDebtPayments: new Decimal(10000), // 10%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.debtToIncome.value).toBeCloseTo(10, 0);
      expect(result.components.debtToIncome.score).toBe(100);
    });

    it('should score 80 for DTI 10-20%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlyDebtPayments: new Decimal(15000), // 15%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.debtToIncome.value).toBeCloseTo(15, 0);
      expect(result.components.debtToIncome.score).toBe(80);
    });

    it('should score 60 for DTI 20-35%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlyDebtPayments: new Decimal(25000), // 25%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.debtToIncome.value).toBeCloseTo(25, 0);
      expect(result.components.debtToIncome.score).toBe(60);
    });

    it('should score 40 for DTI 35-50%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlyDebtPayments: new Decimal(40000), // 40%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.debtToIncome.value).toBeCloseTo(40, 0);
      expect(result.components.debtToIncome.score).toBe(40);
    });

    it('should score 20 for DTI > 50%', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlyDebtPayments: new Decimal(60000), // 60%
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.debtToIncome.value).toBeCloseTo(60, 0);
      expect(result.components.debtToIncome.score).toBe(20);
    });

    it('should score 20 for zero income with debt', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(0),
        monthlyDebtPayments: new Decimal(10000),
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.debtToIncome.value).toBe(100);
      expect(result.components.debtToIncome.score).toBe(20);
    });
  });

  // ==========================================
  // INCOME STABILITY SCORING TESTS
  // ==========================================

  describe('Income Stability Score (15% weight)', () => {
    it('should score 100 for CV < 15%', async () => {
      // Stable income - same amount each month
      const data = createBaseFinancialData({
        last6MonthsIncome: [100000, 100000, 100000, 100000, 100000, 100000],
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.incomeStability.value).toBeLessThan(15);
      expect(result.components.incomeStability.score).toBe(100);
    });

    it('should score 60 for CV 15-30%', async () => {
      // Moderate variance - CV ~26%
      // Values: [70000, 130000, 80000, 120000, 85000, 115000]
      // Mean: 100000, StdDev: ~24000, CV: ~24%
      const data = createBaseFinancialData({
        last6MonthsIncome: [70000, 130000, 80000, 120000, 85000, 115000],
      });

      const result = await calculator.calculate('user-123', data);

      // CV between 15-30% scores 60
      expect(result.components.incomeStability.value).toBeGreaterThanOrEqual(15);
      expect(result.components.incomeStability.value).toBeLessThanOrEqual(30);
      expect(result.components.incomeStability.score).toBe(60);
    });

    it('should score 20 for CV > 30%', async () => {
      // High variance income
      const data = createBaseFinancialData({
        last6MonthsIncome: [50000, 150000, 30000, 200000, 80000, 40000],
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.incomeStability.value).toBeGreaterThan(30);
      expect(result.components.incomeStability.score).toBe(20);
    });

    it('should score 60 for insufficient history (less than 2 months)', async () => {
      const data = createBaseFinancialData({
        last6MonthsIncome: [100000], // Only 1 month of data
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.incomeStability.value).toBe(0);
      expect(result.components.incomeStability.score).toBe(60);
    });

    it('should use weighted variance when incomeVarianceWeighted is provided', async () => {
      const data = createBaseFinancialData({
        incomeVarianceWeighted: 10, // 10% variance
        last6MonthsIncome: [50000, 150000], // This should be ignored
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.incomeStability.value).toBe(10);
      expect(result.components.incomeStability.score).toBe(100);
    });

    it('should score 20 for zero average income', async () => {
      const data = createBaseFinancialData({
        last6MonthsIncome: [0, 0, 0, 0, 0, 0],
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.incomeStability.score).toBe(20);
    });
  });

  // ==========================================
  // DEPENDENCY RATIO SCORING TESTS
  // ==========================================

  describe('Dependency Ratio Score (10% weight)', () => {
    it('should score 100 for ratio <= 10%', async () => {
      const data = createBaseFinancialData({
        totalFamilySupport: new Decimal(9500),
        netIncome: new Decimal(100000), // 9.5% support
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.dependencyRatio.value).toBeCloseTo(9.5, 0);
      expect(result.components.dependencyRatio.score).toBe(100);
    });

    it('should score 80 for ratio 10-35%', async () => {
      const data = createBaseFinancialData({
        totalFamilySupport: new Decimal(20000),
        netIncome: new Decimal(100000), // 20% support
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.dependencyRatio.value).toBeCloseTo(20, 0);
      expect(result.components.dependencyRatio.score).toBe(80);
    });

    it('should score 40 for ratio > 35%', async () => {
      const data = createBaseFinancialData({
        totalFamilySupport: new Decimal(40000),
        netIncome: new Decimal(100000), // 40% support
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.dependencyRatio.value).toBeCloseTo(40, 0);
      expect(result.components.dependencyRatio.score).toBe(40);
    });

    it('should score 100 for zero net income (assumes zero support ratio)', async () => {
      const data = createBaseFinancialData({
        totalFamilySupport: new Decimal(0),
        netIncome: new Decimal(0),
      });

      const result = await calculator.calculate('user-123', data);

      expect(result.components.dependencyRatio.value).toBe(0);
      expect(result.components.dependencyRatio.score).toBe(100);
    });

    it('should not harshly penalize family support', async () => {
      // Even 35% family support should only drop to 40 (not 0 or 20)
      const data = createBaseFinancialData({
        totalFamilySupport: new Decimal(50000),
        netIncome: new Decimal(100000), // 50% support
      });

      const result = await calculator.calculate('user-123', data);

      // Minimum score for high family support is 40, not lower
      expect(result.components.dependencyRatio.score).toBe(40);
    });
  });

  // ==========================================
  // WEIGHTED SCORE CALCULATION TESTS
  // ==========================================

  describe('Weighted Score Calculation', () => {
    it('should calculate correct weighted total', async () => {
      // Create data where we know expected component scores
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(100000),
        monthlySavings: new Decimal(20000), // 20% → score 100
        emergencyFund: new Decimal(900000),
        monthlyExpenses: new Decimal(100000), // 9 months → score 100
        monthlyDebtPayments: new Decimal(5000), // 5% → score 100
        totalFamilySupport: new Decimal(5000),
        netIncome: new Decimal(95000), // ~5.3% → score 100
        last6MonthsIncome: [100000, 100000, 100000, 100000, 100000, 100000], // CV=0 → score 100
      });

      const result = await calculator.calculate('user-123', data);

      // All scores should be 100
      expect(result.components.savingsRate.score).toBe(100);
      expect(result.components.runwayMonths.score).toBe(100);
      expect(result.components.debtToIncome.score).toBe(100);
      expect(result.components.incomeStability.score).toBe(100);
      expect(result.components.dependencyRatio.score).toBe(100);

      // Final score should be 100
      expect(result.finalScore).toBe(100);
    });

    it('should respect component weights in final score', async () => {
      // Test that weights are correctly applied
      // Create a scenario where we get different scores for each component
      const result = await calculator.calculate('user-123', createBaseFinancialData());

      // Verify the calculation string shows the weights
      expect(result.calculation).toContain('*0.3'); // savingsRate 30%
      expect(result.calculation).toContain('*0.25'); // runwayMonths 25%
      expect(result.calculation).toContain('*0.2'); // debtToIncome 20%
      expect(result.calculation).toContain('*0.15'); // incomeStability 15%
      expect(result.calculation).toContain('*0.1'); // dependencyRatio 10%
    });
  });

  // ==========================================
  // ERROR HANDLING TESTS
  // ==========================================

  describe('Error Handling', () => {
    it('should handle gracefully when data has null values', async () => {
      // Null values are coerced to 0 in JavaScript calculations
      const dataWithNullIncome = {
        ...createBaseFinancialData(),
        monthlyIncome: null as unknown as Decimal,
      };

      // Should not throw - handles gracefully
      const result = await calculator.calculate('user-123', dataWithNullIncome);

      // Should still return a valid score (handling edge case)
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(100);
    });

    it('should end trace with success even for edge case data', async () => {
      const data = createBaseFinancialData({
        monthlyIncome: new Decimal(0),
        monthlyExpenses: new Decimal(0),
        emergencyFund: new Decimal(0),
      });

      await calculator.calculate('user-123', data);

      expect(mockOpikService.endTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          success: true,
        }),
      );
    });
  });

  // ==========================================
  // UTILITY METHODS TESTS
  // ==========================================

  describe('getWeights', () => {
    it('should return a copy of the weights', () => {
      const weights = calculator.getWeights();

      expect(weights.savingsRate).toBe(0.3);
      expect(weights.runwayMonths).toBe(0.25);
      expect(weights.debtToIncome).toBe(0.2);
      expect(weights.incomeStability).toBe(0.15);
      expect(weights.dependencyRatio).toBe(0.1);

      // Total should equal 1
      const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
      expect(total).toBeCloseTo(1.0, 10);
    });

    it('should not allow modification of internal weights', () => {
      const weights = calculator.getWeights() as { savingsRate: number };
      weights.savingsRate = 0.5;

      const freshWeights = calculator.getWeights();
      expect(freshWeights.savingsRate).toBe(0.3);
    });
  });
});
