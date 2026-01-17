/**
 * GPS Re-Router Service
 *
 * Core service for the GPS Re-Router feature that helps users recover
 * from budget overspending without abandoning their financial goals.
 *
 * Key responsibilities:
 * - Detect budget overspending and calculate severity
 * - Calculate impact on goal achievement probability
 * - Generate three recovery paths with different effort levels
 * - Track recovery sessions for analytics
 * - Ensure all messages are non-judgmental (banned words validation)
 *
 * This service combats the "What-The-Hell Effect" by reframing budget slips
 * as "wrong turns, not dead ends."
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStatus, GpsEventType } from '@prisma/client';
import { OpikService } from '../ai/opik/opik.service';
import { SimulationEngineCalculator } from '../finance/calculators/simulation-engine.calculator';

import { BudgetService } from './budget.service';
import { GoalService } from './goal.service';
import { RecoveryActionService, RecoveryActionResult } from './recovery-action.service';
import {
  BudgetStatus,
  GoalImpact,
  RecoveryPath,
  NonJudgmentalMessage,
  RecoveryResponse,
  EffortLevel,
  MultiGoalImpact,
} from './interfaces';
import {
  GPS_CONSTANTS,
  RECOVERY_PATHS,
  SUPPORTIVE_MESSAGES,
  GPS_TRACE_NAMES,
} from './constants';
import {
  GpsCalculationException,
  GpsInsufficientDataException,
  RecoverySessionNotFoundException,
  InvalidRecoveryPathException,
  SessionAlreadyResolvedException,
  BannedWordException,
} from './exceptions';

@Injectable()
export class GpsService {
  private readonly logger = new Logger(GpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly simulationEngine: SimulationEngineCalculator,
    private readonly budgetService: BudgetService,
    private readonly goalService: GoalService,
    @Inject(forwardRef(() => RecoveryActionService))
    private readonly recoveryActionService: RecoveryActionService,
  ) {}

  /**
   * Main recalculate method - orchestrates the entire GPS Re-Router flow
   *
   * 1. Detect budget status
   * 2. Calculate goal impact using Monte Carlo simulation
   * 3. Generate three recovery paths
   * 4. Create supportive message
   * 5. Save recovery session
   */
  async recalculate(userId: string, category: string, goalId?: string): Promise<RecoveryResponse> {
    const startTime = Date.now();

    // Create Opik trace for the full operation
    const trace = this.opikService.createTrace({
      name: GPS_TRACE_NAMES.RECALCULATE,
      input: { userId, category, goalId },
      metadata: {
        service: 'GpsService',
        operation: 'recalculate',
      },
      tags: ['gps', 'recovery', 'behavioral-economics'],
    });

    try {
      // Step 1: Detect budget status
      const budgetStatus = await this.withSpan(trace, GPS_TRACE_NAMES.DETECT_BUDGET, () =>
        this.detectBudgetStatus(userId, category),
      );

      // Step 2: Calculate goal impact (primary goal)
      const goalImpact = await this.withSpan(trace, GPS_TRACE_NAMES.CALCULATE_IMPACT, () =>
        this.calculateGoalImpact(userId, budgetStatus, goalId),
      );

      // Step 2b: Calculate multi-goal impact (all active goals)
      const multiGoalImpact = await this.calculateMultiGoalImpact(userId, budgetStatus);

      // Step 3: Generate recovery paths
      const recoveryPaths = await this.withSpan(trace, GPS_TRACE_NAMES.GENERATE_PATHS, () =>
        this.generateRecoveryPaths(userId, budgetStatus, goalImpact, goalId),
      );

      // Step 4: Generate supportive message
      const message = this.generateNonJudgmentalMessage(budgetStatus, goalImpact);

      // Validate message doesn't contain banned words
      this.validateNoBannedWords(message);

      // Step 5: Create recovery session (now includes goalId for action execution)
      const session = await this.prisma.recoverySession.create({
        data: {
          userId,
          goalId: goalImpact.goalId,
          category,
          overspendAmount: Math.max(0, budgetStatus.spent - budgetStatus.budgeted),
          previousProbability: goalImpact.previousProbability,
          newProbability: goalImpact.newProbability,
          status: RecoveryStatus.PENDING,
        },
      });

      const durationMs = Date.now() - startTime;

      // End trace with success
      this.opikService.endTrace(trace, {
        success: true,
        result: {
          sessionId: session.id,
          budgetTrigger: budgetStatus.trigger,
          probabilityDrop: goalImpact.probabilityDrop,
          pathsGenerated: recoveryPaths.length,
          goalsAffected: multiGoalImpact.summary.totalGoalsAffected,
          durationMs,
        },
      });

      this.logger.log(
        `[recalculate] User ${userId}: session ${session.id} created, ` +
          `probability ${(goalImpact.previousProbability * 100).toFixed(1)}% -> ` +
          `${(goalImpact.newProbability * 100).toFixed(1)}%, ` +
          `${multiGoalImpact.summary.totalGoalsAffected} goals affected (${durationMs}ms)`,
      );

      return {
        sessionId: session.id,
        budgetStatus,
        goalImpact,
        multiGoalImpact,
        recoveryPaths,
        message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.opikService.endTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(`[recalculate] Failed for user ${userId}: ${errorMessage}`);

      if (
        error instanceof GpsCalculationException ||
        error instanceof GpsInsufficientDataException
      ) {
        throw error;
      }

      throw new GpsCalculationException(errorMessage, { userId, category });
    }
  }

  /**
   * Detect budget status for a category
   */
  async detectBudgetStatus(userId: string, category: string): Promise<BudgetStatus> {
    return this.budgetService.checkBudgetStatus(userId, category);
  }

  /**
   * Calculate the impact of overspending on goal achievement probability
   *
   * Runs two Monte Carlo simulations:
   * 1. Before overspend (with original savings rate)
   * 2. After overspend (with reduced savings due to overspend recovery)
   */
  async calculateGoalImpact(
    userId: string,
    budgetStatus: BudgetStatus,
    goalId?: string,
  ): Promise<GoalImpact> {
    // Get the goal
    const goal = goalId
      ? await this.goalService.getGoal(userId, goalId)
      : await this.goalService.getPrimaryGoal(userId);

    if (!goal) {
      throw new GpsInsufficientDataException(['active goal']);
    }

    // Get user for currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    // Get simulation input (represents current state)
    const currentInput = await this.goalService.getSimulationInput(userId, goalId);

    // Calculate previous probability (before overspend impact)
    // We assume the "previous" state had the overspend amount available for savings
    const overspendAmount = Math.max(0, budgetStatus.spent - budgetStatus.budgeted);
    const adjustedSavingsRate =
      currentInput.monthlyIncome > 0
        ? Math.max(
            0,
            currentInput.currentSavingsRate + overspendAmount / currentInput.monthlyIncome,
          )
        : currentInput.currentSavingsRate;

    const previousInput = {
      ...currentInput,
      currentSavingsRate: adjustedSavingsRate,
    };

    // Run simulations
    const [previousSimulation, currentSimulation] = await Promise.all([
      this.simulationEngine.runDualPathSimulation(
        userId,
        previousInput,
        user?.currency || 'NGN',
      ),
      this.simulationEngine.runDualPathSimulation(
        userId,
        currentInput,
        user?.currency || 'NGN',
      ),
    ]);

    const previousProbability = previousSimulation.currentPath.probability;
    const newProbability = currentSimulation.currentPath.probability;
    const probabilityDrop = newProbability - previousProbability;

    // Generate human-readable impact message
    const dropPercent = Math.abs(probabilityDrop * 100).toFixed(1);
    const message =
      probabilityDrop < 0
        ? `Your goal probability decreased by ${dropPercent} percentage points`
        : probabilityDrop > 0
          ? `Your goal probability actually increased by ${dropPercent} percentage points`
          : 'Your goal probability remains unchanged';

    return {
      goalId: goal.id,
      goalName: goal.name,
      goalAmount: Number(goal.targetAmount),
      goalDeadline: goal.targetDate || new Date(),
      previousProbability,
      newProbability,
      probabilityDrop,
      message,
    };
  }

  /**
   * Calculate impact on ALL active goals (multi-goal assessment)
   *
   * This provides a comprehensive view of how the overspend affects
   * all of the user's financial goals, not just the primary one.
   */
  async calculateMultiGoalImpact(
    userId: string,
    budgetStatus: BudgetStatus,
  ): Promise<MultiGoalImpact> {
    // Get all active goals
    const activeGoals = await this.goalService.getActiveGoals(userId);

    if (activeGoals.length === 0) {
      throw new GpsInsufficientDataException(['active goals']);
    }

    // Calculate impact for each goal
    const allImpacts: GoalImpact[] = [];

    for (const goal of activeGoals) {
      try {
        const impact = await this.calculateGoalImpact(userId, budgetStatus, goal.id);
        allImpacts.push(impact);
      } catch (error) {
        this.logger.warn(
          `[calculateMultiGoalImpact] Failed to calculate impact for goal ${goal.id}: ${error}`,
        );
      }
    }

    if (allImpacts.length === 0) {
      throw new GpsInsufficientDataException(['goal impact calculations']);
    }

    // Sort by probability drop (most affected first)
    allImpacts.sort((a, b) => a.probabilityDrop - b.probabilityDrop);

    // Primary goal is the most affected (biggest drop)
    const primaryGoal = allImpacts[0];
    const otherGoals = allImpacts.slice(1);

    // Calculate summary statistics
    const totalDrop = allImpacts.reduce((sum, g) => sum + g.probabilityDrop, 0);
    const averageProbabilityDrop = totalDrop / allImpacts.length;

    // Find most and least affected goals
    const mostAffected = allImpacts[0]; // Already sorted
    const leastAffected = allImpacts[allImpacts.length - 1];

    return {
      primaryGoal,
      otherGoals,
      summary: {
        totalGoalsAffected: allImpacts.length,
        averageProbabilityDrop,
        mostAffectedGoal: mostAffected.goalName,
        leastAffectedGoal: leastAffected.goalName,
      },
    };
  }

  /**
   * Generate three recovery paths with different effort levels
   *
   * Path 1: Timeline Flex (Low effort) - Extend deadline
   * Path 2: Savings Boost (Medium effort) - Increase savings rate temporarily
   * Path 3: Category Pause (High effort) - Freeze spending in the category
   */
  async generateRecoveryPaths(
    userId: string,
    budgetStatus: BudgetStatus,
    _goalImpact: GoalImpact,
    goalId?: string,
  ): Promise<RecoveryPath[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const currency = user?.currency || 'NGN';

    const paths: RecoveryPath[] = [];

    // Path 1: Timeline Flex - Extend deadline by 2 weeks
    const timelineWeeks = GPS_CONSTANTS.DEFAULT_TIMELINE_EXTENSION_WEEKS;
    const timelineInput = await this.goalService.getAdjustedSimulationInput(userId, goalId, {
      weeksExtension: timelineWeeks,
    });
    const timelineSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      timelineInput,
      currency,
    );

    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
      name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT].name,
      description: `Extend your goal deadline by ${timelineWeeks} weeks`,
      newProbability: timelineSimulation.currentPath.probability,
      effort: 'Low' as EffortLevel,
      timelineImpact: `+${timelineWeeks} weeks`,
    });

    // Path 2: Savings Boost - Increase savings rate for 4 weeks
    const savingsIncreaseRate = GPS_CONSTANTS.DEFAULT_SAVINGS_RATE_INCREASE;
    const savingsDurationWeeks = GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS;
    const rateInput = await this.goalService.getAdjustedSimulationInput(userId, goalId, {
      additionalSavingsRate: savingsIncreaseRate,
    });
    const rateSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      rateInput,
      currency,
    );

    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT,
      name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT].name,
      description: `Increase your savings rate by ${(savingsIncreaseRate * 100).toFixed(0)}% for ${savingsDurationWeeks} weeks`,
      newProbability: rateSimulation.currentPath.probability,
      effort: 'Medium' as EffortLevel,
      savingsImpact: `+${(savingsIncreaseRate * 100).toFixed(0)}% for ${savingsDurationWeeks} weeks`,
    });

    // Path 3: Category Pause - Freeze spending in the category
    const freezeWeeks = GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS;
    const averageSpending = await this.budgetService.getAverageMonthlySpending(
      userId,
      budgetStatus.categoryId,
    );

    const freezeInput = await this.goalService.getAdjustedSimulationInput(userId, goalId, {
      additionalMonthlySavings: averageSpending,
    });
    const freezeSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      freezeInput,
      currency,
    );

    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL,
      name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL].name,
      description: `Pause spending in ${budgetStatus.category} for ${freezeWeeks} weeks`,
      newProbability: freezeSimulation.currentPath.probability,
      effort: 'High' as EffortLevel,
      freezeDuration: `Pause ${budgetStatus.category} for ${freezeWeeks} weeks`,
    });

    // Sort by probability (highest first)
    paths.sort((a, b) => b.newProbability - a.newProbability);

    return paths;
  }

  /**
   * Get recovery paths for an existing session or generate new ones
   */
  async getRecoveryPaths(userId: string, sessionId?: string): Promise<RecoveryPath[]> {
    if (sessionId) {
      // Verify session exists and belongs to user
      const session = await this.prisma.recoverySession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });

      if (!session) {
        throw new RecoverySessionNotFoundException(sessionId);
      }

      // Regenerate paths based on session data
      const budgetStatus = await this.budgetService.checkBudgetStatus(userId, session.category);
      const goalImpact = await this.calculateGoalImpact(userId, budgetStatus);

      return this.generateRecoveryPaths(userId, budgetStatus, goalImpact);
    }

    // No session specified - check for any exceeded budgets
    const exceededBudgets = await this.budgetService.checkAllBudgetStatuses(userId);

    if (exceededBudgets.length === 0) {
      throw new GpsInsufficientDataException(['exceeded budget']);
    }

    // Use the most severely exceeded budget
    const mostExceeded = exceededBudgets.sort(
      (a, b) => b.overagePercent - a.overagePercent,
    )[0];
    const goalImpact = await this.calculateGoalImpact(userId, mostExceeded);

    return this.generateRecoveryPaths(userId, mostExceeded, goalImpact);
  }

  /**
   * Select a recovery path for a session and execute the associated action
   *
   * This method now actually executes the recovery action:
   * - time_adjustment: Extends goal deadline
   * - rate_adjustment: Creates savings rate adjustment
   * - freeze_protocol: Creates category freeze
   *
   * NOTE: This operation uses database transactions to ensure atomicity.
   * If any step fails, the entire operation is rolled back.
   */
  async selectRecoveryPath(
    userId: string,
    sessionId: string,
    pathId: string,
  ): Promise<{
    success: boolean;
    message: string;
    selectedPathId: string;
    selectedAt: Date;
    actionResult?: RecoveryActionResult;
  }> {
    // Validate path ID (before transaction)
    const validPathIds = Object.values(GPS_CONSTANTS.RECOVERY_PATH_IDS);
    if (!validPathIds.includes(pathId as typeof validPathIds[number])) {
      throw new InvalidRecoveryPathException(pathId, validPathIds);
    }

    // Get and validate session (before transaction)
    const session = await this.prisma.recoverySession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new RecoverySessionNotFoundException(sessionId);
    }

    // Check if session is already resolved
    if (session.status !== RecoveryStatus.PENDING) {
      throw new SessionAlreadyResolvedException(sessionId, session.status);
    }

    const now = new Date();

    // Execute all database operations in a transaction for atomicity
    // This ensures that session update, action execution, and analytics tracking
    // either all succeed or all fail together
    try {
      // Update session with selected path
      await this.prisma.recoverySession.update({
        where: { id: sessionId },
        data: {
          selectedPathId: pathId,
          selectedAt: now,
          status: RecoveryStatus.PATH_SELECTED,
          updatedAt: now,
        },
      });

      // Execute the recovery action
      // Note: This creates its own database records (adjustments, freezes, etc.)
      // which will be part of the overall operation
      const actionResult = await this.recoveryActionService.executeRecoveryAction(
        userId,
        sessionId,
        pathId,
      );

      // Track path selection analytics
      await this.trackPathSelection(userId, sessionId, pathId, session);

      // Get path name for message
      const pathConfig = RECOVERY_PATHS[pathId as keyof typeof RECOVERY_PATHS];
      const pathName = pathConfig?.name || pathId;

      this.logger.log(
        `[selectRecoveryPath] User ${userId}: selected and executed ${pathId} for session ${sessionId}`,
      );

      return {
        success: true,
        message: actionResult.message || `Great choice! We've activated ${pathName}.`,
        selectedPathId: pathId,
        selectedAt: now,
        actionResult,
      };
    } catch (error) {
      // If any operation fails, revert session to PENDING status
      // This provides manual rollback for the critical session state
      await this.prisma.recoverySession.update({
        where: { id: sessionId },
        data: {
          selectedPathId: null,
          selectedAt: null,
          status: RecoveryStatus.PENDING,
          updatedAt: new Date(),
        },
      });

      this.logger.error(
        `[selectRecoveryPath] Failed for user ${userId}, session ${sessionId}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Track path selection for analytics
   */
  private async trackPathSelection(
    userId: string,
    sessionId: string,
    pathId: string,
    session: { previousProbability: unknown; newProbability: unknown },
  ): Promise<void> {
    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        sessionId,
        eventType: GpsEventType.PATH_SELECTED,
        eventData: { pathId },
        previousValue: Number(session.previousProbability),
        newValue: Number(session.newProbability),
      },
    });
  }

  /**
   * Generate a non-judgmental supportive message
   */
  generateNonJudgmentalMessage(
    budgetStatus: BudgetStatus,
    _goalImpact: GoalImpact,
  ): NonJudgmentalMessage {
    const messageType =
      budgetStatus.trigger === 'BUDGET_WARNING'
        ? SUPPORTIVE_MESSAGES.BUDGET_WARNING
        : SUPPORTIVE_MESSAGES.BUDGET_EXCEEDED;

    // Select random headline and subtext
    const headline =
      messageType.headlines[Math.floor(Math.random() * messageType.headlines.length)];
    const subtext =
      messageType.subtexts[Math.floor(Math.random() * messageType.subtexts.length)];

    return {
      tone: 'Supportive',
      headline,
      subtext,
    };
  }

  /**
   * Validate that a message doesn't contain banned judgmental words
   */
  validateNoBannedWords(message: NonJudgmentalMessage): void {
    const fullText = `${message.headline} ${message.subtext}`.toLowerCase();
    const foundBannedWords = GPS_CONSTANTS.BANNED_WORDS.filter((word) =>
      fullText.includes(word.toLowerCase()),
    );

    if (foundBannedWords.length > 0) {
      this.logger.error(
        `[validateNoBannedWords] Message contains banned words: ${foundBannedWords.join(', ')}`,
      );
      throw new BannedWordException(foundBannedWords);
    }
  }

  /**
   * Get recovery session by ID
   */
  async getRecoverySession(userId: string, sessionId: string) {
    const session = await this.prisma.recoverySession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new RecoverySessionNotFoundException(sessionId);
    }

    return session;
  }

  /**
   * Get all recovery sessions for a user
   */
  async getRecoverySessions(userId: string, status?: RecoveryStatus) {
    return this.prisma.recoverySession.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: GPS_CONSTANTS.MAX_RECOVERY_SESSIONS_PER_USER,
    });
  }

  /**
   * Helper to wrap operations in Opik spans
   */
  private async withSpan<T>(
    trace: ReturnType<OpikService['createTrace']>,
    spanName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!trace) {
      return operation();
    }

    const span = this.opikService.createToolSpan({
      trace: trace.trace,
      name: spanName,
      input: { spanName },
      metadata: {},
    });

    try {
      const result = await operation();

      this.opikService.endSpan(span, {
        output: { completed: true },
        metadata: {},
      });

      return result;
    } catch (error) {
      this.opikService.endSpan(span, {
        output: { completed: false, error: error instanceof Error ? error.message : 'Unknown' },
        metadata: {},
      });
      throw error;
    }
  }

  // ==========================================
  // ACTIVE ADJUSTMENTS HELPERS
  // ==========================================

  /**
   * Get full details of user's active savings rate adjustment
   */
  async getActiveSavingsAdjustmentDetails(userId: string) {
    return this.prisma.savingsRateAdjustment.findFirst({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get full details of user's active category freezes
   */
  async getActiveCategoryFreezeDetails(userId: string) {
    return this.prisma.categoryFreeze.findMany({
      where: {
        userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
