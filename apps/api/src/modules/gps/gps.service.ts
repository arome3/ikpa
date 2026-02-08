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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStatus, GpsEventType } from '@prisma/client';
import { OpikService } from '../ai/opik/opik.service';
import { AnthropicService } from '../ai/anthropic/anthropic.service';
import { SimulationEngineCalculator } from '../finance/calculators/simulation-engine.calculator';

import { CommitmentRiskService, CommitmentRiskAssessment } from '../commitment/commitment-risk.service';
import { BudgetService } from './budget.service';
import { GoalService } from './goal.service';
import { StreakService } from './streaks';
import {
  RecoveryActionService,
  RecoveryActionResult,
  RecoveryActionDetails,
} from './recovery-action.service';
import { GpsRerouterAgent } from './agents';
import {
  BudgetStatus,
  GoalImpact,
  RecoveryPath,
  NonJudgmentalMessage,
  RecoveryResponse,
  EffortLevel,
  MultiGoalImpact,
  TimelineTranslation,
  RecoveryProgress,
  RecoveryHistoryEntry,
} from './interfaces';
import { createMonetaryValue, formatCurrency } from '../../common/utils';
import { GPS_CONSTANTS, RECOVERY_PATHS, SUPPORTIVE_MESSAGES, GPS_TRACE_NAMES, ACTION_TEMPLATES } from './constants';
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
    private readonly anthropicService: AnthropicService,
    private readonly eventEmitter: EventEmitter2,
    private readonly simulationEngine: SimulationEngineCalculator,
    private readonly budgetService: BudgetService,
    private readonly goalService: GoalService,
    @Inject(forwardRef(() => RecoveryActionService))
    private readonly recoveryActionService: RecoveryActionService,
    private readonly gpsRerouterAgent: GpsRerouterAgent,
    private readonly commitmentRiskService: CommitmentRiskService,
    private readonly streakService: StreakService,
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

      // Step 2: Calculate multi-goal impact (returns null when no goals exist)
      const multiGoalImpact = await this.calculateMultiGoalImpact(userId, budgetStatus);

      // Determine goal impact: null when user has no goals (budget-only mode)
      let goalImpact: GoalImpact | null = null;
      let effectiveGoalId: string | undefined;

      if (multiGoalImpact) {
        // User has goals - calculate impact
        goalImpact = goalId
          ? await this.withSpan(trace, GPS_TRACE_NAMES.CALCULATE_IMPACT, () =>
              this.calculateGoalImpact(userId, budgetStatus, goalId!),
            )
          : multiGoalImpact.primaryGoal;

        effectiveGoalId = goalId || goalImpact.goalId;

        // Translate probability to timeline
        try {
          const simulationInput = await this.goalService.getSimulationInput(userId, effectiveGoalId);
          const timeline = this.translateToTimeline(goalImpact, simulationInput);
          goalImpact.projectedDate = timeline.projectedDate;
          goalImpact.humanReadable = timeline.humanReadable;
          goalImpact.scheduleStatus = timeline.scheduleStatus;
        } catch (err) {
          this.logger.warn(`[recalculate] Timeline translation failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      } else {
        this.logger.log(`[recalculate] User ${userId} has no active goals, running in budget-only mode`);
      }

      // Step 2.5: Check active commitment risk (only if goals exist)
      let commitmentAtRisk: CommitmentRiskAssessment | undefined;
      if (effectiveGoalId) {
        try {
          commitmentAtRisk = await this.commitmentRiskService.assessCommitmentRisk(userId, effectiveGoalId);
          if (!commitmentAtRisk.hasActiveCommitment) commitmentAtRisk = undefined;
        } catch (err) {
          this.logger.warn(`[recalculate] Commitment risk check failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }

      // Step 3: Generate recovery paths (budget-only when no goals)
      const recoveryPaths = await this.withSpan(trace, GPS_TRACE_NAMES.GENERATE_PATHS, () =>
        goalImpact
          ? this.generateRecoveryPaths(userId, budgetStatus, goalImpact, effectiveGoalId)
          : this.generateBudgetOnlyRecoveryPaths(userId, budgetStatus),
      );

      // Step 4: Generate supportive message (AI agent with fallback)
      const message = goalImpact && multiGoalImpact
        ? await this.generateMessage(userId, budgetStatus, goalImpact, multiGoalImpact, recoveryPaths)
        : this.generateBudgetOnlyMessage(budgetStatus);

      // Validate message doesn't contain banned words
      this.validateNoBannedWords(message);

      // Extract adaptive timeline weeks from the timeline path (if present)
      const timelinePath = recoveryPaths.find(
        (p) => p.id === GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
      );
      const adaptiveTimelineWeeks = timelinePath?.timelineImpact
        ? this.parseTimelineWeeks(timelinePath.timelineImpact)
        : null;

      // Step 5: Create recovery session
      const session = await this.prisma.recoverySession.create({
        data: {
          userId,
          goalId: goalImpact?.goalId || null,
          category,
          overspendAmount: Math.max(0, budgetStatus.spent.amount - budgetStatus.budgeted.amount),
          budgetAmount: budgetStatus.budgeted.amount,
          timelineWeeks: adaptiveTimelineWeeks,
          previousProbability: goalImpact?.previousProbability ?? 0,
          newProbability: goalImpact?.newProbability ?? 0,
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
          probabilityDrop: goalImpact?.probabilityDrop ?? 0,
          pathsGenerated: recoveryPaths.length,
          goalsAffected: multiGoalImpact?.summary.totalGoalsAffected ?? 0,
          budgetOnlyMode: !goalImpact,
          durationMs,
        },
      });

      if (goalImpact) {
        this.logger.log(
          `[recalculate] User ${userId}: session ${session.id} created, ` +
            `probability ${(goalImpact.previousProbability * 100).toFixed(1)}% -> ` +
            `${(goalImpact.newProbability * 100).toFixed(1)}%, ` +
            `${multiGoalImpact?.summary.totalGoalsAffected ?? 0} goals affected (${durationMs}ms)`,
        );
      } else {
        this.logger.log(
          `[recalculate] User ${userId}: session ${session.id} created (budget-only mode), ` +
            `${recoveryPaths.length} paths generated (${durationMs}ms)`,
        );
      }

      return {
        sessionId: session.id,
        budgetStatus,
        goalImpact,
        multiGoalImpact,
        recoveryPaths,
        message,
        commitmentAtRisk,
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
        ? `Your ${goal.name} probability decreased by ${dropPercent} percentage points`
        : probabilityDrop > 0
          ? `Your ${goal.name} probability actually increased by ${dropPercent} percentage points`
          : `Your ${goal.name} probability remains unchanged`;

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
  ): Promise<MultiGoalImpact | null> {
    // Get all active goals
    const activeGoals = await this.goalService.getActiveGoals(userId);

    if (activeGoals.length === 0) {
      return null;
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
      return null;
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

    // Smart Swap: Check if we can rebalance from a surplus category
    try {
      const rebalanceCount = await this.budgetService.getRebalanceCountInPeriod(userId);
      if (rebalanceCount < GPS_CONSTANTS.MAX_REBALANCES_PER_PERIOD) {
        const surplusCategories = await this.budgetService.findCategoriesWithSurplus(
          userId,
          budgetStatus.categoryId,
        );

        if (surplusCategories.length > 0) {
          const bestSurplus = surplusCategories[0];
          const overspendAmount = Math.max(
            0,
            budgetStatus.spent.amount - budgetStatus.budgeted.amount,
          );
          const coverageAmount = Math.min(overspendAmount, bestSurplus.proratedSurplus);
          const isFullCoverage = bestSurplus.proratedSurplus >= overspendAmount;

          // Simulate: if we neutralize the overspend, what's the probability?
          const rebalanceInput = await this.goalService.getAdjustedSimulationInput(
            userId,
            goalId,
            { additionalMonthlySavings: coverageAmount },
          );
          const rebalanceSimulation = await this.simulationEngine.runDualPathSimulation(
            userId,
            rebalanceInput,
            currency,
          );

          const formattedSurplus = formatCurrency(bestSurplus.proratedSurplus, currency);
          const formattedCoverage = formatCurrency(coverageAmount, currency);

          const description = isFullCoverage
            ? `Cover this with your ${bestSurplus.categoryName} surplus (${formattedSurplus} available)`
            : `Partially cover with ${bestSurplus.categoryName} surplus (${formattedCoverage} of ${formatCurrency(overspendAmount, currency)})`;

          paths.push({
            id: GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE,
            name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE].name,
            description,
            newProbability: rebalanceSimulation.currentPath.probability,
            effort: 'None' as EffortLevel,
            rebalanceInfo: {
              fromCategory: bestSurplus.categoryName,
              fromCategoryId: bestSurplus.categoryId,
              availableSurplus: bestSurplus.proratedSurplus,
              coverageAmount,
              isFullCoverage,
            },
          });
        }
      }
    } catch (error) {
      // If rebalance detection fails, log but continue with other paths
      this.logger.warn(
        `[generateRecoveryPaths] Smart Swap check failed for user ${userId}: ${error}`,
      );
    }

    // Get base simulation input to assess the financial gap
    const baseInput = await this.goalService.getSimulationInput(userId, goalId);
    const monthlySavings = baseInput.monthlyIncome * baseInput.currentSavingsRate;
    const gap = Math.max(0, baseInput.goalAmount - Math.max(0, baseInput.currentNetWorth));
    const monthsToDeadline = this.monthsBetween(new Date(), baseInput.goalDeadline);
    const monthsNeeded = monthlySavings > 0 ? Math.ceil(gap / monthlySavings) : 999;
    const shortfall = Math.max(0, monthsNeeded - monthsToDeadline);

    // Path 1: Timeline Flex - Adaptive deadline extension
    // If the default 2 weeks can't help, scale up to what's actually needed
    const baseTimelineWeeks = GPS_CONSTANTS.DEFAULT_TIMELINE_EXTENSION_WEEKS;
    const adaptiveTimelineWeeks = shortfall > 0
      ? Math.max(baseTimelineWeeks, Math.min(104, Math.ceil(shortfall * 4.33 * 1.15)))
      : baseTimelineWeeks;
    const timelineInput = await this.goalService.getAdjustedSimulationInput(userId, goalId, {
      weeksExtension: adaptiveTimelineWeeks,
    });
    const timelineSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      timelineInput,
      currency,
    );

    const timelineMonths = Math.round(adaptiveTimelineWeeks / 4.33);
    const goalLabel = _goalImpact.goalName || 'your goal';
    const timelineDesc = adaptiveTimelineWeeks <= 8
      ? `Extend your ${goalLabel} deadline by ${adaptiveTimelineWeeks} weeks`
      : `Extend your ${goalLabel} deadline by ~${timelineMonths} months`;

    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
      name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT].name,
      description: timelineDesc,
      newProbability: timelineSimulation.currentPath.probability,
      effort: 'Low' as EffortLevel,
      timelineImpact: adaptiveTimelineWeeks <= 8
        ? `+${adaptiveTimelineWeeks} weeks`
        : `+${timelineMonths} months`,
    });

    // Path 2: Savings Boost - Increase savings rate + modest timeline extension if needed
    const savingsIncreaseRate = GPS_CONSTANTS.DEFAULT_SAVINGS_RATE_INCREASE;
    const savingsDurationWeeks = GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS;
    // When timeline is tight, combine savings boost with a moderate extension
    const boostTimelineWeeks = shortfall > 0
      ? Math.max(0, Math.min(78, Math.ceil(shortfall * 4.33 * 0.85)))
      : 0;
    const rateInput = await this.goalService.getAdjustedSimulationInput(userId, goalId, {
      additionalSavingsRate: savingsIncreaseRate,
      weeksExtension: boostTimelineWeeks,
    });
    const rateSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      rateInput,
      currency,
    );

    const boostDesc = boostTimelineWeeks > 0
      ? `Boost savings by ${(savingsIncreaseRate * 100).toFixed(0)}% and extend ${goalLabel} deadline by ~${Math.round(boostTimelineWeeks / 4.33)} months`
      : `Increase your savings rate by ${(savingsIncreaseRate * 100).toFixed(0)}% for ${savingsDurationWeeks} weeks`;

    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT,
      name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT].name,
      description: boostDesc,
      newProbability: rateSimulation.currentPath.probability,
      effort: 'Medium' as EffortLevel,
      savingsImpact: boostTimelineWeeks > 0
        ? `+${(savingsIncreaseRate * 100).toFixed(0)}% savings + ${Math.round(boostTimelineWeeks / 4.33)}mo`
        : `+${(savingsIncreaseRate * 100).toFixed(0)}% for ${savingsDurationWeeks} weeks`,
    });

    // Path 3: Category Pause - Freeze spending + modest timeline extension if needed
    const freezeWeeks = GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS;
    const averageSpending = await this.budgetService.getAverageMonthlySpending(
      userId,
      budgetStatus.categoryId,
    );

    const freezeTimelineWeeks = shortfall > 0
      ? Math.max(0, Math.min(78, Math.ceil(shortfall * 4.33 * 0.85)))
      : 0;
    const freezeInput = await this.goalService.getAdjustedSimulationInput(userId, goalId, {
      additionalMonthlySavings: averageSpending,
      weeksExtension: freezeTimelineWeeks,
    });
    const freezeSimulation = await this.simulationEngine.runDualPathSimulation(
      userId,
      freezeInput,
      currency,
    );

    const freezeDesc = freezeTimelineWeeks > 0
      ? `Pause ${budgetStatus.category} spending and extend ${goalLabel} deadline by ~${Math.round(freezeTimelineWeeks / 4.33)} months`
      : `Pause spending in ${budgetStatus.category} for ${freezeWeeks} weeks`;

    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL,
      name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL].name,
      description: freezeDesc,
      newProbability: freezeSimulation.currentPath.probability,
      effort: 'High' as EffortLevel,
      freezeDuration: freezeTimelineWeeks > 0
        ? `Pause ${budgetStatus.category} + extend ${Math.round(freezeTimelineWeeks / 4.33)}mo`
        : `Pause ${budgetStatus.category} for ${freezeWeeks} weeks`,
    });

    // Sort by probability (highest first)
    paths.sort((a, b) => (b.newProbability ?? 0) - (a.newProbability ?? 0));

    // Add timeline effect to each path
    try {
      const currentInput = await this.goalService.getSimulationInput(userId, goalId);
      const currentTimeline = this.translateToTimeline(_goalImpact, currentInput);

      for (const path of paths) {
        if (path.newProbability !== null && path.newProbability > (_goalImpact.newProbability ?? 0)) {
          // Estimate the improved projected date
          const improvementRatio = path.newProbability / Math.max(0.01, _goalImpact.newProbability);
          const improvedMonths = Math.max(1, Math.round(currentTimeline.monthsToGoal / improvementRatio));
          const improvedDate = new Date();
          improvedDate.setMonth(improvedDate.getMonth() + improvedMonths);
          const currentMonth = currentTimeline.projectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const improvedMonth = improvedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          if (currentMonth !== improvedMonth) {
            path.timelineEffect = `Moves your projected date from ${currentMonth} to ${improvedMonth}`;
          } else {
            path.timelineEffect = `Keeps you on track for ${improvedMonth}`;
          }
        }
      }
    } catch (err) {
      this.logger.warn(`[generateRecoveryPaths] Timeline effect calculation failed: ${err}`);
    }

    // Attach concrete daily actions to each path
    const overspendAmount = Math.max(0, budgetStatus.spent.amount - budgetStatus.budgeted.amount);
    for (const path of paths) {
      path.concreteActions = this.generateConcreteActions(budgetStatus.categoryId, overspendAmount);
    }

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

      // Regenerate paths based on session data, using the session's saved goalId
      const budgetStatus = await this.budgetService.checkBudgetStatus(userId, session.category);

      let paths: RecoveryPath[];
      if (session.goalId) {
        const goalImpact = await this.calculateGoalImpact(userId, budgetStatus, session.goalId);
        paths = await this.generateRecoveryPaths(userId, budgetStatus, goalImpact, session.goalId);
      } else {
        paths = await this.generateBudgetOnlyRecoveryPaths(userId, budgetStatus);
      }
      return { paths, sessionId: session.id, category: session.category };
    }

    // No session specified - check for any exceeded budgets
    const exceededBudgets = await this.budgetService.checkAllBudgetStatuses(userId);

    if (exceededBudgets.length === 0) {
      throw new GpsInsufficientDataException(['exceeded budget']);
    }

    // Use the most severely exceeded budget
    const mostExceeded = exceededBudgets.sort((a, b) => b.overagePercent - a.overagePercent)[0];

    // Pick the most-affected goal (or null if no goals exist)
    const multiGoalImpact = await this.calculateMultiGoalImpact(userId, mostExceeded);
    const goalImpact = multiGoalImpact?.primaryGoal ?? null;

    const paths = goalImpact
      ? await this.generateRecoveryPaths(userId, mostExceeded, goalImpact, goalImpact.goalId)
      : await this.generateBudgetOnlyRecoveryPaths(userId, mostExceeded);

    // Extract adaptive timeline weeks from the timeline path (if present)
    const timelinePath = paths.find(
      (p) => p.id === GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
    );
    const adaptiveWeeks = timelinePath?.timelineImpact
      ? this.parseTimelineWeeks(timelinePath.timelineImpact)
      : null;

    // Create a new session for tracking when no sessionId was provided
    const session = await this.prisma.recoverySession.create({
      data: {
        userId,
        goalId: goalImpact?.goalId || null,
        category: mostExceeded.category,
        overspendAmount: Math.max(0, mostExceeded.spent.amount - mostExceeded.budgeted.amount),
        budgetAmount: mostExceeded.budgeted.amount,
        timelineWeeks: adaptiveWeeks,
        previousProbability: goalImpact?.previousProbability ?? 0,
        newProbability: goalImpact?.newProbability ?? 0,
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

      // Get goal name for contextual next steps
      let goalName: string | undefined;
      if (session.goalId) {
        const goal = await this.prisma.goal.findUnique({
          where: { id: session.goalId },
          select: { name: true },
        });
        goalName = goal?.name ?? undefined;
      }

      // Generate helpful next steps based on the path selected
      const nextSteps = this.generateNextSteps(pathId, actionResult.details, goalName);

      this.logger.log(
        `[selectRecoveryPath] User ${userId}: selected and executed ${pathId} for session ${sessionId}`,
      );

      // Emit cross-agent coordination event for Future Self reinforcement
      this.eventEmitter.emit('gps.recovery.path_selected', {
        userId,
        sessionId,
        pathId,
        goalId: session.goalId,
        pathName,
        actionResult: {
          message: actionResult.message,
          details: actionResult.details,
        },
      });

      // Check and award recovery-related achievements (fire-and-forget)
      this.streakService.checkFirstRecoveryAchievement(userId).catch(() => {});
      this.streakService.checkComebackAchievement(userId).catch(() => {});

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
  private generateNextSteps(pathId: string, details: RecoveryActionDetails, goalName?: string): string[] {
    const steps: string[] = [];

    switch (pathId) {
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT:
        steps.push(goalName
          ? `Your "${goalName}" goal deadline has been automatically updated`
          : 'Your goal deadline has been automatically updated');
        steps.push('Review your updated timeline in the Goals section');
        steps.push('Consider adjusting your budget to stay on track');
        if (details.previousDeadline && details.newDeadline) {
          steps.push(`Deadline moved from ${details.previousDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → ${details.newDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
        } else if (details.newDeadline) {
          steps.push(`New target date: ${details.newDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
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

      case GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE:
        if (details.fromCategory && details.toCategory) {
          steps.push(`Budget moved from ${details.fromCategory} to ${details.toCategory}`);
        }
        steps.push('Your savings goal remains on track');
        steps.push('Monitor both categories for the rest of this period');
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
   * Generate a supportive message using the AI agent with graceful fallback
   *
   * If Claude is available: uses GpsRerouterAgent for personalized messages
   * If Claude is unavailable: falls back to static template picker
   */
  private async generateMessage(
    userId: string,
    budgetStatus: BudgetStatus,
    goalImpact: GoalImpact,
    multiGoalImpact: MultiGoalImpact,
    recoveryPaths: RecoveryPath[],
  ): Promise<NonJudgmentalMessage> {
    // Check if AI agent is available
    const aiAvailable = this.anthropicService.isAvailable();
    if (aiAvailable) {
      try {
        const message = await this.gpsRerouterAgent.generatePersonalizedMessage(
          userId,
          budgetStatus,
          goalImpact,
          multiGoalImpact,
          recoveryPaths,
        );
        this.logger.log(`[generateMessage] AI agent generated personalized message for user ${userId}`);
        return message;
      } catch (error) {
        this.logger.warn(
          `[generateMessage] AI agent failed (anthropic.isAvailable=${aiAvailable}), falling back to static templates`,
        );
        this.logger.warn(
          `[generateMessage] Error details: ${error instanceof Error ? error.stack || error.message : 'Unknown error'}`,
        );
      }
    } else {
      this.logger.log(`[generateMessage] Anthropic not available, using static templates for user ${userId}`);
    }

    // Fallback: use static template picker
    return this.generateNonJudgmentalMessage(budgetStatus, goalImpact);
  }

  /**
   * Generate a non-judgmental supportive message (static template fallback)
   */
  generateNonJudgmentalMessage(
    budgetStatus: BudgetStatus,
    _goalImpact: GoalImpact,
  ): NonJudgmentalMessage {
    const messageType =
      budgetStatus.trigger === 'BUDGET_WARNING'
        ? SUPPORTIVE_MESSAGES.BUDGET_WARNING
        : SUPPORTIVE_MESSAGES.BUDGET_EXCEEDED;

    // Select random headline and subtext, replacing {goal} with actual goal name
    const goalName = _goalImpact.goalName || 'your goal';
    const headline =
      messageType.headlines[Math.floor(Math.random() * messageType.headlines.length)];
    const subtext = messageType.subtexts[Math.floor(Math.random() * messageType.subtexts.length)]
      .replace('{goal}', goalName);

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
   * Generate concrete daily actions based on the budget category and overspend amount
   *
   * Looks up the category in ACTION_TEMPLATES (falls back to 'other'),
   * filters actions where minOverage <= overspendAmount, and returns
   * the top 3 sorted by weeklySavings descending with savings prefix.
   */
  private generateConcreteActions(categoryId: string, overspendAmount: number): string[] {
    // Normalize category ID to match template keys (e.g., 'food-dining')
    const normalizedId = categoryId.toLowerCase().replace(/[\s&]+/g, '-');
    const templates = ACTION_TEMPLATES[normalizedId] || ACTION_TEMPLATES['other'];

    // Filter actions applicable to this overage level
    const applicable = templates.filter((t) => t.minOverage <= overspendAmount);

    // Sort by weeklySavings descending, take top 3
    const sorted = [...applicable].sort((a, b) => b.weeklySavings - a.weeklySavings);
    const top3 = sorted.slice(0, 3);

    // Format with savings estimate prefix
    return top3.map((t) => `${t.action} \u2192 saves ~$${t.weeklySavings}/week`);
  }

  /**
   * Get recovery progress for an active recovery session
   *
   * Calculates adherence based on path type:
   * - rate_adjustment: compare actual savings vs target during boost period
   * - freeze_protocol: check if expenses added in frozen category
   * - time_adjustment: check if spending pace has improved
   * - category_rebalance: check if both categories within new effective limits
   */
  async getRecoveryProgress(userId: string, sessionId: string): Promise<RecoveryProgress> {
    const session = await this.prisma.recoverySession.findFirst({
      where: { id: sessionId, userId },
      include: { goal: { select: { name: true } } },
    });

    if (!session) {
      throw new RecoverySessionNotFoundException(sessionId);
    }

    const pathId = session.selectedPathId || 'unknown';
    const pathConfig = RECOVERY_PATHS[pathId as keyof typeof RECOVERY_PATHS];
    const pathName = pathConfig?.name || pathId;

    const startDate = session.selectedAt || session.createdAt;
    let endDate: Date;
    let targetSaved = Number(session.overspendAmount);
    let actualSaved = 0;

    // Determine end date and calculate adherence based on path type
    if (pathId === GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT) {
      const adjustment = await this.prisma.savingsRateAdjustment.findFirst({
        where: { sessionId, userId },
        orderBy: { createdAt: 'desc' },
      });
      endDate = adjustment?.endDate || new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000);
      if (adjustment) {
        targetSaved = Number(adjustment.additionalRate) * (await this.getMonthlyIncome(userId)) * (adjustment.durationWeeks / 4);
        // Estimate actual savings: (income - expenses) during the boost period
        const expenses = await this.getExpensesSince(userId, startDate);
        const income = await this.getMonthlyIncome(userId);
        const elapsedMonths = Math.max(0.1, (Date.now() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
        actualSaved = Math.max(0, income * elapsedMonths - expenses);
      }
    } else if (pathId === GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL) {
      const freeze = await this.prisma.categoryFreeze.findFirst({
        where: { sessionId, userId },
        orderBy: { createdAt: 'desc' },
      });
      endDate = freeze?.endDate || new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000);
      if (freeze) {
        targetSaved = Number(freeze.savedAmount);
        // Check if any expenses were added in the frozen category during freeze
        const frozenExpenses = await this.prisma.expense.aggregate({
          where: {
            userId,
            categoryId: freeze.categoryId,
            date: { gte: freeze.startDate, lte: new Date() },
          },
          _sum: { amount: true },
        });
        const spentInFrozen = Number(frozenExpenses._sum.amount || 0);
        actualSaved = Math.max(0, targetSaved - spentInFrozen);
      }
    } else if (pathId === GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT) {
      const weeks = session.timelineWeeks || GPS_CONSTANTS.DEFAULT_TIMELINE_EXTENSION_WEEKS;
      endDate = new Date(startDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
      // For timeline extension, check if spending pace has slowed
      const budgetStatus = await this.budgetService.checkBudgetStatus(userId, session.category);
      const spentPercent = budgetStatus.budgeted.amount > 0
        ? budgetStatus.spent.amount / budgetStatus.budgeted.amount
        : 0;
      actualSaved = spentPercent <= 1 ? targetSaved : targetSaved * (1 - (spentPercent - 1));
    } else {
      // category_rebalance or unknown
      endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      actualSaved = targetSaved; // Rebalances are instant
    }

    const now = new Date();
    const daysTotal = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const daysElapsed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const daysRemaining = Math.max(0, daysTotal - daysElapsed);

    const adherence = targetSaved > 0
      ? Math.min(100, Math.round((actualSaved / targetSaved) * 100))
      : 100;

    let status: RecoveryProgress['status'];
    if (daysRemaining <= 0) {
      status = adherence >= 70 ? 'completed' : 'failed';
    } else if (adherence >= 60) {
      status = 'on_track';
    } else {
      status = 'at_risk';
    }

    // Generate encouraging message
    const weekNum = Math.ceil(daysElapsed / 7);
    const totalWeeks = Math.ceil(daysTotal / 7);
    let message: string;
    if (status === 'completed') {
      message = `Recovery complete! You saved $${Math.round(actualSaved)} of your $${Math.round(targetSaved)} target.`;
    } else if (status === 'on_track') {
      message = `Week ${weekNum} of ${totalWeeks}: You've saved $${Math.round(actualSaved)} of your $${Math.round(targetSaved)} target. Keep it up!`;
    } else if (status === 'at_risk') {
      message = `Week ${weekNum} of ${totalWeeks}: You've saved $${Math.round(actualSaved)} of $${Math.round(targetSaved)}. Consider picking up the pace.`;
    } else {
      message = `Recovery period ended. You saved $${Math.round(actualSaved)} of your $${Math.round(targetSaved)} target.`;
    }

    return {
      sessionId,
      pathId,
      pathName,
      startDate,
      endDate,
      daysTotal,
      daysElapsed,
      daysRemaining,
      adherence,
      status,
      actualSaved,
      targetSaved,
      message,
    };
  }

  /**
   * Get recovery history - past recovery sessions with outcomes
   */
  async getRecoveryHistory(userId: string): Promise<RecoveryHistoryEntry[]> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        userId,
        selectedPathId: { not: null },
        status: { in: ['COMPLETED', 'ABANDONED', 'PATH_SELECTED', 'IN_PROGRESS'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const history: RecoveryHistoryEntry[] = [];

    for (const session of sessions) {
      const target = Number(session.overspendAmount);
      let actual = 0;

      // Try to calculate actual savings based on the path type
      if (session.selectedPathId === GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL) {
        const freeze = await this.prisma.categoryFreeze.findFirst({
          where: { sessionId: session.id, userId },
        });
        if (freeze) {
          const frozenExpenses = await this.prisma.expense.aggregate({
            where: {
              userId,
              categoryId: freeze.categoryId,
              date: { gte: freeze.startDate, lte: freeze.endDate },
            },
            _sum: { amount: true },
          });
          actual = Math.max(0, Number(freeze.savedAmount) - Number(frozenExpenses._sum.amount || 0));
        }
      } else if (session.selectedPathId === GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT) {
        const adjustment = await this.prisma.savingsRateAdjustment.findFirst({
          where: { sessionId: session.id, userId },
        });
        if (adjustment) {
          actual = Number(adjustment.additionalRate) * (await this.getMonthlyIncome(userId)) * (adjustment.durationWeeks / 4);
        }
      } else if (session.selectedPathId === GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE) {
        const rebalance = await this.prisma.budgetRebalance.findFirst({
          where: { sessionId: session.id, userId },
        });
        actual = rebalance ? Number(rebalance.amount) : 0;
      } else {
        actual = target; // Timeline adjustments are always "successful"
      }

      const pathConfig = RECOVERY_PATHS[session.selectedPathId as keyof typeof RECOVERY_PATHS];

      history.push({
        date: session.createdAt,
        category: session.category,
        pathChosen: pathConfig?.name || session.selectedPathId || 'Unknown',
        target,
        actual,
        success: actual >= target * 0.7, // 70% threshold for success
      });
    }

    return history;
  }

  /**
   * Helper: Get user's monthly income
   */
  private async getMonthlyIncome(userId: string): Promise<number> {
    try {
      const input = await this.goalService.getSimulationInput(userId);
      return input.monthlyIncome;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: Get total expenses since a date
   */
  private async getExpensesSince(userId: string, since: Date): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      where: {
        userId,
        date: { gte: since },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount || 0);
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
      include: {
        goal: {
          select: { name: true },
        },
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

  /**
   * Parse timeline weeks from a timelineImpact string like "+22 months" or "+4 weeks"
   */
  private parseTimelineWeeks(timelineImpact: string): number | null {
    const weeksMatch = timelineImpact.match(/\+(\d+)\s*weeks?/i);
    if (weeksMatch) return parseInt(weeksMatch[1], 10);

    const monthsMatch = timelineImpact.match(/\+(\d+)\s*months?/i);
    if (monthsMatch) return Math.round(parseInt(monthsMatch[1], 10) * 4.33);

    return null;
  }


  /**
   * Translate goal probability into a concrete projected date
   *
   * Converts abstract probability numbers into human-readable timeline information
   * like "You'll likely reach Emergency Fund by August 2026" and "3 months behind schedule"
   */
  private translateToTimeline(goalImpact: GoalImpact, simulationInput: { monthlyIncome: number; currentSavingsRate: number; goalAmount: number; currentNetWorth: number }): TimelineTranslation {
    const monthlySavings = simulationInput.monthlyIncome * simulationInput.currentSavingsRate;
    const remaining = Math.max(0, simulationInput.goalAmount - simulationInput.currentNetWorth);
    const monthsNeeded = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : Infinity;

    const projectedDate = new Date();
    if (monthsNeeded !== Infinity) {
      projectedDate.setMonth(projectedDate.getMonth() + monthsNeeded);
    } else {
      // Set far future if no savings
      projectedDate.setFullYear(projectedDate.getFullYear() + 99);
    }

    const deadlineDate = new Date(goalImpact.goalDeadline);
    const diffMonths = (projectedDate.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    let scheduleStatus: string;
    if (monthsNeeded === Infinity) {
      scheduleStatus = 'no savings toward this goal';
    } else if (diffMonths <= 0) {
      scheduleStatus = `${Math.abs(Math.round(diffMonths))} months ahead of schedule`;
    } else if (diffMonths < 1) {
      scheduleStatus = 'roughly on track';
    } else {
      scheduleStatus = `${Math.round(diffMonths)} months behind schedule`;
    }

    const humanReadable = monthsNeeded !== Infinity
      ? `You'll likely reach ${goalImpact.goalName} by ${projectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : `At current savings, ${goalImpact.goalName} cannot be projected`;

    return {
      projectedDate,
      humanReadable,
      scheduleStatus,
      monthsToGoal: monthsNeeded,
    };
  }

  /**
   * Generate budget-only recovery paths when user has no financial goals
   *
   * These paths focus purely on getting spending back under control
   * without any Monte Carlo probability calculations.
   */
  private async generateBudgetOnlyRecoveryPaths(
    userId: string,
    budgetStatus: BudgetStatus,
  ): Promise<RecoveryPath[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const currency = user?.currency || 'NGN';
    const paths: RecoveryPath[] = [];
    const overspendAmount = Math.max(0, budgetStatus.spent.amount - budgetStatus.budgeted.amount);

    // Smart Swap: same logic, no probability
    try {
      const rebalanceCount = await this.budgetService.getRebalanceCountInPeriod(userId);
      if (rebalanceCount < GPS_CONSTANTS.MAX_REBALANCES_PER_PERIOD) {
        const surplusCategories = await this.budgetService.findCategoriesWithSurplus(
          userId,
          budgetStatus.categoryId,
        );

        if (surplusCategories.length > 0) {
          const bestSurplus = surplusCategories[0];
          const coverageAmount = Math.min(overspendAmount, bestSurplus.proratedSurplus);
          const isFullCoverage = bestSurplus.proratedSurplus >= overspendAmount;

          const formattedSurplus = formatCurrency(bestSurplus.proratedSurplus, currency);
          const formattedCoverage = formatCurrency(coverageAmount, currency);

          const description = isFullCoverage
            ? `Cover this with your ${bestSurplus.categoryName} surplus (${formattedSurplus} available)`
            : `Partially cover with ${bestSurplus.categoryName} surplus (${formattedCoverage} of ${formatCurrency(overspendAmount, currency)})`;

          paths.push({
            id: GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE,
            name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE].name,
            description,
            newProbability: null,
            effort: 'None' as EffortLevel,
            budgetImpact: isFullCoverage
              ? `Fully covers the ${formatCurrency(overspendAmount, currency)} overage`
              : `Covers ${formattedCoverage} of ${formatCurrency(overspendAmount, currency)} overage`,
            rebalanceInfo: {
              fromCategory: bestSurplus.categoryName,
              fromCategoryId: bestSurplus.categoryId,
              availableSurplus: bestSurplus.proratedSurplus,
              coverageAmount,
              isFullCoverage,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn(`[generateBudgetOnlyRecoveryPaths] Smart Swap check failed: ${error}`);
    }

    // Weekly Reduction path
    const weeklyReduction = Math.ceil(overspendAmount / 4);
    const formattedWeekly = formatCurrency(weeklyReduction, currency);
    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT,
      name: 'Weekly Reduction',
      description: `Reduce spending by ${formattedWeekly}/week for 4 weeks to recover`,
      newProbability: null,
      effort: 'Medium' as EffortLevel,
      budgetImpact: `Recovers ${formatCurrency(overspendAmount, currency)} over 4 weeks`,
      savingsImpact: `${formattedWeekly}/week for 4 weeks`,
    });

    // Category Pause path
    const freezeWeeks = GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS;
    const averageSpending = await this.budgetService.getAverageMonthlySpending(
      userId,
      budgetStatus.categoryId,
    );
    const freezeSavings = Math.round(averageSpending * (freezeWeeks / 4.33));
    paths.push({
      id: GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL,
      name: RECOVERY_PATHS[GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL].name,
      description: `Pause spending in ${budgetStatus.category} for ${freezeWeeks} weeks`,
      newProbability: null,
      effort: 'High' as EffortLevel,
      budgetImpact: `Saves ~${formatCurrency(freezeSavings, currency)} over ${freezeWeeks} weeks`,
      freezeDuration: `Pause ${budgetStatus.category} for ${freezeWeeks} weeks`,
    });

    // Attach concrete actions
    for (const path of paths) {
      path.concreteActions = this.generateConcreteActions(budgetStatus.categoryId, overspendAmount);
    }

    return paths;
  }

  /**
   * Generate a budget-only supportive message (no goal context)
   */
  private generateBudgetOnlyMessage(budgetStatus: BudgetStatus): NonJudgmentalMessage {
    const messageType = budgetStatus.trigger === 'BUDGET_WARNING'
      ? SUPPORTIVE_MESSAGES.BUDGET_WARNING
      : SUPPORTIVE_MESSAGES.BUDGET_EXCEEDED;

    const headline = messageType.headlines[Math.floor(Math.random() * messageType.headlines.length)];
    const subtext = messageType.subtexts[Math.floor(Math.random() * messageType.subtexts.length)];

    return {
      tone: 'Supportive',
      headline,
      subtext,
    };
  }

  /**
   * Calculate months between two dates
   */
  private monthsBetween(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    return Math.max(0, months);
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
    } | null;
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

    // Get the goal for probability calculations (optional - budget-only mode if no goals)
    let goal = goalId ? await this.goalService.getGoal(userId, goalId) : null;
    if (!goal) {
      try {
        goal = await this.goalService.getPrimaryGoal(userId);
      } catch {
        // No active goals - that's fine, we'll run in budget-only mode
      }
    }

    // Get user currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });
    const currency = user?.currency || 'NGN';

    // Calculate probability impact (only when goals exist)
    let currentProbability = 0;
    let projectedProbability = 0;
    let probabilityChange = 0;
    let changePercentPoints = 0;

    if (goal) {
      const currentInput = await this.goalService.getSimulationInput(userId, goalId);
      const currentSimulation = await this.simulationEngine.runDualPathSimulation(
        userId,
        currentInput,
        currency,
      );
      currentProbability = currentSimulation.currentPath.probability;

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
      projectedProbability = projectedSimulation.currentPath.probability;

      probabilityChange = projectedProbability - currentProbability;
      changePercentPoints = Math.round(probabilityChange * 100);
    }

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

      if (goal) {
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
      } else {
        recoveryPreview = await this.generateBudgetOnlyRecoveryPaths(userId, simulatedStatus);
      }
    }

    // Determine severity and recommendation
    let severity: 'low' | 'medium' | 'high';
    let recommendation: string;

    const whatIfGoalName = goal?.name || 'your goal';
    if (!wouldTrigger && probabilityChange > -0.05) {
      severity = 'low';
      recommendation = `This purchase fits within your ${category} budget. ${whatIfGoalName} remains on track.`;
    } else if (triggerLevel === 'BUDGET_WARNING' || probabilityChange >= -0.1) {
      severity = 'medium';
      recommendation = `This purchase would use ${Math.round(projectedPercentUsed)}% of your ${category} budget. Consider if it's essential.`;
    } else {
      severity = 'high';
      recommendation = `This purchase would significantly impact your budget and ${whatIfGoalName} probability. Consider alternatives or delaying.`;
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
      probabilityImpact: goal ? {
        goalId: goal.id,
        goalName: goal.name,
        currentProbability,
        projectedProbability,
        probabilityChange,
        changePercentPoints,
      } : null,
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
