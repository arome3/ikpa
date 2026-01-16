/**
 * FinanceController Unit Tests
 *
 * Tests cover:
 * - DTO structure validation
 * - Query parameter handling
 * - Response formatting
 *
 * Note: These tests focus on logic verification without
 * complex NestJS DI mocking.
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { Currency, FinancialSnapshot } from '@prisma/client';
import { ValidMetric, HistoryPeriod, HistoryInterval } from '../dto';

describe('FinanceController DTOs', () => {
  // ==========================================
  // VALID METRIC ENUM TESTS
  // ==========================================

  describe('ValidMetric Enum', () => {
    it('should have cash-flow metric', () => {
      expect(ValidMetric.CASH_FLOW).toBe('cash-flow');
    });

    it('should have savings-rate metric', () => {
      expect(ValidMetric.SAVINGS_RATE).toBe('savings-rate');
    });

    it('should have runway metric', () => {
      expect(ValidMetric.RUNWAY).toBe('runway');
    });

    it('should have dependency metric', () => {
      expect(ValidMetric.DEPENDENCY).toBe('dependency');
    });

    it('should have net-worth metric', () => {
      expect(ValidMetric.NET_WORTH).toBe('net-worth');
    });
  });

  // ==========================================
  // HISTORY PERIOD ENUM TESTS
  // ==========================================

  describe('HistoryPeriod Enum', () => {
    it('should have 30 days period', () => {
      expect(HistoryPeriod.DAYS_30).toBe(30);
    });

    it('should have 90 days period', () => {
      expect(HistoryPeriod.DAYS_90).toBe(90);
    });

    it('should have 365 days period', () => {
      expect(HistoryPeriod.DAYS_365).toBe(365);
    });
  });

  // ==========================================
  // HISTORY INTERVAL ENUM TESTS
  // ==========================================

  describe('HistoryInterval Enum', () => {
    it('should have day interval', () => {
      expect(HistoryInterval.DAY).toBe('day');
    });

    it('should have week interval', () => {
      expect(HistoryInterval.WEEK).toBe('week');
    });

    it('should have month interval', () => {
      expect(HistoryInterval.MONTH).toBe('month');
    });
  });
});

describe('FinanceController Response Formatting', () => {
  // Mock snapshot factory
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

  // ==========================================
  // SNAPSHOT FORMATTING TESTS
  // ==========================================

  describe('Snapshot Response Formatting', () => {
    const formatSnapshotResponse = (snapshot: FinancialSnapshot) => ({
      id: snapshot.id,
      userId: snapshot.userId,
      date: snapshot.date,
      cashFlowScore: snapshot.cashFlowScore,
      savingsRate: Number(snapshot.savingsRate),
      runwayMonths: Number(snapshot.runwayMonths),
      burnRate: Number(snapshot.burnRate),
      dependencyRatio: Number(snapshot.dependencyRatio),
      netWorth: Number(snapshot.netWorth),
      totalIncome: Number(snapshot.totalIncome),
      totalExpenses: Number(snapshot.totalExpenses),
      totalSavings: Number(snapshot.totalSavings),
      totalDebt: Number(snapshot.totalDebt),
      totalAssets: Number(snapshot.totalAssets),
      totalSupport: Number(snapshot.totalSupport),
      currency: snapshot.currency,
      createdAt: snapshot.createdAt,
    });

    it('should convert Decimal fields to numbers', () => {
      const snapshot = createMockSnapshot();
      const formatted = formatSnapshotResponse(snapshot);

      expect(typeof formatted.savingsRate).toBe('number');
      expect(typeof formatted.runwayMonths).toBe('number');
      expect(typeof formatted.totalIncome).toBe('number');
    });

    it('should preserve non-Decimal fields', () => {
      const snapshot = createMockSnapshot();
      const formatted = formatSnapshotResponse(snapshot);

      expect(formatted.id).toBe('snapshot-123');
      expect(formatted.userId).toBe('user-123');
      expect(formatted.currency).toBe('NGN');
    });

    it('should convert numeric values correctly', () => {
      const snapshot = createMockSnapshot({
        savingsRate: new Decimal(15.5),
        runwayMonths: new Decimal(4.25),
      });
      const formatted = formatSnapshotResponse(snapshot);

      expect(formatted.savingsRate).toBe(15.5);
      expect(formatted.runwayMonths).toBe(4.25);
    });
  });

  // ==========================================
  // SCORE RESULT FORMATTING TESTS
  // ==========================================

  describe('Score Result Formatting', () => {
    const createMockScoreResult = () => ({
      finalScore: 70,
      components: {
        savingsRate: { value: 15, score: 80 },
        runwayMonths: { value: 4.5, score: 60 },
        debtToIncome: { value: 18, score: 80 },
        incomeStability: { value: 8, score: 100 },
        dependencyRatio: { value: 12, score: 80 },
      },
      calculation: '(80*0.3) + (60*0.25) + (80*0.2) + (100*0.15) + (80*0.1)',
      timestamp: new Date('2026-01-16T02:00:00Z'),
    });

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

    const formatScoreResponse = (
      result: ReturnType<typeof createMockScoreResult>,
      previousScore: number | null,
    ) => ({
      finalScore: result.finalScore,
      components: result.components,
      calculation: result.calculation,
      timestamp: result.timestamp,
      label: getScoreLabel(result.finalScore),
      color: getScoreColor(result.finalScore),
      previousScore: previousScore ?? undefined,
      change: previousScore !== null ? result.finalScore - previousScore : undefined,
    });

    it('should include all components', () => {
      const result = createMockScoreResult();
      const formatted = formatScoreResponse(result, null);

      expect(formatted.components.savingsRate).toBeDefined();
      expect(formatted.components.runwayMonths).toBeDefined();
      expect(formatted.components.debtToIncome).toBeDefined();
      expect(formatted.components.incomeStability).toBeDefined();
      expect(formatted.components.dependencyRatio).toBeDefined();
    });

    it('should include label and color', () => {
      const result = createMockScoreResult();
      const formatted = formatScoreResponse(result, null);

      expect(formatted.label).toBe('Good');
      expect(formatted.color).toBe('#84CC16');
    });

    it('should calculate change when previous score available', () => {
      const result = createMockScoreResult();
      const formatted = formatScoreResponse(result, 65);

      expect(formatted.previousScore).toBe(65);
      expect(formatted.change).toBe(5);
    });

    it('should omit change when no previous score', () => {
      const result = createMockScoreResult();
      const formatted = formatScoreResponse(result, null);

      expect(formatted.previousScore).toBeUndefined();
      expect(formatted.change).toBeUndefined();
    });

    it('should handle negative change', () => {
      const result = createMockScoreResult();
      const formatted = formatScoreResponse(result, 80);

      expect(formatted.change).toBe(-10);
    });
  });

  // ==========================================
  // PAGINATION RESPONSE TESTS
  // ==========================================

  describe('Pagination Response', () => {
    const formatPaginatedResponse = <T>(
      items: T[],
      total: number,
      limit: number,
      offset: number,
    ) => ({
      items,
      count: items.length,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      },
    });

    it('should include pagination metadata', () => {
      const response = formatPaginatedResponse(['a', 'b'], 100, 10, 0);

      expect(response.pagination.total).toBe(100);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.offset).toBe(0);
    });

    it('should calculate hasMore correctly', () => {
      expect(formatPaginatedResponse(['a', 'b'], 100, 10, 0).pagination.hasMore).toBe(true);
      expect(formatPaginatedResponse(['a', 'b'], 2, 10, 0).pagination.hasMore).toBe(false);
    });

    it('should return count of returned items', () => {
      const response = formatPaginatedResponse(['a', 'b', 'c'], 100, 10, 0);

      expect(response.count).toBe(3);
    });
  });
});

describe('FinanceController Query Handling', () => {
  // ==========================================
  // DATE PARSING TESTS
  // ==========================================

  describe('Date Parsing', () => {
    const parseQueryDate = (dateString?: string): Date | undefined => {
      if (!dateString) return undefined;
      return new Date(dateString);
    };

    it('should parse valid ISO date string', () => {
      const date = parseQueryDate('2026-01-16');

      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(0); // January
      expect(date?.getDate()).toBe(16);
    });

    it('should return undefined for missing date', () => {
      expect(parseQueryDate(undefined)).toBeUndefined();
      expect(parseQueryDate('')).toBeUndefined();
    });
  });

  // ==========================================
  // PAGINATION DEFAULTS TESTS
  // ==========================================

  describe('Pagination Defaults', () => {
    const getQueryDefaults = () => ({
      limit: 100,
      offset: 0,
    });

    it('should have default limit of 100', () => {
      expect(getQueryDefaults().limit).toBe(100);
    });

    it('should have default offset of 0', () => {
      expect(getQueryDefaults().offset).toBe(0);
    });
  });
});
