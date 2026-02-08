/**
 * Goal Service
 *
 * Manages financial goal operations for the GPS Re-Router feature.
 * Handles goal retrieval, deadline extension, and simulation input building.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Goal } from '@prisma/client';
import { addWeeks } from 'date-fns';
import { GpsNoActiveGoalException } from './exceptions';
import { SimulationInput, ECONOMIC_DEFAULTS } from '../finance/interfaces';

/**
 * Goal with computed fields
 */
interface GoalWithProgress extends Goal {
  progressPercent: number;
  amountRemaining: number;
}

@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the primary (highest priority) active goal for a user
   */
  async getPrimaryGoal(userId: string): Promise<Goal> {
    const goal = await this.prisma.goal.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (!goal) {
      throw new GpsNoActiveGoalException(userId);
    }

    return goal;
  }

  /**
   * Get a specific goal by ID
   */
  async getGoal(userId: string, goalId: string): Promise<Goal | null> {
    return this.prisma.goal.findFirst({
      where: {
        id: goalId,
        userId,
      },
    });
  }

  /**
   * Get all active goals for a user
   */
  async getActiveGoals(userId: string): Promise<Goal[]> {
    return this.prisma.goal.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get a goal with computed progress fields
   */
  async getGoalWithProgress(userId: string, goalId?: string): Promise<GoalWithProgress> {
    const goal = goalId
      ? await this.getGoal(userId, goalId)
      : await this.getPrimaryGoal(userId);

    if (!goal) {
      throw new GpsNoActiveGoalException(userId);
    }

    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const progressPercent = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const amountRemaining = Math.max(0, targetAmount - currentAmount);

    return {
      ...goal,
      progressPercent,
      amountRemaining,
    };
  }

  /**
   * Extend a goal's deadline by a specified number of weeks
   *
   * Used by the "Timeline Flex" recovery path.
   */
  async extendDeadline(userId: string, goalId: string, weeks: number): Promise<Goal> {
    const goal = await this.getGoal(userId, goalId);

    if (!goal) {
      throw new GpsNoActiveGoalException(userId);
    }

    const currentDeadline = goal.targetDate || new Date();
    const newDeadline = addWeeks(currentDeadline, weeks);

    const updatedGoal = await this.prisma.goal.update({
      where: {
        id: goalId,
        userId, // Ensure user owns the goal
      },
      data: {
        targetDate: newDeadline,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `[extendDeadline] User ${userId}, goal ${goalId}: ` +
        `extended deadline by ${weeks} weeks to ${newDeadline.toISOString()}`,
    );

    return updatedGoal;
  }

  /**
   * Build simulation input from user's financial data and goal
   *
   * This delegates to the finance service but provides a simplified interface
   * for the GPS Re-Router.
   */
  async getSimulationInput(userId: string, goalId?: string): Promise<SimulationInput> {
    // Get the goal (primary or specific)
    const goal = goalId
      ? await this.getGoal(userId, goalId)
      : await this.getPrimaryGoal(userId);

    if (!goal) {
      throw new GpsNoActiveGoalException(userId);
    }

    // Get user's financial data
    const [user, financialData] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { country: true, currency: true },
      }),
      this.aggregateFinancialData(userId),
    ]);

    // Calculate savings rate
    const monthlyIncome = Number(financialData.monthlyIncome);
    const monthlySavings = Number(financialData.monthlySavings);
    const currentSavingsRate = monthlyIncome > 0 ? Math.max(0, monthlySavings / monthlyIncome) : 0;

    // Calculate net worth — use the greater of liquid savings or goal progress
    // so the simulation starts from at least the goal's current amount
    const liquidSavings = Number(financialData.liquidSavings);
    const goalProgress = Number(goal.currentAmount);
    const effectiveSavings = Math.max(liquidSavings, goalProgress);
    const currentNetWorth = effectiveSavings - Number(financialData.totalDebt);

    // Get economic defaults based on country
    const defaults = this.getEconomicDefaults(user?.country);

    // Use goal's target date or default to 5 years from now
    const goalDeadline = goal.targetDate || new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);

    return {
      currentSavingsRate: Math.min(1, Math.max(0, currentSavingsRate)),
      monthlyIncome,
      currentNetWorth,
      goalAmount: Number(goal.targetAmount),
      goalDeadline,
      expectedReturnRate: defaults.expectedReturn,
      inflationRate: defaults.inflationRate,
      incomeGrowthRate: defaults.incomeGrowthRate,
    };
  }

  /**
   * Build adjusted simulation input with modified parameters
   *
   * Used to calculate probability for different recovery paths.
   */
  async getAdjustedSimulationInput(
    userId: string,
    goalId: string | undefined,
    adjustments: {
      weeksExtension?: number;
      additionalSavingsRate?: number;
      additionalMonthlySavings?: number;
    },
  ): Promise<SimulationInput> {
    const baseInput = await this.getSimulationInput(userId, goalId);

    // Apply adjustments
    let adjustedInput = { ...baseInput };

    // Extend deadline if specified
    if (adjustments.weeksExtension && adjustments.weeksExtension > 0) {
      adjustedInput.goalDeadline = addWeeks(baseInput.goalDeadline, adjustments.weeksExtension);
    }

    // Increase savings rate if specified
    if (adjustments.additionalSavingsRate && adjustments.additionalSavingsRate > 0) {
      adjustedInput.currentSavingsRate = Math.min(
        1,
        baseInput.currentSavingsRate + adjustments.additionalSavingsRate,
      );
    }

    // Add additional monthly savings (convert to savings rate increase)
    if (adjustments.additionalMonthlySavings && adjustments.additionalMonthlySavings > 0) {
      const additionalRate =
        baseInput.monthlyIncome > 0
          ? adjustments.additionalMonthlySavings / baseInput.monthlyIncome
          : 0;
      adjustedInput.currentSavingsRate = Math.min(
        1,
        adjustedInput.currentSavingsRate + additionalRate,
      );
    }

    return adjustedInput;
  }

  /**
   * Aggregate financial data for simulation input
   *
   * Simplified version of FinanceService.aggregateFinancialData
   */
  private async aggregateFinancialData(userId: string): Promise<{
    monthlyIncome: number;
    monthlySavings: number;
    liquidSavings: number;
    totalDebt: number;
  }> {
    const [incomeSources, recentExpenses, savingsAccounts, debts] = await Promise.all([
      this.prisma.incomeSource.findMany({
        where: { userId, isActive: true },
      }),
      this.prisma.expense.findMany({
        where: {
          userId,
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
      this.prisma.savingsAccount.findMany({
        where: { userId, isActive: true },
      }),
      this.prisma.debt.findMany({
        where: { userId, isActive: true },
      }),
    ]);

    // Calculate monthly income
    const monthlyIncome = incomeSources.reduce((sum, source) => {
      const multiplier = this.getMonthlyMultiplier(source.frequency);
      return sum + Number(source.amount) * multiplier;
    }, 0);

    // Calculate monthly expenses
    const monthlyExpenses = recentExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    // Calculate monthly savings
    const monthlySavings = monthlyIncome - monthlyExpenses;

    // Calculate liquid savings
    const liquidSavings = savingsAccounts.reduce(
      (sum, account) => sum + Number(account.balance),
      0,
    );

    // Calculate total debt
    const totalDebt = debts.reduce((sum, debt) => sum + Number(debt.remainingBalance), 0);

    return {
      monthlyIncome,
      monthlySavings,
      liquidSavings,
      totalDebt,
    };
  }

  /**
   * Get multiplier to convert frequency to monthly
   */
  private getMonthlyMultiplier(frequency: string): number {
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
  }

  /**
   * Get economic defaults based on country
   * Uses the canonical ECONOMIC_DEFAULTS from the finance module
   */
  private getEconomicDefaults(country?: string | null): {
    inflationRate: number;
    expectedReturn: number;
    incomeGrowthRate: number;
  } {
    const countryKey = country?.toUpperCase() || 'DEFAULT';
    const defaults = ECONOMIC_DEFAULTS[countryKey] || ECONOMIC_DEFAULTS.DEFAULT;
    return defaults;
  }
}
