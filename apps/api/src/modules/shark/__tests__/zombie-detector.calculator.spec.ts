/**
 * Zombie Detector Calculator Tests
 *
 * Tests zombie subscription detection logic based on usage patterns.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ZombieDetectorCalculator } from '../calculators/zombie-detector.calculator';
import {
  SubscriptionStatus,
  SubscriptionCategory,
  Currency,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Subscription } from '../interfaces';

describe('ZombieDetectorCalculator', () => {
  let calculator: ZombieDetectorCalculator;

  beforeEach(() => {
    calculator = new ZombieDetectorCalculator();
  });

  const createMockSubscription = (
    overrides: Partial<Subscription> = {},
  ): Subscription => ({
    id: 'sub-123',
    userId: 'user-123',
    name: 'Test Service',
    merchantPattern: 'test-service',
    category: SubscriptionCategory.STREAMING,
    monthlyCost: new Decimal(5000),
    annualCost: new Decimal(60000),
    currency: Currency.NGN,
    status: SubscriptionStatus.UNKNOWN,
    lastUsageDate: null,
    detectedAt: new Date(),
    firstChargeDate: new Date('2024-01-01'),
    lastChargeDate: new Date(),
    chargeCount: 12,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('calculateDaysSinceLastUsage', () => {
    it('should return null for null lastUsageDate', () => {
      const result = calculator.calculateDaysSinceLastUsage(null);
      expect(result).toBeNull();
    });

    it('should calculate days since usage correctly', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const result = calculator.calculateDaysSinceLastUsage(tenDaysAgo);
      expect(result).toBe(10);
    });

    it('should return 0 for usage today', () => {
      const today = new Date();
      const result = calculator.calculateDaysSinceLastUsage(today);
      expect(result).toBe(0);
    });
  });

  describe('determineStatus', () => {
    it('should return ZOMBIE for usage > 90 days ago', () => {
      const oneHundredDaysAgo = new Date();
      oneHundredDaysAgo.setDate(oneHundredDaysAgo.getDate() - 100);

      const status = calculator.determineStatus(oneHundredDaysAgo, new Date());
      expect(status).toBe(SubscriptionStatus.ZOMBIE);
    });

    it('should return ACTIVE for usage within 90 days', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const status = calculator.determineStatus(thirtyDaysAgo, new Date());
      expect(status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should return UNKNOWN for null usage date with recent charge', () => {
      const status = calculator.determineStatus(null, new Date());
      expect(status).toBe(SubscriptionStatus.UNKNOWN);
    });

    it('should return UNKNOWN for null usage date with no charge info', () => {
      const status = calculator.determineStatus(null, null);
      expect(status).toBe(SubscriptionStatus.UNKNOWN);
    });

    it('should return ACTIVE for usage exactly 90 days ago', () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const status = calculator.determineStatus(ninetyDaysAgo, new Date());
      expect(status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should return ZOMBIE for usage 91 days ago', () => {
      const ninetyOneDaysAgo = new Date();
      ninetyOneDaysAgo.setDate(ninetyOneDaysAgo.getDate() - 91);

      const status = calculator.determineStatus(ninetyOneDaysAgo, new Date());
      expect(status).toBe(SubscriptionStatus.ZOMBIE);
    });
  });

  describe('analyze', () => {
    it('should identify zombie subscriptions', async () => {
      const oneHundredDaysAgo = new Date();
      oneHundredDaysAgo.setDate(oneHundredDaysAgo.getDate() - 100);

      const subscriptions = [
        createMockSubscription({
          id: 'sub-1',
          lastUsageDate: oneHundredDaysAgo,
        }),
      ];

      const results = await calculator.analyze('user-123', subscriptions);

      expect(results).toHaveLength(1);
      expect(results[0].isZombie).toBe(true);
      expect(results[0].status).toBe(SubscriptionStatus.ZOMBIE);
    });

    it('should identify active subscriptions', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const subscriptions = [
        createMockSubscription({
          id: 'sub-1',
          lastUsageDate: tenDaysAgo,
        }),
      ];

      const results = await calculator.analyze('user-123', subscriptions);

      expect(results).toHaveLength(1);
      expect(results[0].isZombie).toBe(false);
      expect(results[0].status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('should skip already cancelled subscriptions', async () => {
      const subscriptions = [
        createMockSubscription({
          id: 'sub-1',
          status: SubscriptionStatus.CANCELLED,
        }),
      ];

      const results = await calculator.analyze('user-123', subscriptions);

      expect(results).toHaveLength(1);
      expect(results[0].isZombie).toBe(false);
      expect(results[0].status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('should analyze multiple subscriptions correctly', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const oneHundredDaysAgo = new Date();
      oneHundredDaysAgo.setDate(oneHundredDaysAgo.getDate() - 100);

      const subscriptions = [
        createMockSubscription({
          id: 'sub-1',
          name: 'Active Service',
          lastUsageDate: tenDaysAgo,
        }),
        createMockSubscription({
          id: 'sub-2',
          name: 'Zombie Service',
          lastUsageDate: oneHundredDaysAgo,
        }),
        createMockSubscription({
          id: 'sub-3',
          name: 'Unknown Service',
          lastUsageDate: null,
        }),
      ];

      const results = await calculator.analyze('user-123', subscriptions);

      expect(results).toHaveLength(3);

      const activeResult = results.find((r) => r.id === 'sub-1');
      expect(activeResult?.status).toBe(SubscriptionStatus.ACTIVE);
      expect(activeResult?.isZombie).toBe(false);

      const zombieResult = results.find((r) => r.id === 'sub-2');
      expect(zombieResult?.status).toBe(SubscriptionStatus.ZOMBIE);
      expect(zombieResult?.isZombie).toBe(true);

      const unknownResult = results.find((r) => r.id === 'sub-3');
      expect(unknownResult?.status).toBe(SubscriptionStatus.UNKNOWN);
      expect(unknownResult?.isZombie).toBe(false);
    });

    it('should return empty array for empty subscriptions', async () => {
      const results = await calculator.analyze('user-123', []);
      expect(results).toHaveLength(0);
    });

    it('should include days since last usage in results', async () => {
      const fiftyDaysAgo = new Date();
      fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50);

      const subscriptions = [
        createMockSubscription({
          lastUsageDate: fiftyDaysAgo,
        }),
      ];

      const results = await calculator.analyze('user-123', subscriptions);

      expect(results[0].daysSinceLastUsage).toBe(50);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate correct metrics', () => {
      const results = [
        {
          id: 'sub-1',
          status: SubscriptionStatus.ACTIVE,
          daysSinceLastUsage: 10,
          isZombie: false,
        },
        {
          id: 'sub-2',
          status: SubscriptionStatus.ZOMBIE,
          daysSinceLastUsage: 100,
          isZombie: true,
        },
        {
          id: 'sub-3',
          status: SubscriptionStatus.ZOMBIE,
          daysSinceLastUsage: 120,
          isZombie: true,
        },
        {
          id: 'sub-4',
          status: SubscriptionStatus.UNKNOWN,
          daysSinceLastUsage: null,
          isZombie: false,
        },
      ];

      const metrics = calculator.calculateMetrics(results);

      expect(metrics.totalAnalyzed).toBe(4);
      expect(metrics.zombieCount).toBe(2);
      expect(metrics.activeCount).toBe(1);
      expect(metrics.unknownCount).toBe(1);
      expect(metrics.zombieRate).toBe(0.5);
    });

    it('should handle empty results', () => {
      const metrics = calculator.calculateMetrics([]);

      expect(metrics.totalAnalyzed).toBe(0);
      expect(metrics.zombieCount).toBe(0);
      expect(metrics.zombieRate).toBe(0);
    });
  });

  describe('getZombieThresholdDays', () => {
    it('should return 90 days as threshold', () => {
      expect(calculator.getZombieThresholdDays()).toBe(90);
    });
  });
});
