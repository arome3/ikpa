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
export type EffortLevel = 'Low' | 'Medium' | 'High';

/**
 * Status of a user's budget for a specific category
 */
export interface BudgetStatus {
  /** Expense category name */
  category: string;
  /** Category ID for database reference */
  categoryId: string;
  /** Budgeted amount for the period */
  budgeted: number;
  /** Amount spent so far */
  spent: number;
  /** Amount remaining (can be negative if overspent) */
  remaining: number;
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
  /** Goal target amount */
  goalAmount: number;
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
  /** Projected probability if this path is followed */
  newProbability: number;
  /** Effort level required */
  effort: EffortLevel;
  /** How the timeline changes (e.g., "+2 weeks") */
  timelineImpact?: string;
  /** How savings rate changes (e.g., "+5% for 4 weeks") */
  savingsImpact?: string;
  /** Category freeze duration if applicable */
  freezeDuration?: string;
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
  /** Impact on the user's primary goal (for backwards compatibility) */
  goalImpact: GoalImpact;
  /** Impact on all active goals (multi-goal assessment) */
  multiGoalImpact?: MultiGoalImpact;
  /** Three recovery path options */
  recoveryPaths: RecoveryPath[];
  /** Non-judgmental supportive message */
  message: NonJudgmentalMessage;
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
  adjustmentType: 'time' | 'rate' | 'freeze';
  /** Weeks to extend deadline (for time adjustment) */
  weeksExtension?: number;
  /** Additional savings rate (for rate adjustment) */
  additionalSavingsRate?: number;
  /** Amount saved by freezing category (for freeze protocol) */
  freezeAmountSaved?: number;
}

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
