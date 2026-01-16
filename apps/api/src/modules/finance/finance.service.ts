import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { subMonths, subDays, startOfDay, endOfDay, format } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { CashFlowScoreCalculator } from './calculators/cash-flow-score.calculator';
import {
  CashFlowScoreResult,
  FinancialData,
  ScoreHistoryResponse,
  MetricDetailResponse,
  getScoreLabel,
  getScoreColor,
} from './interfaces';
import {
  InsufficientFinancialDataException,
  ScoreHistoryNotFoundException,
  InvalidMetricException,
  CurrencyMismatchException,
  UserNotFoundException,
  InvalidFinancialDataException,
} from './exceptions';
import { FinancialSnapshot, Currency } from '@prisma/client';

/**
 * Valid metric names for the metrics endpoint
 */
const VALID_METRICS = ['cash-flow', 'savings-rate', 'runway', 'dependency', 'net-worth'] as const;
type MetricName = (typeof VALID_METRICS)[number];

/**
 * Finance Service
 *
 * Provides financial metric calculations and score management.
 * Aggregates data from multiple financial models (income, expenses,
 * savings, debts, family support) to compute the Cash Flow Score.
 *
 * Features:
 * - Cash Flow Score calculation with caching
 * - Score history and trend analysis
 * - Individual metric detail endpoints
 * - Full financial snapshot generation
 * - Frequency normalization (daily/weekly/monthly/etc.)
 */
@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: CashFlowScoreCalculator,
  ) {}

  // ==========================================
  // CASH FLOW SCORE METHODS
  // ==========================================

  /**
   * Get Cash Flow Score for a user
   * Returns cached score if calculated today, otherwise calculates fresh
   *
   * Uses transaction with conflict handling to prevent race conditions
   * when multiple requests try to create a snapshot simultaneously.
   */
  async getCashFlowScore(userId: string): Promise<CashFlowScoreResult> {
    const startTime = Date.now();

    // Validate user exists (defense-in-depth)
    await this.validateUserExists(userId);

    // Check for existing today's snapshot first (fast path)
    const existingSnapshot = await this.getTodaySnapshot(userId);

    if (existingSnapshot) {
      this.logger.debug(
        `[getCashFlowScore] Cache hit for user ${userId}, score: ${existingSnapshot.cashFlowScore}`,
      );
      return this.snapshotToScoreResult(existingSnapshot);
    }

    // Calculate fresh score with race condition protection
    try {
      const result = await this.calculateCashFlowScore(userId);

      this.logger.log(
        `[getCashFlowScore] Calculated new score for user ${userId}: ${result.finalScore} ` +
          `(took ${Date.now() - startTime}ms)`,
      );

      return result;
    } catch (error) {
      // Handle unique constraint violation (P2002) - another request created the snapshot
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.debug(
          `[getCashFlowScore] Race condition handled for user ${userId}, fetching existing snapshot`,
        );

        // Fetch the snapshot that was just created by the other request
        const snapshot = await this.getTodaySnapshot(userId);
        if (snapshot) {
          return this.snapshotToScoreResult(snapshot);
        }
      }
      throw error;
    }
  }

  /**
   * Calculate and save a new Cash Flow Score
   *
   * Wraps the entire operation in a database transaction to ensure
   * data consistency. If any step fails, all changes are rolled back.
   *
   * Logs calculation metrics for monitoring and debugging.
   */
  async calculateCashFlowScore(userId: string): Promise<CashFlowScoreResult> {
    const startTime = Date.now();

    // Use a transaction to ensure data consistency
    return this.prisma.$transaction(async (tx) => {
      // Aggregate financial data within the transaction
      const financialData = await this.aggregateFinancialDataTx(tx, userId);
      const aggregationTime = Date.now() - startTime;

      // Validate data ranges before calculation
      this.validateFinancialDataRanges(financialData);

      const calcStartTime = Date.now();
      const result = await this.calculator.calculate(userId, financialData);
      const calculationTime = Date.now() - calcStartTime;

      // Save snapshot within the same transaction
      const saveStartTime = Date.now();
      await this.saveSnapshotTx(tx, userId, result, financialData);
      const saveTime = Date.now() - saveStartTime;

      const totalTime = Date.now() - startTime;

      // Log detailed metrics for monitoring
      this.logger.log(
        `[calculateCashFlowScore] User ${userId}: ` +
          `score=${result.finalScore}, ` +
          `savingsRate=${result.components.savingsRate.value.toFixed(1)}%, ` +
          `runway=${result.components.runwayMonths.value.toFixed(1)}mo, ` +
          `dti=${result.components.debtToIncome.value.toFixed(1)}%, ` +
          `timing: aggregate=${aggregationTime}ms, calc=${calculationTime}ms, save=${saveTime}ms, total=${totalTime}ms`,
      );

      return {
        ...result,
        // Add UI helper fields
        label: getScoreLabel(result.finalScore),
        color: getScoreColor(result.finalScore),
      } as CashFlowScoreResult & { label: string; color: string };
    }, {
      maxWait: 10000, // 10 seconds max wait for transaction slot
      timeout: 30000, // 30 seconds transaction timeout
    });
  }

  /**
   * Get the previous day's score for comparison
   */
  async getPreviousScore(userId: string): Promise<number | null> {
    const yesterday = subDays(new Date(), 1);

    const snapshot = await this.prisma.financialSnapshot.findFirst({
      where: {
        userId,
        date: {
          gte: startOfDay(yesterday),
          lte: endOfDay(yesterday),
        },
      },
      select: { cashFlowScore: true },
    });

    return snapshot?.cashFlowScore ?? null;
  }

  // ==========================================
  // SCORE HISTORY METHODS
  // ==========================================

  /**
   * Get score history for the specified period
   */
  async getScoreHistory(userId: string, days: number): Promise<ScoreHistoryResponse> {
    const startDate = subDays(new Date(), days);

    const snapshots = await this.prisma.financialSnapshot.findMany({
      where: {
        userId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        cashFlowScore: true,
      },
    });

    if (snapshots.length === 0) {
      throw new ScoreHistoryNotFoundException(userId);
    }

    const history = snapshots.map((s) => ({
      date: format(s.date, 'yyyy-MM-dd'),
      score: s.cashFlowScore,
    }));

    const scores = snapshots.map((s) => s.cashFlowScore);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Calculate trend based on first vs last week average
    const trend = this.calculateTrend(scores);

    return {
      history,
      trend,
      averageScore,
      periodDays: days,
    };
  }

  // ==========================================
  // FINANCIAL SNAPSHOT METHODS
  // ==========================================

  /**
   * Get current financial snapshot (full metrics)
   */
  async getCurrentSnapshot(userId: string): Promise<FinancialSnapshot> {
    const existing = await this.getTodaySnapshot(userId);

    if (existing) {
      return existing;
    }

    // Calculate and save new snapshot
    const financialData = await this.aggregateFinancialData(userId);
    const result = await this.calculator.calculate(userId, financialData);
    return this.saveSnapshot(userId, result, financialData);
  }

  /**
   * Get snapshot history for a date range with pagination
   *
   * @param userId - User ID
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @param limit - Maximum records to return (default 100, max 365)
   * @param offset - Number of records to skip (default 0)
   */
  async getSnapshotHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ snapshots: FinancialSnapshot[]; total: number; limit: number; offset: number; hasMore: boolean }> {
    // Enforce maximum limit of 365 (one year of daily snapshots)
    const effectiveLimit = Math.min(Math.max(1, limit), 365);
    const effectiveOffset = Math.max(0, offset);

    const where: { userId: string; date?: { gte?: Date; lte?: Date } } = { userId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    // Execute count and data queries in parallel
    const [total, snapshots] = await Promise.all([
      this.prisma.financialSnapshot.count({ where }),
      this.prisma.financialSnapshot.findMany({
        where,
        orderBy: { date: 'asc' },
        skip: effectiveOffset,
        take: effectiveLimit,
      }),
    ]);

    return {
      snapshots,
      total,
      limit: effectiveLimit,
      offset: effectiveOffset,
      hasMore: effectiveOffset + snapshots.length < total,
    };
  }

  // ==========================================
  // INDIVIDUAL METRIC METHODS
  // ==========================================

  /**
   * Get detail for a specific metric
   */
  async getMetricDetail(userId: string, metric: string): Promise<MetricDetailResponse> {
    // Validate metric name
    if (!VALID_METRICS.includes(metric as MetricName)) {
      throw new InvalidMetricException(metric, [...VALID_METRICS]);
    }

    const current = await this.getCurrentSnapshot(userId);
    // Get last 3 months of history without pagination limits for metric detail
    const { snapshots: history } = await this.getSnapshotHistory(
      userId,
      subMonths(new Date(), 3),
      undefined,
      365, // Get all snapshots for metric detail
      0,
    );

    const previousSnapshot = history.length > 1 ? history[history.length - 2] : null;

    const currentValue = this.getMetricValue(current, metric as MetricName);
    const previousValue = previousSnapshot
      ? this.getMetricValue(previousSnapshot, metric as MetricName)
      : null;

    const change = previousValue !== null ? currentValue - previousValue : 0;
    const trend: 'up' | 'down' | 'stable' =
      change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable';

    return {
      current: currentValue,
      change: Number(change.toFixed(2)),
      trend,
      history: history.map((s) => ({
        date: s.date,
        value: this.getMetricValue(s, metric as MetricName),
      })),
    };
  }

  // ==========================================
  // DATA AGGREGATION (PRIVATE)
  // ==========================================

  /**
   * Aggregate all financial data needed for score calculation
   *
   * Validates currency consistency across all financial data to prevent
   * incorrect calculations from mixing currencies without conversion.
   */
  private async aggregateFinancialData(userId: string): Promise<FinancialData> {
    const now = new Date();
    const oneMonthAgo = subMonths(now, 1);
    const sixMonthsAgo = subMonths(now, 6);

    // Get user's primary currency first
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const primaryCurrency = user?.currency ?? 'NGN';

    // Fetch all required data in parallel
    const [incomeSources, recentExpenses, savingsAccounts, debts, familySupport, historicalSnapshots] =
      await Promise.all([
        this.prisma.incomeSource.findMany({
          where: { userId, isActive: true },
        }),
        this.prisma.expense.findMany({
          where: { userId, date: { gte: oneMonthAgo } },
        }),
        this.prisma.savingsAccount.findMany({
          where: { userId, isActive: true },
        }),
        this.prisma.debt.findMany({
          where: { userId, isActive: true },
        }),
        this.prisma.familySupport.findMany({
          where: { userId, isActive: true },
        }),
        // Get last 6 months of snapshots for income history
        this.prisma.financialSnapshot.findMany({
          where: { userId, date: { gte: sixMonthsAgo } },
          orderBy: { date: 'asc' },
          select: { totalIncome: true, date: true },
        }),
      ]);

    // Validate minimum data requirements
    if (incomeSources.length === 0) {
      throw new InsufficientFinancialDataException(['income sources']);
    }

    // Validate currency consistency across all financial data
    const mismatchedCurrencies = this.validateCurrencyConsistency(
      primaryCurrency,
      incomeSources,
      recentExpenses,
      savingsAccounts,
      debts,
      familySupport,
    );

    if (mismatchedCurrencies.length > 0) {
      this.logger.warn(
        `[aggregateFinancialData] Currency mismatch for user ${userId}: ` +
          `primary=${primaryCurrency}, mismatched=${mismatchedCurrencies.join(',')}`,
      );
      throw new CurrencyMismatchException(primaryCurrency, mismatchedCurrencies);
    }

    // Calculate monthly income (normalize all frequencies to monthly)
    const monthlyIncome = this.calculateMonthlyTotal(
      incomeSources.map((s) => ({ amount: s.amount, frequency: s.frequency })),
    );

    // Calculate income stability from variancePercentage if available
    let incomeVarianceWeighted: number | undefined;
    const totalIncomeNumber = Number(monthlyIncome);
    if (totalIncomeNumber > 0) {
      incomeVarianceWeighted =
        incomeSources.reduce((sum, source) => {
          const weight = Number(source.amount) / totalIncomeNumber;
          return sum + (source.variancePercentage ?? 0) * weight;
        }, 0);
    }

    // Calculate monthly expenses
    const monthlyExpenses = recentExpenses.reduce(
      (sum, e) => sum.plus(e.amount),
      new Decimal(0),
    );

    // Calculate monthly savings (income - expenses) - can be negative
    const monthlySavings = monthlyIncome.minus(monthlyExpenses);

    // Calculate monthly debt payments
    const monthlyDebtPayments = debts.reduce(
      (sum, d) => sum.plus(d.minimumPayment),
      new Decimal(0),
    );

    // Calculate family support (normalize to monthly)
    const totalFamilySupport = this.calculateMonthlyTotal(
      familySupport.map((f) => ({ amount: f.amount, frequency: f.frequency })),
    );

    // Calculate emergency fund (liquid savings marked as emergency or liquid types)
    const emergencyFund = savingsAccounts
      .filter(
        (s) => s.isEmergencyFund || ['BANK_ACCOUNT', 'MOBILE_MONEY', 'CASH'].includes(s.type),
      )
      .reduce((sum, s) => sum.plus(s.balance), new Decimal(0));

    // Total liquid savings
    const liquidSavings = savingsAccounts.reduce((sum, s) => sum.plus(s.balance), new Decimal(0));

    // Total debt
    const totalDebt = debts.reduce((sum, d) => sum.plus(d.remainingBalance), new Decimal(0));

    // Net income (after family support)
    const netIncome = monthlyIncome.minus(totalFamilySupport);

    // Build income history from snapshots
    const last6MonthsIncome =
      historicalSnapshots.length >= 2
        ? historicalSnapshots.map((s) => Number(s.totalIncome))
        : [Number(monthlyIncome)]; // Use current if no history

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      monthlyDebtPayments,
      totalFamilySupport,
      emergencyFund,
      liquidSavings,
      totalInvestments: new Decimal(0), // TODO: Add investments when Investment module is ready
      totalDebt,
      netIncome,
      last6MonthsIncome,
      incomeVarianceWeighted,
    };
  }

  /**
   * Convert frequency-based amounts to monthly
   */
  private calculateMonthlyTotal(
    items: Array<{ amount: Decimal; frequency: string }>,
  ): Decimal {
    return items.reduce((sum, item) => {
      const multiplier = this.getMonthlyMultiplier(item.frequency);
      return sum.plus(item.amount.times(multiplier));
    }, new Decimal(0));
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
   * Calculate trend based on score history
   */
  private calculateTrend(scores: number[]): 'up' | 'down' | 'stable' {
    if (scores.length < 7) return 'stable';

    const recentAvg = scores.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const olderAvg = scores.slice(0, Math.min(7, scores.length - 7)).reduce((a, b) => a + b, 0) /
      Math.min(7, scores.length - 7);

    const diff = recentAvg - olderAvg;

    if (diff > 3) return 'up';
    if (diff < -3) return 'down';
    return 'stable';
  }

  /**
   * Get today's snapshot if it exists
   */
  private async getTodaySnapshot(userId: string): Promise<FinancialSnapshot | null> {
    return this.prisma.financialSnapshot.findFirst({
      where: {
        userId,
        date: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date()),
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Save a financial snapshot with all component scores
   *
   * Stores both the raw values AND the computed scores for each component
   * to avoid data loss when reconstructing from cache.
   */
  private async saveSnapshot(
    userId: string,
    result: CashFlowScoreResult,
    data: FinancialData,
  ): Promise<FinancialSnapshot> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const today = startOfDay(new Date());

    // Use upsert to handle race conditions (unique constraint on userId + date)
    return this.prisma.financialSnapshot.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        // Update existing snapshot (in case of race condition)
        cashFlowScore: result.finalScore,
        savingsRate: new Decimal(result.components.savingsRate.value),
        runwayMonths: new Decimal(result.components.runwayMonths.value),
        debtToIncome: new Decimal(result.components.debtToIncome.value),
        incomeStability: new Decimal(result.components.incomeStability.value),
        burnRate: data.monthlyExpenses.plus(data.monthlyDebtPayments),
        dependencyRatio: new Decimal(result.components.dependencyRatio.value),
        // Store individual component scores (0-100)
        savingsRateScore: result.components.savingsRate.score,
        runwayMonthsScore: result.components.runwayMonths.score,
        debtToIncomeScore: result.components.debtToIncome.score,
        incomeStabilityScore: result.components.incomeStability.score,
        dependencyRatioScore: result.components.dependencyRatio.score,
        // Totals
        netWorth: data.liquidSavings.minus(data.totalDebt),
        totalIncome: data.monthlyIncome,
        totalExpenses: data.monthlyExpenses,
        totalSavings: data.liquidSavings,
        totalDebt: data.totalDebt,
        totalAssets: data.liquidSavings,
        totalSupport: data.totalFamilySupport,
        currency: (user?.currency as Currency) ?? 'NGN',
      },
      create: {
        userId,
        date: today,
        cashFlowScore: result.finalScore,
        savingsRate: new Decimal(result.components.savingsRate.value),
        runwayMonths: new Decimal(result.components.runwayMonths.value),
        debtToIncome: new Decimal(result.components.debtToIncome.value),
        incomeStability: new Decimal(result.components.incomeStability.value),
        burnRate: data.monthlyExpenses.plus(data.monthlyDebtPayments),
        dependencyRatio: new Decimal(result.components.dependencyRatio.value),
        // Store individual component scores (0-100)
        savingsRateScore: result.components.savingsRate.score,
        runwayMonthsScore: result.components.runwayMonths.score,
        debtToIncomeScore: result.components.debtToIncome.score,
        incomeStabilityScore: result.components.incomeStability.score,
        dependencyRatioScore: result.components.dependencyRatio.score,
        // Totals
        netWorth: data.liquidSavings.minus(data.totalDebt),
        totalIncome: data.monthlyIncome,
        totalExpenses: data.monthlyExpenses,
        totalSavings: data.liquidSavings,
        totalDebt: data.totalDebt,
        totalAssets: data.liquidSavings,
        totalSupport: data.totalFamilySupport,
        currency: (user?.currency as Currency) ?? 'NGN',
      },
    });
  }

  /**
   * Convert a snapshot to CashFlowScoreResult format
   *
   * Uses stored component scores directly instead of recalculating,
   * ensuring cache returns are identical to original calculations.
   */
  private snapshotToScoreResult(snapshot: FinancialSnapshot): CashFlowScoreResult {
    // Use stored component scores directly (no recalculation needed)
    const components = {
      savingsRate: {
        value: Number(snapshot.savingsRate),
        score: snapshot.savingsRateScore,
      },
      runwayMonths: {
        value: Number(snapshot.runwayMonths),
        score: snapshot.runwayMonthsScore,
      },
      debtToIncome: {
        value: Number(snapshot.debtToIncome),
        score: snapshot.debtToIncomeScore,
      },
      incomeStability: {
        value: Number(snapshot.incomeStability),
        score: snapshot.incomeStabilityScore,
      },
      dependencyRatio: {
        value: Number(snapshot.dependencyRatio),
        score: snapshot.dependencyRatioScore,
      },
    };

    // Reconstruct the calculation string from stored scores
    const calculation =
      `(${components.savingsRate.score}*0.30) + ` +
      `(${components.runwayMonths.score}*0.25) + ` +
      `(${components.debtToIncome.score}*0.20) + ` +
      `(${components.incomeStability.score}*0.15) + ` +
      `(${components.dependencyRatio.score}*0.10)`;

    return {
      finalScore: snapshot.cashFlowScore,
      components,
      calculation,
      timestamp: snapshot.date,
    };
  }

  /**
   * Get metric value from snapshot
   */
  private getMetricValue(snapshot: FinancialSnapshot, metric: MetricName): number {
    switch (metric) {
      case 'cash-flow':
        return snapshot.cashFlowScore;
      case 'savings-rate':
        return Number(snapshot.savingsRate);
      case 'runway':
        return Number(snapshot.runwayMonths);
      case 'dependency':
        return Number(snapshot.dependencyRatio);
      case 'net-worth':
        return Number(snapshot.netWorth);
      default:
        return 0;
    }
  }

  // ==========================================
  // VALIDATION HELPERS
  // ==========================================
  // NOTE: Scoring helper methods (rateToScore, runwayToScore, dependencyToScore)
  // were removed because snapshotToScoreResult now uses stored component scores
  // directly instead of recalculating them. This prevents data loss and ensures
  // cache returns match original calculations exactly.

  /**
   * Validate that all financial data uses the same currency
   * Returns array of mismatched currencies (empty if all match)
   */
  private validateCurrencyConsistency(
    primaryCurrency: Currency,
    incomeSources: Array<{ currency: Currency }>,
    expenses: Array<{ currency: Currency }>,
    savingsAccounts: Array<{ currency: Currency }>,
    debts: Array<{ currency: Currency }>,
    familySupport: Array<{ currency: Currency }>,
  ): string[] {
    const mismatched = new Set<string>();

    // Check each data source for currency mismatches
    for (const source of incomeSources) {
      if (source.currency !== primaryCurrency) {
        mismatched.add(source.currency);
      }
    }

    for (const expense of expenses) {
      if (expense.currency !== primaryCurrency) {
        mismatched.add(expense.currency);
      }
    }

    for (const account of savingsAccounts) {
      if (account.currency !== primaryCurrency) {
        mismatched.add(account.currency);
      }
    }

    for (const debt of debts) {
      if (debt.currency !== primaryCurrency) {
        mismatched.add(debt.currency);
      }
    }

    for (const support of familySupport) {
      if (support.currency !== primaryCurrency) {
        mismatched.add(support.currency);
      }
    }

    return Array.from(mismatched);
  }

  /**
   * Validate that a user exists
   *
   * Defense-in-depth check at the service layer to prevent
   * unauthorized access if this service is called from other modules.
   */
  private async validateUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      this.logger.warn(`[validateUserExists] User not found: ${userId}`);
      throw new UserNotFoundException(userId);
    }
  }

  /**
   * Validate financial data ranges to detect corrupted or suspicious data
   *
   * Checks for:
   * - Negative amounts (invalid for most financial data)
   * - Extremely large values (potential data corruption)
   * - NaN or Infinity values
   */
  private validateFinancialDataRanges(data: FinancialData): void {
    const MAX_REASONABLE_AMOUNT = 1_000_000_000_000; // 1 trillion (in smallest currency unit)
    const issues: string[] = [];

    // Check for negative income
    if (Number(data.monthlyIncome) < 0) {
      issues.push('Monthly income cannot be negative');
    }

    // Check for extremely large values that might indicate data corruption
    if (Number(data.monthlyIncome) > MAX_REASONABLE_AMOUNT) {
      issues.push('Monthly income exceeds reasonable limits');
    }

    if (Number(data.liquidSavings) > MAX_REASONABLE_AMOUNT) {
      issues.push('Liquid savings exceeds reasonable limits');
    }

    if (Number(data.totalDebt) > MAX_REASONABLE_AMOUNT) {
      issues.push('Total debt exceeds reasonable limits');
    }

    // Check for NaN or Infinity
    const numericFields = [
      { name: 'monthlyIncome', value: Number(data.monthlyIncome) },
      { name: 'monthlyExpenses', value: Number(data.monthlyExpenses) },
      { name: 'liquidSavings', value: Number(data.liquidSavings) },
      { name: 'totalDebt', value: Number(data.totalDebt) },
      { name: 'emergencyFund', value: Number(data.emergencyFund) },
    ];

    for (const field of numericFields) {
      if (!Number.isFinite(field.value)) {
        issues.push(`${field.name} contains invalid value (NaN or Infinity)`);
      }
    }

    if (issues.length > 0) {
      throw new InvalidFinancialDataException(issues.join('; '), {
        issueCount: issues.length,
      });
    }
  }

  // ==========================================
  // TRANSACTION-COMPATIBLE METHODS
  // ==========================================

  /**
   * Transaction-compatible version of aggregateFinancialData
   *
   * Uses the provided transaction client instead of this.prisma
   * to ensure all operations are within the same transaction.
   */
  private async aggregateFinancialDataTx(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<FinancialData> {
    const now = new Date();
    const oneMonthAgo = subMonths(now, 1);
    const sixMonthsAgo = subMonths(now, 6);

    // Get user's primary currency first
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const primaryCurrency = user?.currency ?? 'NGN';

    // Fetch all required data in parallel within the transaction
    const [incomeSources, recentExpenses, savingsAccounts, debts, familySupport, historicalSnapshots] =
      await Promise.all([
        tx.incomeSource.findMany({
          where: { userId, isActive: true },
        }),
        tx.expense.findMany({
          where: { userId, date: { gte: oneMonthAgo } },
        }),
        tx.savingsAccount.findMany({
          where: { userId, isActive: true },
        }),
        tx.debt.findMany({
          where: { userId, isActive: true },
        }),
        tx.familySupport.findMany({
          where: { userId, isActive: true },
        }),
        tx.financialSnapshot.findMany({
          where: { userId, date: { gte: sixMonthsAgo } },
          orderBy: { date: 'asc' },
          select: { totalIncome: true, date: true },
        }),
      ]);

    // Validate minimum data requirements
    if (incomeSources.length === 0) {
      throw new InsufficientFinancialDataException(['income sources']);
    }

    // Validate currency consistency
    const mismatchedCurrencies = this.validateCurrencyConsistency(
      primaryCurrency,
      incomeSources,
      recentExpenses,
      savingsAccounts,
      debts,
      familySupport,
    );

    if (mismatchedCurrencies.length > 0) {
      this.logger.warn(
        `[aggregateFinancialDataTx] Currency mismatch for user ${userId}: ` +
          `primary=${primaryCurrency}, mismatched=${mismatchedCurrencies.join(',')}`,
      );
      throw new CurrencyMismatchException(primaryCurrency, mismatchedCurrencies);
    }

    // Calculate monthly income
    const monthlyIncome = this.calculateMonthlyTotal(
      incomeSources.map((s) => ({ amount: s.amount, frequency: s.frequency })),
    );

    // Calculate income stability from variancePercentage
    let incomeVarianceWeighted: number | undefined;
    const totalIncomeNumber = Number(monthlyIncome);
    if (totalIncomeNumber > 0) {
      incomeVarianceWeighted = incomeSources.reduce((sum, source) => {
        const weight = Number(source.amount) / totalIncomeNumber;
        return sum + (source.variancePercentage ?? 0) * weight;
      }, 0);
    }

    // Calculate other metrics
    const monthlyExpenses = recentExpenses.reduce(
      (sum, e) => sum.plus(e.amount),
      new Decimal(0),
    );
    const monthlySavings = monthlyIncome.minus(monthlyExpenses);
    const monthlyDebtPayments = debts.reduce(
      (sum, d) => sum.plus(d.minimumPayment),
      new Decimal(0),
    );
    const totalFamilySupport = this.calculateMonthlyTotal(
      familySupport.map((f) => ({ amount: f.amount, frequency: f.frequency })),
    );
    const emergencyFund = savingsAccounts
      .filter(
        (s) => s.isEmergencyFund || ['BANK_ACCOUNT', 'MOBILE_MONEY', 'CASH'].includes(s.type),
      )
      .reduce((sum, s) => sum.plus(s.balance), new Decimal(0));
    const liquidSavings = savingsAccounts.reduce((sum, s) => sum.plus(s.balance), new Decimal(0));
    const totalDebt = debts.reduce((sum, d) => sum.plus(d.remainingBalance), new Decimal(0));
    const netIncome = monthlyIncome.minus(totalFamilySupport);
    const last6MonthsIncome =
      historicalSnapshots.length >= 2
        ? historicalSnapshots.map((s) => Number(s.totalIncome))
        : [Number(monthlyIncome)];

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      monthlyDebtPayments,
      totalFamilySupport,
      emergencyFund,
      liquidSavings,
      totalInvestments: new Decimal(0),
      totalDebt,
      netIncome,
      last6MonthsIncome,
      incomeVarianceWeighted,
    };
  }

  /**
   * Transaction-compatible version of saveSnapshot
   *
   * Uses the provided transaction client for consistent writes.
   */
  private async saveSnapshotTx(
    tx: Prisma.TransactionClient,
    userId: string,
    result: CashFlowScoreResult,
    data: FinancialData,
  ): Promise<FinancialSnapshot> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const today = startOfDay(new Date());

    return tx.financialSnapshot.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        cashFlowScore: result.finalScore,
        savingsRate: new Decimal(result.components.savingsRate.value),
        runwayMonths: new Decimal(result.components.runwayMonths.value),
        debtToIncome: new Decimal(result.components.debtToIncome.value),
        incomeStability: new Decimal(result.components.incomeStability.value),
        burnRate: data.monthlyExpenses.plus(data.monthlyDebtPayments),
        dependencyRatio: new Decimal(result.components.dependencyRatio.value),
        savingsRateScore: result.components.savingsRate.score,
        runwayMonthsScore: result.components.runwayMonths.score,
        debtToIncomeScore: result.components.debtToIncome.score,
        incomeStabilityScore: result.components.incomeStability.score,
        dependencyRatioScore: result.components.dependencyRatio.score,
        netWorth: data.liquidSavings.minus(data.totalDebt),
        totalIncome: data.monthlyIncome,
        totalExpenses: data.monthlyExpenses,
        totalSavings: data.liquidSavings,
        totalDebt: data.totalDebt,
        totalAssets: data.liquidSavings,
        totalSupport: data.totalFamilySupport,
        currency: (user?.currency as Currency) ?? 'NGN',
      },
      create: {
        userId,
        date: today,
        cashFlowScore: result.finalScore,
        savingsRate: new Decimal(result.components.savingsRate.value),
        runwayMonths: new Decimal(result.components.runwayMonths.value),
        debtToIncome: new Decimal(result.components.debtToIncome.value),
        incomeStability: new Decimal(result.components.incomeStability.value),
        burnRate: data.monthlyExpenses.plus(data.monthlyDebtPayments),
        dependencyRatio: new Decimal(result.components.dependencyRatio.value),
        savingsRateScore: result.components.savingsRate.score,
        runwayMonthsScore: result.components.runwayMonths.score,
        debtToIncomeScore: result.components.debtToIncome.score,
        incomeStabilityScore: result.components.incomeStability.score,
        dependencyRatioScore: result.components.dependencyRatio.score,
        netWorth: data.liquidSavings.minus(data.totalDebt),
        totalIncome: data.monthlyIncome,
        totalExpenses: data.monthlyExpenses,
        totalSavings: data.liquidSavings,
        totalDebt: data.totalDebt,
        totalAssets: data.liquidSavings,
        totalSupport: data.totalFamilySupport,
        currency: (user?.currency as Currency) ?? 'NGN',
      },
    });
  }
}
