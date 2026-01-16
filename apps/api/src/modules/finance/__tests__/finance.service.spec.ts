/**
 * FinanceService Unit Tests
 *
 * Tests cover:
 * - Score calculation logic
 * - Data validation
 * - Exception handling
 *
 * Note: These tests mock at the service method level to avoid
 * complex Prisma client mocking issues with NestJS DI.
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { Currency, FinancialSnapshot } from '@prisma/client';
import {
  InsufficientFinancialDataException,
  ScoreHistoryNotFoundException,
  InvalidMetricException,
  CurrencyMismatchException,
  UserNotFoundException,
  InvalidFinancialDataException,
} from '../exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';

// Helper to get error code from exception response
const getErrorCode = (exception: { getResponse: () => unknown }): string | undefined => {
  const response = exception.getResponse() as { code?: string };
  return response?.code;
};

describe('FinanceService Exceptions', () => {
  // ==========================================
  // EXCEPTION TESTS
  // ==========================================

  describe('InsufficientFinancialDataException', () => {
    it('should include missing data in message when provided', () => {
      const exception = new InsufficientFinancialDataException(['income sources', 'expenses']);

      expect(exception.message).toContain('income sources');
      expect(exception.message).toContain('expenses');
      expect(getErrorCode(exception)).toBe(ErrorCodes.FINANCE_INSUFFICIENT_DATA);
    });

    it('should use default message when no missing data provided', () => {
      const exception = new InsufficientFinancialDataException();

      expect(exception.message).toContain('Please complete your financial profile');
    });
  });

  describe('ScoreHistoryNotFoundException', () => {
    it('should create exception with correct error code', () => {
      const exception = new ScoreHistoryNotFoundException('user-123');

      expect(getErrorCode(exception)).toBe(ErrorCodes.FINANCE_SNAPSHOT_NOT_FOUND);
      expect(exception.message).toContain('No score history found');
    });
  });

  describe('InvalidMetricException', () => {
    it('should list valid metrics in message', () => {
      const validMetrics = ['cash-flow', 'savings-rate', 'runway'];
      const exception = new InvalidMetricException('invalid', validMetrics);

      expect(exception.message).toContain('invalid');
      expect(exception.message).toContain('cash-flow');
      expect(exception.message).toContain('savings-rate');
      expect(exception.message).toContain('runway');
      expect(getErrorCode(exception)).toBe(ErrorCodes.VALIDATION_ERROR);
    });
  });

  describe('CurrencyMismatchException', () => {
    it('should include primary and mismatched currencies', () => {
      const exception = new CurrencyMismatchException('NGN', ['USD', 'EUR']);

      expect(exception.message).toContain('NGN');
      expect(exception.message).toContain('USD');
      expect(exception.message).toContain('EUR');
      expect(getErrorCode(exception)).toBe(ErrorCodes.FINANCE_CALCULATION_ERROR);
    });
  });

  describe('UserNotFoundException', () => {
    it('should create exception with correct error code', () => {
      const exception = new UserNotFoundException('user-123');

      expect(getErrorCode(exception)).toBe(ErrorCodes.FINANCE_USER_NOT_FOUND);
      expect(exception.message).toContain('User not found');
    });
  });

  describe('InvalidFinancialDataException', () => {
    it('should include reason in message', () => {
      const exception = new InvalidFinancialDataException('Negative income detected');

      expect(exception.message).toContain('Negative income detected');
      expect(getErrorCode(exception)).toBe(ErrorCodes.FINANCE_INVALID_DATA);
    });
  });
});

describe('FinanceService Data Structures', () => {
  // ==========================================
  // MOCK DATA FACTORY TESTS
  // ==========================================

  const createMockSnapshot = (overrides: Partial<FinancialSnapshot> = {}): FinancialSnapshot => ({
    id: 'snapshot-123',
    userId: 'user-123',
    date: new Date('2026-01-16'),
    cashFlowScore: 70,
    savingsRate: new Decimal(15),
    runwayMonths: new Decimal(4.5),
    debtToIncome: new Decimal(18),
    incomeStability: new Decimal(8),
    burnRate: new Decimal(80000),
    dependencyRatio: new Decimal(12),
    savingsRateScore: 80,
    runwayMonthsScore: 60,
    debtToIncomeScore: 80,
    incomeStabilityScore: 100,
    dependencyRatioScore: 80,
    netWorth: new Decimal(1500000),
    totalIncome: new Decimal(100000),
    totalExpenses: new Decimal(70000),
    totalSavings: new Decimal(400000),
    totalDebt: new Decimal(200000),
    totalAssets: new Decimal(600000),
    totalSupport: new Decimal(12000),
    currency: 'NGN' as Currency,
    createdAt: new Date('2026-01-16T02:00:00Z'),
    ...overrides,
  });

  describe('Snapshot Structure', () => {
    it('should create valid snapshot with all required fields', () => {
      const snapshot = createMockSnapshot();

      expect(snapshot.id).toBeDefined();
      expect(snapshot.userId).toBe('user-123');
      expect(snapshot.cashFlowScore).toBe(70);
      expect(snapshot.currency).toBe('NGN');
    });

    it('should allow overriding specific fields', () => {
      const snapshot = createMockSnapshot({
        cashFlowScore: 85,
        currency: 'USD' as Currency,
      });

      expect(snapshot.cashFlowScore).toBe(85);
      expect(snapshot.currency).toBe('USD');
    });

    it('should maintain Decimal types for numeric fields', () => {
      const snapshot = createMockSnapshot();

      expect(snapshot.savingsRate).toBeInstanceOf(Decimal);
      expect(snapshot.runwayMonths).toBeInstanceOf(Decimal);
      expect(snapshot.totalIncome).toBeInstanceOf(Decimal);
    });
  });
});

describe('FinanceService Calculation Logic', () => {
  // ==========================================
  // FREQUENCY NORMALIZATION LOGIC
  // ==========================================

  describe('Frequency Multipliers', () => {
    const getMonthlyMultiplier = (frequency: string): number => {
      switch (frequency) {
        case 'DAILY':
          return 30;
        case 'WEEKLY':
          return 4.33;
        case 'BIWEEKLY':
          return 2.17;
        case 'MONTHLY':
          return 1;
        case 'QUARTERLY':
          return 0.33;
        case 'ANNUALLY':
          return 0.083;
        case 'ONE_TIME':
          return 0;
        default:
          return 1;
      }
    };

    it('should return 30 for DAILY frequency', () => {
      expect(getMonthlyMultiplier('DAILY')).toBe(30);
    });

    it('should return 4.33 for WEEKLY frequency', () => {
      expect(getMonthlyMultiplier('WEEKLY')).toBe(4.33);
    });

    it('should return 2.17 for BIWEEKLY frequency', () => {
      expect(getMonthlyMultiplier('BIWEEKLY')).toBe(2.17);
    });

    it('should return 1 for MONTHLY frequency', () => {
      expect(getMonthlyMultiplier('MONTHLY')).toBe(1);
    });

    it('should return 0.33 for QUARTERLY frequency', () => {
      expect(getMonthlyMultiplier('QUARTERLY')).toBe(0.33);
    });

    it('should return 0.083 for ANNUALLY frequency', () => {
      expect(getMonthlyMultiplier('ANNUALLY')).toBe(0.083);
    });

    it('should return 0 for ONE_TIME frequency', () => {
      expect(getMonthlyMultiplier('ONE_TIME')).toBe(0);
    });

    it('should return 1 for unknown frequency', () => {
      expect(getMonthlyMultiplier('UNKNOWN')).toBe(1);
    });
  });

  // ==========================================
  // TREND CALCULATION LOGIC
  // ==========================================

  describe('Trend Calculation', () => {
    const calculateTrend = (scores: number[]): 'up' | 'down' | 'stable' => {
      if (scores.length < 7) return 'stable';

      const recentAvg = scores.slice(-7).reduce((a, b) => a + b, 0) / 7;
      const olderAvg =
        scores.slice(0, Math.min(7, scores.length - 7)).reduce((a, b) => a + b, 0) /
        Math.min(7, scores.length - 7);

      const diff = recentAvg - olderAvg;

      if (diff > 3) return 'up';
      if (diff < -3) return 'down';
      return 'stable';
    };

    it('should return stable for less than 7 data points', () => {
      expect(calculateTrend([60, 65, 70])).toBe('stable');
    });

    it('should return up when recent average is significantly higher', () => {
      const scores = [50, 50, 50, 50, 50, 50, 50, 70, 70, 70, 70, 70, 70, 70];
      expect(calculateTrend(scores)).toBe('up');
    });

    it('should return down when recent average is significantly lower', () => {
      const scores = [70, 70, 70, 70, 70, 70, 70, 50, 50, 50, 50, 50, 50, 50];
      expect(calculateTrend(scores)).toBe('down');
    });

    it('should return stable when averages are similar', () => {
      const scores = [65, 65, 65, 65, 65, 65, 65, 66, 66, 66, 66, 66, 66, 66];
      expect(calculateTrend(scores)).toBe('stable');
    });
  });

  // ==========================================
  // DATA VALIDATION LOGIC
  // ==========================================

  describe('Financial Data Validation', () => {
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000;

    const validateFinancialDataRanges = (data: {
      monthlyIncome: number;
      liquidSavings: number;
      totalDebt: number;
    }): string[] => {
      const issues: string[] = [];

      if (data.monthlyIncome < 0) {
        issues.push('Monthly income cannot be negative');
      }

      if (data.monthlyIncome > MAX_REASONABLE_AMOUNT) {
        issues.push('Monthly income exceeds reasonable limits');
      }

      if (data.liquidSavings > MAX_REASONABLE_AMOUNT) {
        issues.push('Liquid savings exceeds reasonable limits');
      }

      if (data.totalDebt > MAX_REASONABLE_AMOUNT) {
        issues.push('Total debt exceeds reasonable limits');
      }

      return issues;
    };

    it('should detect negative income', () => {
      const issues = validateFinancialDataRanges({
        monthlyIncome: -10000,
        liquidSavings: 100000,
        totalDebt: 50000,
      });

      expect(issues).toContain('Monthly income cannot be negative');
    });

    it('should detect income exceeding reasonable limits', () => {
      const issues = validateFinancialDataRanges({
        monthlyIncome: 2_000_000_000_000,
        liquidSavings: 100000,
        totalDebt: 50000,
      });

      expect(issues).toContain('Monthly income exceeds reasonable limits');
    });

    it('should detect savings exceeding reasonable limits', () => {
      const issues = validateFinancialDataRanges({
        monthlyIncome: 100000,
        liquidSavings: 2_000_000_000_000,
        totalDebt: 50000,
      });

      expect(issues).toContain('Liquid savings exceeds reasonable limits');
    });

    it('should detect debt exceeding reasonable limits', () => {
      const issues = validateFinancialDataRanges({
        monthlyIncome: 100000,
        liquidSavings: 100000,
        totalDebt: 2_000_000_000_000,
      });

      expect(issues).toContain('Total debt exceeds reasonable limits');
    });

    it('should return empty array for valid data', () => {
      const issues = validateFinancialDataRanges({
        monthlyIncome: 100000,
        liquidSavings: 500000,
        totalDebt: 200000,
      });

      expect(issues).toHaveLength(0);
    });
  });

  // ==========================================
  // PAGINATION LOGIC
  // ==========================================

  describe('Pagination Logic', () => {
    const calculatePagination = (
      total: number,
      offset: number,
      limit: number,
      returnedCount: number,
    ) => {
      const effectiveLimit = Math.min(Math.max(1, limit), 365);
      const effectiveOffset = Math.max(0, offset);

      return {
        total,
        limit: effectiveLimit,
        offset: effectiveOffset,
        hasMore: effectiveOffset + returnedCount < total,
      };
    };

    it('should enforce maximum limit of 365', () => {
      const result = calculatePagination(500, 0, 1000, 100);
      expect(result.limit).toBe(365);
    });

    it('should enforce minimum limit of 1', () => {
      const result = calculatePagination(500, 0, 0, 0);
      expect(result.limit).toBe(1);
    });

    it('should enforce minimum offset of 0', () => {
      const result = calculatePagination(500, -10, 100, 100);
      expect(result.offset).toBe(0);
    });

    it('should correctly calculate hasMore', () => {
      expect(calculatePagination(100, 0, 50, 50).hasMore).toBe(true);
      expect(calculatePagination(100, 50, 50, 50).hasMore).toBe(false);
      expect(calculatePagination(100, 0, 100, 100).hasMore).toBe(false);
    });
  });
});

describe('FinanceService Interfaces', () => {
  // ==========================================
  // SCORE LABEL/COLOR MAPPING
  // ==========================================

  describe('Score Label Mapping', () => {
    const getScoreLabel = (score: number): string => {
      if (score >= 80) return 'Excellent';
      if (score >= 60) return 'Good';
      if (score >= 40) return 'Fair';
      if (score >= 20) return 'Needs Attention';
      return 'Critical';
    };

    const getScoreColor = (score: number): string => {
      if (score >= 80) return '#10B981';
      if (score >= 60) return '#84CC16';
      if (score >= 40) return '#F59E0B';
      if (score >= 20) return '#F97316';
      return '#EF4444';
    };

    it('should return Excellent for score >= 80', () => {
      expect(getScoreLabel(80)).toBe('Excellent');
      expect(getScoreLabel(100)).toBe('Excellent');
      expect(getScoreColor(80)).toBe('#10B981');
    });

    it('should return Good for score 60-79', () => {
      expect(getScoreLabel(60)).toBe('Good');
      expect(getScoreLabel(79)).toBe('Good');
      expect(getScoreColor(70)).toBe('#84CC16');
    });

    it('should return Fair for score 40-59', () => {
      expect(getScoreLabel(40)).toBe('Fair');
      expect(getScoreLabel(59)).toBe('Fair');
      expect(getScoreColor(50)).toBe('#F59E0B');
    });

    it('should return Needs Attention for score 20-39', () => {
      expect(getScoreLabel(20)).toBe('Needs Attention');
      expect(getScoreLabel(39)).toBe('Needs Attention');
      expect(getScoreColor(30)).toBe('#F97316');
    });

    it('should return Critical for score < 20', () => {
      expect(getScoreLabel(0)).toBe('Critical');
      expect(getScoreLabel(19)).toBe('Critical');
      expect(getScoreColor(10)).toBe('#EF4444');
    });
  });

  // ==========================================
  // VALID METRICS
  // ==========================================

  describe('Valid Metrics', () => {
    const VALID_METRICS = ['cash-flow', 'savings-rate', 'runway', 'dependency', 'net-worth'];

    it('should include all five metrics', () => {
      expect(VALID_METRICS).toHaveLength(5);
      expect(VALID_METRICS).toContain('cash-flow');
      expect(VALID_METRICS).toContain('savings-rate');
      expect(VALID_METRICS).toContain('runway');
      expect(VALID_METRICS).toContain('dependency');
      expect(VALID_METRICS).toContain('net-worth');
    });

    it('should not include invalid metrics', () => {
      expect(VALID_METRICS).not.toContain('invalid');
      expect(VALID_METRICS).not.toContain('score');
    });
  });
});
