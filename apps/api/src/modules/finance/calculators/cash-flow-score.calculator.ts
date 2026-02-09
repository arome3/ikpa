import { Injectable, Logger } from '@nestjs/common';
import { OpikService } from '../../ai/opik/opik.service';
import {
  FinancialData,
  CashFlowScoreResult,
  CashFlowScoreComponents,
  ComponentScore,
  getScoreLabel,
} from '../interfaces';
import { ScoreCalculationException } from '../exceptions';

/**
 * Component weights for Cash Flow Score calculation
 * Must sum to 1.0 (100%)
 *
 * These weights reflect the relative importance of each financial health factor:
 * - Savings Rate (30%): Foundation of wealth building
 * - Runway Months (25%): Emergency preparedness
 * - Debt-to-Income (20%): Financial burden management
 * - Income Stability (15%): Predictability of cash flow
 * - Dependency Ratio (10%): Family support component
 */
const WEIGHTS = {
  savingsRate: 0.3,
  runwayMonths: 0.25,
  debtToIncome: 0.2,
  incomeStability: 0.15,
  dependencyRatio: 0.1,
} as const;

/**
 * Cash Flow Score Calculator
 *
 * Calculates IKPA's primary financial health metric (0-100).
 * The score provides a single, easy-to-understand number representing
 * overall financial health - similar to a credit score but for cash flow.
 *
 * Unique Features:
 * - Dependency Ratio component that doesn't penalize family support
 * - Full Opik tracing for observability
 * - Transparent calculation with human-readable breakdown
 *
 * @example
 * ```typescript
 * const calculator = new CashFlowScoreCalculator(opikService);
 * const result = await calculator.calculate(userId, financialData);
 * console.log(result.finalScore); // 70
 * console.log(result.components.savingsRate); // { value: 12, score: 60 }
 * ```
 */
@Injectable()
export class CashFlowScoreCalculator {
  private readonly logger = new Logger(CashFlowScoreCalculator.name);

  constructor(private readonly opikService: OpikService) {}

  /**
   * Calculate the complete Cash Flow Score with all components
   *
   * @param userId - User ID for tracing
   * @param data - Aggregated financial data
   * @returns Complete score result with component breakdown
   */
  async calculate(userId: string, data: FinancialData): Promise<CashFlowScoreResult> {
    // Create Opik trace for the calculation
    const trace = this.opikService.createTrace({
      name: 'cash_flow_score_calculation',
      input: { userId },
      metadata: {
        calculator: 'CashFlowScoreCalculator',
        version: '1.0',
        weights: WEIGHTS,
      },
      tags: ['finance', 'score', 'calculation'],
    });

    try {
      // Calculate each component with individual spans
      const components = this.calculateAllComponents(trace, data);

      // Calculate final weighted score
      const finalScore = this.calculateWeightedScore(components);

      // Format the calculation string for transparency
      const calculation = this.formatCalculation(components);

      const result: CashFlowScoreResult = {
        finalScore: Math.round(Math.max(0, Math.min(100, finalScore))),
        components,
        calculation,
        timestamp: new Date(),
      };

      // End trace with success
      this.opikService.endTrace(trace, {
        success: true,
        result: {
          finalScore: result.finalScore,
          label: getScoreLabel(result.finalScore),
          componentBreakdown: {
            savingsRate: components.savingsRate.score,
            runwayMonths: components.runwayMonths.score,
            debtToIncome: components.debtToIncome.score,
            incomeStability: components.incomeStability.score,
            dependencyRatio: components.dependencyRatio.score,
          },
        },
      });

      this.logger.log(`Calculated Cash Flow Score for user ${userId}: ${result.finalScore}`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // End trace with error
      this.opikService.endTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(`Failed to calculate Cash Flow Score for user ${userId}: ${errorMessage}`);

      throw new ScoreCalculationException(errorMessage, { userId });
    }
  }

  /**
   * Calculate all score components with Opik spans
   */
  private calculateAllComponents(
    trace: ReturnType<OpikService['createTrace']>,
    data: FinancialData,
  ): CashFlowScoreComponents {
    return {
      savingsRate: this.withSpan(trace, 'savingsRate', () =>
        this.calculateSavingsRateScore(data),
      ),
      runwayMonths: this.withSpan(trace, 'runwayMonths', () =>
        this.calculateRunwayScore(data),
      ),
      debtToIncome: this.withSpan(trace, 'debtToIncome', () =>
        this.calculateDebtToIncomeScore(data),
      ),
      incomeStability: this.withSpan(trace, 'incomeStability', () =>
        this.calculateIncomeStabilityScore(data),
      ),
      dependencyRatio: this.withSpan(trace, 'dependencyRatio', () =>
        this.calculateDependencyRatioScore(data),
      ),
    };
  }

  /**
   * Wrap a calculation in an Opik span for tracing
   */
  private withSpan(
    trace: ReturnType<OpikService['createTrace']>,
    componentName: keyof typeof WEIGHTS,
    calculation: () => ComponentScore,
  ): ComponentScore {
    if (!trace) {
      return calculation();
    }

    const span = this.opikService.createToolSpan({
      trace: trace.trace,
      name: `calculate_${componentName}`,
      input: { component: componentName },
      metadata: { weight: WEIGHTS[componentName] },
    });

    const result = calculation();

    this.opikService.endSpan(span, {
      output: { value: result.value, score: result.score },
      metadata: {
        weight: WEIGHTS[componentName],
        contribution: result.score * WEIGHTS[componentName],
      },
    });

    return result;
  }

  // ==========================================
  // COMPONENT SCORING FUNCTIONS
  // ==========================================

  /**
   * Savings Rate Score (30% weight)
   * Formula: (Monthly Savings / Monthly Income) * 100
   *
   * Scoring:
   * - 20%+ → 100
   * - 15-20% → 80
   * - 10-15% → 60
   * - 5-10% → 40
   * - 0-5% → 20
   */
  private calculateSavingsRateScore(data: FinancialData): ComponentScore {
    const monthlyIncome = Number(data.monthlyIncome);

    if (monthlyIncome === 0) {
      return { value: 0, score: 20 };
    }

    const rate = (Number(data.monthlySavings) / monthlyIncome) * 100;
    let score: number;

    if (rate >= 20) score = 100;
    else if (rate >= 15) score = 80;
    else if (rate >= 10) score = 60;
    else if (rate >= 5) score = 40;
    else score = 20;

    return { value: Number(rate.toFixed(2)), score };
  }

  /**
   * Runway Months Score (25% weight)
   * Formula: Emergency Fund / Monthly Expenses
   *
   * Scoring:
   * - 9+ months → 100
   * - 6-9 months → 80
   * - 3-6 months → 60
   * - 1-3 months → 40
   * - 0-1 months → 20
   */
  private calculateRunwayScore(data: FinancialData): ComponentScore {
    const monthlyExpenses = Number(data.monthlyExpenses);

    if (monthlyExpenses === 0) {
      // No expenses = infinite runway, cap at 24 for display
      return { value: 24, score: 100 };
    }

    const months = Number(data.emergencyFund) / monthlyExpenses;
    let score: number;

    if (months >= 9) score = 100;
    else if (months >= 6) score = 80;
    else if (months >= 3) score = 60;
    else if (months >= 1) score = 40;
    else score = 20;

    return { value: Number(months.toFixed(1)), score };
  }

  /**
   * Debt-to-Income Score (20% weight) - INVERSE scoring
   * Formula: (Monthly Debt Payments / Monthly Income) * 100
   *
   * Scoring (lower ratio = higher score):
   * - 0-10% → 100
   * - 10-20% → 80
   * - 20-35% → 60
   * - 35-50% → 40
   * - 50%+ → 20
   */
  private calculateDebtToIncomeScore(data: FinancialData): ComponentScore {
    const monthlyIncome = Number(data.monthlyIncome);

    if (monthlyIncome === 0) {
      // No income with debt = worst case
      return { value: 100, score: 20 };
    }

    const ratio = (Number(data.monthlyDebtPayments) / monthlyIncome) * 100;
    let score: number;

    // Lower ratio = higher score (inverse relationship)
    if (ratio <= 10) score = 100;
    else if (ratio <= 20) score = 80;
    else if (ratio <= 35) score = 60;
    else if (ratio <= 50) score = 40;
    else score = 20;

    return { value: Number(ratio.toFixed(2)), score };
  }

  /**
   * Income Stability Score (15% weight)
   *
   * Two calculation methods supported:
   * 1. Coefficient of Variation (CV) from historical income data
   * 2. Weighted variance from income source variancePercentage fields
   *
   * Scoring:
   * - CV < 15% → 100 (Very stable)
   * - CV 15-30% → 60 (Moderately stable)
   * - CV > 30% → 20 (High variance)
   */
  private calculateIncomeStabilityScore(data: FinancialData): ComponentScore {
    // Use weighted variance if available (from IncomeSource.variancePercentage)
    if (data.incomeVarianceWeighted !== undefined) {
      const variance = data.incomeVarianceWeighted;
      let score: number;

      if (variance < 15) score = 100;
      else if (variance <= 30) score = 60;
      else score = 20;

      return { value: Number(variance.toFixed(2)), score };
    }

    // Fall back to coefficient of variation from historical data
    const incomes = data.last6MonthsIncome;

    if (incomes.length < 2) {
      // Not enough data for variance calculation - neutral score
      return { value: 0, score: 60 };
    }

    const avg = incomes.reduce((a, b) => a + b, 0) / incomes.length;

    if (avg === 0) {
      return { value: 100, score: 20 };
    }

    // Calculate standard deviation
    const variance =
      incomes.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / incomes.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of Variation (CV) as percentage
    const cv = (stdDev / avg) * 100;
    let score: number;

    if (cv < 15) score = 100;
    else if (cv <= 30) score = 60;
    else score = 20;

    return { value: Number(cv.toFixed(2)), score };
  }

  /**
   * Dependency Ratio Score (10% weight)
   * Formula: (Total Family Support / Net Income) * 100
   *
   * This component recognizes that supporting family is common
   * and doesn't penalize it harshly.
   *
   * Scoring:
   * - 0-10% → 100 (Low support obligations)
   * - 10-35% → 80 (Healthy moderate level)
   * - 35%+ → 40 (High but not severely penalized)
   */
  private calculateDependencyRatioScore(data: FinancialData): ComponentScore {
    const netIncome = Number(data.netIncome);

    if (netIncome === 0) {
      // No net income - assume zero support ratio
      return { value: 0, score: 100 };
    }

    const ratio = (Number(data.totalFamilySupport) / netIncome) * 100;
    let score: number;

    // Balanced scoring that doesn't overly penalize family support
    if (ratio <= 10) score = 100;
    else if (ratio <= 35) score = 80;
    else score = 40;

    return { value: Number(ratio.toFixed(2)), score };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Calculate the final weighted score from all components
   */
  private calculateWeightedScore(components: CashFlowScoreComponents): number {
    return (
      components.savingsRate.score * WEIGHTS.savingsRate +
      components.runwayMonths.score * WEIGHTS.runwayMonths +
      components.debtToIncome.score * WEIGHTS.debtToIncome +
      components.incomeStability.score * WEIGHTS.incomeStability +
      components.dependencyRatio.score * WEIGHTS.dependencyRatio
    );
  }

  /**
   * Format the calculation as a human-readable string
   */
  private formatCalculation(components: CashFlowScoreComponents): string {
    return (
      `(${components.savingsRate.score}*${WEIGHTS.savingsRate}) + ` +
      `(${components.runwayMonths.score}*${WEIGHTS.runwayMonths}) + ` +
      `(${components.debtToIncome.score}*${WEIGHTS.debtToIncome}) + ` +
      `(${components.incomeStability.score}*${WEIGHTS.incomeStability}) + ` +
      `(${components.dependencyRatio.score}*${WEIGHTS.dependencyRatio})`
    );
  }

  /**
   * Get component weights (useful for frontend display)
   */
  getWeights(): typeof WEIGHTS {
    return { ...WEIGHTS };
  }
}
