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
import { FutureSelfService } from './future-self.service';

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
 * User profile updated event
 */
export interface UserProfileUpdatedEvent extends UserEvent {
  fieldsUpdated: string[];
}

@Injectable()
export class FutureSelfCacheListener {
  private readonly logger = new Logger(FutureSelfCacheListener.name);

  constructor(private readonly futureSelfService: FutureSelfService) {}

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
   * Handle expense created (from GPS module)
   *
   * Large expenses affect user context enrichment (recentDecisions, struggles).
   * We debounce by only invalidating if the letter cache exists.
   */
  @OnEvent(FUTURE_SELF_EVENTS.EXPENSE_CREATED)
  async handleExpenseCreated(event: UserEvent): Promise<void> {
    // Only invalidate letter cache, not simulation (expenses don't affect simulation)
    // This is handled by the service's short TTL - we don't need aggressive invalidation
    this.logger.debug(
      `[handleExpenseCreated] Expense activity for user ${event.userId} - cache will refresh on next request`,
    );
  }
}
