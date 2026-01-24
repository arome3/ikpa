import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { subMonths, startOfMonth, addWeeks, subDays, format } from 'date-fns';
import {
  Currency,
  AdjustmentType,
  RelationshipType,
  FamilySupport,
  FamilyEmergency,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import { SimulationEngineCalculator } from '../finance/calculators';
import { SimulationInput, ECONOMIC_DEFAULTS } from '../finance/interfaces';
import { DependencyRatioCalculator } from './calculators';
import {
  DependencyRatioResult,
  AdjustmentsResponse,
  AdjustmentOption,
  AdjustmentResult,
  AdjustmentDetails,
} from './interfaces';
import {
  EmergencyNotFoundException,
  NoActiveEmergencyException,
  EmergencyAlreadyResolvedException,
  InvalidAdjustmentException,
  InsufficientEmergencyFundException,
  FamilySupportNotFoundException,
  PendingEmergencyExistsException,
} from './exceptions';
import {
  TRACE_NAMES,
  RECOVERY_WEEKS,
  EMERGENCY_FUND_TAP_THRESHOLD,
  GOAL_TIMELINE_EXTENSION_WEEKS,
  TEMPORARY_SAVINGS_REDUCTION,
} from './constants';
import {
  FamilySupportListQueryDto,
  FamilySupportListResponseDto,
  UpdateFamilySupportDto,
  EmergencyListQueryDto,
  EmergencyListResponseDto,
  RatioHistoryQueryDto,
  RatioHistoryResponseDto,
} from './dto';

/**
 * Ubuntu Manager Service
 *
 * Implements the Ubuntu philosophy: "I am because we are."
 *
 * This service recognizes that in African cultures, supporting family is a VALUE,
 * not a problem. It reframes family transfers as "Social Capital Investment" and
 * provides non-judgmental adjustments for family emergencies.
 *
 * Features:
 * - Dependency ratio calculation with culturally-calibrated thresholds
 * - Family support tracking with positive reframing
 * - Emergency reporting and adjustment options
 * - Non-judgmental messaging throughout
 */
@Injectable()
export class UbuntuService {
  private readonly logger = new Logger(UbuntuService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly calculator: DependencyRatioCalculator,
    private readonly simulationEngine: SimulationEngineCalculator,
  ) {}

  // ==========================================
  // DEPENDENCY RATIO METHODS
  // ==========================================

  /**
   * Get current dependency ratio with component breakdown
   */
  async getDependencyRatio(userId: string): Promise<DependencyRatioResult> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.GET_DEPENDENCY_RATIO,
      input: { userId },
      metadata: { operation: 'getDependencyRatio' },
      tags: ['ubuntu', 'dependency-ratio'],
    });

    try {
      // Get user's currency and calculate monthly income
      const [user, familySupport, monthlyIncome] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { currency: true },
        }),
        this.prisma.familySupport.findMany({
          where: { userId, isActive: true },
        }),
        this.calculateMonthlyIncome(userId),
      ]);

      const currency = user?.currency ?? 'NGN';

      // Get previous month's ratio for trend calculation
      const previousRatio = await this.getPreviousMonthRatio(userId);

      // Calculate current ratio
      const result = this.calculator.calculate(
        familySupport,
        monthlyIncome,
        currency as Currency,
        previousRatio,
      );

      // Save history record
      await this.saveDependencyRatioHistory(userId, result);

      this.opikService.endTrace(trace, {
        success: true,
        result: {
          totalRatio: result.totalRatio,
          riskLevel: result.riskLevel,
          trend: result.trend,
        },
      });

      return result;
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get previous month's dependency ratio for trend comparison
   */
  private async getPreviousMonthRatio(userId: string): Promise<number | undefined> {
    const lastMonth = subMonths(new Date(), 1);
    const history = await this.prisma.dependencyRatioHistory.findFirst({
      where: {
        userId,
        date: {
          gte: startOfMonth(lastMonth),
          lt: startOfMonth(new Date()),
        },
      },
      orderBy: { date: 'desc' },
    });

    return history ? Number(history.totalRatio) : undefined;
  }

  /**
   * Save dependency ratio history for trend tracking
   */
  private async saveDependencyRatioHistory(
    userId: string,
    result: DependencyRatioResult,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.dependencyRatioHistory.upsert({
      where: {
        userId_date: { userId, date: today },
      },
      update: {
        totalRatio: new Decimal(result.totalRatio),
        riskLevel: result.riskLevel,
        parentSupport: new Decimal(result.components.parentSupport),
        siblingEducation: new Decimal(result.components.siblingEducation),
        extendedFamily: new Decimal(result.components.extendedFamily),
        communityContribution: new Decimal(result.components.communityContribution),
        monthlyTotal: new Decimal(result.monthlyTotal),
        monthlyIncome: new Decimal(result.monthlyIncome),
        currency: result.currency,
      },
      create: {
        userId,
        date: today,
        totalRatio: new Decimal(result.totalRatio),
        riskLevel: result.riskLevel,
        parentSupport: new Decimal(result.components.parentSupport),
        siblingEducation: new Decimal(result.components.siblingEducation),
        extendedFamily: new Decimal(result.components.extendedFamily),
        communityContribution: new Decimal(result.components.communityContribution),
        monthlyTotal: new Decimal(result.monthlyTotal),
        monthlyIncome: new Decimal(result.monthlyIncome),
        currency: result.currency,
      },
    });
  }

  // ==========================================
  // FAMILY SUPPORT METHODS
  // ==========================================

  /**
   * Add a new family support obligation
   *
   * Reframes "Gift/Transfer" to "Social Capital Investment"
   */
  async addFamilySupport(
    userId: string,
    input: {
      name: string;
      relationship: RelationshipType;
      amount: number;
      frequency: string;
      description?: string;
      currency?: Currency;
    },
  ): Promise<FamilySupport & { reframedLabel: string }> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.ADD_FAMILY_SUPPORT,
      input: { userId, relationship: input.relationship },
      metadata: { operation: 'addFamilySupport' },
      tags: ['ubuntu', 'family-support'],
    });

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { currency: true },
      });

      const support = await this.prisma.familySupport.create({
        data: {
          userId,
          name: input.name,
          relationship: input.relationship,
          amount: new Decimal(input.amount),
          currency: input.currency ?? user?.currency ?? 'NGN',
          frequency: input.frequency as any,
          description: input.description,
        },
      });

      const reframedLabel = this.reframeTransactionLabel('Gift/Transfer');

      this.logger.log(
        `[addFamilySupport] Created family support for user ${userId}: ` +
          `${input.name} (${input.relationship}), ${input.amount} ${input.frequency}`,
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: { supportId: support.id, relationship: input.relationship },
      });

      return { ...support, reframedLabel };
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Reframe transaction labels to positive terminology
   *
   * "Gift/Transfer" becomes "Social Capital Investment"
   */
  reframeTransactionLabel(originalLabel: string): string {
    const reframes: Record<string, string> = {
      'Gift/Transfer': 'Social Capital Investment',
      'Gift': 'Social Capital Investment',
      'Transfer': 'Family Support',
      'Money Transfer': 'Family Support',
      'Family': 'Family Investment',
    };

    return reframes[originalLabel] ?? originalLabel;
  }

  // ==========================================
  // EMERGENCY METHODS
  // ==========================================

  /**
   * Report a family emergency
   *
   * Uses serializable transaction to prevent race conditions where
   * concurrent requests could create duplicate pending emergencies.
   */
  async reportEmergency(
    userId: string,
    input: {
      type: string;
      recipientName: string;
      relationship: RelationshipType;
      amount: number;
      description?: string;
      currency?: Currency;
    },
  ): Promise<FamilyEmergency> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.REPORT_EMERGENCY,
      input: { userId, type: input.type, relationship: input.relationship },
      metadata: { operation: 'reportEmergency' },
      tags: ['ubuntu', 'emergency'],
    });

    try {
      // Get user currency and goal probability outside transaction (read-only)
      const [user, currentGoalProbability] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { currency: true },
        }),
        this.getCurrentGoalProbability(userId),
      ]);

      // Use serializable transaction to prevent race conditions
      // This ensures check-and-create is atomic
      const emergency = await this.prisma.$transaction(
        async (tx) => {
          // Check for existing pending emergency with row-level lock
          const existingPending = await tx.familyEmergency.findFirst({
            where: { userId, status: 'PENDING' },
          });

          if (existingPending) {
            throw new PendingEmergencyExistsException(existingPending.id);
          }

          // Create the emergency within the same transaction
          return tx.familyEmergency.create({
            data: {
              userId,
              type: input.type as any,
              recipientName: input.recipientName,
              relationship: input.relationship,
              amount: new Decimal(input.amount),
              currency: input.currency ?? user?.currency ?? 'NGN',
              description: input.description,
              status: 'PENDING',
              originalGoalProbability: currentGoalProbability
                ? new Decimal(currentGoalProbability)
                : null,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      );

      this.logger.log(
        `[reportEmergency] Emergency reported for user ${userId}: ` +
          `${input.type} - ${input.recipientName}, amount: ${input.amount}`,
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: { emergencyId: emergency.id, type: input.type },
      });

      return emergency;
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get adjustment options for an emergency
   */
  async getAdjustmentOptions(
    userId: string,
    emergencyId: string,
  ): Promise<AdjustmentsResponse> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.GET_ADJUSTMENTS,
      input: { userId, emergencyId },
      metadata: { operation: 'getAdjustmentOptions' },
      tags: ['ubuntu', 'adjustments'],
    });

    try {
      const emergency = await this.prisma.familyEmergency.findFirst({
        where: { id: emergencyId, userId },
      });

      if (!emergency) {
        throw new EmergencyNotFoundException(emergencyId);
      }

      if (emergency.status !== 'PENDING') {
        throw new NoActiveEmergencyException(emergencyId, emergency.status);
      }

      // Get user's financial data for adjustment calculations
      const [emergencyFund, monthlyIncome, activeGoal] = await Promise.all([
        this.getEmergencyFundBalance(userId),
        this.calculateMonthlyIncome(userId),
        this.getActiveGoal(userId),
      ]);

      const emergencyAmount = Number(emergency.amount);
      const currentProbability = emergency.originalGoalProbability
        ? Number(emergency.originalGoalProbability)
        : await this.getCurrentGoalProbability(userId) ?? 0.5;

      // Generate adjustment options
      const options = await this.generateAdjustmentOptions(
        userId,
        emergencyAmount,
        emergencyFund,
        monthlyIncome,
        currentProbability,
        activeGoal?.targetDate ?? undefined,
      );

      const response: AdjustmentsResponse = {
        emergencyId,
        emergencyAmount,
        recipientName: emergency.recipientName,
        relationship: emergency.relationship,
        originalGoalProbability: currentProbability,
        options,
      };

      this.opikService.endTrace(trace, {
        success: true,
        result: { optionsCount: options.length },
      });

      return response;
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Apply selected adjustment to handle emergency
   */
  async handleEmergency(
    userId: string,
    emergencyId: string,
    adjustmentType: AdjustmentType,
  ): Promise<AdjustmentResult> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.HANDLE_EMERGENCY,
      input: { userId, emergencyId, adjustmentType },
      metadata: { operation: 'handleEmergency' },
      tags: ['ubuntu', 'emergency-handling'],
    });

    try {
      const emergency = await this.prisma.familyEmergency.findFirst({
        where: { id: emergencyId, userId },
      });

      if (!emergency) {
        throw new EmergencyNotFoundException(emergencyId);
      }

      if (emergency.status === 'RESOLVED') {
        throw new EmergencyAlreadyResolvedException(emergencyId);
      }

      if (emergency.status !== 'PENDING' && emergency.status !== 'ADJUSTING') {
        throw new NoActiveEmergencyException(emergencyId, emergency.status);
      }

      // Validate adjustment type
      const validTypes = Object.values(AdjustmentType);
      if (!validTypes.includes(adjustmentType)) {
        throw new InvalidAdjustmentException(adjustmentType, validTypes);
      }

      // Get financial data
      const [emergencyFund, monthlyIncome] = await Promise.all([
        this.getEmergencyFundBalance(userId),
        this.calculateMonthlyIncome(userId),
      ]);

      const emergencyAmount = Number(emergency.amount);
      const originalProbability = emergency.originalGoalProbability
        ? Number(emergency.originalGoalProbability)
        : 0.5;

      // Apply the adjustment
      const { details, newProbability, recoveryWeeks } = await this.applyAdjustment(
        userId,
        adjustmentType,
        emergencyAmount,
        emergencyFund,
        monthlyIncome,
        originalProbability,
      );

      // Update emergency status
      await this.prisma.familyEmergency.update({
        where: { id: emergencyId },
        data: {
          status: 'RESOLVED',
          adjustmentType,
          adjustmentDetails: details as any,
          newGoalProbability: new Decimal(newProbability),
          recoveryWeeks,
          adjustedAt: new Date(),
          resolvedAt: new Date(),
        },
      });

      const result: AdjustmentResult = {
        emergencyId,
        status: 'RESOLVED',
        adjustmentType,
        recoveryWeeks,
        originalGoalProbability: originalProbability,
        newGoalProbability: newProbability,
        message: this.getAdjustmentMessage(adjustmentType),
        details,
      };

      this.logger.log(
        `[handleEmergency] Emergency ${emergencyId} resolved with ${adjustmentType}. ` +
          `Recovery: ${recoveryWeeks} weeks, Probability: ${originalProbability} -> ${newProbability}`,
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: {
          adjustmentType,
          recoveryWeeks,
          probabilityChange: newProbability - originalProbability,
        },
      });

      return result;
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Calculate monthly income from income sources
   */
  private async calculateMonthlyIncome(userId: string): Promise<number> {
    const incomeSources = await this.prisma.incomeSource.findMany({
      where: { userId, isActive: true },
    });

    return incomeSources.reduce((sum, source) => {
      const amount = Number(source.amount);
      const multiplier = this.getMonthlyMultiplier(source.frequency);
      return sum + amount * multiplier;
    }, 0);
  }

  /**
   * Get monthly multiplier for frequency
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
   * Get emergency fund balance
   */
  private async getEmergencyFundBalance(userId: string): Promise<number> {
    const accounts = await this.prisma.savingsAccount.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { isEmergencyFund: true },
          { type: { in: ['BANK_ACCOUNT', 'MOBILE_MONEY', 'CASH'] } },
        ],
      },
    });

    return accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  }

  /**
   * Get current goal probability using Monte Carlo simulation
   *
   * Falls back to a simple calculation if simulation fails
   */
  private async getCurrentGoalProbability(userId: string): Promise<number | null> {
    try {
      const simulationInput = await this.buildSimulationInput(userId);
      if (!simulationInput) return null;

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { currency: true },
      });

      const result = await this.simulationEngine.runDualPathSimulation(
        userId,
        simulationInput,
        user?.currency ?? 'NGN',
      );

      return result.currentPath.probability;
    } catch (error) {
      this.logger.warn(
        `[getCurrentGoalProbability] Simulation failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.fallbackProbabilityCalculation(userId);
    }
  }

  /**
   * Fallback probability calculation when simulation fails
   */
  private async fallbackProbabilityCalculation(userId: string): Promise<number | null> {
    const goal = await this.prisma.goal.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (!goal) return null;

    // Simplified probability based on progress
    const progress = Number(goal.currentAmount) / Number(goal.targetAmount);
    return Math.min(0.95, Math.max(0.1, progress + 0.4));
  }

  /**
   * Build simulation input from user's financial data
   */
  private async buildSimulationInput(userId: string): Promise<SimulationInput | null> {
    const [goal, monthlyIncome, monthlyExpenses, savingsRate, netWorth, user] = await Promise.all([
      this.getActiveGoal(userId),
      this.calculateMonthlyIncome(userId),
      this.calculateMonthlyExpenses(userId),
      this.getUserSavingsRate(userId),
      this.getCurrentNetWorth(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { country: true },
      }),
    ]);

    if (!goal || monthlyIncome <= 0 || !goal.targetDate) {
      return null;
    }

    // Get economic defaults for user's country
    const countryKey = user?.country?.toUpperCase() ?? 'DEFAULT';
    const defaults = ECONOMIC_DEFAULTS[countryKey] ?? ECONOMIC_DEFAULTS.DEFAULT;

    return {
      currentSavingsRate: savingsRate,
      monthlyIncome,
      monthlyExpenses,
      currentNetWorth: netWorth,
      goalAmount: Number(goal.targetAmount),
      goalDeadline: goal.targetDate,
      expectedReturnRate: defaults.expectedReturn,
      inflationRate: defaults.inflationRate,
      incomeGrowthRate: defaults.incomeGrowthRate,
    };
  }

  /**
   * Get user's current savings rate from financial snapshot or calculate it
   */
  private async getUserSavingsRate(userId: string): Promise<number> {
    // Try to get from latest financial snapshot
    const snapshot = await this.prisma.financialSnapshot.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { savingsRate: true },
    });

    if (snapshot?.savingsRate) {
      return Number(snapshot.savingsRate);
    }

    // Fallback: calculate from income and expenses
    const [monthlyIncome, monthlyExpenses] = await Promise.all([
      this.calculateMonthlyIncome(userId),
      this.calculateMonthlyExpenses(userId),
    ]);

    const monthlySavings = monthlyIncome - monthlyExpenses;

    // Return savings rate or default to 10% if no income
    return monthlyIncome > 0 ? Math.max(0, Math.min(1, monthlySavings / monthlyIncome)) : 0.1;
  }

  /**
   * Calculate monthly expenses from recurring expense records
   */
  private async calculateMonthlyExpenses(userId: string): Promise<number> {
    const expenses = await this.prisma.expense.findMany({
      where: { userId, isRecurring: true },
      select: { amount: true, frequency: true },
    });

    return expenses.reduce((sum, expense) => {
      // Handle nullable frequency - default to MONTHLY if not set
      const frequency = expense.frequency ?? 'MONTHLY';
      return sum + Number(expense.amount) * this.getMonthlyMultiplier(frequency);
    }, 0);
  }

  /**
   * Get current net worth (assets minus liabilities)
   */
  private async getCurrentNetWorth(userId: string): Promise<number> {
    const [savings, debts] = await Promise.all([
      this.prisma.savingsAccount.findMany({
        where: { userId, isActive: true },
        select: { balance: true },
      }),
      this.prisma.debt.findMany({
        where: { userId, isActive: true },
        select: { remainingBalance: true },
      }),
    ]);

    const totalAssets = savings.reduce((sum, s) => sum + Number(s.balance), 0);
    const totalLiabilities = debts.reduce((sum, d) => sum + Number(d.remainingBalance), 0);

    return totalAssets - totalLiabilities;
  }

  /**
   * Get active goal
   */
  private async getActiveGoal(userId: string) {
    return this.prisma.goal.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Generate adjustment options for an emergency
   */
  private async generateAdjustmentOptions(
    userId: string,
    emergencyAmount: number,
    emergencyFund: number,
    monthlyIncome: number,
    currentProbability: number,
    goalDeadline?: Date,
  ): Promise<AdjustmentOption[]> {
    const options: AdjustmentOption[] = [];

    // Option 1: Emergency Fund Tap
    const fundAvailable = emergencyFund >= emergencyAmount * EMERGENCY_FUND_TAP_THRESHOLD;
    const fundCoversAll = emergencyFund >= emergencyAmount;
    const coveragePercent = Math.round((emergencyFund / emergencyAmount) * 100);
    const shortfall = Math.max(0, emergencyAmount - emergencyFund);
    const impact1 = this.calculator.calculateEmergencyImpact(
      emergencyAmount,
      currentProbability,
      emergencyFund,
      monthlyIncome,
    );

    // Build description based on coverage level
    let fundTapDescription: string;
    if (fundCoversAll) {
      fundTapDescription = 'Your emergency fund can cover this need completely.';
    } else if (fundAvailable) {
      fundTapDescription =
        `Your emergency fund covers ${coveragePercent}% of this need. ` +
        `You'll need to find ${shortfall.toLocaleString()} elsewhere.`;
    } else {
      fundTapDescription =
        `Your emergency fund only covers ${coveragePercent}% of this need, ` +
        `which is below the 50% minimum threshold.`;
    }

    options.push({
      type: 'EMERGENCY_FUND_TAP',
      label: 'Use Emergency Fund',
      description: fundTapDescription,
      recoveryWeeks: RECOVERY_WEEKS.EMERGENCY_FUND_TAP,
      newGoalProbability: impact1.newProbability,
      recommended: fundAvailable && fundCoversAll,
      available: fundAvailable,
      unavailableReason: fundAvailable
        ? undefined
        : `Emergency fund (${emergencyFund.toLocaleString()}) is less than 50% of the required amount (${(emergencyAmount * EMERGENCY_FUND_TAP_THRESHOLD).toLocaleString()}).`,
      details: {
        availableFund: emergencyFund,
        amountToTap: Math.min(emergencyAmount, emergencyFund),
        remainingFund: Math.max(0, emergencyFund - emergencyAmount),
        coveragePercent,
        shortfall: shortfall > 0 ? shortfall : undefined,
        isPartialCoverage: !fundCoversAll && fundAvailable,
      },
    });

    // Option 2: Goal Timeline Extension
    const currentDeadline = goalDeadline ?? addWeeks(new Date(), 12);
    const newDeadline = addWeeks(currentDeadline, GOAL_TIMELINE_EXTENSION_WEEKS);
    const probabilityDrop2 = 0.03; // Small drop for timeline extension

    options.push({
      type: 'GOAL_TIMELINE_EXTEND',
      label: 'Extend Goal Deadline',
      description: `Add ${GOAL_TIMELINE_EXTENSION_WEEKS} weeks to your goal deadline to free up savings.`,
      recoveryWeeks: RECOVERY_WEEKS.GOAL_TIMELINE_EXTEND,
      newGoalProbability: currentProbability - probabilityDrop2,
      recommended: !fundAvailable,
      available: true,
      details: {
        currentDeadline,
        newDeadline,
        extensionWeeks: GOAL_TIMELINE_EXTENSION_WEEKS,
      },
    });

    // Option 3: Temporary Savings Rate Reduction
    const currentSavingsRate = await this.getUserSavingsRate(userId);
    const temporaryRate = currentSavingsRate * TEMPORARY_SAVINGS_REDUCTION;
    const impact3 = this.calculator.calculateEmergencyImpact(
      emergencyAmount * 0.5, // Reduced impact since spreading over time
      currentProbability,
      emergencyFund,
      monthlyIncome,
    );

    options.push({
      type: 'SAVINGS_RATE_REDUCE',
      label: 'Temporarily Reduce Savings',
      description: `Reduce your savings rate by 50% for ${RECOVERY_WEEKS.SAVINGS_RATE_REDUCE} weeks.`,
      recoveryWeeks: RECOVERY_WEEKS.SAVINGS_RATE_REDUCE,
      newGoalProbability: impact3.newProbability,
      recommended: false,
      available: true,
      details: {
        currentRate: currentSavingsRate,
        temporaryRate,
        durationWeeks: RECOVERY_WEEKS.SAVINGS_RATE_REDUCE,
      },
    });

    return options;
  }

  /**
   * Apply the selected adjustment within a transaction for data integrity
   */
  private async applyAdjustment(
    userId: string,
    adjustmentType: AdjustmentType,
    emergencyAmount: number,
    emergencyFund: number,
    monthlyIncome: number,
    currentProbability: number,
  ): Promise<{
    details: AdjustmentDetails;
    newProbability: number;
    recoveryWeeks: number;
  }> {
    return this.prisma.$transaction(
      async (tx) => {
        switch (adjustmentType) {
          case 'EMERGENCY_FUND_TAP': {
            if (emergencyFund < emergencyAmount * EMERGENCY_FUND_TAP_THRESHOLD) {
              throw new InsufficientEmergencyFundException(
                emergencyFund,
                emergencyAmount,
                'NGN',
              );
            }

            const amountToTap = Math.min(emergencyAmount, emergencyFund);
            const shortfall = Math.max(0, emergencyAmount - emergencyFund);
            const isPartialCoverage = shortfall > 0;
            const coveragePercent = Math.round((emergencyFund / emergencyAmount) * 100);

            // Log warning for partial coverage
            if (isPartialCoverage) {
              this.logger.warn(
                `[applyAdjustment] Partial coverage: Emergency fund (${emergencyFund}) ` +
                  `covers ${coveragePercent}% of emergency (${emergencyAmount}). ` +
                  `Shortfall: ${shortfall}`,
              );
            }

            // Actually deduct from emergency fund accounts
            await this.deductFromEmergencyFund(tx, userId, amountToTap);

            const impact = this.calculator.calculateEmergencyImpact(
              emergencyAmount,
              currentProbability,
              emergencyFund,
              monthlyIncome,
            );

            return {
              details: {
                availableFund: emergencyFund,
                amountToTap,
                remainingFund: Math.max(0, emergencyFund - emergencyAmount),
                coveragePercent,
                shortfall: isPartialCoverage ? shortfall : undefined,
                isPartialCoverage,
              },
              newProbability: impact.newProbability,
              recoveryWeeks: RECOVERY_WEEKS.EMERGENCY_FUND_TAP,
            };
          }

          case 'GOAL_TIMELINE_EXTEND': {
            const goal = await tx.goal.findFirst({
              where: { userId, status: 'ACTIVE' },
              orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
            });
            const currentDeadline = goal?.targetDate ?? addWeeks(new Date(), 12);
            const newDeadline = addWeeks(currentDeadline, GOAL_TIMELINE_EXTENSION_WEEKS);

            // Update goal deadline within transaction
            if (goal) {
              await tx.goal.update({
                where: { id: goal.id },
                data: { targetDate: newDeadline },
              });
            }

            return {
              details: {
                currentDeadline,
                newDeadline,
                extensionWeeks: GOAL_TIMELINE_EXTENSION_WEEKS,
              },
              newProbability: currentProbability - 0.03,
              recoveryWeeks: RECOVERY_WEEKS.GOAL_TIMELINE_EXTEND,
            };
          }

          case 'SAVINGS_RATE_REDUCE': {
            // Get actual savings rate instead of hardcoded value
            const snapshot = await tx.financialSnapshot.findFirst({
              where: { userId },
              orderBy: { date: 'desc' },
              select: { savingsRate: true },
            });
            const currentRate = snapshot?.savingsRate ? Number(snapshot.savingsRate) : 0.2;
            const temporaryRate = currentRate * TEMPORARY_SAVINGS_REDUCTION;

            // Create savings rate adjustment within transaction
            await tx.savingsRateAdjustment.create({
              data: {
                userId,
                sessionId: 'ubuntu-emergency',
                additionalRate: new Decimal(-temporaryRate),
                durationWeeks: RECOVERY_WEEKS.SAVINGS_RATE_REDUCE,
                startDate: new Date(),
                endDate: addWeeks(new Date(), RECOVERY_WEEKS.SAVINGS_RATE_REDUCE),
                originalRate: new Decimal(currentRate),
                isActive: true,
              },
            });

            return {
              details: {
                currentRate,
                temporaryRate,
                durationWeeks: RECOVERY_WEEKS.SAVINGS_RATE_REDUCE,
              },
              newProbability: currentProbability - 0.05,
              recoveryWeeks: RECOVERY_WEEKS.SAVINGS_RATE_REDUCE,
            };
          }

          default:
            throw new InvalidAdjustmentException(adjustmentType, Object.values(AdjustmentType));
        }
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );
  }

  /**
   * Deduct amount from emergency fund accounts
   *
   * Prioritizes accounts marked as emergency fund, then by balance (highest first).
   * Spreads deduction across multiple accounts if needed.
   */
  private async deductFromEmergencyFund(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
  ): Promise<void> {
    // Get emergency fund accounts ordered by priority
    const accounts = await tx.savingsAccount.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { isEmergencyFund: true },
          { type: { in: ['BANK_ACCOUNT', 'MOBILE_MONEY', 'CASH'] } },
        ],
      },
      orderBy: [
        { isEmergencyFund: 'desc' }, // Emergency funds first
        { balance: 'desc' }, // Then by balance (highest first)
      ],
    });

    let remainingToDeduct = amount;

    for (const account of accounts) {
      if (remainingToDeduct <= 0) break;

      const accountBalance = Number(account.balance);
      const deductFromThisAccount = Math.min(accountBalance, remainingToDeduct);

      if (deductFromThisAccount > 0) {
        const balanceBefore = Number(account.balance);

        await tx.savingsAccount.update({
          where: { id: account.id },
          data: {
            balance: { decrement: deductFromThisAccount },
          },
        });

        remainingToDeduct -= deductFromThisAccount;

        // Audit trail for emergency fund deduction
        this.logAudit({
          operation: 'UPDATE',
          entity: 'SavingsAccount',
          entityId: account.id,
          userId,
          before: { balance: balanceBefore },
          after: { balance: balanceBefore - deductFromThisAccount },
          changes: ['balance'],
          metadata: {
            reason: 'emergency_fund_tap',
            deductionAmount: deductFromThisAccount,
            isEmergencyFund: account.isEmergencyFund,
          },
        });
      }
    }

    if (remainingToDeduct > 0) {
      this.logger.warn(
        `[deductFromEmergencyFund] Could not fully deduct amount. Remaining: ${remainingToDeduct}`,
      );
    }
  }

  /**
   * Get supportive message for adjustment completion
   */
  private getAdjustmentMessage(adjustmentType: AdjustmentType): string {
    const messages: Record<AdjustmentType, string> = {
      EMERGENCY_FUND_TAP:
        "Your family is important, and so is your future. " +
        "You've used your emergency fund wisely - that's exactly what it's for.",
      GOAL_TIMELINE_EXTEND:
        "Taking care of family is part of building wealth in our culture. " +
        "Your goal is still on track, just with a little more time.",
      SAVINGS_RATE_REDUCE:
        "Sometimes we need to slow down to support those we love. " +
        "Your commitment to your goals remains strong.",
    };

    return messages[adjustmentType];
  }

  // ==========================================
  // FAMILY SUPPORT CRUD METHODS
  // ==========================================

  /**
   * List family support records with pagination and summary
   */
  async listFamilySupport(
    userId: string,
    query: FamilySupportListQueryDto,
  ): Promise<FamilySupportListResponseDto> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.GET_DEPENDENCY_RATIO, // Reuse trace name
      input: { userId, query },
      metadata: { operation: 'listFamilySupport' },
      tags: ['ubuntu', 'family-support', 'list'],
    });

    try {
      const where = { userId, ...(query.activeOnly ? { isActive: true } : {}) };

      // Optimized: Run all queries in parallel, using groupBy for summary
      // instead of fetching all records
      const [familySupport, total, summaryByRelationship] = await Promise.all([
        this.prisma.familySupport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
        }),
        this.prisma.familySupport.count({ where }),
        // Use groupBy to aggregate without fetching all records
        this.prisma.familySupport.groupBy({
          by: ['relationship', 'frequency'],
          where: { userId, isActive: true },
          _sum: { amount: true },
        }),
      ]);

      // Calculate monthly totals from aggregated data
      const byRelationship: Record<string, number> = {};
      let totalMonthly = 0;

      for (const group of summaryByRelationship) {
        const monthlyAmount =
          Number(group._sum.amount ?? 0) * this.getMonthlyMultiplier(group.frequency);
        byRelationship[group.relationship] =
          (byRelationship[group.relationship] ?? 0) + monthlyAmount;
        totalMonthly += monthlyAmount;
      }

      const response: FamilySupportListResponseDto = {
        familySupport: familySupport.map((s) => ({
          id: s.id,
          name: s.name,
          relationship: s.relationship,
          amount: Number(s.amount),
          currency: s.currency,
          frequency: s.frequency,
          description: s.description,
          isActive: s.isActive,
          createdAt: s.createdAt,
          reframedLabel: this.reframeTransactionLabel('Gift/Transfer'),
        })),
        summary: {
          totalMonthly: Math.round(totalMonthly * 100) / 100, // Round to 2 decimals
          byRelationship,
        },
        pagination: {
          total,
          limit: query.limit!,
          offset: query.offset!,
          hasMore: query.offset! + familySupport.length < total,
        },
      };

      this.opikService.endTrace(trace, { success: true, result: { total } });
      return response;
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update an existing family support record
   */
  async updateFamilySupport(
    userId: string,
    supportId: string,
    input: UpdateFamilySupportDto,
  ): Promise<FamilySupport & { reframedLabel: string }> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.ADD_FAMILY_SUPPORT, // Reuse trace name
      input: { userId, supportId, hasUpdates: Object.keys(input).length },
      metadata: { operation: 'updateFamilySupport' },
      tags: ['ubuntu', 'family-support', 'update'],
    });

    try {
      // Verify ownership
      const existing = await this.prisma.familySupport.findFirst({
        where: { id: supportId, userId },
      });

      if (!existing) {
        throw new FamilySupportNotFoundException(supportId);
      }

      // Capture before state for audit
      const beforeState = {
        name: existing.name,
        amount: Number(existing.amount),
        frequency: existing.frequency,
        description: existing.description,
        isActive: existing.isActive,
      };

      const updated = await this.prisma.familySupport.update({
        where: { id: supportId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.amount !== undefined && { amount: new Decimal(input.amount) }),
          ...(input.frequency !== undefined && { frequency: input.frequency }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      // Capture after state for audit
      const afterState = {
        name: updated.name,
        amount: Number(updated.amount),
        frequency: updated.frequency,
        description: updated.description,
        isActive: updated.isActive,
      };

      // Log audit trail with before/after comparison
      this.logAudit({
        operation: 'UPDATE',
        entity: 'FamilySupport',
        entityId: supportId,
        userId,
        before: beforeState,
        after: afterState,
        metadata: { inputFields: Object.keys(input) },
      });

      this.opikService.endTrace(trace, { success: true });

      return {
        ...updated,
        reframedLabel: this.reframeTransactionLabel('Gift/Transfer'),
      };
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Soft delete (deactivate) a family support record
   */
  async deleteFamilySupport(userId: string, supportId: string): Promise<void> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.ADD_FAMILY_SUPPORT,
      input: { userId, supportId },
      metadata: { operation: 'deleteFamilySupport' },
      tags: ['ubuntu', 'family-support', 'delete'],
    });

    try {
      const existing = await this.prisma.familySupport.findFirst({
        where: { id: supportId, userId },
      });

      if (!existing) {
        throw new FamilySupportNotFoundException(supportId);
      }

      // Capture state before deletion for audit
      const beforeState = {
        name: existing.name,
        amount: Number(existing.amount),
        frequency: existing.frequency,
        relationship: existing.relationship,
        isActive: existing.isActive,
      };

      // Soft delete by deactivating
      await this.prisma.familySupport.update({
        where: { id: supportId },
        data: { isActive: false },
      });

      // Log audit trail for deletion
      this.logAudit({
        operation: 'DELETE',
        entity: 'FamilySupport',
        entityId: supportId,
        userId,
        before: beforeState,
        after: { ...beforeState, isActive: false },
        changes: ['isActive'],
        metadata: { softDelete: true },
      });

      this.opikService.endTrace(trace, { success: true });
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ==========================================
  // EMERGENCY LIST METHOD
  // ==========================================

  /**
   * List family emergencies with pagination
   */
  async listEmergencies(
    userId: string,
    query: EmergencyListQueryDto,
  ): Promise<EmergencyListResponseDto> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.REPORT_EMERGENCY,
      input: { userId, query },
      metadata: { operation: 'listEmergencies' },
      tags: ['ubuntu', 'emergency', 'list'],
    });

    try {
      const where = { userId, ...(query.status && { status: query.status }) };

      const [emergencies, total] = await Promise.all([
        this.prisma.familyEmergency.findMany({
          where,
          orderBy: { reportedAt: 'desc' },
          take: query.limit,
          skip: query.offset,
        }),
        this.prisma.familyEmergency.count({ where }),
      ]);

      const response: EmergencyListResponseDto = {
        emergencies: emergencies.map((e) => ({
          id: e.id,
          type: e.type,
          recipientName: e.recipientName,
          relationship: e.relationship,
          amount: Number(e.amount),
          currency: e.currency,
          description: e.description,
          status: e.status,
          reportedAt: e.reportedAt,
          resolvedAt: e.resolvedAt,
          adjustmentType: e.adjustmentType,
          message:
            e.status === 'PENDING'
              ? 'Review your adjustment options'
              : `Resolved via ${e.adjustmentType ?? 'adjustment'}`,
        })),
        pagination: {
          total,
          limit: query.limit!,
          offset: query.offset!,
          hasMore: query.offset! + emergencies.length < total,
        },
      };

      this.opikService.endTrace(trace, { success: true, result: { total } });
      return response;
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ==========================================
  // RATIO HISTORY METHOD
  // ==========================================

  /**
   * Get dependency ratio history for trend analysis
   */
  async getRatioHistory(
    userId: string,
    query: RatioHistoryQueryDto,
  ): Promise<RatioHistoryResponseDto> {
    const trace = this.opikService.createTrace({
      name: TRACE_NAMES.GET_DEPENDENCY_RATIO,
      input: { userId, days: query.days },
      metadata: { operation: 'getRatioHistory' },
      tags: ['ubuntu', 'dependency-ratio', 'history'],
    });

    try {
      const startDate = subDays(new Date(), query.days!);

      const history = await this.prisma.dependencyRatioHistory.findMany({
        where: { userId, date: { gte: startDate } },
        orderBy: { date: 'asc' },
        select: { date: true, totalRatio: true, riskLevel: true, monthlyTotal: true },
      });

      const ratios = history.map((h) => Number(h.totalRatio));
      const averageRatio =
        ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;

      const trend = this.calculateTrendFromHistory(ratios);

      const response: RatioHistoryResponseDto = {
        history: history.map((h) => ({
          date: format(h.date, 'yyyy-MM-dd'),
          totalRatio: Number(h.totalRatio),
          riskLevel: h.riskLevel,
          monthlyTotal: Number(h.monthlyTotal),
        })),
        trend,
        averageRatio: Number(averageRatio.toFixed(3)),
        periodDays: query.days!,
      };

      this.opikService.endTrace(trace, { success: true, result: { entries: history.length } });
      return response;
    } catch (error) {
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Log an audit trail entry for data changes
   *
   * Captures who changed what, when, and the before/after values.
   * This structured log format enables compliance reporting and debugging.
   */
  private logAudit(params: {
    operation: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: 'FamilySupport' | 'FamilyEmergency' | 'SavingsAccount';
    entityId: string;
    userId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changes?: string[];
    metadata?: Record<string, unknown>;
  }): void {
    const { operation, entity, entityId, userId, before, after, changes, metadata } = params;

    // Build list of changed fields if before and after are provided
    const changedFields = changes ?? (before && after
      ? Object.keys(after).filter(key => {
          const beforeVal = before[key];
          const afterVal = after[key];
          // Handle Decimal comparison
          if (beforeVal instanceof Object && 'toNumber' in beforeVal) {
            return (beforeVal as { toNumber(): number }).toNumber() !== afterVal;
          }
          return beforeVal !== afterVal;
        })
      : undefined);

    const auditEntry = {
      timestamp: new Date().toISOString(),
      operation,
      entity,
      entityId,
      userId,
      ...(before && { before }),
      ...(after && { after }),
      ...(changedFields && { changedFields }),
      ...(metadata && { metadata }),
    };

    // Log as structured JSON for observability tools
    this.logger.log(`[AUDIT] ${JSON.stringify(auditEntry)}`);
  }

  /**
   * Calculate trend direction from historical ratios
   *
   * Compares first half average to second half average.
   * improving = ratio decreasing, increasing = ratio growing
   */
  private calculateTrendFromHistory(
    ratios: number[],
  ): 'improving' | 'stable' | 'increasing' {
    if (ratios.length < 2) return 'stable';

    const midpoint = Math.floor(ratios.length / 2);
    const firstHalf = ratios.slice(0, midpoint);
    const secondHalf = ratios.slice(midpoint);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;

    // Use 1% threshold for meaningful change
    if (diff < -0.01) return 'improving'; // Ratio decreasing is good
    if (diff > 0.01) return 'increasing';
    return 'stable';
  }
}
