/**
 * Category Freeze Guard Service
 *
 * Enforces category freeze restrictions for the GPS Re-Router feature.
 * When a category is frozen (as part of a recovery path), this service
 * prevents or warns about new expenses in that category.
 *
 * Usage:
 * - Call `validateExpense()` before creating a new expense
 * - Returns a validation result with allowed/blocked status
 * - Tracks freeze violations for analytics
 *
 * Integration Points:
 * - Expense creation service
 * - Transaction creation service
 * - Budget event listener
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GpsEventType } from '@prisma/client';

/**
 * Result of category freeze validation
 */
export interface FreezeValidationResult {
  /** Whether the expense is allowed */
  allowed: boolean;
  /** Whether the category is frozen */
  isFrozen: boolean;
  /** Freeze details if category is frozen */
  freezeDetails?: {
    freezeId: string;
    categoryId: string;
    categoryName: string;
    endDate: Date;
    daysRemaining: number;
    savedAmount: number;
  };
  /** Warning or error message */
  message?: string;
  /** Recommended action for the user */
  recommendation?: string;
}

/**
 * Configuration for freeze enforcement behavior
 */
export interface FreezeEnforcementConfig {
  /** Whether to block expenses (true) or just warn (false) */
  blockExpenses: boolean;
  /** Allow essential expenses even when frozen */
  allowEssentialCategories: boolean;
  /** Categories that are always allowed (e.g., utilities, groceries) */
  essentialCategoryIds: string[];
}

@Injectable()
export class CategoryFreezeGuardService {
  private readonly logger = new Logger(CategoryFreezeGuardService.name);

  /** Default enforcement configuration */
  private readonly defaultConfig: FreezeEnforcementConfig = {
    blockExpenses: false, // Warn by default, don't block
    allowEssentialCategories: true,
    essentialCategoryIds: [], // Can be configured per deployment
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate whether an expense is allowed in the given category
   *
   * This is the main entry point for expense validation.
   * Call this before creating any new expense.
   *
   * @param userId - User ID
   * @param categoryId - Category ID to check
   * @param amount - Expense amount (for tracking)
   * @param config - Optional enforcement configuration override
   * @returns Validation result with allowed/blocked status
   */
  async validateExpense(
    userId: string,
    categoryId: string,
    amount: number,
    config?: Partial<FreezeEnforcementConfig>,
  ): Promise<FreezeValidationResult> {
    const effectiveConfig = { ...this.defaultConfig, ...config };

    // Check if category is frozen
    const freeze = await this.prisma.categoryFreeze.findFirst({
      where: {
        userId,
        categoryId,
        isActive: true,
        endDate: { gte: new Date() },
      },
    });

    // Not frozen - expense is allowed
    if (!freeze) {
      return {
        allowed: true,
        isFrozen: false,
      };
    }

    // Calculate days remaining
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((freeze.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const freezeDetails = {
      freezeId: freeze.id,
      categoryId: freeze.categoryId,
      categoryName: freeze.categoryName,
      endDate: freeze.endDate,
      daysRemaining,
      savedAmount: Number(freeze.savedAmount),
    };

    // Check if this is an essential category that should be allowed
    if (
      effectiveConfig.allowEssentialCategories &&
      effectiveConfig.essentialCategoryIds.includes(categoryId)
    ) {
      this.logger.debug(
        `[validateExpense] User ${userId}: allowing essential category expense despite freeze`,
      );

      return {
        allowed: true,
        isFrozen: true,
        freezeDetails,
        message: `Note: ${freeze.categoryName} is paused, but this is marked as essential.`,
        recommendation: 'Consider if this expense is truly necessary.',
      };
    }

    // Track the freeze violation attempt
    await this.trackFreezeViolation(userId, freeze.id, categoryId, amount);

    // Determine if we block or warn
    if (effectiveConfig.blockExpenses) {
      this.logger.log(
        `[validateExpense] User ${userId}: blocked expense in frozen category ${freeze.categoryName}`,
      );

      return {
        allowed: false,
        isFrozen: true,
        freezeDetails,
        message: `Spending in ${freeze.categoryName} is paused for ${daysRemaining} more days.`,
        recommendation: `Your ${freeze.categoryName} spending is paused as part of your recovery plan. Wait until ${freeze.endDate.toLocaleDateString()} or consider a different category.`,
      };
    }

    // Warn but allow
    this.logger.log(
      `[validateExpense] User ${userId}: warning about expense in frozen category ${freeze.categoryName}`,
    );

    return {
      allowed: true,
      isFrozen: true,
      freezeDetails,
      message: `Heads up: ${freeze.categoryName} is currently paused as part of your recovery plan.`,
      recommendation: `This expense will affect your recovery progress. The pause ends in ${daysRemaining} days (${freeze.endDate.toLocaleDateString()}).`,
    };
  }

  /**
   * Quick check if a category is frozen (without full validation)
   *
   * Use this for UI indicators or quick checks.
   */
  async isCategoryFrozen(userId: string, categoryId: string): Promise<boolean> {
    const freeze = await this.prisma.categoryFreeze.findFirst({
      where: {
        userId,
        categoryId,
        isActive: true,
        endDate: { gte: new Date() },
      },
    });

    return freeze !== null;
  }

  /**
   * Get all frozen categories for a user
   *
   * Useful for UI to show which categories are frozen.
   */
  async getFrozenCategories(userId: string): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      endDate: Date;
      daysRemaining: number;
    }>
  > {
    const freezes = await this.prisma.categoryFreeze.findMany({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
    });

    const now = new Date();

    return freezes.map((freeze) => ({
      categoryId: freeze.categoryId,
      categoryName: freeze.categoryName,
      endDate: freeze.endDate,
      daysRemaining: Math.max(
        0,
        Math.ceil((freeze.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      ),
    }));
  }

  /**
   * Track a freeze violation attempt for analytics
   *
   * This helps understand user behavior and recovery compliance.
   */
  private async trackFreezeViolation(
    userId: string,
    freezeId: string,
    categoryId: string,
    attemptedAmount: number,
  ): Promise<void> {
    // Get the session associated with this freeze
    const freeze = await this.prisma.categoryFreeze.findUnique({
      where: { id: freezeId },
      select: { sessionId: true },
    });

    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        sessionId: freeze?.sessionId,
        eventType: GpsEventType.BUDGET_THRESHOLD_CROSSED, // Reusing this type for violation tracking
        eventData: {
          type: 'FREEZE_VIOLATION_ATTEMPT',
          categoryId,
          freezeId,
          attemptedAmount,
          timestamp: new Date().toISOString(),
        },
        newValue: attemptedAmount,
      },
    });
  }

  /**
   * Validate a batch of expenses (for bulk imports)
   *
   * Returns validation results for each expense.
   */
  async validateBatch(
    userId: string,
    expenses: Array<{ categoryId: string; amount: number }>,
    config?: Partial<FreezeEnforcementConfig>,
  ): Promise<Map<string, FreezeValidationResult>> {
    const results = new Map<string, FreezeValidationResult>();

    // Get all active freezes for the user
    const freezes = await this.prisma.categoryFreeze.findMany({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
    });

    const frozenCategoryIds = new Set(freezes.map((f) => f.categoryId));

    // Validate each expense
    for (const expense of expenses) {
      if (frozenCategoryIds.has(expense.categoryId)) {
        // Category is frozen - do full validation
        const result = await this.validateExpense(
          userId,
          expense.categoryId,
          expense.amount,
          config,
        );
        results.set(expense.categoryId, result);
      } else {
        // Not frozen - quick allow
        results.set(expense.categoryId, {
          allowed: true,
          isFrozen: false,
        });
      }
    }

    return results;
  }

  /**
   * Get freeze compliance rate for a user
   *
   * Returns the percentage of time a user respected their category freezes.
   */
  async getFreezeComplianceRate(userId: string, days: number = 30): Promise<{
    totalFreezes: number;
    violationAttempts: number;
    complianceRate: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all freezes in the period
    const freezes = await this.prisma.categoryFreeze.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    });

    // Get violation attempts
    const violations = await this.prisma.gpsAnalyticsEvent.count({
      where: {
        userId,
        eventType: GpsEventType.BUDGET_THRESHOLD_CROSSED,
        eventData: {
          path: ['type'],
          equals: 'FREEZE_VIOLATION_ATTEMPT',
        },
        createdAt: { gte: startDate },
      },
    });

    const totalFreezes = freezes.length;
    const complianceRate = totalFreezes > 0 ? Math.max(0, 1 - violations / (totalFreezes * 10)) : 1;

    return {
      totalFreezes,
      violationAttempts: violations,
      complianceRate,
    };
  }
}
