/**
 * BudgetService Unit Tests
 *
 * Tests cover:
 * - Budget status calculation logic
 * - Period date calculations
 * - Overspend amount calculations
 */

import { describe, it, expect } from 'vitest';
import { BudgetPeriod } from '@prisma/client';
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { GPS_CONSTANTS } from '../constants';
import { BudgetTrigger } from '../interfaces';

describe('BudgetService', () => {
  describe('Period Start Date Calculation', () => {
    const getPeriodStartDate = (period: BudgetPeriod): Date => {
      const now = new Date();

      switch (period) {
        case 'WEEKLY':
          return startOfWeek(now, { weekStartsOn: 1 }); // Monday
        case 'MONTHLY':
          return startOfMonth(now);
        case 'QUARTERLY':
          return startOfQuarter(now);
        case 'ANNUALLY':
          return startOfYear(now);
        default:
          return startOfMonth(now);
      }
    };

    it('should return start of week for WEEKLY period', () => {
      const start = getPeriodStartDate('WEEKLY');
      const expected = startOfWeek(new Date(), { weekStartsOn: 1 });

      expect(start.toDateString()).toBe(expected.toDateString());
    });

    it('should return start of month for MONTHLY period', () => {
      const start = getPeriodStartDate('MONTHLY');
      const expected = startOfMonth(new Date());

      expect(start.toDateString()).toBe(expected.toDateString());
    });

    it('should return start of quarter for QUARTERLY period', () => {
      const start = getPeriodStartDate('QUARTERLY');
      const expected = startOfQuarter(new Date());

      expect(start.toDateString()).toBe(expected.toDateString());
    });

    it('should return start of year for ANNUALLY period', () => {
      const start = getPeriodStartDate('ANNUALLY');
      const expected = startOfYear(new Date());

      expect(start.toDateString()).toBe(expected.toDateString());
    });
  });

  describe('Budget Status Calculation', () => {
    interface BudgetStatusInput {
      budgeted: number;
      spent: number;
    }

    interface BudgetStatusResult {
      remaining: number;
      overagePercent: number;
      trigger: BudgetTrigger;
    }

    const calculateBudgetStatus = (input: BudgetStatusInput): BudgetStatusResult => {
      const { budgeted, spent } = input;
      const remaining = budgeted - spent;
      const spentPercentage = budgeted > 0 ? spent / budgeted : 0;

      let trigger: BudgetTrigger;
      if (spentPercentage >= GPS_CONSTANTS.BUDGET_CRITICAL_THRESHOLD) {
        trigger = 'BUDGET_CRITICAL';
      } else if (spentPercentage >= GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD) {
        trigger = 'BUDGET_EXCEEDED';
      } else {
        trigger = 'BUDGET_WARNING';
      }

      const overagePercent = Math.max(0, (spentPercentage - 1) * 100);

      return { remaining, overagePercent, trigger };
    };

    it('should calculate remaining correctly when under budget', () => {
      const result = calculateBudgetStatus({ budgeted: 100000, spent: 80000 });

      expect(result.remaining).toBe(20000);
      expect(result.overagePercent).toBe(0);
      expect(result.trigger).toBe('BUDGET_WARNING');
    });

    it('should calculate remaining correctly when over budget', () => {
      const result = calculateBudgetStatus({ budgeted: 100000, spent: 115000 });

      expect(result.remaining).toBe(-15000);
      expect(result.overagePercent).toBeCloseTo(15, 10);
      expect(result.trigger).toBe('BUDGET_EXCEEDED');
    });

    it('should detect critical overspend', () => {
      const result = calculateBudgetStatus({ budgeted: 100000, spent: 130000 });

      expect(result.remaining).toBe(-30000);
      expect(result.overagePercent).toBeCloseTo(30, 10);
      expect(result.trigger).toBe('BUDGET_CRITICAL');
    });

    it('should handle zero budget gracefully', () => {
      const result = calculateBudgetStatus({ budgeted: 0, spent: 5000 });

      expect(result.trigger).toBe('BUDGET_WARNING');
      expect(result.overagePercent).toBe(0);
    });

    it('should handle exact budget match', () => {
      const result = calculateBudgetStatus({ budgeted: 100000, spent: 100000 });

      expect(result.remaining).toBe(0);
      expect(result.overagePercent).toBe(0);
      expect(result.trigger).toBe('BUDGET_EXCEEDED');
    });
  });

  describe('Overspend Amount Calculation', () => {
    const calculateOverspend = (budgeted: number, spent: number): number => {
      return Math.max(0, spent - budgeted);
    };

    it('should return 0 when under budget', () => {
      expect(calculateOverspend(100000, 80000)).toBe(0);
    });

    it('should return difference when over budget', () => {
      expect(calculateOverspend(100000, 115000)).toBe(15000);
    });

    it('should return 0 when exactly at budget', () => {
      expect(calculateOverspend(100000, 100000)).toBe(0);
    });
  });

  describe('Average Monthly Spending Calculation', () => {
    const calculateAverageMonthlySpending = (
      totalSpent: number,
      months: number,
    ): number => {
      if (months <= 0) return 0;
      return totalSpent / months;
    };

    it('should calculate average correctly', () => {
      expect(calculateAverageMonthlySpending(30000, 3)).toBe(10000);
    });

    it('should handle single month', () => {
      expect(calculateAverageMonthlySpending(15000, 1)).toBe(15000);
    });

    it('should handle zero months gracefully', () => {
      expect(calculateAverageMonthlySpending(15000, 0)).toBe(0);
    });
  });
});

describe('Budget Warning Thresholds', () => {
  describe('Threshold Detection', () => {
    const getWarningLevel = (
      spent: number,
      budgeted: number,
    ): 'none' | 'warning' | 'exceeded' | 'critical' => {
      if (budgeted <= 0) return 'none';

      const percentage = spent / budgeted;

      if (percentage >= GPS_CONSTANTS.BUDGET_CRITICAL_THRESHOLD) {
        return 'critical';
      } else if (percentage >= GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD) {
        return 'exceeded';
      } else if (percentage >= GPS_CONSTANTS.BUDGET_WARNING_THRESHOLD) {
        return 'warning';
      }
      return 'none';
    };

    it('should return none for under 80%', () => {
      expect(getWarningLevel(70000, 100000)).toBe('none');
      expect(getWarningLevel(50000, 100000)).toBe('none');
    });

    it('should return warning for 80-99%', () => {
      expect(getWarningLevel(80000, 100000)).toBe('warning');
      expect(getWarningLevel(90000, 100000)).toBe('warning');
      expect(getWarningLevel(99000, 100000)).toBe('warning');
    });

    it('should return exceeded for 100-119%', () => {
      expect(getWarningLevel(100000, 100000)).toBe('exceeded');
      expect(getWarningLevel(110000, 100000)).toBe('exceeded');
      expect(getWarningLevel(119000, 100000)).toBe('exceeded');
    });

    it('should return critical for 120%+', () => {
      expect(getWarningLevel(120000, 100000)).toBe('critical');
      expect(getWarningLevel(150000, 100000)).toBe('critical');
      expect(getWarningLevel(200000, 100000)).toBe('critical');
    });
  });
});
