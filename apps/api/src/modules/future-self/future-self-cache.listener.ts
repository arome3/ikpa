/**
 * Future Self Cache Event Listener
 *
 * Listens for financial data changes and invalidates the Future Self cache
 * to ensure simulations and letters reflect current user data.
 *
 * Events handled:
 * - financial.snapshot.created: User's financial state changed
 * - goal.created/updated/deleted: User's goals changed
 * - expense.created/updated: Major expense activity (via GPS events)
 * - user.profile.updated: User profile data changed
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LetterTrigger } from '@prisma/client';
import { FutureSelfService } from './future-self.service';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';

// ==========================================
// EVENT DEFINITIONS
// ==========================================

/**
 * Future Self cache invalidation events
 */
export const FUTURE_SELF_EVENTS = {
  // Events we listen to (from other modules)
  FINANCIAL_SNAPSHOT_CREATED: 'financial.snapshot.created',
  GOAL_CREATED: 'goal.created',
  GOAL_UPDATED: 'goal.updated',
  GOAL_DELETED: 'goal.deleted',
  USER_PROFILE_UPDATED: 'user.profile.updated',
  // GPS expense events (re-use existing events)
  EXPENSE_CREATED: 'expense.created',
  EXPENSE_UPDATED: 'expense.updated',
  // Goal contribution events
  GOAL_CONTRIBUTION_CREATED: 'goal.contribution.created',
  // GPS cross-agent coordination
  REINFORCEMENT_REQUESTED: 'future_self.reinforcement_requested',
} as const;

/**
 * Base event payload with userId
 */
export interface UserEvent {
  userId: string;
}

/**
 * Financial snapshot created event
 */
export interface FinancialSnapshotCreatedEvent extends UserEvent {
  snapshotId: string;
  netWorth: number;
  savingsRate: number;
}

/**
 * Goal event payload
 */
export interface GoalEvent extends UserEvent {
  goalId: string;
  goalName: string;
}

/**
 * Expense created event (from finance module)
 */
export interface ExpenseCreatedEvent extends UserEvent {
  expenseId: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  currency: string;
}

/**
 * Goal contribution created event (from finance module)
 */
export interface GoalContributionCreatedEvent extends UserEvent {
  goalId: string;
  goalName: string;
  contributionAmount: number;
  currentAmount: number;
  targetAmount: number;
  progressPercent: number;
  currency: string;
}

/**
 * User profile updated event
 */
export interface UserProfileUpdatedEvent extends UserEvent {
  fieldsUpdated: string[];
}

@Injectable()
export class FutureSelfCacheListener {
  private readonly logger = new Logger(FutureSelfCacheListener.name);

  constructor(
    private readonly futureSelfService: FutureSelfService,
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Handle new financial snapshot creation
   *
   * This is the most important trigger - financial snapshot contains
   * net worth, savings rate, and income data used in simulations.
   */
  @OnEvent(FUTURE_SELF_EVENTS.FINANCIAL_SNAPSHOT_CREATED)
  async handleFinancialSnapshotCreated(event: FinancialSnapshotCreatedEvent): Promise<void> {
    this.logger.debug(
      `[handleFinancialSnapshotCreated] Invalidating cache for user ${event.userId}`,
    );

    try {
      await this.futureSelfService.invalidateCache(event.userId);
      this.logger.log(
        `Cache invalidated for user ${event.userId} after financial snapshot update`,
      );
    } catch (error) {
      this.logger.warn(
        `[handleFinancialSnapshotCreated] Cache invalidation failed for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle goal created
   *
   * New goals affect simulation projections and letter personalization.
   */
  @OnEvent(FUTURE_SELF_EVENTS.GOAL_CREATED)
  async handleGoalCreated(event: GoalEvent): Promise<void> {
    this.logger.debug(
      `[handleGoalCreated] Invalidating cache for user ${event.userId} (goal: ${event.goalName})`,
    );

    try {
      await this.futureSelfService.invalidateCache(event.userId);
    } catch (error) {
      this.logger.warn(
        `[handleGoalCreated] Cache invalidation failed for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle goal updated
   *
   * Updated goal amounts or deadlines affect simulations.
   */
  @OnEvent(FUTURE_SELF_EVENTS.GOAL_UPDATED)
  async handleGoalUpdated(event: GoalEvent): Promise<void> {
    this.logger.debug(
      `[handleGoalUpdated] Invalidating cache for user ${event.userId} (goal: ${event.goalName})`,
    );

    try {
      await this.futureSelfService.invalidateCache(event.userId);
    } catch (error) {
      this.logger.warn(
        `[handleGoalUpdated] Cache invalidation failed for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle goal deleted
   *
   * Deleted goals affect primary goal selection in simulations.
   */
  @OnEvent(FUTURE_SELF_EVENTS.GOAL_DELETED)
  async handleGoalDeleted(event: GoalEvent): Promise<void> {
    this.logger.debug(
      `[handleGoalDeleted] Invalidating cache for user ${event.userId} (goal: ${event.goalName})`,
    );

    try {
      await this.futureSelfService.invalidateCache(event.userId);
    } catch (error) {
      this.logger.warn(
        `[handleGoalDeleted] Cache invalidation failed for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle user profile updated
   *
   * Profile changes (name, age, city) affect letter personalization.
   */
  @OnEvent(FUTURE_SELF_EVENTS.USER_PROFILE_UPDATED)
  async handleUserProfileUpdated(event: UserProfileUpdatedEvent): Promise<void> {
    // Only invalidate if relevant fields changed
    const relevantFields = ['name', 'dateOfBirth', 'country', 'currency'];
    const hasRelevantChange = event.fieldsUpdated.some((field) =>
      relevantFields.includes(field),
    );

    if (!hasRelevantChange) {
      this.logger.debug(
        `[handleUserProfileUpdated] Skipping cache invalidation - no relevant fields changed`,
      );
      return;
    }

    this.logger.debug(
      `[handleUserProfileUpdated] Invalidating cache for user ${event.userId}`,
    );

    try {
      await this.futureSelfService.invalidateCache(event.userId);
    } catch (error) {
      this.logger.warn(
        `[handleUserProfileUpdated] Cache invalidation failed for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle expense created — POST_DECISION trigger
   *
   * When a large expense (> 10% of monthly income) is created,
   * schedule a POST_DECISION letter with a 5-minute delay.
   */
  @OnEvent(FUTURE_SELF_EVENTS.EXPENSE_CREATED)
  async handleExpenseCreated(event: ExpenseCreatedEvent): Promise<void> {
    this.logger.debug(
      `[handleExpenseCreated] Expense ${event.expenseId} for user ${event.userId}: ${event.amount}`,
    );

    try {
      // Check if expense is significant (> 10% of monthly income)
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: {
          incomeSources: { where: { isActive: true }, select: { amount: true } },
        },
      });

      if (!user) return;

      const monthlyIncome = user.incomeSources.reduce((sum, s) => sum + Number(s.amount), 0);
      if (monthlyIncome <= 0 || event.amount < monthlyIncome * 0.10) {
        return; // Not significant enough
      }

      this.logger.log(
        `[handleExpenseCreated] Large expense detected for user ${event.userId}: ${event.amount} (${Math.round((event.amount / monthlyIncome) * 100)}% of income)`,
      );

      // Delay 5 minutes before generating — don't interrupt user right after spending
      setTimeout(() => {
        this.futureSelfService.generateTriggeredLetter(
          event.userId,
          LetterTrigger.POST_DECISION,
          {
            expenseDescription: event.categoryName,
            expenseAmount: event.amount,
            currency: event.currency,
          },
        ).catch((error) => {
          this.logger.warn(
            `[handleExpenseCreated] POST_DECISION letter failed for user ${event.userId}: ${error}`,
          );
        });
      }, 5 * 60 * 1000); // 5 minutes
    } catch (error) {
      this.logger.warn(
        `[handleExpenseCreated] Failed to evaluate expense for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle goal contribution — GOAL_MILESTONE trigger
   *
   * When a goal contribution crosses 25%, 50%, 75%, or 100% threshold,
   * generate a celebratory milestone letter.
   */
  @OnEvent(FUTURE_SELF_EVENTS.GOAL_CONTRIBUTION_CREATED)
  async handleGoalContribution(event: GoalContributionCreatedEvent): Promise<void> {
    this.logger.debug(
      `[handleGoalContribution] Goal ${event.goalName} for user ${event.userId}: ${event.progressPercent}%`,
    );

    try {
      // Check if progress crossed a milestone threshold
      const milestones = [25, 50, 75, 100];
      const previousAmount = event.currentAmount - event.contributionAmount;
      const previousPercent = event.targetAmount > 0
        ? Math.round((previousAmount / event.targetAmount) * 100)
        : 0;

      // Find the milestone that was crossed (if any)
      const crossedMilestone = milestones.find(
        (m) => previousPercent < m && event.progressPercent >= m,
      );

      if (!crossedMilestone) {
        return; // No milestone crossed
      }

      this.logger.log(
        `[handleGoalContribution] Milestone ${crossedMilestone}% crossed for goal "${event.goalName}" by user ${event.userId}`,
      );

      // Generate milestone letter immediately — milestones deserve instant celebration
      await this.futureSelfService.generateTriggeredLetter(
        event.userId,
        LetterTrigger.GOAL_MILESTONE,
        {
          goalName: event.goalName,
          goalAmount: event.targetAmount,
          currentAmount: event.currentAmount,
          milestone: crossedMilestone,
          currency: event.currency,
        },
      );
    } catch (error) {
      this.logger.warn(
        `[handleGoalContribution] GOAL_MILESTONE letter failed for user ${event.userId}: ${error}`,
      );
    }
  }

  /**
   * Handle GPS recovery path selection for cross-agent reinforcement
   *
   * When a user selects a recovery path in the GPS Re-Router, store
   * the recovery context in Redis so the next Future Self letter
   * can reference the user's commitment. Then invalidate the letter
   * cache so the next request generates a fresh letter.
   */
  @OnEvent(FUTURE_SELF_EVENTS.REINFORCEMENT_REQUESTED)
  async handleReinforcementRequested(payload: {
    userId: string;
    trigger: string;
    context: {
      sessionId: string;
      pathId: string;
      pathName: string;
      goalId: string | null;
      actionMessage: string;
    };
  }): Promise<void> {
    this.logger.log(
      `[handleReinforcementRequested] Generating reinforcement context for user ${payload.userId} after ${payload.context.pathName}`,
    );

    try {
      // Store recovery context in Redis for the letter generation to pick up
      const cacheKey = `gps_recovery_context:${payload.userId}`;
      await this.redisService.set(cacheKey, payload.context, 86400); // 24h TTL

      // Invalidate cached letter so next letter request generates fresh one with recovery context
      await this.futureSelfService.invalidateCache(payload.userId);
    } catch (error) {
      this.logger.warn(
        `[handleReinforcementRequested] Failed to set recovery context for reinforcement: ${error}`,
      );
    }
  }
}
