/**
 * Recovery Action Service
 *
 * Executes recovery path actions for the GPS Re-Router feature.
 * This service handles the actual implementation of recovery paths:
 * - Timeline Flex: Extends goal deadline
 * - Savings Boost: Creates temporary savings rate adjustment
 * - Category Pause: Freezes spending in a category
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GpsEventType } from '@prisma/client';
import { addWeeks } from 'date-fns';
import { GoalService } from './goal.service';
import { BudgetService } from './budget.service';
import { GPS_CONSTANTS } from './constants';
import { InvalidRecoveryPathException, RecoverySessionNotFoundException } from './exceptions';
import { formatCurrency } from '../../common/utils';

/**
 * Detailed information about the executed recovery action
 */
export interface RecoveryActionDetails {
  originalRate?: number; // for rate_adjustment
  newRate?: number; // for rate_adjustment
  boostAmount?: number; // additional savings rate as decimal
  durationWeeks: number;
  endDate: Date;
  estimatedRecovery?: number; // estimated amount to recover
  categoryFrozen?: string; // for freeze_protocol
  previousDeadline?: Date; // for time_adjustment
  newDeadline?: Date; // for time_adjustment
}

/**
 * Result of executing a recovery action
 */
export interface RecoveryActionResult {
  success: boolean;
  pathId: string;
  action: string;
  details: RecoveryActionDetails;
  message: string;
}

/**
 * Context for executing a recovery action
 */
interface ActionContext {
  userId: string;
  sessionId: string;
  goalId: string;
  category: string;
  categoryId: string;
  overspendAmount: number;
  monthlyIncome: number;
  currentSavingsRate: number;
  currency: string;
}

@Injectable()
export class RecoveryActionService {
  private readonly logger = new Logger(RecoveryActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly goalService: GoalService,
    private readonly budgetService: BudgetService,
  ) {}

  /**
   * Execute a recovery path action
   *
   * This is the main entry point that routes to the appropriate action handler
   */
  async executeRecoveryAction(
    userId: string,
    sessionId: string,
    pathId: string,
  ): Promise<RecoveryActionResult> {
    // Get session details
    const session = await this.prisma.recoverySession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new RecoverySessionNotFoundException(sessionId);
    }

    // Build action context
    const context = await this.buildActionContext(userId, session);

    // Execute the appropriate action
    let result: RecoveryActionResult;

    switch (pathId) {
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT:
        result = await this.executeTimelineExtension(context);
        break;
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT:
        result = await this.executeSavingsBoost(context);
        break;
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL:
        result = await this.executeCategoryFreeze(context);
        break;
      default:
        throw new InvalidRecoveryPathException(
          pathId,
          Object.values(GPS_CONSTANTS.RECOVERY_PATH_IDS),
        );
    }

    // Update session with action execution timestamp
    await this.prisma.recoverySession.update({
      where: { id: sessionId },
      data: {
        actionExecutedAt: new Date(),
        status: 'IN_PROGRESS',
      },
    });

    // Track analytics event
    await this.trackAnalyticsEvent(userId, sessionId, pathId, result);

    this.logger.log(
      `[executeRecoveryAction] User ${userId}: executed ${pathId} for session ${sessionId}`,
    );

    return result;
  }

  /**
   * Execute Timeline Flex - extend goal deadline
   */
  private async executeTimelineExtension(context: ActionContext): Promise<RecoveryActionResult> {
    const { userId, goalId, overspendAmount, monthlyIncome } = context;

    // Calculate dynamic extension based on overspend severity
    const weeksExtension = this.calculateTimelineExtension(overspendAmount, monthlyIncome);

    // Get current goal
    const goal = await this.goalService.getGoal(userId, goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const previousDeadline = goal.targetDate || new Date();

    // Extend the deadline
    const updatedGoal = await this.goalService.extendDeadline(userId, goalId, weeksExtension);
    const newDeadline = updatedGoal.targetDate || addWeeks(previousDeadline, weeksExtension);

    this.logger.log(
      `[executeTimelineExtension] User ${userId}: extended goal ${goalId} by ${weeksExtension} weeks`,
    );

    return {
      success: true,
      pathId: GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
      action: 'DEADLINE_EXTENDED',
      details: {
        durationWeeks: weeksExtension,
        endDate: newDeadline,
        previousDeadline,
        newDeadline,
      },
      message: `Your goal deadline has been extended by ${weeksExtension} weeks to give you more time to recover.`,
    };
  }

  /**
   * Execute Savings Boost - create temporary savings rate adjustment
   */
  private async executeSavingsBoost(context: ActionContext): Promise<RecoveryActionResult> {
    const { userId, sessionId, overspendAmount, monthlyIncome, currentSavingsRate } = context;

    // Calculate dynamic savings rate increase
    const { additionalRate, durationWeeks } = this.calculateSavingsBoost(
      overspendAmount,
      monthlyIncome,
      currentSavingsRate,
    );

    const startDate = new Date();
    const endDate = addWeeks(startDate, durationWeeks);

    // Create savings rate adjustment record
    await this.prisma.savingsRateAdjustment.create({
      data: {
        userId,
        sessionId,
        additionalRate,
        durationWeeks,
        startDate,
        endDate,
        originalRate: currentSavingsRate,
        isActive: true,
      },
    });

    const additionalRatePercent = (additionalRate * 100).toFixed(1);

    // Estimate the total recovery amount over the duration
    const estimatedRecovery = (additionalRate * monthlyIncome * durationWeeks) / 4;

    this.logger.log(
      `[executeSavingsBoost] User ${userId}: savings boost of ${additionalRatePercent}% for ${durationWeeks} weeks`,
    );

    return {
      success: true,
      pathId: GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT,
      action: 'SAVINGS_RATE_INCREASED',
      details: {
        originalRate: currentSavingsRate,
        newRate: currentSavingsRate + additionalRate,
        boostAmount: additionalRate,
        durationWeeks,
        endDate,
        estimatedRecovery,
      },
      message: `Your savings rate has been boosted by ${additionalRatePercent}% for the next ${durationWeeks} weeks.`,
    };
  }

  /**
   * Execute Category Pause - freeze spending in the overspent category
   */
  private async executeCategoryFreeze(context: ActionContext): Promise<RecoveryActionResult> {
    const { userId, sessionId, category, categoryId, overspendAmount, monthlyIncome, currency } =
      context;

    // Calculate dynamic freeze duration
    const durationWeeks = this.calculateFreezeDuration(overspendAmount, monthlyIncome);

    const startDate = new Date();
    const endDate = addWeeks(startDate, durationWeeks);

    // Get average monthly spending for estimated savings
    const averageMonthlySpending = await this.budgetService.getAverageMonthlySpending(
      userId,
      categoryId,
    );
    const estimatedSavings = (averageMonthlySpending / 4) * durationWeeks; // Weekly savings * weeks
    const formattedSavings = formatCurrency(estimatedSavings, currency);

    // Create category freeze record
    await this.prisma.categoryFreeze.create({
      data: {
        userId,
        sessionId,
        categoryId,
        categoryName: category,
        durationWeeks,
        startDate,
        endDate,
        savedAmount: estimatedSavings,
        isActive: true,
      },
    });

    this.logger.log(
      `[executeCategoryFreeze] User ${userId}: froze ${category} for ${durationWeeks} weeks`,
    );

    return {
      success: true,
      pathId: GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL,
      action: 'CATEGORY_FROZEN',
      details: {
        durationWeeks,
        endDate,
        estimatedRecovery: estimatedSavings,
        categoryFrozen: category,
      },
      message: `Spending in ${category} has been paused for ${durationWeeks} weeks. Estimated savings: ${formattedSavings}.`,
    };
  }

  /**
   * Calculate dynamic timeline extension based on overspend severity
   *
   * - Minor overspend (< 10% of monthly income): 1-2 weeks
   * - Moderate overspend (10-20%): 2-3 weeks
   * - Significant overspend (> 20%): 3-4 weeks
   */
  private calculateTimelineExtension(overspendAmount: number, monthlyIncome: number): number {
    if (monthlyIncome <= 0) return GPS_CONSTANTS.DEFAULT_TIMELINE_EXTENSION_WEEKS;

    const overspendRatio = overspendAmount / monthlyIncome;

    if (overspendRatio < 0.1) {
      return Math.max(1, Math.ceil(overspendRatio * 20)); // 1-2 weeks
    } else if (overspendRatio < 0.2) {
      return Math.min(3, Math.ceil(overspendRatio * 15)); // 2-3 weeks
    } else {
      return Math.min(4, Math.ceil(overspendRatio * 10)); // 3-4 weeks
    }
  }

  /**
   * Calculate dynamic savings boost based on overspend and capacity
   *
   * Takes into account:
   * - Overspend severity
   * - User's current savings rate (capacity to save more)
   * - Reasonable limits (don't ask for more than 15% additional)
   */
  private calculateSavingsBoost(
    overspendAmount: number,
    monthlyIncome: number,
    currentSavingsRate: number,
  ): { additionalRate: number; durationWeeks: number } {
    if (monthlyIncome <= 0) {
      return {
        additionalRate: GPS_CONSTANTS.DEFAULT_SAVINGS_RATE_INCREASE,
        durationWeeks: GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS,
      };
    }

    // Calculate how much additional savings is needed to recover
    const overspendRatio = overspendAmount / monthlyIncome;

    // Available capacity (max 1 - current rate, capped at 0.15 additional)
    const maxAdditionalRate = Math.min(0.15, 1 - currentSavingsRate - 0.1); // Leave 10% buffer

    // Target additional rate based on overspend (aim to recover in 4-8 weeks)
    let targetAdditionalRate = overspendRatio / 4; // Spread over 4 weeks minimum

    // Cap at available capacity
    const additionalRate = Math.max(0.03, Math.min(targetAdditionalRate, maxAdditionalRate));

    // Calculate duration (how many weeks to recover the overspend)
    const weeklyRecovery = (additionalRate * monthlyIncome) / 4;
    let durationWeeks = Math.ceil(overspendAmount / weeklyRecovery);

    // Cap duration between 2-8 weeks
    durationWeeks = Math.max(2, Math.min(8, durationWeeks));

    return { additionalRate, durationWeeks };
  }

  /**
   * Calculate dynamic freeze duration based on overspend severity
   *
   * - Minor overspend: 1-2 weeks
   * - Moderate overspend: 2-3 weeks
   * - Significant overspend: 3-4 weeks
   */
  private calculateFreezeDuration(overspendAmount: number, monthlyIncome: number): number {
    if (monthlyIncome <= 0) return GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS;

    const overspendRatio = overspendAmount / monthlyIncome;

    if (overspendRatio < 0.1) {
      return 2;
    } else if (overspendRatio < 0.2) {
      return 3;
    } else {
      return 4;
    }
  }

  /**
   * Build action context from session and user data
   */
  private async buildActionContext(
    userId: string,
    session: { id: string; goalId: string | null; category: string; overspendAmount: unknown },
  ): Promise<ActionContext> {
    // Get goal (use session's goal or primary goal)
    const goalId = session.goalId;
    const goal = goalId
      ? await this.goalService.getGoal(userId, goalId)
      : await this.goalService.getPrimaryGoal(userId);

    if (!goal) {
      throw new Error('No active goal found');
    }

    // Get user for currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    // Get budget status to get category ID
    const budgetStatus = await this.budgetService.checkBudgetStatus(userId, session.category);

    // Get simulation input for financial data
    const simInput = await this.goalService.getSimulationInput(userId, goal.id);

    return {
      userId,
      sessionId: session.id,
      goalId: goal.id,
      category: session.category,
      categoryId: budgetStatus.categoryId,
      overspendAmount: Number(session.overspendAmount),
      monthlyIncome: simInput.monthlyIncome,
      currentSavingsRate: simInput.currentSavingsRate,
      currency: user?.currency || 'NGN',
    };
  }

  /**
   * Track analytics event for recovery action
   */
  private async trackAnalyticsEvent(
    userId: string,
    sessionId: string,
    pathId: string,
    result: RecoveryActionResult,
  ): Promise<void> {
    // Convert Date objects to ISO strings for JSON storage
    const serializableDetails = {
      durationWeeks: result.details.durationWeeks,
      endDate: result.details.endDate?.toISOString(),
      ...(result.details.originalRate !== undefined && {
        originalRate: result.details.originalRate,
      }),
      ...(result.details.newRate !== undefined && { newRate: result.details.newRate }),
      ...(result.details.boostAmount !== undefined && { boostAmount: result.details.boostAmount }),
      ...(result.details.estimatedRecovery !== undefined && {
        estimatedRecovery: result.details.estimatedRecovery,
      }),
      ...(result.details.categoryFrozen && { categoryFrozen: result.details.categoryFrozen }),
      ...(result.details.previousDeadline && {
        previousDeadline: result.details.previousDeadline.toISOString(),
      }),
      ...(result.details.newDeadline && { newDeadline: result.details.newDeadline.toISOString() }),
    };

    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        sessionId,
        eventType: GpsEventType.RECOVERY_STARTED,
        eventData: {
          pathId,
          action: result.action,
          details: serializableDetails,
        },
      },
    });
  }

  /**
   * Get active savings rate adjustment for a user
   */
  async getActiveSavingsAdjustment(userId: string): Promise<{
    additionalRate: number;
    endDate: Date;
  } | null> {
    const adjustment = await this.prisma.savingsRateAdjustment.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!adjustment) return null;

    return {
      additionalRate: Number(adjustment.additionalRate),
      endDate: adjustment.endDate,
    };
  }

  /**
   * Get active category freezes for a user
   */
  async getActiveCategoryFreezes(userId: string): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      endDate: Date;
    }>
  > {
    const freezes = await this.prisma.categoryFreeze.findMany({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
    });

    return freezes.map((freeze) => ({
      categoryId: freeze.categoryId,
      categoryName: freeze.categoryName,
      endDate: freeze.endDate,
    }));
  }

  /**
   * Check if a category is currently frozen
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
   * Get freeze details for a category (by ID or name)
   *
   * Returns the freeze record if the category is frozen, or null if not.
   * Supports lookup by either categoryId (UUID) or categoryName.
   */
  async getCategoryFreezeDetails(
    userId: string,
    categoryIdOrName: string,
  ): Promise<{
    id: string;
    categoryId: string;
    categoryName: string;
    startDate: Date;
    endDate: Date;
    durationWeeks: number;
    savedAmount: number;
    sessionId: string;
  } | null> {
    // Try to find by categoryId first, then by categoryName
    const freeze = await this.prisma.categoryFreeze.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
        OR: [{ categoryId: categoryIdOrName }, { categoryName: categoryIdOrName }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!freeze) {
      return null;
    }

    return {
      id: freeze.id,
      categoryId: freeze.categoryId,
      categoryName: freeze.categoryName,
      startDate: freeze.startDate,
      endDate: freeze.endDate,
      durationWeeks: freeze.durationWeeks,
      savedAmount: Number(freeze.savedAmount),
      sessionId: freeze.sessionId,
    };
  }

  /**
   * Deactivate expired adjustments and freezes
   * This should be called by a scheduled job
   */
  async deactivateExpired(): Promise<{ adjustments: number; freezes: number }> {
    const now = new Date();

    const [adjustmentsResult, freezesResult] = await Promise.all([
      this.prisma.savingsRateAdjustment.updateMany({
        where: {
          isActive: true,
          endDate: { lt: now },
        },
        data: { isActive: false },
      }),
      this.prisma.categoryFreeze.updateMany({
        where: {
          isActive: true,
          endDate: { lt: now },
        },
        data: { isActive: false },
      }),
    ]);

    if (adjustmentsResult.count > 0 || freezesResult.count > 0) {
      this.logger.log(
        `[deactivateExpired] Deactivated ${adjustmentsResult.count} adjustments and ${freezesResult.count} freezes`,
      );
    }

    return {
      adjustments: adjustmentsResult.count,
      freezes: freezesResult.count,
    };
  }
}
