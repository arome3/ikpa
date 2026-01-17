/**
 * Subscription Detector Calculator Tests
 *
 * Tests pattern matching and subscription detection logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SubscriptionDetectorCalculator } from '../calculators/subscription-detector.calculator';
import { SubscriptionCategory, Currency } from '@prisma/client';
import { ExpenseForDetection } from '../interfaces';

describe('SubscriptionDetectorCalculator', () => {
  let calculator: SubscriptionDetectorCalculator;

  beforeEach(() => {
    calculator = new SubscriptionDetectorCalculator();
  });

  describe('matchMerchant', () => {
    it('should match Netflix as STREAMING', () => {
      const result = calculator.matchMerchant('NETFLIX.COM');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.STREAMING);
    });

    it('should match Spotify as STREAMING', () => {
      const result = calculator.matchMerchant('Spotify Premium');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.STREAMING);
    });

    it('should match DStv as TV_CABLE', () => {
      const result = calculator.matchMerchant('DSTV PAYMENT');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.TV_CABLE);
    });

    it('should match GOtv as TV_CABLE', () => {
      const result = calculator.matchMerchant('gotv subscription');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.TV_CABLE);
    });

    it('should match Showmax as TV_CABLE', () => {
      const result = calculator.matchMerchant('Showmax Monthly');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.TV_CABLE);
    });

    it('should match gym as FITNESS', () => {
      const result = calculator.matchMerchant('Planet Fitness Membership');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.FITNESS);
    });

    it('should match Dropbox as CLOUD_STORAGE', () => {
      const result = calculator.matchMerchant('DROPBOX PLUS');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.CLOUD_STORAGE);
    });

    it('should match iCloud as CLOUD_STORAGE', () => {
      const result = calculator.matchMerchant('Apple iCloud Storage');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.CLOUD_STORAGE);
    });

    it('should match Adobe as SOFTWARE', () => {
      // "Adobe Photoshop" to avoid "cloud" matching CLOUD_STORAGE pattern
      const result = calculator.matchMerchant('Adobe Photoshop');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.SOFTWARE);
    });

    it('should match NordVPN as VPN', () => {
      const result = calculator.matchMerchant('NordVPN Subscription');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.VPN);
    });

    it('should match Coursera as LEARNING', () => {
      const result = calculator.matchMerchant('Coursera Plus');
      expect(result.matched).toBe(true);
      expect(result.category).toBe(SubscriptionCategory.LEARNING);
    });

    it('should not match unknown merchants', () => {
      const result = calculator.matchMerchant('Random Store');
      expect(result.matched).toBe(false);
      expect(result.category).toBeNull();
    });

    it('should have confidence score > 0 for matches', () => {
      const result = calculator.matchMerchant('netflix');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('detect', () => {
    const createMockExpenses = (
      merchant: string,
      count: number,
    ): ExpenseForDetection[] => {
      const expenses: ExpenseForDetection[] = [];
      const baseDate = new Date('2025-01-01');

      for (let i = 0; i < count; i++) {
        const date = new Date(baseDate);
        date.setMonth(date.getMonth() + i);
        expenses.push({
          id: `exp-${i}`,
          merchant,
          amount: 5000,
          currency: Currency.NGN,
          date,
          isRecurring: true,
        });
      }

      return expenses;
    };

    it('should detect Netflix subscription from recurring expenses', async () => {
      const expenses = createMockExpenses('NETFLIX.COM', 3);
      const result = await calculator.detect('user-123', expenses);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Netflix');
      expect(result[0].category).toBe(SubscriptionCategory.STREAMING);
    });

    it('should detect DStv subscription with correct category', async () => {
      const expenses = createMockExpenses('DSTV MULTICHOICE', 3);
      const result = await calculator.detect('user-123', expenses);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe(SubscriptionCategory.TV_CABLE);
    });

    it('should not detect subscription with less than 2 charges', async () => {
      const expenses = createMockExpenses('NETFLIX.COM', 1);
      const result = await calculator.detect('user-123', expenses);

      expect(result).toHaveLength(0);
    });

    it('should skip non-recurring expenses', async () => {
      const expenses: ExpenseForDetection[] = [
        {
          id: 'exp-1',
          merchant: 'NETFLIX.COM',
          amount: 5000,
          currency: Currency.NGN,
          date: new Date(),
          isRecurring: false,
        },
        {
          id: 'exp-2',
          merchant: 'NETFLIX.COM',
          amount: 5000,
          currency: Currency.NGN,
          date: new Date(),
          isRecurring: false,
        },
      ];

      const result = await calculator.detect('user-123', expenses);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty expenses', async () => {
      const result = await calculator.detect('user-123', []);
      expect(result).toHaveLength(0);
    });

    it('should calculate correct charge count', async () => {
      const expenses = createMockExpenses('Spotify', 5);
      const result = await calculator.detect('user-123', expenses);

      expect(result[0].chargeCount).toBe(5);
    });

    it('should calculate average monthly cost', async () => {
      const expenses: ExpenseForDetection[] = [
        {
          id: 'exp-1',
          merchant: 'Netflix',
          amount: 4500,
          currency: Currency.NGN,
          date: new Date('2025-01-01'),
          isRecurring: true,
        },
        {
          id: 'exp-2',
          merchant: 'Netflix',
          amount: 5500,
          currency: Currency.NGN,
          date: new Date('2025-02-01'),
          isRecurring: true,
        },
      ];

      const result = await calculator.detect('user-123', expenses);
      expect(result[0].monthlyCost).toBe(5000); // Average of 4500 and 5500
    });

    it('should categorize unknown merchants as OTHER', async () => {
      const expenses = createMockExpenses('Unknown Service XYZ', 3);
      const result = await calculator.detect('user-123', expenses);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe(SubscriptionCategory.OTHER);
    });

    it('should detect multiple subscriptions', async () => {
      const netflixExpenses = createMockExpenses('Netflix', 3);
      const spotifyExpenses = createMockExpenses('Spotify', 3);
      const allExpenses = [...netflixExpenses, ...spotifyExpenses];

      const result = await calculator.detect('user-123', allExpenses);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name)).toContain('Netflix');
      expect(result.map((r) => r.name)).toContain('Spotify');
    });
  });
});
