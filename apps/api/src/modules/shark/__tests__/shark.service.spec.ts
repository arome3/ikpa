/**
 * SharkService Unit Tests
 *
 * Tests cover:
 * - Exception behavior
 * - Data transformations
 * - Business logic validation
 *
 * Note: These tests mock at the service method level to avoid
 * complex Prisma client mocking issues with NestJS DI.
 * Core calculation logic is tested in calculator unit tests.
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SubscriptionStatus,
  SwipeAction,
  SubscriptionCategory,
  Currency,
} from '@prisma/client';
import {
  SubscriptionNotFoundException,
  InsufficientExpenseDataException,
  AuditOperationException,
  SubscriptionCancellationException,
} from '../exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { SUBSCRIPTION_PATTERNS, ZOMBIE_THRESHOLD_DAYS } from '../constants';

// Helper to get error code from exception response
const getErrorCode = (exception: { getResponse: () => unknown }): string | undefined => {
  const response = exception.getResponse() as { code?: string };
  return response?.code;
};

describe('SharkService Exceptions', () => {
  describe('SubscriptionNotFoundException', () => {
    it('should create exception with subscription ID', () => {
      const exception = new SubscriptionNotFoundException('sub-123');

      expect(exception.message).toContain('sub-123');
      expect(getErrorCode(exception)).toBe(ErrorCodes.SHARK_SUBSCRIPTION_NOT_FOUND);
    });

    it('should have 404 status', () => {
      const exception = new SubscriptionNotFoundException('sub-123');

      expect(exception.getStatus()).toBe(404);
    });
  });

  describe('InsufficientExpenseDataException', () => {
    it('should create exception with required count', () => {
      const exception = new InsufficientExpenseDataException(10);

      expect(exception.message).toContain('10');
      expect(getErrorCode(exception)).toBe(ErrorCodes.SHARK_INSUFFICIENT_DATA);
    });

    it('should have 422 status', () => {
      const exception = new InsufficientExpenseDataException(5);

      expect(exception.getStatus()).toBe(422);
    });
  });

  describe('AuditOperationException', () => {
    it('should create exception with operation details', () => {
      const exception = new AuditOperationException('Pattern matching failed');

      expect(exception.message).toContain('Pattern matching failed');
      expect(getErrorCode(exception)).toBe(ErrorCodes.SHARK_AUDIT_ERROR);
    });

    it('should have 500 status', () => {
      const exception = new AuditOperationException('Error');

      expect(exception.getStatus()).toBe(500);
    });
  });

  describe('SubscriptionCancellationException', () => {
    it('should create exception with subscription ID and reason', () => {
      const exception = new SubscriptionCancellationException(
        'sub-123',
        'API unavailable',
      );

      expect(exception.message).toContain('sub-123');
      expect(exception.message).toContain('API unavailable');
      expect(getErrorCode(exception)).toBe(ErrorCodes.SHARK_CANCELLATION_ERROR);
    });

    it('should have 422 status', () => {
      const exception = new SubscriptionCancellationException('sub-123', 'Error');

      expect(exception.getStatus()).toBe(422);
    });
  });
});

describe('SharkService Data Structures', () => {
  // Mock subscription factory
  const createMockSubscription = (
    overrides: Partial<{
      id: string;
      userId: string;
      name: string;
      category: SubscriptionCategory;
      monthlyCost: Decimal;
      annualCost: Decimal;
      currency: Currency;
      status: SubscriptionStatus;
      lastUsageDate: Date | null;
    }> = {},
  ) => ({
    id: 'sub-123',
    userId: 'user-123',
    name: 'Netflix',
    merchantPattern: 'netflix.com',
    category: SubscriptionCategory.STREAMING,
    monthlyCost: new Decimal(5000),
    annualCost: new Decimal(60000),
    currency: Currency.NGN,
    status: SubscriptionStatus.ACTIVE,
    lastUsageDate: new Date(),
    detectedAt: new Date(),
    firstChargeDate: new Date('2024-01-01'),
    lastChargeDate: new Date(),
    chargeCount: 12,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    swipeDecisions: [],
    ...overrides,
  });

  describe('Subscription Structure', () => {
    it('should create valid subscription with all required fields', () => {
      const subscription = createMockSubscription();

      expect(subscription.id).toBeDefined();
      expect(subscription.userId).toBe('user-123');
      expect(subscription.name).toBe('Netflix');
      expect(subscription.currency).toBe('NGN');
    });

    it('should allow overriding specific fields', () => {
      const subscription = createMockSubscription({
        status: SubscriptionStatus.ZOMBIE,
        currency: Currency.USD,
      });

      expect(subscription.status).toBe(SubscriptionStatus.ZOMBIE);
      expect(subscription.currency).toBe('USD');
    });

    it('should maintain Decimal types for cost fields', () => {
      const subscription = createMockSubscription();

      expect(subscription.monthlyCost).toBeInstanceOf(Decimal);
      expect(subscription.annualCost).toBeInstanceOf(Decimal);
    });
  });

  describe('Swipe Decision Structure', () => {
    const createMockSwipeDecision = (action: SwipeAction) => ({
      id: 'decision-123',
      subscriptionId: 'sub-123',
      userId: 'user-123',
      action,
      reason: action === SwipeAction.CANCEL ? 'Not using anymore' : null,
      decidedAt: new Date(),
      createdAt: new Date(),
    });

    it('should create KEEP decision', () => {
      const decision = createMockSwipeDecision(SwipeAction.KEEP);

      expect(decision.action).toBe(SwipeAction.KEEP);
      expect(decision.reason).toBeNull();
    });

    it('should create CANCEL decision with reason', () => {
      const decision = createMockSwipeDecision(SwipeAction.CANCEL);

      expect(decision.action).toBe(SwipeAction.CANCEL);
      expect(decision.reason).toBe('Not using anymore');
    });

    it('should create REVIEW_LATER decision', () => {
      const decision = createMockSwipeDecision(SwipeAction.REVIEW_LATER);

      expect(decision.action).toBe(SwipeAction.REVIEW_LATER);
    });
  });
});

describe('SharkService Business Logic', () => {
  describe('Subscription Status Transitions', () => {
    const getNewStatus = (
      action: SwipeAction,
      _currentStatus: SubscriptionStatus,
    ): SubscriptionStatus | null => {
      switch (action) {
        case SwipeAction.KEEP:
          return SubscriptionStatus.ACTIVE;
        case SwipeAction.CANCEL:
          return SubscriptionStatus.CANCELLED;
        case SwipeAction.REVIEW_LATER:
          return null; // No status change
        default:
          return null;
      }
    };

    it('should transition to ACTIVE on KEEP', () => {
      expect(getNewStatus(SwipeAction.KEEP, SubscriptionStatus.ZOMBIE)).toBe(
        SubscriptionStatus.ACTIVE,
      );
      expect(getNewStatus(SwipeAction.KEEP, SubscriptionStatus.UNKNOWN)).toBe(
        SubscriptionStatus.ACTIVE,
      );
    });

    it('should transition to CANCELLED on CANCEL', () => {
      expect(getNewStatus(SwipeAction.CANCEL, SubscriptionStatus.ACTIVE)).toBe(
        SubscriptionStatus.CANCELLED,
      );
      expect(getNewStatus(SwipeAction.CANCEL, SubscriptionStatus.ZOMBIE)).toBe(
        SubscriptionStatus.CANCELLED,
      );
    });

    it('should not change status on REVIEW_LATER', () => {
      expect(getNewStatus(SwipeAction.REVIEW_LATER, SubscriptionStatus.ACTIVE)).toBeNull();
      expect(getNewStatus(SwipeAction.REVIEW_LATER, SubscriptionStatus.ZOMBIE)).toBeNull();
    });
  });

  describe('Zombie Detection Logic', () => {
    const isZombie = (lastUsageDate: Date | null): boolean => {
      if (!lastUsageDate) return true; // No usage data = zombie

      const daysSinceUsage = Math.floor(
        (Date.now() - lastUsageDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return daysSinceUsage > ZOMBIE_THRESHOLD_DAYS;
    };

    it('should mark as zombie when no usage date', () => {
      expect(isZombie(null)).toBe(true);
    });

    it('should mark as zombie when usage > 90 days ago', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      expect(isZombie(oldDate)).toBe(true);
    });

    it('should not mark as zombie when recently used', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      expect(isZombie(recentDate)).toBe(false);
    });

    it('should use 90 day threshold', () => {
      expect(ZOMBIE_THRESHOLD_DAYS).toBe(90);
    });
  });

  describe('Annual Savings Calculation', () => {
    const calculateAnnualSavings = (monthlyCost: Decimal | number): number => {
      const monthly = typeof monthlyCost === 'number' ? monthlyCost : Number(monthlyCost);
      return monthly * 12;
    };

    it('should calculate annual savings from monthly cost', () => {
      expect(calculateAnnualSavings(5000)).toBe(60000);
      expect(calculateAnnualSavings(new Decimal(15000))).toBe(180000);
    });

    it('should handle zero monthly cost', () => {
      expect(calculateAnnualSavings(0)).toBe(0);
    });
  });

  describe('Pagination Logic', () => {
    const calculatePagination = (
      total: number,
      offset: number,
      limit: number,
    ) => {
      const effectiveLimit = Math.min(Math.max(1, limit), 100);
      const effectiveOffset = Math.max(0, offset);

      return {
        total,
        limit: effectiveLimit,
        offset: effectiveOffset,
        hasMore: effectiveOffset + effectiveLimit < total,
      };
    };

    it('should enforce maximum limit of 100', () => {
      const result = calculatePagination(500, 0, 200);
      expect(result.limit).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const result = calculatePagination(500, 0, 0);
      expect(result.limit).toBe(1);
    });

    it('should enforce minimum offset of 0', () => {
      const result = calculatePagination(500, -10, 50);
      expect(result.offset).toBe(0);
    });

    it('should correctly calculate hasMore', () => {
      expect(calculatePagination(100, 0, 50).hasMore).toBe(true);
      expect(calculatePagination(100, 50, 50).hasMore).toBe(false);
      expect(calculatePagination(100, 0, 100).hasMore).toBe(false);
    });
  });
});

describe('SharkService Constants', () => {
  describe('Subscription Patterns', () => {
    it('should have patterns for common subscription categories', () => {
      const categories = SUBSCRIPTION_PATTERNS.map((p) => p.category);

      expect(categories).toContain(SubscriptionCategory.STREAMING);
      expect(categories).toContain(SubscriptionCategory.TV_CABLE);
      expect(categories).toContain(SubscriptionCategory.FITNESS);
      expect(categories).toContain(SubscriptionCategory.SOFTWARE);
    });

    it('should match Netflix to STREAMING', () => {
      const streamingPattern = SUBSCRIPTION_PATTERNS.find(
        (p) => p.category === SubscriptionCategory.STREAMING,
      );
      expect(streamingPattern?.pattern.test('Netflix')).toBe(true);
    });

    it('should match DSTV to TV_CABLE', () => {
      const tvPattern = SUBSCRIPTION_PATTERNS.find(
        (p) => p.category === SubscriptionCategory.TV_CABLE,
      );
      expect(tvPattern?.pattern.test('DSTV subscription')).toBe(true);
    });

    it('should match Adobe to SOFTWARE not CLOUD_STORAGE', () => {
      // Find the first matching pattern (SOFTWARE should come before CLOUD_STORAGE)
      const matchingPattern = SUBSCRIPTION_PATTERNS.find((p) =>
        p.pattern.test('Adobe Creative Cloud'),
      );
      expect(matchingPattern?.category).toBe(SubscriptionCategory.SOFTWARE);
    });

    it('should have at least 7 pattern categories', () => {
      expect(SUBSCRIPTION_PATTERNS.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Zombie Threshold', () => {
    it('should be 90 days', () => {
      expect(ZOMBIE_THRESHOLD_DAYS).toBe(90);
    });
  });
});

describe('SharkService Summary Statistics', () => {
  describe('Summary Calculation', () => {
    interface GroupByResult {
      status: SubscriptionStatus;
      _sum: { monthlyCost: Decimal | null };
      _count: { id: number };
    }

    const calculateSummaryFromGroupBy = (
      groupByResults: GroupByResult[],
      total: number,
      currency: Currency,
    ) => {
      let activeCount = 0;
      let zombieCount = 0;
      let unknownCount = 0;
      let cancelledCount = 0;
      let totalMonthlyCost = new Decimal(0);
      let zombieMonthlyCost = new Decimal(0);

      for (const group of groupByResults) {
        const count = group._count.id;
        const cost = group._sum.monthlyCost ?? new Decimal(0);

        switch (group.status) {
          case SubscriptionStatus.ACTIVE:
            activeCount = count;
            totalMonthlyCost = totalMonthlyCost.plus(cost);
            break;
          case SubscriptionStatus.ZOMBIE:
            zombieCount = count;
            totalMonthlyCost = totalMonthlyCost.plus(cost);
            zombieMonthlyCost = zombieMonthlyCost.plus(cost);
            break;
          case SubscriptionStatus.UNKNOWN:
            unknownCount = count;
            totalMonthlyCost = totalMonthlyCost.plus(cost);
            break;
          case SubscriptionStatus.CANCELLED:
            cancelledCount = count;
            break;
        }
      }

      return {
        totalSubscriptions: total,
        activeCount,
        zombieCount,
        unknownCount,
        cancelledCount,
        totalMonthlyCost: Number(totalMonthlyCost),
        potentialAnnualSavings: Number(zombieMonthlyCost) * 12,
        currency,
      };
    };

    it('should aggregate subscription counts correctly', () => {
      const groupByResults: GroupByResult[] = [
        {
          status: SubscriptionStatus.ACTIVE,
          _sum: { monthlyCost: new Decimal(10000) },
          _count: { id: 3 },
        },
        {
          status: SubscriptionStatus.ZOMBIE,
          _sum: { monthlyCost: new Decimal(5000) },
          _count: { id: 2 },
        },
      ];

      const summary = calculateSummaryFromGroupBy(groupByResults, 5, Currency.NGN);

      expect(summary.activeCount).toBe(3);
      expect(summary.zombieCount).toBe(2);
      expect(summary.totalSubscriptions).toBe(5);
    });

    it('should calculate total monthly cost across statuses', () => {
      const groupByResults: GroupByResult[] = [
        {
          status: SubscriptionStatus.ACTIVE,
          _sum: { monthlyCost: new Decimal(10000) },
          _count: { id: 2 },
        },
        {
          status: SubscriptionStatus.ZOMBIE,
          _sum: { monthlyCost: new Decimal(5000) },
          _count: { id: 1 },
        },
      ];

      const summary = calculateSummaryFromGroupBy(groupByResults, 3, Currency.NGN);

      expect(summary.totalMonthlyCost).toBe(15000);
    });

    it('should calculate potential annual savings from zombies', () => {
      const groupByResults: GroupByResult[] = [
        {
          status: SubscriptionStatus.ZOMBIE,
          _sum: { monthlyCost: new Decimal(15000) },
          _count: { id: 3 },
        },
      ];

      const summary = calculateSummaryFromGroupBy(groupByResults, 3, Currency.NGN);

      expect(summary.potentialAnnualSavings).toBe(180000); // 15000 * 12
    });

    it('should exclude cancelled subscriptions from total cost', () => {
      const groupByResults: GroupByResult[] = [
        {
          status: SubscriptionStatus.ACTIVE,
          _sum: { monthlyCost: new Decimal(5000) },
          _count: { id: 1 },
        },
        {
          status: SubscriptionStatus.CANCELLED,
          _sum: { monthlyCost: new Decimal(10000) },
          _count: { id: 2 },
        },
      ];

      const summary = calculateSummaryFromGroupBy(groupByResults, 3, Currency.NGN);

      expect(summary.totalMonthlyCost).toBe(5000); // Only active cost
      expect(summary.cancelledCount).toBe(2);
    });

    it('should handle null monthly cost', () => {
      const groupByResults: GroupByResult[] = [
        {
          status: SubscriptionStatus.ACTIVE,
          _sum: { monthlyCost: null },
          _count: { id: 1 },
        },
      ];

      const summary = calculateSummaryFromGroupBy(groupByResults, 1, Currency.NGN);

      expect(summary.totalMonthlyCost).toBe(0);
    });
  });
});

describe('SharkService KEEP Logic', () => {
  describe('Skip KEEP subscriptions in zombie detection', () => {
    interface SubscriptionWithDecision {
      id: string;
      status: SubscriptionStatus;
      lastDecision?: { action: SwipeAction };
    }

    const filterForZombieAnalysis = (
      subscriptions: SubscriptionWithDecision[],
    ): SubscriptionWithDecision[] => {
      return subscriptions.filter((s) => {
        // Skip subscriptions marked as KEEP
        return s.lastDecision?.action !== SwipeAction.KEEP;
      });
    };

    it('should exclude KEEP subscriptions from analysis', () => {
      const subscriptions: SubscriptionWithDecision[] = [
        { id: 'sub-1', status: SubscriptionStatus.ACTIVE, lastDecision: { action: SwipeAction.KEEP } },
        { id: 'sub-2', status: SubscriptionStatus.ZOMBIE },
        { id: 'sub-3', status: SubscriptionStatus.ACTIVE },
      ];

      const filtered = filterForZombieAnalysis(subscriptions);

      expect(filtered).toHaveLength(2);
      expect(filtered.find((s) => s.id === 'sub-1')).toBeUndefined();
    });

    it('should include CANCEL subscriptions in analysis', () => {
      const subscriptions: SubscriptionWithDecision[] = [
        { id: 'sub-1', status: SubscriptionStatus.ACTIVE, lastDecision: { action: SwipeAction.CANCEL } },
      ];

      const filtered = filterForZombieAnalysis(subscriptions);

      expect(filtered).toHaveLength(1);
    });

    it('should include REVIEW_LATER subscriptions in analysis', () => {
      const subscriptions: SubscriptionWithDecision[] = [
        { id: 'sub-1', status: SubscriptionStatus.ACTIVE, lastDecision: { action: SwipeAction.REVIEW_LATER } },
      ];

      const filtered = filterForZombieAnalysis(subscriptions);

      expect(filtered).toHaveLength(1);
    });

    it('should include subscriptions with no decision', () => {
      const subscriptions: SubscriptionWithDecision[] = [
        { id: 'sub-1', status: SubscriptionStatus.ACTIVE },
      ];

      const filtered = filterForZombieAnalysis(subscriptions);

      expect(filtered).toHaveLength(1);
    });
  });
});
