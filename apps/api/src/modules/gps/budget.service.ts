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
import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, subMonths } from 'date-fns';
import { BudgetStatus, BudgetTrigger } from './interfaces';
import { GPS_CONSTANTS } from './constants';
import { NoBudgetFoundException } from './exceptions';
import { createMonetaryValue } from '../../common/utils';

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
    const budgetedAmount = Number(budget.amount);
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
  private getPeriodStartDate(period: BudgetPeriod): Date {
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
}
