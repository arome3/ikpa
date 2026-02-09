import { Decimal } from '@prisma/client/runtime/library';

/**
 * Raw financial data aggregated from various models
 * Used as input for score calculations
 */
export interface FinancialData {
  // Monthly figures (normalized from various frequencies)
  monthlyIncome: Decimal;
  monthlyExpenses: Decimal;
  monthlySavings: Decimal;
  monthlyDebtPayments: Decimal;
  totalFamilySupport: Decimal;

  // Asset totals
  emergencyFund: Decimal;
  liquidSavings: Decimal;
  totalInvestments: Decimal;
  totalDebt: Decimal;

  // Derived/calculated
  netIncome: Decimal;

  // For income stability calculation (last 6 months or variance-based)
  last6MonthsIncome: number[];
  incomeVarianceWeighted?: number;
}

/**
 * Individual component score with raw value and computed score
 */
export interface ComponentScore {
  /** Raw value (percentage, months, or ratio) */
  value: number;
  /** Normalized score (0-100) */
  score: number;
}

/**
 * All Cash Flow Score components
 * Each component contributes to the final weighted score
 */
export interface CashFlowScoreComponents {
  /** Savings Rate: (Monthly Savings / Monthly Income) * 100 - Weight: 30% */
  savingsRate: ComponentScore;
  /** Runway Months: Emergency Fund / Monthly Expenses - Weight: 25% */
  runwayMonths: ComponentScore;
  /** Debt-to-Income: (Monthly Debt Payments / Monthly Income) * 100 - Weight: 20% */
  debtToIncome: ComponentScore;
  /** Income Stability: Based on coefficient of variation - Weight: 15% */
  incomeStability: ComponentScore;
  /** Dependency Ratio: (Total Family Support / Net Income) * 100 - Weight: 10% */
  dependencyRatio: ComponentScore;
}

/**
 * Complete Cash Flow Score calculation result
 */
export interface CashFlowScoreResult {
  /** Final weighted score (0-100) */
  finalScore: number;
  /** Individual component breakdowns */
  components: CashFlowScoreComponents;
  /** Human-readable calculation string */
  calculation: string;
  /** When the score was calculated */
  timestamp: Date;
}

/**
 * Score history entry for trend analysis
 */
export interface ScoreHistoryEntry {
  /** Date of the score */
  date: string;
  /** Score value (0-100) */
  score: number;
}

/**
 * Score history response with trend analysis
 */
export interface ScoreHistoryResponse {
  /** Historical score entries */
  history: ScoreHistoryEntry[];
  /** Overall trend direction */
  trend: 'up' | 'down' | 'stable';
  /** Average score over the period */
  averageScore: number;
  /** Number of days in the history period */
  periodDays: number;
}

/**
 * Metric detail response for individual metric endpoints
 */
export interface MetricDetailResponse {
  /** Current metric value */
  current: number;
  /** Change from previous period */
  change: number;
  /** Trend direction */
  trend: 'up' | 'down' | 'stable';
  /** Historical values */
  history: Array<{ date: Date; value: number }>;
}

/**
 * Score color ranges for UI display
 */
export const SCORE_COLOR_RANGES = {
  EXCELLENT: { min: 80, max: 100, color: '#10B981', label: 'Excellent' },
  GOOD: { min: 60, max: 79, color: '#84CC16', label: 'Good' },
  FAIR: { min: 40, max: 59, color: '#F59E0B', label: 'Fair' },
  NEEDS_ATTENTION: { min: 20, max: 39, color: '#F97316', label: 'Needs Attention' },
  CRITICAL: { min: 0, max: 19, color: '#EF4444', label: 'Critical' },
} as const;

/**
 * Get the label for a score value
 */
export function getScoreLabel(score: number): string {
  if (score >= 80) return SCORE_COLOR_RANGES.EXCELLENT.label;
  if (score >= 60) return SCORE_COLOR_RANGES.GOOD.label;
  if (score >= 40) return SCORE_COLOR_RANGES.FAIR.label;
  if (score >= 20) return SCORE_COLOR_RANGES.NEEDS_ATTENTION.label;
  return SCORE_COLOR_RANGES.CRITICAL.label;
}

/**
 * Get the color for a score value
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return SCORE_COLOR_RANGES.EXCELLENT.color;
  if (score >= 60) return SCORE_COLOR_RANGES.GOOD.color;
  if (score >= 40) return SCORE_COLOR_RANGES.FAIR.color;
  if (score >= 20) return SCORE_COLOR_RANGES.NEEDS_ATTENTION.color;
  return SCORE_COLOR_RANGES.CRITICAL.color;
}
