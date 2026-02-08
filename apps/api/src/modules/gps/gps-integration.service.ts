/**
 * GPS Integration Service
 *
 * A facade that provides easy integration points for other modules
 * to interact with the GPS Re-Router system.
 *
 * This service consolidates:
 * - Expense event emission (triggers budget threshold checks)
 * - Category freeze validation (checks if expense is allowed)
 * - Active adjustments retrieval (for financial calculations)
 *
 * INTEGRATION GUIDE:
 *
 * 1. Import GpsModule in your module:
 *    ```typescript
 *    @Module({
 *      imports: [GpsModule],
 *      ...
 *    })
 *    export class ExpenseModule {}
 *    ```
 *
 * 2. Inject GpsIntegrationService in your service:
 *    ```typescript
 *    constructor(private readonly gpsIntegration: GpsIntegrationService) {}
 *    ```
 *
 * 3. Before creating an expense:
 *    ```typescript
 *    // Check if category is frozen
 *    const validation = await this.gpsIntegration.validateExpenseCategory(
 *      userId,
 *      categoryId,
 *      amount,
 *    );
 *
 *    if (!validation.allowed) {
 *      throw new CategoryFrozenException(validation.message);
 *    }
 *
 *    // ... create expense ...
 *
 *    // After expense is created, notify GPS
 *    await this.gpsIntegration.notifyExpenseCreated({
 *      userId,
 *      expenseId: expense.id,
 *      categoryId,
 *      categoryName,
 *      amount,
 *      currency,
 *    });
 *    ```
 *
 * 4. For financial calculations, get active adjustments:
 *    ```typescript
 *    const adjustments = await this.gpsIntegration.getActiveAdjustments(userId);
 *    const effectiveSavingsRate = baseSavingsRate + (adjustments.savingsBoost?.additionalRate ?? 0);
 *    ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BudgetEventListener, ExpenseCreatedEvent } from './budget-event.listener';
import { CategoryFreezeGuardService, FreezeValidationResult } from './category-freeze-guard.service';
import { RecoveryActionService } from './recovery-action.service';

/**
 * Active GPS adjustments that affect financial calculations
 */
export interface ActiveGpsAdjustments {
  /** Active savings rate boost (if any) */
  savingsBoost: {
    additionalRate: number;
    endDate: Date;
  } | null;

  /** Active category freezes */
  frozenCategories: Array<{
    categoryId: string;
    categoryName: string;
    endDate: Date;
  }>;

  /** Whether user has any active recovery measures */
  hasActiveRecovery: boolean;
}

@Injectable()
export class GpsIntegrationService {
  private readonly logger = new Logger(GpsIntegrationService.name);

  constructor(
    private readonly budgetEventListener: BudgetEventListener,
    private readonly categoryFreezeGuard: CategoryFreezeGuardService,
    private readonly recoveryActionService: RecoveryActionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==========================================
  // EXPENSE LIFECYCLE HOOKS
  // ==========================================

  /**
   * Validate if an expense is allowed in a category
   *
   * Call this BEFORE creating an expense to check if the category is frozen.
   * Returns validation result with allowed status and user-friendly messages.
   *
   * @example
   * ```typescript
   * const validation = await gpsIntegration.validateExpenseCategory(userId, categoryId, amount);
   * if (!validation.allowed) {
   *   // Show user the message and recommendation
   *   console.log(validation.message);
   *   console.log(validation.recommendation);
   * }
   * ```
   */
  async validateExpenseCategory(
    userId: string,
    categoryId: string,
    amount: number,
    options?: {
      /** Block expense if frozen (default: false, just warn) */
      blockIfFrozen?: boolean;
    },
  ): Promise<FreezeValidationResult> {
    return this.categoryFreezeGuard.validateExpense(userId, categoryId, amount, {
      blockExpenses: options?.blockIfFrozen ?? false,
    });
  }

  /**
   * Notify GPS that a new expense was created
   *
   * Call this AFTER creating an expense to trigger budget threshold checks.
   * This enables proactive GPS Re-Router notifications when budgets are exceeded.
   *
   * @example
   * ```typescript
   * // After expense is saved to database
   * await gpsIntegration.notifyExpenseCreated({
   *   userId: expense.userId,
   *   expenseId: expense.id,
   *   categoryId: expense.categoryId,
   *   categoryName: category.name,
   *   amount: expense.amount,
   *   currency: expense.currency,
   * });
   * ```
   */
  async notifyExpenseCreated(event: ExpenseCreatedEvent): Promise<void> {
    this.logger.debug(
      `[notifyExpenseCreated] Expense ${event.expenseId} created for user ${event.userId}`,
    );
    this.budgetEventListener.emitExpenseCreated(event);
  }

  /**
   * Notify GPS that an expense was updated
   *
   * Call this AFTER updating an expense amount to re-check budget thresholds.
   */
  async notifyExpenseUpdated(event: ExpenseCreatedEvent): Promise<void> {
    this.logger.debug(
      `[notifyExpenseUpdated] Expense ${event.expenseId} updated for user ${event.userId}`,
    );
    this.budgetEventListener.emitExpenseUpdated(event);
  }

  /**
   * Request a manual budget check for a user
   *
   * Useful when you want to trigger GPS analysis without an expense event.
   * For example, after importing transactions or at user login.
   */
  async requestBudgetCheck(userId: string, categoryName?: string): Promise<void> {
    this.logger.debug(
      `[requestBudgetCheck] Manual check requested for user ${userId}${categoryName ? `, category: ${categoryName}` : ''}`,
    );
    this.budgetEventListener.requestBudgetCheck(userId, categoryName);
  }

  // ==========================================
  // FINANCIAL CALCULATION HOOKS
  // ==========================================

  /**
   * Get active GPS adjustments that affect financial calculations
   *
   * Use this to incorporate active recovery measures into financial calculations:
   * - Savings boost increases effective savings rate
   * - Frozen categories should be excluded from spending projections
   *
   * @example
   * ```typescript
   * const adjustments = await gpsIntegration.getActiveAdjustments(userId);
   *
   * // Adjust savings rate
   * const effectiveSavingsRate = baseSavingsRate +
   *   (adjustments.savingsBoost?.additionalRate ?? 0);
   *
   * // Filter out frozen categories from projections
   * const frozenCategoryIds = new Set(
   *   adjustments.frozenCategories.map(f => f.categoryId)
   * );
   * const activeCategories = categories.filter(c => !frozenCategoryIds.has(c.id));
   * ```
   */
  async getActiveAdjustments(userId: string): Promise<ActiveGpsAdjustments> {
    const [savingsAdjustment, categoryFreezes] = await Promise.all([
      this.recoveryActionService.getActiveSavingsAdjustment(userId),
      this.recoveryActionService.getActiveCategoryFreezes(userId),
    ]);

    return {
      savingsBoost: savingsAdjustment
        ? {
            additionalRate: savingsAdjustment.additionalRate,
            endDate: savingsAdjustment.endDate,
          }
        : null,
      frozenCategories: categoryFreezes.map((f) => ({
        categoryId: f.categoryId,
        categoryName: f.categoryName,
        endDate: f.endDate,
      })),
      hasActiveRecovery: savingsAdjustment !== null || categoryFreezes.length > 0,
    };
  }

  /**
   * Get effective savings rate including any active boosts
   *
   * Convenience method that returns the adjusted savings rate directly.
   *
   * @example
   * ```typescript
   * const baseSavingsRate = user.savingsRate; // e.g., 0.15 (15%)
   * const effectiveRate = await gpsIntegration.getEffectiveSavingsRate(
   *   userId,
   *   baseSavingsRate
   * );
   * // If there's a 5% boost, effectiveRate would be 0.20 (20%)
   * ```
   */
  async getEffectiveSavingsRate(userId: string, baseSavingsRate: number): Promise<number> {
    const adjustment = await this.recoveryActionService.getActiveSavingsAdjustment(userId);
    return baseSavingsRate + (adjustment?.additionalRate ?? 0);
  }

  // ==========================================
  // QUICK CHECKS
  // ==========================================

  /**
   * Quick check if a category is frozen (no detailed info)
   *
   * Use for quick UI indicators or simple checks.
   * For detailed validation with messages, use `validateExpenseCategory`.
   */
  async isCategoryFrozen(userId: string, categoryId: string): Promise<boolean> {
    return this.categoryFreezeGuard.isCategoryFrozen(userId, categoryId);
  }

  /**
   * Get all frozen categories for a user
   *
   * Useful for UI to show freeze indicators on category list.
   */
  async getFrozenCategories(userId: string): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      endDate: Date;
      daysRemaining: number;
    }>
  > {
    return this.categoryFreezeGuard.getFrozenCategories(userId);
  }

  /**
   * Check if user has any active recovery measures
   *
   * Quick check for UI indicators or conditional logic.
   */
  async hasActiveRecovery(userId: string): Promise<boolean> {
    const adjustments = await this.getActiveAdjustments(userId);
    return adjustments.hasActiveRecovery;
  }

  // ==========================================
  // CROSS-AGENT COORDINATION
  // ==========================================

  /**
   * Handle recovery path selection event for cross-agent coordination
   *
   * When a user selects a recovery path, this triggers coordination
   * with the Future Self module to generate a supportive reinforcement
   * message. This demonstrates multi-agent orchestration.
   *
   * Event payload:
   * - userId: The user who selected the path
   * - sessionId: The recovery session ID
   * - pathId: Which path was selected (time_adjustment, rate_adjustment, etc.)
   * - goalId: The goal being recovered
   * - pathName: Human-readable path name
   * - actionResult: Details of the executed action
   */
  @OnEvent('gps.recovery.path_selected')
  async handleRecoveryPathSelected(payload: {
    userId: string;
    sessionId: string;
    pathId: string;
    goalId: string | null;
    pathName: string;
    actionResult: {
      message: string;
      details: Record<string, unknown>;
    };
  }): Promise<void> {
    this.logger.log(
      `[handleRecoveryPathSelected] Requesting Future Self reinforcement for user ${payload.userId}`,
    );

    // Emit event that Future Self module listens to (loose coupling via events)
    this.eventEmitter.emit('future_self.reinforcement_requested', {
      userId: payload.userId,
      trigger: 'recovery_path_selected',
      context: {
        sessionId: payload.sessionId,
        pathId: payload.pathId,
        pathName: payload.pathName,
        goalId: payload.goalId,
        actionMessage: payload.actionResult.message,
      },
    });
  }
}
