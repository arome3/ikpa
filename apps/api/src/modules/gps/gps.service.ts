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
import {
  RecoveryActionService,
  RecoveryActionResult,
  RecoveryActionDetails,
} from './recovery-action.service';
import {
  BudgetStatus,
  GoalImpact,
  RecoveryPath,
  NonJudgmentalMessage,
  RecoveryResponse,
  EffortLevel,
  MultiGoalImpact,
} from './interfaces';
import { createMonetaryValue } from '../../common/utils';
import { GPS_CONSTANTS, RECOVERY_PATHS, SUPPORTIVE_MESSAGES, GPS_TRACE_NAMES } from './constants';
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
          overspendAmount: Math.max(0, budgetStatus.spent.amount - budgetStatus.budgeted.amount),
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
    const overspendAmount = Math.max(0, budgetStatus.spent.amount - budgetStatus.budgeted.amount);
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
      this.simulationEngine.runDualPathSimulation(userId, previousInput, user?.currency || 'NGN'),
      this.simulationEngine.runDualPathSimulation(userId, currentInput, user?.currency || 'NGN'),
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

    // Create MonetaryValue for goal amount
    const currency = user?.currency || 'NGN';
    const goalAmountValue = createMonetaryValue(Number(goal.targetAmount), currency);

    return {
      goalId: goal.id,
      goalName: goal.name,
      goalAmount: goalAmountValue,
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
   *
   * Returns paths along with sessionId and category for context
   */
  async getRecoveryPaths(
    userId: string,
    sessionId?: string,
  ): Promise<{ paths: RecoveryPath[]; sessionId: string; category: string }> {
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

      const paths = await this.generateRecoveryPaths(userId, budgetStatus, goalImpact);
      return { paths, sessionId: session.id, category: session.category };
    }

    // No session specified - check for any exceeded budgets
    const exceededBudgets = await this.budgetService.checkAllBudgetStatuses(userId);

    if (exceededBudgets.length === 0) {
      throw new GpsInsufficientDataException(['exceeded budget']);
    }

    // Use the most severely exceeded budget
    const mostExceeded = exceededBudgets.sort((a, b) => b.overagePercent - a.overagePercent)[0];
    const goalImpact = await this.calculateGoalImpact(userId, mostExceeded);

    const paths = await this.generateRecoveryPaths(userId, mostExceeded, goalImpact);

    // Create a new session for tracking when no sessionId was provided
    const session = await this.prisma.recoverySession.create({
      data: {
        userId,
        goalId: goalImpact.goalId,
        category: mostExceeded.category,
        overspendAmount: Math.max(0, mostExceeded.spent.amount - mostExceeded.budgeted.amount),
        previousProbability: goalImpact.previousProbability,
        newProbability: goalImpact.newProbability,
        status: RecoveryStatus.PENDING,
      },
    });

    return { paths, sessionId: session.id, category: mostExceeded.category };
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
    details: RecoveryActionDetails;
    nextSteps: string[];
    actionResult?: RecoveryActionResult;
  }> {
    // Validate path ID (before transaction)
    const validPathIds = Object.values(GPS_CONSTANTS.RECOVERY_PATH_IDS);
    if (!validPathIds.includes(pathId as (typeof validPathIds)[number])) {
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

      // Generate helpful next steps based on the path selected
      const nextSteps = this.generateNextSteps(pathId, actionResult.details);

      this.logger.log(
        `[selectRecoveryPath] User ${userId}: selected and executed ${pathId} for session ${sessionId}`,
      );

      return {
        success: true,
        message: actionResult.message || `Great choice! We've activated ${pathName}.`,
        selectedPathId: pathId,
        selectedAt: now,
        details: actionResult.details,
        nextSteps,
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
   * Generate helpful next steps based on the recovery path selected
   */
  private generateNextSteps(pathId: string, details: RecoveryActionDetails): string[] {
    const steps: string[] = [];

    switch (pathId) {
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT:
        steps.push('Your goal deadline has been automatically updated');
        steps.push('Review your updated timeline in the Goals section');
        steps.push('Consider adjusting your budget to stay on track');
        if (details.newDeadline) {
          steps.push(`New target date: ${details.newDeadline.toLocaleDateString()}`);
        }
        break;

      case GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT:
        steps.push('Your savings rate boost is now active');
        if (details.boostAmount) {
          steps.push(`You are now saving an additional ${(details.boostAmount * 100).toFixed(1)}%`);
        }
        steps.push('Track your progress in the Dashboard');
        if (details.endDate) {
          steps.push(`Boost ends on ${details.endDate.toLocaleDateString()}`);
        }
        steps.push('Set up automatic transfers to make saving easier');
        break;

      case GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL:
        if (details.categoryFrozen) {
          steps.push(`Spending in ${details.categoryFrozen} is now paused`);
        }
        steps.push('You will receive alerts if you try to spend in this category');
        steps.push('Review your spending patterns to identify alternatives');
        if (details.endDate) {
          steps.push(`Freeze ends on ${details.endDate.toLocaleDateString()}`);
        }
        break;

      default:
        steps.push('Your recovery plan is now active');
        steps.push('Check back regularly to track your progress');
    }

    return steps;
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
    const subtext = messageType.subtexts[Math.floor(Math.random() * messageType.subtexts.length)];

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
  // WHAT-IF SIMULATION
  // ==========================================

  /**
   * Simulate the impact of additional spending without modifying database
   *
   * This is a READ-ONLY operation that helps users preview the consequences
   * of a purchase before committing. Answers: "What happens if I spend more?"
   */
  async simulateWhatIf(
    userId: string,
    category: string,
    additionalSpend: number,
    goalId?: string,
  ): Promise<{
    category: string;
    simulatedAmount: number;
    budgetImpact: {
      budgetAmount: number;
      currentSpending: number;
      projectedSpending: number;
      currentPercentUsed: number;
      projectedPercentUsed: number;
      remainingAfterSpend: number;
    };
    probabilityImpact: {
      goalId: string;
      goalName: string;
      currentProbability: number;
      projectedProbability: number;
      probabilityChange: number;
      changePercentPoints: number;
    };
    triggerPreview: {
      wouldTrigger: boolean;
      triggerLevel?: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';
      description: string;
    };
    recoveryPreview?: RecoveryPath[];
    recommendation: string;
    severity: 'low' | 'medium' | 'high';
  }> {
    // Get current budget status (without the additional spend)
    const currentStatus = await this.budgetService.checkBudgetStatus(userId, category);

    // Calculate projected values
    const budgetAmount = currentStatus.budgeted.amount;
    const currentSpending = currentStatus.spent.amount;
    const projectedSpending = currentSpending + additionalSpend;
    const currentPercentUsed = budgetAmount > 0 ? (currentSpending / budgetAmount) * 100 : 0;
    const projectedPercentUsed = budgetAmount > 0 ? (projectedSpending / budgetAmount) * 100 : 0;
    const remainingAfterSpend = budgetAmount - projectedSpending;

    // Get the goal for probability calculations
    const goal = goalId
      ? await this.goalService.getGoal(userId, goalId)
      : await this.goalService.getPrimaryGoal(userId);

    if (!goal) {
      throw new GpsInsufficientDataException(['active goal']);
    }

    // Get user currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const currency = user?.currency || 'NGN';

    // Calculate current probability
    const currentInput = await this.goalService.getSimulationInput(userId, goalId);
    const currentSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      currentInput,
      currency,
    );
    const currentProbability = currentSimulation.currentPath.probability;

    // Calculate projected probability (simulating the additional spend reducing savings)
    // We model this as the additional spend coming from what would have been saved
    const additionalSpendImpact = currentInput.monthlyIncome > 0
      ? additionalSpend / currentInput.monthlyIncome
      : 0;

    const projectedInput = {
      ...currentInput,
      currentSavingsRate: Math.max(0, currentInput.currentSavingsRate - additionalSpendImpact),
    };
    const projectedSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      projectedInput,
      currency,
    );
    const projectedProbability = projectedSimulation.currentPath.probability;

    const probabilityChange = projectedProbability - currentProbability;
    const changePercentPoints = Math.round(probabilityChange * 100);

    // Determine trigger level
    let triggerLevel: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL' | undefined;
    let wouldTrigger = false;
    let triggerDescription = 'This spend keeps you within safe limits.';

    const projectedRatio = projectedSpending / budgetAmount;

    if (projectedRatio >= GPS_CONSTANTS.BUDGET_CRITICAL_THRESHOLD) {
      wouldTrigger = true;
      triggerLevel = 'BUDGET_CRITICAL';
      triggerDescription = `This would put you at ${Math.round(projectedPercentUsed)}% of your budget - well over the limit.`;
    } else if (projectedRatio >= GPS_CONSTANTS.BUDGET_EXCEEDED_THRESHOLD) {
      wouldTrigger = true;
      triggerLevel = 'BUDGET_EXCEEDED';
      triggerDescription = `This would put you at ${Math.round(projectedPercentUsed)}% of your budget - over the limit.`;
    } else if (projectedRatio >= GPS_CONSTANTS.BUDGET_WARNING_THRESHOLD) {
      wouldTrigger = true;
      triggerLevel = 'BUDGET_WARNING';
      triggerDescription = `This would put you at ${Math.round(projectedPercentUsed)}% of your budget - approaching the limit.`;
    }

    // Generate recovery preview only if would trigger
    let recoveryPreview: RecoveryPath[] | undefined;
    if (wouldTrigger) {
      // Create a simulated budget status for path generation
      const simulatedStatus = {
        ...currentStatus,
        spent: createMonetaryValue(projectedSpending, currency),
        remaining: createMonetaryValue(remainingAfterSpend, currency),
        overagePercent: Math.max(0, (projectedSpending - budgetAmount) / budgetAmount * 100),
        trigger: triggerLevel as 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL',
      };

      const simulatedImpact = {
        goalId: goal.id,
        goalName: goal.name,
        goalAmount: createMonetaryValue(Number(goal.targetAmount), currency),
        goalDeadline: goal.targetDate || new Date(),
        previousProbability: currentProbability,
        newProbability: projectedProbability,
        probabilityDrop: probabilityChange,
        message: `Simulated probability drop of ${Math.abs(changePercentPoints)} percentage points`,
      };

      recoveryPreview = await this.generateRecoveryPaths(
        userId,
        simulatedStatus,
        simulatedImpact,
        goalId,
      );
    }

    // Determine severity and recommendation
    let severity: 'low' | 'medium' | 'high';
    let recommendation: string;

    if (!wouldTrigger && probabilityChange > -0.05) {
      severity = 'low';
      recommendation = `This purchase fits within your ${category} budget. Your goal remains on track.`;
    } else if (triggerLevel === 'BUDGET_WARNING' || probabilityChange >= -0.1) {
      severity = 'medium';
      recommendation = `This purchase would use ${Math.round(projectedPercentUsed)}% of your ${category} budget. Consider if it's essential.`;
    } else {
      severity = 'high';
      recommendation = `This purchase would significantly impact your budget and goal probability. Consider alternatives or delaying.`;
    }

    this.logger.log(
      `[simulateWhatIf] User ${userId}: simulated ₦${additionalSpend} in ${category}, ` +
      `probability impact: ${(probabilityChange * 100).toFixed(1)}pp, trigger: ${triggerLevel || 'none'}`,
    );

    return {
      category,
      simulatedAmount: additionalSpend,
      budgetImpact: {
        budgetAmount,
        currentSpending,
        projectedSpending,
        currentPercentUsed: Math.round(currentPercentUsed),
        projectedPercentUsed: Math.round(projectedPercentUsed),
        remainingAfterSpend,
      },
      probabilityImpact: {
        goalId: goal.id,
        goalName: goal.name,
        currentProbability,
        projectedProbability,
        probabilityChange,
        changePercentPoints,
      },
      triggerPreview: {
        wouldTrigger,
        triggerLevel,
        description: triggerDescription,
      },
      recoveryPreview,
      recommendation,
      severity,
    };
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

  /**
   * Get timeline extensions from time_adjustment recovery paths
   *
   * Queries RecoverySession records where selectedPathId = 'time_adjustment',
   * then fetches the associated goal and analytics event to get extension details.
   */
  async getTimelineExtensions(userId: string): Promise<
    Array<{
      goalId: string;
      goalName: string;
      originalDeadline: Date;
      newDeadline: Date;
      extensionDays: number;
      sessionId: string;
    }>
  > {
    // Find all sessions where time_adjustment was selected
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        userId,
        selectedPathId: GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
        status: { in: ['PATH_SELECTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      include: {
        goal: {
          select: {
            id: true,
            name: true,
            targetDate: true,
          },
        },
      },
      orderBy: { selectedAt: 'desc' },
    });

    const extensions: Array<{
      goalId: string;
      goalName: string;
      originalDeadline: Date;
      newDeadline: Date;
      extensionDays: number;
      sessionId: string;
    }> = [];

    for (const session of sessions) {
      if (!session.goal || !session.goalId) continue;

      // Get the analytics event that recorded the extension details
      const analyticsEvent = await this.prisma.gpsAnalyticsEvent.findFirst({
        where: {
          sessionId: session.id,
          eventType: GpsEventType.RECOVERY_STARTED,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!analyticsEvent?.eventData) continue;

      // Extract deadline details from eventData
      const eventData = analyticsEvent.eventData as {
        pathId?: string;
        action?: string;
        details?: {
          previousValue?: string | Date;
          newValue?: string | Date;
          duration?: string;
        };
      };

      if (eventData.action !== 'DEADLINE_EXTENDED' || !eventData.details) continue;

      const { previousValue, newValue, duration } = eventData.details;

      // Parse the dates
      const originalDeadline = previousValue ? new Date(previousValue) : null;
      const newDeadline = newValue ? new Date(newValue) : session.goal.targetDate;

      if (!originalDeadline || !newDeadline) continue;

      // Calculate extension days (or extract from duration string like "2 weeks")
      let extensionDays = 0;
      if (duration) {
        const weeksMatch = duration.match(/(\d+)\s*weeks?/i);
        if (weeksMatch) {
          extensionDays = parseInt(weeksMatch[1], 10) * 7;
        }
      }

      // Fallback: calculate from date difference
      if (extensionDays === 0) {
        extensionDays = Math.round(
          (newDeadline.getTime() - originalDeadline.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      extensions.push({
        goalId: session.goal.id,
        goalName: session.goal.name,
        originalDeadline,
        newDeadline,
        extensionDays,
        sessionId: session.id,
      });
    }

    return extensions;
  }
}
