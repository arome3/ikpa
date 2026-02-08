/**
 * Time horizons for Monte Carlo simulation projections
 */
export type TimeHorizon = '6mo' | '1yr' | '5yr' | '10yr' | '20yr';

/**
 * All time horizons as an array for iteration
 */
export const TIME_HORIZONS: TimeHorizon[] = ['6mo', '1yr', '5yr', '10yr', '20yr'];

/**
 * Time horizon to months mapping
 */
export const TIME_HORIZON_MONTHS: Record<TimeHorizon, number> = {
  '6mo': 6,
  '1yr': 12,
  '5yr': 60,
  '10yr': 120,
  '20yr': 240,
};

/**
 * Single financial goal for simulation
 */
export interface SimulationGoal {
  /** Unique identifier for the goal */
  id?: string;
  /** Goal name for display */
  name?: string;
  /** Target goal amount */
  amount: number;
  /** Target date to achieve the goal */
  deadline: Date;
  /** Priority (1 = highest, used for ordering) */
  priority?: number;
}

/**
 * Input parameters for the Monte Carlo simulation
 */
export interface SimulationInput {
  /** Current savings rate as a decimal (0.0 - 1.0) */
  currentSavingsRate: number;
  /** Monthly income in local currency */
  monthlyIncome: number;
  /** Monthly expenses in local currency (optional, for expense growth modeling) */
  monthlyExpenses?: number;
  /** Current net worth (assets - liabilities) */
  currentNetWorth: number;
  /** Target goal amount (primary goal - deprecated, use goals array) */
  goalAmount: number;
  /** Target date to achieve the goal (primary goal - deprecated, use goals array) */
  goalDeadline: Date;
  /** Multiple goals with priorities (optional, overrides goalAmount/goalDeadline) */
  goals?: SimulationGoal[];
  /** Expected annual investment return rate (default: 0.07 = 7%) */
  expectedReturnRate: number;
  /** Annual inflation rate (country-specific default) */
  inflationRate: number;
  /** Annual income growth rate (default: 0.03 = 3%) */
  incomeGrowthRate?: number;
  /** Annual expense growth rate (default: equals inflation rate) */
  expenseGrowthRate?: number;
  /** Tax rate on investment returns (default: 0 = no tax) */
  taxRateOnReturns?: number;
  /** Enable market regime modeling (bull/bear cycles) */
  enableMarketRegimes?: boolean;
  /** Monthly withdrawal amount after goal achievement (for retirement modeling) */
  monthlyWithdrawal?: number;
  /** Random seed for reproducible simulations (optional) */
  randomSeed?: number;
}

/**
 * Confidence interval for projected values
 */
export interface ConfidenceInterval {
  /** 10th percentile (pessimistic scenario) */
  low: number;
  /** 90th percentile (optimistic scenario) */
  high: number;
}

/**
 * Confidence intervals at each time horizon
 */
export type ConfidenceIntervalsByHorizon = Record<TimeHorizon, ConfidenceInterval>;

/**
 * Projected net worth at each time horizon
 */
export type ProjectedNetWorth = Record<TimeHorizon, number>;

/**
 * Individual goal result in path output
 */
export interface GoalPathResult {
  /** Goal identifier */
  goalId: string;
  /** Goal name */
  goalName?: string;
  /** Target amount */
  targetAmount: number;
  /** Probability of achieving this goal */
  probability: number;
  /** Estimated achievement date */
  achieveDate: Date | null;
}

/**
 * Single path simulation result
 */
export interface PathResult {
  /** Probability of achieving the primary goal (0.0 - 1.0) */
  probability: number;
  /** Projected net worth at each time horizon */
  projectedNetWorth: ProjectedNetWorth;
  /** Estimated date when primary goal will be achieved, or null if unlikely */
  achieveGoalDate: Date | null;
  /** 10th-90th percentile confidence intervals at each time horizon */
  confidenceIntervals: ConfidenceIntervalsByHorizon;
  /** Probability of achieving ALL goals (when multiple goals provided) */
  allGoalsProbability?: number;
  /** Individual goal results (when multiple goals provided) */
  goalResults?: GoalPathResult[];
}

/**
 * Optimized path includes the required savings rate adjustment
 */
export interface OptimizedPathResult extends PathResult {
  /** Recommended savings rate to achieve 85%+ probability */
  requiredSavingsRate: number;
}

/**
 * Wealth difference between optimized and current path at each horizon
 */
export type WealthDifference = Record<TimeHorizon, number>;

/**
 * Simulation metadata for debugging and analytics
 */
export interface SimulationMetadata {
  /** Number of Monte Carlo iterations (typically 10,000) */
  iterations: number;
  /** Simulation execution time in milliseconds */
  durationMs: number;
  /** Timestamp when simulation was run */
  simulatedAt: Date;
  /** Currency used for all monetary values */
  currency: string;
}

/**
 * Complete simulation output comparing current vs optimized paths
 */
export interface SimulationOutput {
  /** Results following the user's current savings behavior */
  currentPath: PathResult;
  /** Results following an optimized savings strategy */
  optimizedPath: OptimizedPathResult;
  /** Net worth difference at each time horizon (optimized - current) */
  wealthDifference: WealthDifference;
  /** Simulation metadata */
  metadata: SimulationMetadata;
}

/**
 * Goal achievement result for a single goal
 */
export interface GoalAchievementResult {
  /** Goal identifier or index */
  goalId: string;
  /** Whether the goal was achieved by its deadline */
  achieved: boolean;
  /** Month when goal was first achieved (or null) */
  achievedMonth: number | null;
}

/**
 * Single Monte Carlo iteration result
 */
export interface MonteCarloIteration {
  /** Final net worth at each time horizon */
  netWorthByHorizon: ProjectedNetWorth;
  /** Whether the primary goal was achieved by the deadline */
  goalAchieved: boolean;
  /** Month when primary goal was first achieved (or null) */
  goalAchievedMonth: number | null;
  /** Results for each individual goal (when using multiple goals) */
  goalResults?: GoalAchievementResult[];
  /** Whether all goals were achieved */
  allGoalsAchieved?: boolean;
}

/**
 * Aggregated result for a single goal
 */
export interface GoalAggregatedResult {
  /** Goal identifier */
  goalId: string;
  /** Goal name */
  goalName?: string;
  /** Probability of achieving this specific goal */
  probability: number;
  /** Median month when goal was achieved (or null) */
  medianAchievedMonth: number | null;
}

/**
 * Aggregated results from all Monte Carlo iterations
 */
export interface MonteCarloAggregatedResults {
  /** Probability of achieving primary goal (successful iterations / total) */
  probability: number;
  /** Median net worth at each horizon */
  medianNetWorth: ProjectedNetWorth;
  /** 10th percentile net worth at each horizon */
  percentile10ByHorizon: ProjectedNetWorth;
  /** 90th percentile net worth at each horizon */
  percentile90ByHorizon: ProjectedNetWorth;
  /** Median month when primary goal was achieved (or null) */
  medianGoalMonth: number | null;
  /** Probability of achieving ALL goals */
  allGoalsProbability?: number;
  /** Individual goal results */
  goalResults?: GoalAggregatedResult[];
}

/**
 * Economic defaults by country for simulation parameters
 */
export interface EconomicDefaults {
  /** Annual inflation rate */
  inflationRate: number;
  /** Expected annual investment return */
  expectedReturn: number;
  /** Annual income growth rate */
  incomeGrowthRate: number;
}

/**
 * Country-specific economic defaults
 * Income growth rates are based on typical professional salary growth in each region
 */
export const ECONOMIC_DEFAULTS: Record<string, EconomicDefaults> = {
  NIGERIA: { inflationRate: 0.05, expectedReturn: 0.1, incomeGrowthRate: 0.05 },
  GHANA: { inflationRate: 0.08, expectedReturn: 0.12, incomeGrowthRate: 0.04 },
  KENYA: { inflationRate: 0.06, expectedReturn: 0.09, incomeGrowthRate: 0.04 },
  SOUTH_AFRICA: { inflationRate: 0.05, expectedReturn: 0.08, incomeGrowthRate: 0.03 },
  USA: { inflationRate: 0.02, expectedReturn: 0.07, incomeGrowthRate: 0.03 },
  UK: { inflationRate: 0.02, expectedReturn: 0.06, incomeGrowthRate: 0.025 },
  DEFAULT: { inflationRate: 0.05, expectedReturn: 0.07, incomeGrowthRate: 0.03 },
};

/**
 * Market regime types for correlation modeling
 */
export type MarketRegime = 'bull' | 'bear' | 'normal';

/**
 * Market regime parameters
 */
export interface MarketRegimeParams {
  /** Mean return adjustment for this regime */
  returnAdjustment: number;
  /** Volatility multiplier for this regime */
  volatilityMultiplier: number;
  /** Average duration in months */
  averageDuration: number;
  /** Probability of transitioning to each regime */
  transitionProbabilities: Record<MarketRegime, number>;
}

/**
 * Market regime configurations based on historical data
 */
export const MARKET_REGIMES: Record<MarketRegime, MarketRegimeParams> = {
  bull: {
    returnAdjustment: 0.03, // +3% annual boost
    volatilityMultiplier: 0.8, // Lower volatility
    averageDuration: 36, // 3 years average
    transitionProbabilities: { bull: 0.85, normal: 0.12, bear: 0.03 },
  },
  normal: {
    returnAdjustment: 0,
    volatilityMultiplier: 1.0,
    averageDuration: 24, // 2 years average
    transitionProbabilities: { bull: 0.15, normal: 0.70, bear: 0.15 },
  },
  bear: {
    returnAdjustment: -0.05, // -5% annual drag
    volatilityMultiplier: 1.5, // Higher volatility
    averageDuration: 12, // 1 year average
    transitionProbabilities: { bull: 0.10, normal: 0.30, bear: 0.60 },
  },
};

/**
 * Simulation engine constants
 */
export const SIMULATION_CONSTANTS = {
  /** Number of Monte Carlo iterations for full simulation */
  ITERATIONS: 10000,
  /** Reduced iterations for binary search optimization (faster) */
  OPTIMIZATION_ITERATIONS: 1000,
  /** Annual return standard deviation (volatility) */
  RETURN_STD_DEV: 0.15,
  /** Maximum recommended savings rate */
  MAX_SAVINGS_RATE: 0.35,
  /** Minimum savings rate for optimization search */
  MIN_SAVINGS_RATE: 0.01,
  /** Target probability for optimized path (85%) */
  TARGET_PROBABILITY: 0.85,
  /** Binary search tolerance for savings rate */
  OPTIMIZATION_TOLERANCE: 0.005,
  /** Maximum binary search iterations */
  MAX_OPTIMIZATION_ITERATIONS: 20,
  /** Cache TTL in milliseconds (5 minutes) */
  CACHE_TTL_MS: 5 * 60 * 1000,
  /** Default income growth rate (3% annually) */
  DEFAULT_INCOME_GROWTH_RATE: 0.03,
  /** Default expense growth rate (follows inflation) */
  DEFAULT_EXPENSE_GROWTH_RATE: null, // null means use inflation rate
  /** Default tax rate on investment returns */
  DEFAULT_TAX_RATE: 0,
  /** Maximum number of goals supported */
  MAX_GOALS: 5,
  /**
   * IKPA platform benefit: expense growth reduction factor.
   * IKPA's budget tracking, alerts, and spending analysis help users
   * reduce wasteful spending growth. Modeled as 40% reduction in
   * expense growth rate (e.g., if inflation is 5%, IKPA users see
   * only 3% effective expense growth through better spending habits).
   */
  IKPA_EXPENSE_GROWTH_REDUCTION: 0.40,
  /**
   * IKPA platform benefit: investment return improvement.
   * IKPA's goal tracking and financial guidance help users make
   * more informed investment decisions. Modeled as +1% annual
   * real return improvement.
   */
  IKPA_RETURN_BONUS: 0.01,
  /**
   * IKPA platform benefit: immediate expense reduction.
   * IKPA's Shark subscription auditor, GPS budget alerts, and spending
   * analysis catch wasteful spending from day one. Modeled as a 15%
   * reduction in monthly expenses, which directly increases the
   * effective savings rate. This creates an immediate, visible gap
   * between the two paths (unlike compound-only benefits which take
   * years to become noticeable).
   */
  IKPA_EXPENSE_REDUCTION: 0.15,
  /**
   * IKPA platform benefit: income growth improvement.
   * IKPA's financial confidence, career planning insights, and
   * goal-oriented mindset help users pursue raises and better
   * opportunities. Modeled as +2% annual income growth bonus.
   */
  IKPA_INCOME_GROWTH_BONUS: 0.02,
} as const;
