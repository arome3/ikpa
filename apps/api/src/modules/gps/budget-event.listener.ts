/**
 * Budget Event Listener
 *
 * Proactively listens for expense-related events and triggers GPS Re-Router
 * when budget thresholds are crossed. This addresses the "No Proactive Trigger"
 * gap by automatically detecting overspending.
 *
 * Events handled:
 * - expense.created: Check if new expense crosses budget threshold
 * - expense.updated: Re-check budget after expense modification
 * - budget.check: Manual budget status check request
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { GpsEventType } from '@prisma/client';
import { BudgetService } from './budget.service';
import { StreakService } from './streaks';
import { GpsNotificationService } from './notification';
import { GPS_CONSTANTS } from './constants';
import { BudgetTrigger, BudgetStatus } from './interfaces';
import { SpendingCoachAgent } from './agents/spending-coach.agent';

/**
 * Event payload for expense events
 */
export interface ExpenseCreatedEvent {
  userId: string;
  expenseId: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  currency: string;
}

/**
 * Event payload for budget threshold crossed
 */
export interface BudgetThresholdCrossedEvent {
  userId: string;
  categoryId: string;
  categoryName: string;
  trigger: BudgetTrigger;
  budgeted: number;
  spent: number;
  overagePercent: number;
}

/**
 * GPS Event names for the event emitter
 */
export const GPS_EVENTS = {
  EXPENSE_CREATED: 'expense.created',
  EXPENSE_UPDATED: 'expense.updated',
  BUDGET_CHECK: 'budget.check',
  BUDGET_THRESHOLD_CROSSED: 'gps.budget.threshold.crossed',
  GPS_NOTIFICATION_REQUIRED: 'gps.notification.required',
  SPENDING_DRIFT_DETECTED: 'gps.drift.detected',
} as const;

@Injectable()
export class BudgetEventListener {
  private readonly logger = new Logger(BudgetEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetService: BudgetService,
    private readonly eventEmitter: EventEmitter2,
    private readonly streakService: StreakService,
    private readonly notificationService: GpsNotificationService,
    private readonly spendingCoachAgent: SpendingCoachAgent,
  ) {}

  /**
   * Handle new expense creation
   *
   * When a new expense is created, check if it causes the user to cross
   * any budget thresholds. If so, emit a threshold crossed event.
   */
  @OnEvent(GPS_EVENTS.EXPENSE_CREATED)
  async handleExpenseCreated(event: ExpenseCreatedEvent): Promise<void> {
    this.logger.debug(
      `[handleExpenseCreated] Processing expense ${event.expenseId} for user ${event.userId}`,
    );

    try {
      await this.checkBudgetThreshold(event.userId, event.categoryName, event.categoryId);
    } catch (error) {
      // Don't let budget check failures break expense creation
      this.logger.warn(
        `[handleExpenseCreated] Failed to check budget for user ${event.userId}: ${error}`,
      );
    }

    // Proactive drift detection — runs independently of threshold checks
    try {
      await this.checkSpendingDrift(event.userId, event.categoryId, event.categoryName, event.currency);
    } catch (error) {
      // Drift detection failure must never block expense creation
      this.logger.warn(
        `[handleExpenseCreated] Drift check failed for user ${event.userId}: ${error}`,
      );
    }

    // AI Spending Coach — fire-and-forget nudge generation
    this.spendingCoachAgent
      .analyzeExpense(
        event.userId,
        event.expenseId,
        event.categoryName,
        event.categoryId,
        event.amount,
      )
      .catch((error) => {
        this.logger.warn(
          `[handleExpenseCreated] Spending coach failed for user ${event.userId}: ${error}`,
        );
      });
  }

  /**
   * Handle expense update
   *
   * Re-check budget when an expense amount changes.
   */
  @OnEvent(GPS_EVENTS.EXPENSE_UPDATED)
  async handleExpenseUpdated(event: ExpenseCreatedEvent): Promise<void> {
    this.logger.debug(
      `[handleExpenseUpdated] Processing updated expense ${event.expenseId} for user ${event.userId}`,
    );

    try {
      await this.checkBudgetThreshold(event.userId, event.categoryName, event.categoryId);
    } catch (error) {
      this.logger.warn(
        `[handleExpenseUpdated] Failed to check budget for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle manual budget check request
   *
   * Allows other services to trigger a budget check for a user.
   */
  @OnEvent(GPS_EVENTS.BUDGET_CHECK)
  async handleBudgetCheck(event: { userId: string; categoryName?: string }): Promise<void> {
    this.logger.debug(`[handleBudgetCheck] Manual check for user ${event.userId}`);

    try {
      if (event.categoryName) {
        // Check specific category
        const status = await this.budgetService.checkBudgetStatus(
          event.userId,
          event.categoryName,
        );
        await this.processBudgetStatus(event.userId, status);
      } else {
        // Check all budgets
        const statuses = await this.budgetService.checkAllBudgetStatuses(event.userId);
        for (const status of statuses) {
          await this.processBudgetStatus(event.userId, status);
        }
      }
    } catch (error) {
      this.logger.warn(
        `[handleBudgetCheck] Failed to check budget for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Check if a budget threshold has been crossed and emit event if so
   */
  private async checkBudgetThreshold(
    userId: string,
    categoryName: string,
    _categoryId: string,
  ): Promise<void> {
    try {
      const status = await this.budgetService.checkBudgetStatus(userId, categoryName);
      await this.processBudgetStatus(userId, status);
    } catch {
      // Budget might not exist for this category - that's fine
      this.logger.debug(
        `[checkBudgetThreshold] No budget found for category ${categoryName} (user ${userId})`,
      );
    }
  }

  /**
   * Process a budget status and emit events if thresholds are crossed
   */
  private async processBudgetStatus(
    userId: string,
    status: BudgetStatus,
  ): Promise<void> {
    // Access the numeric amounts from MonetaryValue objects
    const budgetedAmount = status.budgeted.amount;
    const spentAmount = status.spent.amount;
    const spentPercentage = budgetedAmount > 0 ? spentAmount / budgetedAmount : 0;

    // If under budget, potentially increment streak
    if (spentPercentage < GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD) {
      // User is within budget - this could increment their streak
      // (Streak is incremented at end of day by cron, not on each expense)
      return;
    }

    // User exceeded budget - reset their streak
    if (spentPercentage >= GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD) {
      try {
        await this.streakService.resetStreak(userId, `Exceeded ${status.category} budget`);
      } catch (error) {
        this.logger.warn(`[processBudgetStatus] Failed to reset streak for user ${userId}: ${error}`);
      }
    }

    // Only emit notification events for warning threshold or higher
    if (spentPercentage < GPS_CONSTANTS.BUDGET_WARNING_THRESHOLD) {
      return;
    }

    // Check if we've already notified about this threshold recently
    const recentNotification = await this.hasRecentNotification(
      userId,
      status.categoryId,
      status.trigger,
    );

    if (recentNotification) {
      this.logger.debug(
        `[processBudgetStatus] Skipping notification for ${status.category} - already notified recently`,
      );
      return;
    }

    // Emit threshold crossed event (using numeric amounts for the event payload)
    const thresholdEvent: BudgetThresholdCrossedEvent = {
      userId,
      categoryId: status.categoryId,
      categoryName: status.category,
      trigger: status.trigger,
      budgeted: budgetedAmount,
      spent: spentAmount,
      overagePercent: status.overagePercent,
    };

    this.eventEmitter.emit(GPS_EVENTS.BUDGET_THRESHOLD_CROSSED, thresholdEvent);

    // Track analytics event
    await this.trackThresholdCrossed(userId, thresholdEvent);

    // Emit notification event for push notification service
    this.eventEmitter.emit(GPS_EVENTS.GPS_NOTIFICATION_REQUIRED, {
      userId,
      type: 'BUDGET_THRESHOLD',
      data: thresholdEvent,
    });

    this.logger.log(
      `[processBudgetStatus] User ${userId}: ${status.category} crossed ${status.trigger} threshold ` +
        `(${(spentPercentage * 100).toFixed(1)}% of budget)`,
    );
  }

  /**
   * Check if we've sent a notification for this threshold recently (within 24 hours)
   */
  private async hasRecentNotification(
    userId: string,
    categoryId: string,
    trigger: BudgetTrigger,
  ): Promise<boolean> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentEvent = await this.prisma.gpsAnalyticsEvent.findFirst({
      where: {
        userId,
        eventType: GpsEventType.BUDGET_THRESHOLD_CROSSED,
        createdAt: { gte: twentyFourHoursAgo },
        eventData: {
          path: ['categoryId'],
          equals: categoryId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // If we found a recent event, check if the trigger level is the same or lower
    if (recentEvent && recentEvent.eventData) {
      const previousTrigger = (recentEvent.eventData as { trigger?: string }).trigger;
      const triggerLevels: Record<string, number> = {
        BUDGET_WARNING: 1,
        BUDGET_EXCEEDED: 2,
        BUDGET_CRITICAL: 3,
      };

      // Only skip if we've already notified at this level or higher
      if (
        previousTrigger &&
        triggerLevels[previousTrigger] >= triggerLevels[trigger]
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Track threshold crossed event for analytics
   */
  private async trackThresholdCrossed(
    userId: string,
    event: BudgetThresholdCrossedEvent,
  ): Promise<void> {
    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        eventType: GpsEventType.BUDGET_THRESHOLD_CROSSED,
        eventData: {
          categoryId: event.categoryId,
          categoryName: event.categoryName,
          trigger: event.trigger,
          overagePercent: event.overagePercent,
        },
        previousValue: event.budgeted,
        newValue: event.spent,
      },
    });
  }

  /**
   * Check if spending velocity indicates drift and create notification if needed
   */
  private async checkSpendingDrift(
    userId: string,
    categoryId: string,
    categoryName: string,
    currency: string,
  ): Promise<void> {
    const budget = await this.budgetService.getBudgetByCategoryId(userId, categoryId);
    if (!budget) return;

    const budgetAmount = Number(budget.amount);
    const spentAmount = await this.budgetService.getSpent(userId, categoryId, budget.period);

    // Skip if budget already exceeded — reactive alerts handle that
    if (spentAmount >= budgetAmount) return;

    const velocity = await this.budgetService.calculateSpendingVelocity(
      userId,
      categoryId,
      budget.period,
    );
    if (!velocity) return;

    const { DRIFT_DETECTION } = GPS_CONSTANTS;

    // Apply all guardrails
    if (velocity.daysElapsed < DRIFT_DETECTION.MIN_ELAPSED_DAYS) return;
    if (velocity.daysRemaining < DRIFT_DETECTION.MIN_DAYS_REMAINING) return;
    if (velocity.velocityRatio < DRIFT_DETECTION.VELOCITY_RATIO_THRESHOLD) return;
    if (!velocity.willOverspend) return;

    // Check alert horizon
    if (velocity.projectedOverspendDate) {
      const now = new Date();
      const daysUntilOverspend = Math.ceil(
        (velocity.projectedOverspendDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysUntilOverspend > DRIFT_DETECTION.ALERT_HORIZON_DAYS) return;
    }

    // Create drift notification (fatigue prevention is handled inside)
    const notification = await this.notificationService.createDriftNotification(
      userId,
      categoryId,
      categoryName,
      velocity.velocityRatio,
      velocity.projectedOverspendDate,
      velocity.courseCorrectionDaily,
      currency || budget.currency || 'USD',
    );

    if (notification) {
      // Track analytics event
      await this.prisma.gpsAnalyticsEvent.create({
        data: {
          userId,
          eventType: GpsEventType.DRIFT_DETECTED,
          eventData: {
            categoryId,
            categoryName,
            velocityRatio: velocity.velocityRatio,
            projectedOverspendDate: velocity.projectedOverspendDate?.toISOString() ?? null,
            courseCorrectionDaily: velocity.courseCorrectionDaily,
            detectedBy: 'realtime',
          },
        },
      });

      // Emit event for other listeners
      this.eventEmitter.emit(GPS_EVENTS.SPENDING_DRIFT_DETECTED, {
        userId,
        categoryId,
        categoryName,
        velocityRatio: velocity.velocityRatio,
        projectedOverspendDate: velocity.projectedOverspendDate,
      });

      this.logger.log(
        `[checkSpendingDrift] User ${userId}: drift detected in ${categoryName} ` +
          `(${velocity.velocityRatio.toFixed(1)}x pace)`,
      );
    }
  }

  /**
   * Emit an expense created event
   *
   * This is a helper method that other services can use to trigger budget checks.
   */
  emitExpenseCreated(event: ExpenseCreatedEvent): void {
    this.eventEmitter.emit(GPS_EVENTS.EXPENSE_CREATED, event);
  }

  /**
   * Emit an expense updated event
   */
  emitExpenseUpdated(event: ExpenseCreatedEvent): void {
    this.eventEmitter.emit(GPS_EVENTS.EXPENSE_UPDATED, event);
  }

  /**
   * Request a budget check for a user
   */
  requestBudgetCheck(userId: string, categoryName?: string): void {
    this.eventEmitter.emit(GPS_EVENTS.BUDGET_CHECK, { userId, categoryName });
  }
}
