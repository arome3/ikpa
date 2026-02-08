/**
 * Budget Service
 *
 * Manages budget tracking for the GPS Re-Router feature.
 * Handles budget creation, spending calculations, and budget status detection.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Budget, BudgetPeriod, Currency } from '@prisma/client';
import {
  startOfWeek, startOfMonth, startOfQuarter, startOfYear,
  endOfWeek, endOfMonth, endOfQuarter, endOfYear,
  startOfDay, endOfDay,
  differenceInDays, subMonths, addDays, format,
} from 'date-fns';
import { BudgetStatus, BudgetTrigger, SpendingVelocity, BudgetForecast, ForecastRiskLevel, BudgetInsight, ApplyBudgetInsightInput, WeeklyBreakdown, WeekBreakdown, CurrentWeekInfo, DailyLimit, SpendingBreakdown } from './interfaces';
import { GPS_CONSTANTS } from './constants';
import { NoBudgetFoundException } from './exceptions';
import { createMonetaryValue, formatCurrency } from '../../common/utils';

/**
 * Budget with category relation included
 */
interface BudgetWithCategory extends Budget {
  category: {
    id: string;
    name: string;
  };
  currency: Currency;
}

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a budget by user ID and category name
   */
  async getBudget(userId: string, categoryName: string): Promise<BudgetWithCategory | null> {
    const budget = await this.prisma.budget.findFirst({
      where: {
        userId,
        isActive: true,
        category: {
          name: categoryName,
        },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return budget;
  }

  /**
   * Get a budget by user ID and category ID
   */
  async getBudgetByCategoryId(
    userId: string,
    categoryId: string,
  ): Promise<BudgetWithCategory | null> {
    const budget = await this.prisma.budget.findFirst({
      where: {
        userId,
        categoryId,
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return budget;
  }

  /**
   * Get all active budgets for a user
   */
  async getAllBudgets(userId: string): Promise<BudgetWithCategory[]> {
    const budgets = await this.prisma.budget.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        category: {
          name: 'asc',
        },
      },
    });

    return budgets;
  }

  /**
   * Calculate amount spent in a category for the current budget period
   */
  async getSpent(
    userId: string,
    categoryId: string,
    period: BudgetPeriod = 'MONTHLY',
  ): Promise<number> {
    const periodStart = this.getPeriodStartDate(period);

    const result = await this.prisma.expense.aggregate({
      where: {
        userId,
        categoryId,
        date: {
          gte: periodStart,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount || 0);
  }

  /**
   * Get the net rebalance adjustment for a category in the current period.
   * Positive = budget was increased (received funds), Negative = budget was decreased (gave funds).
   */
  async getRebalanceAdjustment(
    userId: string,
    categoryId: string,
    period: BudgetPeriod = 'MONTHLY',
  ): Promise<number> {
    const periodStart = this.getPeriodStartDate(period);

    // Money received INTO this category
    const received = await this.prisma.budgetRebalance.aggregate({
      where: { userId, toCategoryId: categoryId, isActive: true, createdAt: { gte: periodStart } },
      _sum: { amount: true },
    });

    // Money sent FROM this category
    const sent = await this.prisma.budgetRebalance.aggregate({
      where: { userId, fromCategoryId: categoryId, isActive: true, createdAt: { gte: periodStart } },
      _sum: { amount: true },
    });

    return Number(received._sum.amount ?? 0) - Number(sent._sum.amount ?? 0);
  }

  /**
   * Get effective budget amount for a category (base amount + active rebalances)
   */
  async getEffectiveBudgetAmount(
    userId: string,
    categoryId: string,
    baseAmount: number | { toString(): string },
    period: BudgetPeriod = 'MONTHLY',
  ): Promise<number> {
    const adj = await this.getRebalanceAdjustment(userId, categoryId, period);
    return Number(baseAmount) + adj;
  }

  /**
   * Calculate amount spent in a category within a specific date range
   */
  async getSpentInRange(
    userId: string,
    categoryId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      where: {
        userId,
        categoryId,
        date: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount || 0);
  }

  /**
   * Check budget status for a specific category
   *
   * Accepts either category name (e.g., "Food & Dining") or category ID (e.g., "food-dining").
   * Returns the budget status with trigger level based on spending thresholds.
   * All monetary values include formatted currency strings (e.g., "₦50,000").
   */
  async checkBudgetStatus(userId: string, categoryNameOrId: string): Promise<BudgetStatus> {
    // Try to find budget by category ID first, then by name
    let budget = await this.getBudgetByCategoryId(userId, categoryNameOrId);

    if (!budget) {
      // Fall back to searching by category name
      budget = await this.getBudget(userId, categoryNameOrId);
    }

    if (!budget) {
      // Provide helpful error with available categories
      const availableBudgets = await this.getAllBudgets(userId);
      const availableCategories = availableBudgets.map((b) => ({
        id: b.category.id,
        name: b.category.name,
      }));

      throw new NoBudgetFoundException(categoryNameOrId, userId, availableCategories);
    }

    const spentAmount = await this.getSpent(userId, budget.categoryId, budget.period);
    const rebalanceAdjustment = await this.getRebalanceAdjustment(userId, budget.categoryId, budget.period);
    const budgetedAmount = Number(budget.amount) + rebalanceAdjustment;
    const remainingAmount = budgetedAmount - spentAmount;
    const spentPercentage = budgetedAmount > 0 ? spentAmount / budgetedAmount : 0;

    // Get currency from budget (defaults to NGN)
    const currency = budget.currency || 'NGN';

    // Determine trigger level
    let trigger: BudgetTrigger;
    if (spentPercentage >= GPS_CONSTANTS.BUDGET_CRITICAL_THRESHOLD) {
      trigger = 'BUDGET_CRITICAL';
    } else if (spentPercentage >= GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD) {
      trigger = 'BUDGET_EXCEEDED';
    } else if (spentPercentage >= GPS_CONSTANTS.BUDGET_WARNING_THRESHOLD) {
      trigger = 'BUDGET_WARNING';
    } else {
      // Under budget - still return status but with no trigger
      trigger = 'BUDGET_WARNING'; // Default to warning for under-budget cases
    }

    const overagePercent = Math.max(0, (spentPercentage - 1) * 100);

    this.logger.debug(
      `[checkBudgetStatus] User ${userId}, category ${budget.category.name} (${categoryNameOrId}): ` +
        `budgeted=${budgetedAmount}, spent=${spentAmount}, trigger=${trigger}`,
    );

    // Create MonetaryValue objects with formatted currency strings
    return {
      category: budget.category.name,
      categoryId: budget.categoryId,
      budgeted: createMonetaryValue(budgetedAmount, currency),
      spent: createMonetaryValue(spentAmount, currency),
      remaining: createMonetaryValue(remainingAmount, currency),
      overagePercent,
      trigger,
      period: budget.period,
    };
  }

  /**
   * Check if any budgets are exceeded for a user
   *
   * Returns all budgets that are at WARNING level or higher.
   */
  async checkAllBudgetStatuses(userId: string): Promise<BudgetStatus[]> {
    const budgets = await this.getAllBudgets(userId);
    const statuses: BudgetStatus[] = [];

    for (const budget of budgets) {
      try {
        const status = await this.checkBudgetStatus(userId, budget.category.name);
        statuses.push(status);
      } catch (error) {
        this.logger.warn(
          `Failed to check budget status for category ${budget.category.name}: ${error}`,
        );
      }
    }

    // Return only those at warning level or higher
    return statuses.filter((status) => {
      const budgetedAmount = status.budgeted.amount;
      const spentAmount = status.spent.amount;
      const spentPercentage = budgetedAmount > 0 ? spentAmount / budgetedAmount : 0;
      return spentPercentage >= GPS_CONSTANTS.BUDGET_WARNING_THRESHOLD;
    });
  }

  /**
   * Create or update a budget for a category
   */
  async upsertBudget(
    userId: string,
    categoryId: string,
    amount: number,
    period: BudgetPeriod = 'MONTHLY',
  ): Promise<Budget> {
    const budget = await this.prisma.budget.upsert({
      where: {
        userId_categoryId_period: {
          userId,
          categoryId,
          period,
        },
      },
      update: {
        amount: new Decimal(amount),
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        categoryId,
        amount: new Decimal(amount),
        period,
        isActive: true,
      },
    });

    this.logger.log(
      `[upsertBudget] User ${userId}: budget for category ${categoryId} set to ${amount} (${period})`,
    );

    return budget;
  }

  /**
   * Deactivate a budget
   */
  async deactivateBudget(userId: string, budgetId: string): Promise<void> {
    await this.prisma.budget.update({
      where: {
        id: budgetId,
        userId, // Ensure user owns the budget
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`[deactivateBudget] User ${userId}: budget ${budgetId} deactivated`);
  }

  /**
   * Calculate the overspend amount for a category
   */
  async calculateOverspend(userId: string, categoryName: string): Promise<number> {
    const status = await this.checkBudgetStatus(userId, categoryName);
    return Math.max(0, status.spent.amount - status.budgeted.amount);
  }

  /**
   * Get the start date for a budget period
   */
  getPeriodStartDate(period: BudgetPeriod): Date {
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
  }

  /**
   * Get average monthly spending in a category over the past N months
   *
   * Used to estimate savings from freezing a category.
   */
  async getAverageMonthlySpending(
    userId: string,
    categoryId: string,
    months: number = 3,
  ): Promise<number> {
    const startDate = subMonths(new Date(), months);

    const result = await this.prisma.expense.aggregate({
      where: {
        userId,
        categoryId,
        date: {
          gte: startDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const totalSpent = Number(result._sum.amount || 0);
    return totalSpent / months;
  }

  /**
   * Get the end date for a budget period
   */
  getPeriodEndDate(period: BudgetPeriod): Date {
    const now = new Date();

    switch (period) {
      case 'WEEKLY':
        return endOfWeek(now, { weekStartsOn: 1 });
      case 'MONTHLY':
        return endOfMonth(now);
      case 'QUARTERLY':
        return endOfQuarter(now);
      case 'ANNUALLY':
        return endOfYear(now);
      default:
        return endOfMonth(now);
    }
  }

  /**
   * Get weekly breakdown of a budget for a specific category
   *
   * Splits the monthly budget period into calendar weeks (Mon-Sun),
   * calculates spending per week, and provides daily guidance for
   * the current week. Future weeks are adjusted based on remaining budget.
   */
  async getWeeklyBreakdown(
    userId: string,
    categoryId: string,
  ): Promise<WeeklyBreakdown> {
    // Resolve budget by category ID or name
    let budget = await this.getBudgetByCategoryId(userId, categoryId);
    if (!budget) {
      budget = await this.getBudget(userId, categoryId);
    }

    if (!budget) {
      const availableBudgets = await this.getAllBudgets(userId);
      const availableCategories = availableBudgets.map((b) => ({
        id: b.category.id,
        name: b.category.name,
      }));
      throw new NoBudgetFoundException(categoryId, userId, availableCategories);
    }

    const monthlyBudget = await this.getEffectiveBudgetAmount(userId, budget.categoryId, budget.amount, budget.period);
    const currency = budget.currency || 'NGN';
    const periodStart = this.getPeriodStartDate(budget.period);
    const periodEnd = this.getPeriodEndDate(budget.period);
    const now = new Date();
    const today = startOfDay(now);

    // Build calendar weeks within the budget period (Mon-Sun)
    const weeks: WeekBreakdown[] = [];
    let weekStart = startOfWeek(periodStart, { weekStartsOn: 1 });

    // If week starts before period, clamp to period start
    if (weekStart < periodStart) {
      weekStart = periodStart;
    }

    let weekNumber = 1;
    while (weekStart <= periodEnd) {
      let weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      // Clamp week end to period end
      if (weekEnd > periodEnd) {
        weekEnd = periodEnd;
      }

      weeks.push({
        weekNumber,
        startDate: weekStart,
        endDate: weekEnd,
        allocated: 0,
        spent: 0,
        remaining: 0,
        status: 'on_track',
      });

      weekNumber++;
      // Move to next Monday
      weekStart = addDays(endOfWeek(weekStart, { weekStartsOn: 1 }), 1);
      if (weekStart > periodEnd) break;
    }

    const totalWeeks = weeks.length;
    const weeklyAllocation = totalWeeks > 0 ? monthlyBudget / totalWeeks : monthlyBudget;

    // Calculate spending for each week
    let totalSpent = 0;
    let currentWeekIndex = -1;

    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      const spent = await this.getSpentInRange(
        userId,
        budget.categoryId,
        startOfDay(week.startDate),
        endOfDay(week.endDate),
      );
      week.spent = spent;
      totalSpent += spent;

      // Determine if this is the current week
      if (today >= startOfDay(week.startDate) && today <= endOfDay(week.endDate)) {
        currentWeekIndex = i;
      }

      // For past and current weeks: use base allocation
      week.allocated = weeklyAllocation;
      week.remaining = week.allocated - week.spent;

      // Status based on spending vs allocation
      const ratio = week.allocated > 0 ? week.spent / week.allocated : 0;
      if (ratio > 1) {
        week.status = 'over';
      } else if (ratio >= 0.8) {
        week.status = 'on_track';
      } else {
        week.status = 'under';
      }
    }

    // Adjusted weekly budget for remaining weeks
    const remainingBudget = monthlyBudget - totalSpent;
    const remainingWeeks = weeks.filter((_, i) => i > currentWeekIndex).length;
    const adjustedWeeklyBudget = remainingWeeks > 0
      ? Math.max(0, remainingBudget / remainingWeeks)
      : 0;

    // Update future weeks with adjusted allocation
    for (let i = currentWeekIndex + 1; i < weeks.length; i++) {
      weeks[i].allocated = adjustedWeeklyBudget;
      weeks[i].remaining = adjustedWeeklyBudget;
    }

    // Build current week info
    let currentWeek: CurrentWeekInfo;
    if (currentWeekIndex >= 0) {
      const cw = weeks[currentWeekIndex];
      const daysRemainingInWeek = Math.max(
        1,
        differenceInDays(endOfDay(cw.endDate), today) + 1,
      );
      const remainingInWeek = Math.max(0, cw.allocated - cw.spent);
      const dailyLimit = remainingInWeek / daysRemainingInWeek;

      // Get today's spending
      const spentToday = await this.getSpentInRange(
        userId,
        budget.categoryId,
        startOfDay(now),
        endOfDay(now),
      );

      currentWeek = {
        weekNumber: cw.weekNumber,
        dailyLimit: Math.round(dailyLimit * 100) / 100,
        spentToday,
        daysRemaining: daysRemainingInWeek,
      };
    } else {
      currentWeek = {
        weekNumber: 0,
        dailyLimit: 0,
        spentToday: 0,
        daysRemaining: 0,
      };
    }

    this.logger.debug(
      `[getWeeklyBreakdown] User ${userId}, category ${budget.category.name}: ` +
        `${totalWeeks} weeks, spent=${totalSpent}, adjusted=${adjustedWeeklyBudget}`,
    );

    return {
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      monthlyBudget,
      totalSpent,
      currency,
      weeks,
      currentWeek,
      adjustedWeeklyBudget: Math.round(adjustedWeeklyBudget * 100) / 100,
    };
  }

  /**
   * Get daily spending limits for all budgeted categories
   *
   * For each active budget, calculates today's safe spending limit
   * based on remaining budget divided by remaining days in the period.
   * Also queries today's actual spending per category.
   */
  async getDailyLimits(userId: string): Promise<DailyLimit[]> {
    const budgets = await this.getAllBudgets(userId);
    const now = new Date();
    const limits: DailyLimit[] = [];

    for (const budget of budgets) {
      const budgetAmount = await this.getEffectiveBudgetAmount(userId, budget.categoryId, budget.amount, budget.period);
      const spentAmount = await this.getSpent(userId, budget.categoryId, budget.period);
      const remaining = budgetAmount - spentAmount;
      const currency = budget.currency || 'NGN';

      // Days remaining in the budget period
      const periodEnd = this.getPeriodEndDate(budget.period);
      const daysRemaining = Math.max(1, differenceInDays(periodEnd, now) + 1);

      // Daily limit = remaining / days left
      const dailyLimit = Math.max(0, remaining / daysRemaining);

      // Today's spending
      const spentToday = await this.getSpentInRange(
        userId,
        budget.categoryId,
        startOfDay(now),
        endOfDay(now),
      );

      // Status: green if under daily limit, yellow if close, red if over
      let status: 'under' | 'on_track' | 'over';
      if (dailyLimit <= 0 || spentToday > dailyLimit) {
        status = 'over';
      } else if (spentToday >= dailyLimit * 0.8) {
        status = 'on_track';
      } else {
        status = 'under';
      }

      limits.push({
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        dailyLimit: Math.round(dailyLimit * 100) / 100,
        spentToday,
        remaining: Math.round(remaining * 100) / 100,
        daysRemaining,
        currency,
        status,
      });
    }

    // Sort: over-limit first, then on_track, then under
    const statusOrder = { over: 0, on_track: 1, under: 2 };
    limits.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    this.logger.debug(
      `[getDailyLimits] User ${userId}: ${limits.length} categories, ` +
        `${limits.filter((l) => l.status === 'over').length} over limit`,
    );

    return limits;
  }

  /**
   * Find all budget categories with surplus (spending below prorated budget)
   *
   * Returns categories where the user is under budget, prorated for the
   * remaining days in the period. Used by Smart Swap to identify source
   * categories for budget rebalancing.
   */
  async findCategoriesWithSurplus(
    userId: string,
    excludeCategoryId?: string,
  ): Promise<Array<{
    categoryId: string;
    categoryName: string;
    budgeted: number;
    spent: number;
    surplus: number;
    proratedSurplus: number;
    currency: string;
  }>> {
    const budgets = await this.getAllBudgets(userId);

    const results: Array<{
      categoryId: string;
      categoryName: string;
      budgeted: number;
      spent: number;
      surplus: number;
      proratedSurplus: number;
      currency: string;
    }> = [];

    for (const budget of budgets) {
      // Skip the overspent category itself
      if (excludeCategoryId && budget.categoryId === excludeCategoryId) {
        continue;
      }

      const budgetedAmount = await this.getEffectiveBudgetAmount(userId, budget.categoryId, budget.amount, budget.period);
      const spentAmount = await this.getSpent(userId, budget.categoryId, budget.period);
      const rawSurplus = budgetedAmount - spentAmount;

      // Only consider categories with actual surplus
      if (rawSurplus <= 0) continue;

      // Prorate surplus for remaining days in period
      const periodStart = this.getPeriodStartDate(budget.period);
      const periodEnd = this.getPeriodEndDate(budget.period);
      const now = new Date();

      const totalDays = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);
      const daysRemaining = Math.max(0, differenceInDays(periodEnd, now) + 1);
      const proratedSurplus = rawSurplus * (daysRemaining / totalDays);

      // Filter: prorated surplus must be meaningful (> MIN_SURPLUS_RATIO of budget)
      if (proratedSurplus <= budgetedAmount * GPS_CONSTANTS.MIN_SURPLUS_RATIO) {
        continue;
      }

      results.push({
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        budgeted: budgetedAmount,
        spent: spentAmount,
        surplus: rawSurplus,
        proratedSurplus,
        currency: budget.currency || 'USD',
      });
    }

    // Sort by prorated surplus descending (biggest surplus first)
    results.sort((a, b) => b.proratedSurplus - a.proratedSurplus);

    return results;
  }

  /**
   * Get the number of budget rebalances in the current period for a user
   *
   * Used to enforce the frequency cap (MAX_REBALANCES_PER_PERIOD).
   */
  async getRebalanceCountInPeriod(
    userId: string,
    period: BudgetPeriod = 'MONTHLY',
  ): Promise<number> {
    const periodStart = this.getPeriodStartDate(period);

    const count = await this.prisma.budgetRebalance.count({
      where: {
        userId,
        isActive: true,
        createdAt: { gte: periodStart },
      },
    });

    return count;
  }

  /**
   * Calculate spending velocity for a single budget category
   *
   * Returns velocity analysis including ratio, projected overspend date,
   * and course correction amount. Returns null if insufficient data
   * (e.g., budget period just started).
   */
  async calculateSpendingVelocity(
    userId: string,
    categoryId: string,
    period: BudgetPeriod = 'MONTHLY',
  ): Promise<SpendingVelocity | null> {
    const periodStart = this.getPeriodStartDate(period);
    const periodEnd = this.getPeriodEndDate(period);
    const now = new Date();

    const daysElapsed = Math.max(1, differenceInDays(now, periodStart));
    const daysRemaining = Math.max(0, differenceInDays(periodEnd, now));
    const totalDays = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);

    const totalSpent = await this.getSpent(userId, categoryId, period);
    const budget = await this.getBudgetByCategoryId(userId, categoryId);
    if (!budget) return null;

    const budgetAmount = await this.getEffectiveBudgetAmount(userId, budget.categoryId, budget.amount, period);
    if (budgetAmount <= 0) return null;

    const spendingVelocity = totalSpent / daysElapsed;
    const safeBurnRate = budgetAmount / totalDays;
    const velocityRatio = safeBurnRate > 0 ? spendingVelocity / safeBurnRate : 0;

    // Project when budget will be exceeded at current pace
    const remainingBudget = budgetAmount - totalSpent;
    let projectedOverspendDate: Date | null = null;
    let willOverspend = false;

    if (remainingBudget > 0 && spendingVelocity > 0) {
      const daysUntilOverspend = remainingBudget / spendingVelocity;
      if (daysUntilOverspend <= daysRemaining) {
        projectedOverspendDate = addDays(now, Math.ceil(daysUntilOverspend));
        willOverspend = true;
      }
    } else if (remainingBudget <= 0) {
      // Already overspent
      willOverspend = true;
      projectedOverspendDate = now;
    }

    // Course correction: how much to spend per day to stay within remaining budget
    const courseCorrectionDaily = daysRemaining > 0
      ? Math.max(0, remainingBudget / daysRemaining)
      : 0;

    return {
      velocityRatio,
      spendingVelocity,
      safeBurnRate,
      daysElapsed,
      daysRemaining,
      projectedOverspendDate,
      courseCorrectionDaily,
      willOverspend,
    };
  }

  /**
   * Find all budget categories with spending drift
   *
   * Applies all guardrail thresholds from DRIFT_DETECTION config.
   * Skips already-exceeded budgets (reactive alerts handle those).
   * Returns drifting categories sorted by urgency (soonest overspend first).
   */
  async findCategoriesWithDrift(
    userId: string,
  ): Promise<Array<{
    categoryId: string;
    categoryName: string;
    velocity: SpendingVelocity;
    budgetAmount: number;
    spentAmount: number;
    currency: string;
  }>> {
    const budgets = await this.getAllBudgets(userId);
    const { DRIFT_DETECTION } = GPS_CONSTANTS;

    const results: Array<{
      categoryId: string;
      categoryName: string;
      velocity: SpendingVelocity;
      budgetAmount: number;
      spentAmount: number;
      currency: string;
    }> = [];

    for (const budget of budgets) {
      const budgetAmount = await this.getEffectiveBudgetAmount(userId, budget.categoryId, budget.amount, budget.period);
      const spentAmount = await this.getSpent(userId, budget.categoryId, budget.period);

      // Skip already-exceeded budgets — reactive alerts handle those
      if (spentAmount >= budgetAmount) continue;

      const velocity = await this.calculateSpendingVelocity(
        userId,
        budget.categoryId,
        budget.period,
      );
      if (!velocity) continue;

      // Apply guardrails
      if (velocity.daysElapsed < DRIFT_DETECTION.MIN_ELAPSED_DAYS) continue;
      if (velocity.daysRemaining < DRIFT_DETECTION.MIN_DAYS_REMAINING) continue;
      if (velocity.velocityRatio < DRIFT_DETECTION.VELOCITY_RATIO_THRESHOLD) continue;
      if (!velocity.willOverspend) continue;

      // Check alert horizon: only alert if overspend projected within N days
      if (velocity.projectedOverspendDate) {
        const daysUntilOverspend = differenceInDays(velocity.projectedOverspendDate, new Date());
        if (daysUntilOverspend > DRIFT_DETECTION.ALERT_HORIZON_DAYS) continue;
      }

      results.push({
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        velocity,
        budgetAmount,
        spentAmount,
        currency: budget.currency || 'USD',
      });
    }

    // Sort by urgency: soonest projected overspend first
    results.sort((a, b) => {
      const dateA = a.velocity.projectedOverspendDate?.getTime() ?? Infinity;
      const dateB = b.velocity.projectedOverspendDate?.getTime() ?? Infinity;
      return dateA - dateB;
    });

    return results;
  }

  /**
   * Get proactive spending forecast for a single budget category
   *
   * Calculates daily spending rate, projects end-of-period spending,
   * and determines risk level. Used to warn users BEFORE they overspend.
   */
  async getProactiveForecast(
    userId: string,
    categoryId: string,
  ): Promise<BudgetForecast | null> {
    const budget = await this.getBudgetByCategoryId(userId, categoryId);
    if (!budget) return null;

    const budgetAmount = await this.getEffectiveBudgetAmount(userId, budget.categoryId, budget.amount, budget.period);
    if (budgetAmount <= 0) return null;

    const periodStart = this.getPeriodStartDate(budget.period);
    const periodEnd = this.getPeriodEndDate(budget.period);
    const now = new Date();

    const totalDaysInPeriod = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);
    const daysElapsed = Math.max(1, differenceInDays(now, periodStart));
    const daysRemaining = Math.max(0, differenceInDays(periodEnd, now));

    const totalSpent = await this.getSpent(userId, categoryId, budget.period);

    // Calculate daily spending rate
    const dailyRate = totalSpent / daysElapsed;

    // Project end-of-period spending
    const projectedTotal = dailyRate * totalDaysInPeriod;
    const projectedOverage = Math.max(0, projectedTotal - budgetAmount);

    // Calculate days until projected spending crosses budget
    let daysUntilExceed: number | null = null;
    if (dailyRate > 0 && totalSpent < budgetAmount) {
      const remainingBudget = budgetAmount - totalSpent;
      const daysToExceed = remainingBudget / dailyRate;
      if (daysToExceed <= daysRemaining) {
        daysUntilExceed = Math.ceil(daysToExceed);
      }
    } else if (totalSpent >= budgetAmount) {
      daysUntilExceed = 0; // Already exceeded
    }

    // Suggested daily limit to stay within remaining budget
    const suggestedDailyLimit = daysRemaining > 0
      ? Math.max(0, (budgetAmount - totalSpent) / daysRemaining)
      : 0;

    // Determine risk level based on projected spending
    const projectedRatio = projectedTotal / budgetAmount;
    let riskLevel: ForecastRiskLevel;
    if (projectedRatio < 0.8) {
      riskLevel = 'safe';
    } else if (projectedRatio <= 1.0) {
      riskLevel = 'caution';
    } else {
      riskLevel = 'warning';
    }

    const currency = budget.currency || 'USD';

    return {
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      budgeted: budgetAmount,
      spent: totalSpent,
      projectedTotal: Math.round(projectedTotal * 100) / 100,
      projectedOverage: Math.round(projectedOverage * 100) / 100,
      daysUntilExceed,
      suggestedDailyLimit: Math.round(suggestedDailyLimit * 100) / 100,
      riskLevel,
      currency,
    };
  }

  /**
   * Get proactive forecasts for ALL budgeted categories for a user
   *
   * Returns forecast data for every active budget, sorted by risk (warning first).
   */
  async getAllProactiveForecasts(userId: string): Promise<BudgetForecast[]> {
    const budgets = await this.getAllBudgets(userId);
    const forecasts: BudgetForecast[] = [];

    for (const budget of budgets) {
      try {
        const forecast = await this.getProactiveForecast(userId, budget.categoryId);
        if (forecast) {
          forecasts.push(forecast);
        }
      } catch (error) {
        this.logger.warn(
          `[getAllProactiveForecasts] Failed for category ${budget.category.name}: ${error}`,
        );
      }
    }

    // Sort by risk: warning > caution > safe
    const riskOrder: Record<ForecastRiskLevel, number> = { warning: 0, caution: 1, safe: 2 };
    forecasts.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    return forecasts;
  }


  // ==========================================
  // BUDGET REALISM ANALYSIS
  // ==========================================

  /**
   * Analyze budget realism based on spending history
   *
   * For each budget category, looks at the last 3 months of spending
   * to detect unrealistic budgets. A budget is flagged as unrealistic if:
   * - Average spending exceeds budgeted amount by 15%+ AND
   * - Spending exceeded budget in at least 2 of the last 3 months
   *
   * For each unrealistic budget, suggests an adjustment with offset
   * from the category with the highest average surplus.
   */
  async analyzeBudgetRealism(userId: string): Promise<BudgetInsight[]> {
    const budgets = await this.getAllBudgets(userId);
    if (budgets.length === 0) return [];

    const now = new Date();
    const threeMonthsAgo = subMonths(now, 3);
    const insights: BudgetInsight[] = [];

    // Collect per-category monthly spending and surplus data
    const categoryData: Array<{
      categoryId: string;
      categoryName: string;
      budgetedAmount: number;
      monthlySpending: { month: string; spent: number }[];
      averageSpent: number;
      averageSurplus: number;
    }> = [];

    for (const budget of budgets) {
      const rebalanceAdj = await this.getRebalanceAdjustment(userId, budget.categoryId, 'MONTHLY');
      const budgetedAmount = Number(budget.amount) + rebalanceAdj;

      // Query expenses grouped by month for last 3 months
      const expenses = await this.prisma.expense.findMany({
        where: {
          userId,
          categoryId: budget.categoryId,
          date: { gte: threeMonthsAgo },
        },
        select: {
          amount: true,
          date: true,
        },
        orderBy: { date: 'asc' },
      });

      // Group expenses by month
      const monthlyMap = new Map<string, number>();

      // Initialize the last 3 months with 0
      for (let i = 2; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthKey = format(monthDate, 'yyyy-MM');
        monthlyMap.set(monthKey, 0);
      }

      // Sum expenses into their months
      for (const expense of expenses) {
        const monthKey = format(expense.date, 'yyyy-MM');
        if (monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Number(expense.amount));
        }
      }

      const monthlySpending = Array.from(monthlyMap.entries()).map(([month, spent]) => ({
        month,
        spent: Math.round(spent * 100) / 100,
      }));

      // Only average over months that have actual spending (not padded $0 months)
      const activeMonths = monthlySpending.filter((m) => m.spent > 0);
      const totalSpent = activeMonths.reduce((sum, m) => sum + m.spent, 0);
      const averageSpent = activeMonths.length > 0 ? totalSpent / activeMonths.length : 0;
      const averageSurplus = budgetedAmount - averageSpent;

      categoryData.push({
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        budgetedAmount,
        monthlySpending,
        averageSpent,
        averageSurplus,
      });
    }

    // Find categories with the highest surplus (for offset suggestions)
    const surplusCategories = categoryData
      .filter((c) => c.averageSurplus > 0)
      .sort((a, b) => b.averageSurplus - a.averageSurplus);

    // Determine current month key for current-month detection
    const currentMonthKey = format(now, 'yyyy-MM');

    // Analyze each category for unrealistic budgets
    for (const data of categoryData) {
      const { categoryId, categoryName, budgetedAmount, monthlySpending, averageSpent } = data;

      // Count months with actual spending that exceeded budget
      const activeMonthsForCategory = monthlySpending.filter((m) => m.spent > 0);
      const monthsExceeded = activeMonthsForCategory.filter((m) => m.spent > budgetedAmount).length;

      // Current month spending (may be partial — only days elapsed so far)
      const currentMonthData = monthlySpending.find((m) => m.month === currentMonthKey);
      const currentMonthSpent = currentMonthData?.spent ?? 0;

      // Flag as unrealistic if:
      // 1. Historical pattern: average exceeds budget by 15%+ AND 2+ months exceeded, OR
      // 2. Historical + single spike: average exceeds by 15%+ AND 1 month exceeded by >30%, OR
      // 3. Current month already exceeds budget (you've already blown past it this month)
      const historicallyUnrealistic = averageSpent > budgetedAmount * 1.15 &&
        (monthsExceeded >= 2 || (monthsExceeded >= 1 && averageSpent > budgetedAmount * 1.3));
      const currentMonthExceeded = currentMonthSpent > budgetedAmount;

      if (!historicallyUnrealistic && !currentMonthExceeded) continue;

      // Use the higher of average or current-month spending for the suggestion
      const referenceSpent = Math.max(averageSpent, currentMonthSpent);

      // Calculate suggested budget: round up to nearest $10 with 5% buffer
      const suggestedBudget = Math.ceil((referenceSpent * 1.05) / 10) * 10;
      const increaseAmount = suggestedBudget - budgetedAmount;

      // Find the best offset category (highest surplus, excluding current category)
      const offsetCategory = surplusCategories.find((c) => c.categoryId !== categoryId);

      let offsetSuggestion: BudgetInsight['offsetSuggestion'] | undefined;
      if (offsetCategory && offsetCategory.averageSurplus >= increaseAmount) {
        offsetSuggestion = {
          categoryId: offsetCategory.categoryId,
          categoryName: offsetCategory.categoryName,
          currentBudget: offsetCategory.budgetedAmount,
          suggestedReduction: increaseAmount,
          averageSurplus: Math.round(offsetCategory.averageSurplus * 100) / 100,
        };
      }

      // Build human-readable message
      const budgetFormatted = Math.round(budgetedAmount);
      let message: string;
      if (currentMonthExceeded && !historicallyUnrealistic) {
        // Current-month blowout but historically OK
        message = `You've already spent $${Math.round(currentMonthSpent)} on ${categoryName} this month — over your $${budgetFormatted} budget`;
      } else {
        // Historical pattern
        const avgFormatted = Math.round(averageSpent);
        message = `You've averaged $${avgFormatted}/month on ${categoryName} but your budget is $${budgetFormatted}`;
      }
      if (offsetSuggestion) {
        message += `. Adjust to $${suggestedBudget}? (offset by reducing ${offsetSuggestion.categoryName} from $${Math.round(offsetSuggestion.currentBudget)} to $${Math.round(offsetSuggestion.currentBudget - increaseAmount)})`;
      }

      insights.push({
        id: `insight_${categoryId}_${Date.now()}`,
        type: currentMonthExceeded && !historicallyUnrealistic ? 'CURRENT_MONTH_EXCEEDED' : 'UNREALISTIC_BUDGET',
        category: categoryName,
        categoryId,
        budgeted: budgetedAmount,
        averageSpent: Math.round(averageSpent * 100) / 100,
        monthsExceeded,
        monthlyHistory: monthlySpending,
        suggestedBudget,
        offsetSuggestion,
        message,
      });
    }

    this.logger.log(
      `[analyzeBudgetRealism] User ${userId}: found ${insights.length} unrealistic budgets out of ${budgets.length} total`,
    );

    return insights;
  }

  /**
   * Apply a budget insight adjustment
   *
   * Updates both budgets in a transaction:
   * - Increases the underfunded category budget
   * - Decreases the surplus category budget (if offset provided)
   *
   * Returns the updated budgets.
   */
  async applyBudgetInsight(
    userId: string,
    input: ApplyBudgetInsightInput,
  ): Promise<{ updated: Array<{ categoryId: string; newAmount: number }> }> {
    const { categoryId, suggestedBudget, offsetCategoryId, offsetAmount } = input;

    const results = await this.prisma.$transaction(async (tx) => {
      const updated: Array<{ categoryId: string; newAmount: number }> = [];

      // Update the underfunded category budget
      await tx.budget.updateMany({
        where: {
          userId,
          categoryId,
          isActive: true,
        },
        data: {
          amount: new Decimal(suggestedBudget),
          updatedAt: new Date(),
        },
      });
      updated.push({ categoryId, newAmount: suggestedBudget });

      // If offset category provided, reduce its budget
      if (offsetCategoryId && offsetAmount && offsetAmount > 0) {
        const offsetBudget = await tx.budget.findFirst({
          where: {
            userId,
            categoryId: offsetCategoryId,
            isActive: true,
          },
        });

        if (offsetBudget) {
          const newOffsetAmount = Math.max(0, Number(offsetBudget.amount) - offsetAmount);
          await tx.budget.updateMany({
            where: {
              userId,
              categoryId: offsetCategoryId,
              isActive: true,
            },
            data: {
              amount: new Decimal(newOffsetAmount),
              updatedAt: new Date(),
            },
          });
          updated.push({ categoryId: offsetCategoryId, newAmount: newOffsetAmount });
        }
      }

      return updated;
    });

    this.logger.log(
      `[applyBudgetInsight] User ${userId}: applied budget insight for category ${categoryId}, ` +
        `new budget: ${suggestedBudget}${offsetCategoryId ? `, offset from ${offsetCategoryId} by ${offsetAmount}` : ''}`,
    );

    return { updated: results };
  }


  /**
   * Get a detailed spending breakdown for a budget category
   *
   * Groups expenses by merchant (or description if no merchant),
   * shows top 5 subcategories, and generates an actionable insight.
   */
  async getSpendingBreakdown(userId: string, categoryId: string): Promise<SpendingBreakdown> {
    // Resolve category by ID or name
    let budget = await this.getBudgetByCategoryId(userId, categoryId);
    if (!budget) {
      budget = await this.getBudget(userId, categoryId);
    }

    if (!budget) {
      throw new NoBudgetFoundException(categoryId, userId, []);
    }

    const periodStart = this.getPeriodStartDate(budget.period);
    const budgetedAmount = await this.getEffectiveBudgetAmount(userId, budget.categoryId, budget.amount, budget.period);

    // Get all expenses in this category for the current period
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        categoryId: budget.categoryId,
        date: { gte: periodStart },
      },
      select: {
        amount: true,
        merchant: true,
        description: true,
      },
    });

    // Group by merchant (or description fragment)
    const groups: Record<string, { amount: number; count: number }> = {};
    let totalSpent = 0;

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      totalSpent += amount;

      // Use merchant if available, otherwise extract a label from description
      let label = expense.merchant || '';
      if (!label && expense.description) {
        // Take the first 3 meaningful words of the description
        label = expense.description.split(/\s+/).slice(0, 3).join(' ');
      }
      if (!label) {
        label = 'Other';
      }

      if (!groups[label]) {
        groups[label] = { amount: 0, count: 0 };
      }
      groups[label].amount += amount;
      groups[label].count += 1;
    }

    // Sort by amount descending, take top 5
    const sorted = Object.entries(groups)
      .map(([label, data]) => ({
        label,
        amount: Math.round(data.amount * 100) / 100,
        percent: totalSpent > 0 ? Math.round((data.amount / totalSpent) * 100) : 0,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Generate insight from the biggest subcategory
    let insight = 'Not enough spending data to generate insights yet.';
    if (sorted.length > 0) {
      const top = sorted[0];
      const potentialSavings = Math.round(top.amount * 0.3); // Assume 30% reduction is realistic
      if (top.percent >= 20) {
        insight = `${top.label} is ${top.percent}% of your ${budget.category.name} spend. Reducing it could save ~$${potentialSavings}/month.`;
      } else {
        insight = `Your ${budget.category.name} spending is fairly distributed. ${top.label} leads at ${top.percent}%.`;
      }
    }

    return {
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      totalSpent: Math.round(totalSpent * 100) / 100,
      budgeted: budgetedAmount,
      breakdown: sorted,
      insight,
    };
  }


  /**
   * Quick rebalance: move budget from one category to another
   *
   * Lightweight alternative to the full recovery flow. No Monte Carlo,
   * no recovery session, no multi-step flow. User picks source, amount, done.
   */
  async quickRebalance(
    userId: string,
    fromCategoryId: string,
    toCategoryId: string,
    amount: number,
  ): Promise<{
    fromCategory: string;
    toCategory: string;
    amount: { amount: number; formatted: string; currency: string };
    fromRemaining: { amount: number; formatted: string; currency: string };
    toNewRemaining: { amount: number; formatted: string; currency: string };
    message: string;
  }> {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Validate same category
    if (fromCategoryId === toCategoryId) {
      throw new Error('Source and destination categories must be different');
    }

    // Get source budget
    const fromBudget = await this.getBudgetByCategoryId(userId, fromCategoryId);
    if (!fromBudget) {
      throw new NoBudgetFoundException(fromCategoryId, userId, []);
    }

    // Get destination budget
    const toBudget = await this.getBudgetByCategoryId(userId, toCategoryId);
    if (!toBudget) {
      throw new NoBudgetFoundException(toCategoryId, userId, []);
    }

    // Get currency from budget
    const currency = fromBudget.currency || 'USD';

    // Validate source has sufficient remaining budget
    const fromBudgeted = Number(fromBudget.amount);
    const fromSpent = await this.getSpent(userId, fromCategoryId, fromBudget.period);
    const fromRemaining = fromBudgeted - fromSpent;

    if (fromRemaining < amount) {
      throw new Error(
        `Insufficient budget in ${fromBudget.category.name}. ` +
        `Available: ${formatCurrency(fromRemaining, currency)}, ` +
        `requested: ${formatCurrency(amount, currency)}`,
      );
    }

    // Check rebalance frequency cap
    const rebalanceCount = await this.getRebalanceCountInPeriod(userId);
    if (rebalanceCount >= GPS_CONSTANTS.MAX_REBALANCES_PER_PERIOD) {
      throw new Error(
        `Rebalance limit reached (${GPS_CONSTANTS.MAX_REBALANCES_PER_PERIOD} per period). ` +
        `Try again next period.`,
      );
    }

    // Create BudgetRebalance record (no sessionId for quick rebalance)
    await this.prisma.budgetRebalance.create({
      data: {
        userId,
        fromCategoryId,
        fromCategoryName: fromBudget.category.name,
        toCategoryId,
        toCategoryName: toBudget.category.name,
        amount,
        isActive: true,
      },
    });

    // Calculate new remaining for destination
    const toBudgeted = Number(toBudget.amount);
    const toSpent = await this.getSpent(userId, toCategoryId, toBudget.period);
    const toNewRemaining = (toBudgeted - toSpent) + amount;
    const fromNewRemaining = fromRemaining - amount;

    const formattedAmount = formatCurrency(amount, currency);

    this.logger.log(
      `[quickRebalance] User ${userId}: moved ${formattedAmount} from ${fromBudget.category.name} to ${toBudget.category.name}`,
    );

    return {
      fromCategory: fromBudget.category.name,
      toCategory: toBudget.category.name,
      amount: createMonetaryValue(amount, currency),
      fromRemaining: createMonetaryValue(fromNewRemaining, currency),
      toNewRemaining: createMonetaryValue(toNewRemaining, currency),
      message: `Done! ${formattedAmount} moved from ${fromBudget.category.name} to ${toBudget.category.name}`,
    };
  }

  /**
   * Get rebalance options: surplus categories available as source for quick rebalance
   *
   * Wraps findCategoriesWithSurplus with rebalance frequency cap info.
   */
  async getRebalanceOptions(
    userId: string,
    excludeCategoryId: string,
  ): Promise<{
    options: Array<{
      categoryId: string;
      categoryName: string;
      budgeted: number;
      spent: number;
      surplus: number;
      proratedSurplus: number;
      currency: string;
    }>;
    rebalancesUsed: number;
    maxRebalances: number;
    canRebalance: boolean;
  }> {
    const [surplusCategories, rebalancesUsed] = await Promise.all([
      this.findCategoriesWithSurplus(userId, excludeCategoryId),
      this.getRebalanceCountInPeriod(userId),
    ]);

    return {
      options: surplusCategories,
      rebalancesUsed,
      maxRebalances: GPS_CONSTANTS.MAX_REBALANCES_PER_PERIOD,
      canRebalance: rebalancesUsed < GPS_CONSTANTS.MAX_REBALANCES_PER_PERIOD,
    };
  }


}
