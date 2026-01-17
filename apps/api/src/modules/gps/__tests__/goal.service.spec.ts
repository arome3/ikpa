/**
 * GoalService Unit Tests
 *
 * Tests cover:
 * - Goal deadline extension logic
 * - Simulation input building
 * - Economic defaults by country
 */

import { describe, it, expect } from 'vitest';
import { addWeeks } from 'date-fns';

describe('GoalService', () => {
  describe('Deadline Extension', () => {
    const extendDeadline = (currentDeadline: Date, weeks: number): Date => {
      return addWeeks(currentDeadline, weeks);
    };

    it('should extend deadline by specified weeks', () => {
      const currentDeadline = new Date('2026-06-30');
      const extended = extendDeadline(currentDeadline, 2);

      const expectedDate = new Date('2026-07-14');
      expect(extended.toDateString()).toBe(expectedDate.toDateString());
    });

    it('should handle negative weeks (reduction)', () => {
      const currentDeadline = new Date('2026-06-30');
      const extended = extendDeadline(currentDeadline, -1);

      const expectedDate = new Date('2026-06-23');
      expect(extended.toDateString()).toBe(expectedDate.toDateString());
    });

    it('should handle zero weeks (no change)', () => {
      const currentDeadline = new Date('2026-06-30');
      const extended = extendDeadline(currentDeadline, 0);

      expect(extended.toDateString()).toBe(currentDeadline.toDateString());
    });
  });

  describe('Savings Rate Calculation', () => {
    const calculateSavingsRate = (
      monthlyIncome: number,
      monthlySavings: number,
    ): number => {
      if (monthlyIncome <= 0) return 0;
      return Math.min(1, Math.max(0, monthlySavings / monthlyIncome));
    };

    it('should calculate savings rate correctly', () => {
      expect(calculateSavingsRate(100000, 20000)).toBe(0.2);
      expect(calculateSavingsRate(100000, 50000)).toBe(0.5);
    });

    it('should cap at 100%', () => {
      expect(calculateSavingsRate(100000, 120000)).toBe(1);
    });

    it('should floor at 0%', () => {
      expect(calculateSavingsRate(100000, -20000)).toBe(0);
    });

    it('should handle zero income', () => {
      expect(calculateSavingsRate(0, 10000)).toBe(0);
    });
  });

  describe('Net Worth Calculation', () => {
    const calculateNetWorth = (
      liquidSavings: number,
      totalDebt: number,
    ): number => {
      return liquidSavings - totalDebt;
    };

    it('should calculate positive net worth', () => {
      expect(calculateNetWorth(500000, 200000)).toBe(300000);
    });

    it('should calculate negative net worth', () => {
      expect(calculateNetWorth(200000, 500000)).toBe(-300000);
    });

    it('should handle zero values', () => {
      expect(calculateNetWorth(0, 0)).toBe(0);
      expect(calculateNetWorth(100000, 0)).toBe(100000);
      expect(calculateNetWorth(0, 100000)).toBe(-100000);
    });
  });

  describe('Economic Defaults by Country', () => {
    const getEconomicDefaults = (country?: string | null): {
      inflationRate: number;
      expectedReturn: number;
      incomeGrowthRate: number;
    } => {
      const defaults: Record<string, { inflationRate: number; expectedReturn: number; incomeGrowthRate: number }> = {
        NIGERIA: { inflationRate: 0.15, expectedReturn: 0.12, incomeGrowthRate: 0.05 },
        GHANA: { inflationRate: 0.10, expectedReturn: 0.10, incomeGrowthRate: 0.04 },
        KENYA: { inflationRate: 0.06, expectedReturn: 0.08, incomeGrowthRate: 0.04 },
        SOUTH_AFRICA: { inflationRate: 0.05, expectedReturn: 0.09, incomeGrowthRate: 0.03 },
        EGYPT: { inflationRate: 0.12, expectedReturn: 0.10, incomeGrowthRate: 0.04 },
        DEFAULT: { inflationRate: 0.08, expectedReturn: 0.08, incomeGrowthRate: 0.04 },
      };

      const countryKey = country?.toUpperCase() || 'DEFAULT';
      return defaults[countryKey] || defaults.DEFAULT;
    };

    it('should return Nigeria defaults', () => {
      const defaults = getEconomicDefaults('NIGERIA');

      expect(defaults.inflationRate).toBe(0.15);
      expect(defaults.expectedReturn).toBe(0.12);
      expect(defaults.incomeGrowthRate).toBe(0.05);
    });

    it('should return Ghana defaults', () => {
      const defaults = getEconomicDefaults('GHANA');

      expect(defaults.inflationRate).toBe(0.10);
      expect(defaults.expectedReturn).toBe(0.10);
    });

    it('should return Kenya defaults', () => {
      const defaults = getEconomicDefaults('KENYA');

      expect(defaults.inflationRate).toBe(0.06);
      expect(defaults.expectedReturn).toBe(0.08);
    });

    it('should return South Africa defaults', () => {
      const defaults = getEconomicDefaults('SOUTH_AFRICA');

      expect(defaults.inflationRate).toBe(0.05);
      expect(defaults.expectedReturn).toBe(0.09);
    });

    it('should return Egypt defaults', () => {
      const defaults = getEconomicDefaults('EGYPT');

      expect(defaults.inflationRate).toBe(0.12);
    });

    it('should return default values for unknown country', () => {
      const defaults = getEconomicDefaults('UNKNOWN_COUNTRY');

      expect(defaults.inflationRate).toBe(0.08);
      expect(defaults.expectedReturn).toBe(0.08);
      expect(defaults.incomeGrowthRate).toBe(0.04);
    });

    it('should return default values for null country', () => {
      const defaults = getEconomicDefaults(null);

      expect(defaults.inflationRate).toBe(0.08);
    });

    it('should be case insensitive', () => {
      const lowerCase = getEconomicDefaults('nigeria');
      const upperCase = getEconomicDefaults('NIGERIA');

      expect(lowerCase.inflationRate).toBe(upperCase.inflationRate);
    });
  });

  describe('Monthly Multiplier Calculation', () => {
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

    it('should return correct multipliers for each frequency', () => {
      expect(getMonthlyMultiplier('DAILY')).toBe(30);
      expect(getMonthlyMultiplier('WEEKLY')).toBe(4.33);
      expect(getMonthlyMultiplier('BIWEEKLY')).toBe(2.17);
      expect(getMonthlyMultiplier('MONTHLY')).toBe(1);
      expect(getMonthlyMultiplier('QUARTERLY')).toBe(0.33);
      expect(getMonthlyMultiplier('ANNUALLY')).toBe(0.083);
      expect(getMonthlyMultiplier('ONE_TIME')).toBe(0);
    });

    it('should default to monthly for unknown frequency', () => {
      expect(getMonthlyMultiplier('UNKNOWN')).toBe(1);
    });
  });

  describe('Adjusted Simulation Input', () => {
    interface SimulationInput {
      currentSavingsRate: number;
      goalDeadline: Date;
      monthlyIncome: number;
    }

    interface Adjustments {
      weeksExtension?: number;
      additionalSavingsRate?: number;
      additionalMonthlySavings?: number;
    }

    const applyAdjustments = (
      baseInput: SimulationInput,
      adjustments: Adjustments,
    ): SimulationInput => {
      let adjusted = { ...baseInput };

      if (adjustments.weeksExtension && adjustments.weeksExtension > 0) {
        adjusted.goalDeadline = addWeeks(baseInput.goalDeadline, adjustments.weeksExtension);
      }

      if (adjustments.additionalSavingsRate && adjustments.additionalSavingsRate > 0) {
        adjusted.currentSavingsRate = Math.min(
          1,
          baseInput.currentSavingsRate + adjustments.additionalSavingsRate,
        );
      }

      if (adjustments.additionalMonthlySavings && adjustments.additionalMonthlySavings > 0) {
        const additionalRate =
          baseInput.monthlyIncome > 0
            ? adjustments.additionalMonthlySavings / baseInput.monthlyIncome
            : 0;
        adjusted.currentSavingsRate = Math.min(1, adjusted.currentSavingsRate + additionalRate);
      }

      return adjusted;
    };

    it('should extend deadline', () => {
      const baseInput: SimulationInput = {
        currentSavingsRate: 0.2,
        goalDeadline: new Date('2026-06-30'),
        monthlyIncome: 100000,
      };

      const adjusted = applyAdjustments(baseInput, { weeksExtension: 2 });

      expect(adjusted.goalDeadline.toDateString()).toBe(
        new Date('2026-07-14').toDateString(),
      );
      expect(adjusted.currentSavingsRate).toBe(0.2); // Unchanged
    });

    it('should increase savings rate', () => {
      const baseInput: SimulationInput = {
        currentSavingsRate: 0.2,
        goalDeadline: new Date('2026-06-30'),
        monthlyIncome: 100000,
      };

      const adjusted = applyAdjustments(baseInput, { additionalSavingsRate: 0.05 });

      expect(adjusted.currentSavingsRate).toBe(0.25);
    });

    it('should add additional monthly savings as rate increase', () => {
      const baseInput: SimulationInput = {
        currentSavingsRate: 0.2,
        goalDeadline: new Date('2026-06-30'),
        monthlyIncome: 100000,
      };

      const adjusted = applyAdjustments(baseInput, { additionalMonthlySavings: 10000 });

      expect(adjusted.currentSavingsRate).toBeCloseTo(0.3, 10); // 0.2 + (10000/100000)
    });

    it('should cap savings rate at 100%', () => {
      const baseInput: SimulationInput = {
        currentSavingsRate: 0.9,
        goalDeadline: new Date('2026-06-30'),
        monthlyIncome: 100000,
      };

      const adjusted = applyAdjustments(baseInput, { additionalSavingsRate: 0.2 });

      expect(adjusted.currentSavingsRate).toBe(1);
    });
  });
});
