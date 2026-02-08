/**
 * GPS Re-Router Interfaces
 *
 * Type definitions for the GPS Re-Router feature that helps users
 * recover from budget overspending without abandoning their financial goals.
 *
 * The feature is designed to combat the "What-The-Hell Effect" - a behavioral
 * economics phenomenon where one slip causes people to abandon their goals entirely.
 */

/**
 * Budget trigger levels based on spending percentage
 * - WARNING: 80-99% of budget spent
 * - EXCEEDED: 100-119% of budget spent
 * - CRITICAL: 120%+ of budget spent
 */
export type BudgetTrigger = 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';

/**
 * Effort level required for a recovery path
 */
export type EffortLevel = 'None' | 'Low' | 'Medium' | 'High';

/**
 * Forecast risk level based on projected spending
 * - safe: projected spending < 80% of budget
 * - caution: projected spending 80-100% of budget
 * - warning: projected spending > 100% of budget
 */
export type ForecastRiskLevel = 'safe' | 'caution' | 'warning';

/**
 * Proactive budget forecast for a single category
 * Used to warn users BEFORE they overspend
 */
export interface BudgetForecast {
  /** Category ID */
  categoryId: string;
  /** Category name */
  categoryName: string;
  /** Budgeted amount for the period */
  budgeted: number;
  /** Amount spent so far */
  spent: number;
  /** Projected total spending at end of period */
  projectedTotal: number;
  /** Projected overage amount (projectedTotal - budgeted), 0 if under */
  projectedOverage: number;
  /** Days until projected spending crosses budget line, null if won't exceed */
  daysUntilExceed: number | null;
  /** Suggested daily limit to stay within remaining budget */
  suggestedDailyLimit: number;
  /** Risk level based on projected spending vs budget */
  riskLevel: ForecastRiskLevel;
  /** Currency code */
  currency: string;
}

/**
 * Monetary value with both raw amount and formatted string
 * Provides human-readable currency display (e.g., "₦50,000")
 */
export interface MonetaryValue {
  /** Raw numeric amount */
  amount: number;
  /** Formatted string with currency symbol (e.g., "₦50,000") */
  formatted: string;
  /** Currency code (e.g., "NGN", "USD") */
  currency: string;
}

/**
 * Status of a user's budget for a specific category
 */
export interface BudgetStatus {
  /** Expense category name */
  category: string;
  /** Category ID for database reference */
  categoryId: string;
  /** Budgeted amount for the period with formatted currency */
  budgeted: MonetaryValue;
  /** Amount spent so far with formatted currency */
  spent: MonetaryValue;
  /** Amount remaining (can be negative if overspent) with formatted currency */
  remaining: MonetaryValue;
  /** Percentage over budget (0 if under, positive if over) */
  overagePercent: number;
  /** Which trigger threshold was hit */
  trigger: BudgetTrigger;
  /** Budget period (WEEKLY, MONTHLY, etc.) */
  period: string;
}

/**
 * Impact of budget overspending on a financial goal
 */
export interface GoalImpact {
  /** Goal ID */
  goalId: string;
  /** Goal name */
  goalName: string;
  /** Goal target amount with formatted currency */
  goalAmount: MonetaryValue;
  /** Goal deadline */
  goalDeadline: Date;
  /** Probability before the overspend */
  previousProbability: number;
  /** Probability after the overspend */
  newProbability: number;
  /** Difference in probability (negative means decreased) */
  probabilityDrop: number;
  /** Human-readable impact message */
  message: string;
  /** Projected date the user will reach this goal */
  projectedDate?: Date;
  /** Human-readable timeline (e.g. "You'll likely reach Emergency Fund by August 2026") */
  humanReadable?: string;
  /** Schedule status (e.g. "3 months ahead of schedule" or "2 months behind schedule") */
  scheduleStatus?: string;
}

/**
 * Timeline translation for a goal - converts probabilities to concrete dates
 */
export interface TimelineTranslation {
  /** Projected date of goal achievement */
  projectedDate: Date;
  /** Human-readable summary */
  humanReadable: string;
  /** Relative status (ahead/behind/on track) */
  scheduleStatus: string;
  /** Months needed at current pace */
  monthsToGoal: number;
}

/**
 * A recovery path option presented to the user
 */
export interface RecoveryPath {
  /** Unique identifier for the path */
  id: string;
  /** Path name (e.g., "Timeline Flex") */
  name: string;
  /** Human-readable description of what this path involves */
  description: string;
  /** Projected probability if this path is followed (null for budget-only mode) */
  newProbability: number | null;
  /** Effort level required */
  effort: EffortLevel;
  /** How the timeline changes (e.g., "+2 weeks") */
  timelineImpact?: string;
  /** How savings rate changes (e.g., "+5% for 4 weeks") */
  savingsImpact?: string;
  /** Category freeze duration if applicable */
  freezeDuration?: string;
  /** Rebalance info for category_rebalance path */
  rebalanceInfo?: {
    fromCategory: string;
    fromCategoryId: string;
    availableSurplus: number;
    coverageAmount: number;
    isFullCoverage: boolean;
  };
  /** Concrete daily actions the user can take to save money */
  concreteActions?: string[];
  /** Budget impact description for budget-only mode (no goals) */
  budgetImpact?: string;
  /** Timeline effect description (e.g. "Moves projected date from October to August") */
  timelineEffect?: string;
}

/**
 * Non-judgmental message to show the user
 * These messages are validated against banned words to ensure supportive tone
 */
export interface NonJudgmentalMessage {
  /** Always 'Supportive' - enforced at type level */
  tone: 'Supportive';
  /** Main headline (e.g., "Let's recalculate your route") */
  headline: string;
  /** Supporting text with context */
  subtext: string;
}

/**
 * Multi-goal impact assessment
 * Shows impact on all active goals, not just the primary one
 */
export interface MultiGoalImpact {
  /** Primary goal impact (most affected or highest priority) */
  primaryGoal: GoalImpact;
  /** Impact on all other active goals */
  otherGoals: GoalImpact[];
  /** Summary statistics */
  summary: {
    totalGoalsAffected: number;
    averageProbabilityDrop: number;
    mostAffectedGoal: string;
    leastAffectedGoal: string;
  };
}

/**
 * Complete response from the GPS recalculate endpoint
 */
export interface RecoveryResponse {
  /** Session ID for tracking this recovery interaction */
  sessionId: string;
  /** Current budget status */
  budgetStatus: BudgetStatus;
  /** Impact on the user's primary goal (null when no goals exist) */
  goalImpact: GoalImpact | null;
  /** Impact on all active goals (null when no goals exist) */
  multiGoalImpact?: MultiGoalImpact | null;
  /** Three recovery path options */
  recoveryPaths: RecoveryPath[];
  /** Non-judgmental supportive message */
  message: NonJudgmentalMessage;
  /** Active commitment contracts at risk due to overspending */
  commitmentAtRisk?: {
    hasActiveCommitment: boolean;
    contracts: Array<{
      id: string;
      goalId: string;
      goalName: string;
      stakeType: string;
      stakeAmount: number | null;
      daysRemaining: number;
    }>;
    riskLevel: 'none' | 'low' | 'medium' | 'high';
    totalStakeAtRisk: number;
    message: string;
  };
}

/**
 * Input for simulation with adjusted parameters
 */
export interface AdjustedSimulationInput {
  /** Original simulation input */
  originalInput: {
    currentSavingsRate: number;
    monthlyIncome: number;
    currentNetWorth: number;
    goalAmount: number;
    goalDeadline: Date;
    expectedReturnRate: number;
    inflationRate: number;
    incomeGrowthRate: number;
  };
  /** Adjustment type */
  adjustmentType: 'time' | 'rate' | 'freeze' | 'rebalance';
  /** Weeks to extend deadline (for time adjustment) */
  weeksExtension?: number;
  /** Additional savings rate (for rate adjustment) */
  additionalSavingsRate?: number;
  /** Amount saved by freezing category (for freeze protocol) */
  freezeAmountSaved?: number;
}

/**
 * Spending velocity analysis for a budget category
 * Used by drift detection to determine if spending pace will lead to overspending
 */
export interface SpendingVelocity {
  /** Ratio of actual vs safe burn rate (1.0 = on pace, >1.0 = overpacing) */
  velocityRatio: number;
  /** Actual daily spending rate */
  spendingVelocity: number;
  /** Safe daily spending rate to stay within budget */
  safeBurnRate: number;
  /** Days elapsed since period start */
  daysElapsed: number;
  /** Days remaining in budget period */
  daysRemaining: number;
  /** Projected date when budget will be exceeded, or null if on pace */
  projectedOverspendDate: Date | null;
  /** Target daily spend to stay within remaining budget */
  courseCorrectionDaily: number;
  /** Whether current pace will lead to overspending */
  willOverspend: boolean;
}

/**
 * Budget insight from spending pattern analysis
 *
 * Identifies budgets that are consistently unrealistic based on
 * historical spending data (3-month lookback). If someone overspends
 * on Food 3 months in a row, the budget is wrong, not the person.
 */
export interface BudgetInsight {
  /** Unique identifier for the insight */
  id: string;
  /** Type of insight detected */
  type: 'UNREALISTIC_BUDGET' | 'CURRENT_MONTH_EXCEEDED' | 'CONSISTENT_SURPLUS' | 'NEW_CATEGORY';
  /** Category name */
  category: string;
  /** Category ID for database reference */
  categoryId: string;
  /** Current budgeted amount */
  budgeted: number;
  /** Average monthly spending over the lookback period */
  averageSpent: number;
  /** Number of months where spending exceeded budget */
  monthsExceeded: number;
  /** Monthly spending history for the lookback period */
  monthlyHistory: { month: string; spent: number }[];
  /** Suggested new budget amount */
  suggestedBudget: number;
  /** Offset suggestion: which surplus category can absorb the increase */
  offsetSuggestion?: {
    categoryId: string;
    categoryName: string;
    currentBudget: number;
    suggestedReduction: number;
    averageSurplus: number;
  };
  /** Human-readable message explaining the insight */
  message: string;
}

/**
 * Request body for applying a budget insight adjustment
 */
export interface ApplyBudgetInsightInput {
  /** Category ID of the underfunded budget */
  categoryId: string;
  /** New budget amount for the underfunded category */
  suggestedBudget: number;
  /** Optional: category ID of the surplus category to offset */
  offsetCategoryId?: string;
  /** Optional: amount to reduce from the offset category */
  offsetAmount?: number;
}

/**
 * Budget insight from spending pattern analysis
 *
 * Identifies budgets that are consistently unrealistic based on
 * historical spending data (3-month lookback). If someone overspends
 * on Food 3 months in a row, the budget is wrong, not the person.
 */
/**
 * Recovery path configuration for generating paths
 */
export interface RecoveryPathConfig {
  /** Path ID */
  id: string;
  /** Path name */
  name: string;
  /** Base description template */
  descriptionTemplate: string;
  /** Effort level */
  effort: EffortLevel;
  /** Function to calculate the adjustment */
  calculateAdjustment: (overspendAmount: number, monthlyIncome: number) => AdjustedSimulationInput['adjustmentType'];
}

/**
 * Recovery progress tracking
 * Tracks whether a selected recovery path is actually working
 */
export interface RecoveryProgress {
  sessionId: string;
  pathId: string;
  pathName: string;
  startDate: Date;
  endDate: Date;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  adherence: number;
  status: 'on_track' | 'at_risk' | 'completed' | 'failed';
  actualSaved: number;
  targetSaved: number;
  message: string;
}

/**
 * Historical recovery record for past recovery sessions
 */
export interface RecoveryHistoryEntry {
  date: Date;
  category: string;
  pathChosen: string;
  target: number;
  actual: number;
  success: boolean;
}

/**
 * Spending breakdown for a budget category
 * Shows where the money is going within a category
 */
export interface SpendingBreakdown {
  categoryId: string;
  categoryName: string;
  totalSpent: number;
  budgeted: number;
  breakdown: Array<{
    label: string;
    amount: number;
    percent: number;
    count: number;
  }>;
  insight: string;
}
