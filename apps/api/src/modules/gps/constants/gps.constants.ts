/**
 * GPS Re-Router Constants
 *
 * Configuration values and constants for the GPS Re-Router feature.
 */

/**
 * Main GPS constants configuration
 */
export const GPS_CONSTANTS = {
  /**
   * Words that should NEVER appear in messages to users
   * These words are judgmental and can trigger shame/abandonment
   */
  BANNED_WORDS: [
    'failed',
    'failure',
    'mistake',
    'problem',
    'wrong',
    'bad',
    'terrible',
    'awful',
    'shame',
    'shameful',
    'disappoint',
    'disappointed',
    'disappointing',
    'fault',
    'blame',
    'irresponsible',
    'reckless',
    'careless',
    'stupid',
    'dumb',
    'idiot',
  ],

  /**
   * Budget warning threshold (80% of budget spent)
   */
  BUDGET_WARNING_THRESHOLD: 0.8,

  /**
   * Budget exceeded threshold (100% of budget spent)
   */
  BUDGET_EXCEEDED_THRESHOLD: 1.0,

  /**
   * Budget critical threshold (120% of budget spent)
   */
  BUDGET_CRITICAL_THRESHOLD: 1.2,

  /**
   * Recovery path identifiers
   */
  RECOVERY_PATH_IDS: {
    CATEGORY_REBALANCE: 'category_rebalance',
    TIME_ADJUSTMENT: 'time_adjustment',
    RATE_ADJUSTMENT: 'rate_adjustment',
    FREEZE_PROTOCOL: 'freeze_protocol',
  } as const,

  /**
   * Maximum number of budget rebalances per budget period
   * Prevents "Whack-A-Mole" budgeting where users constantly shuffle money around
   */
  MAX_REBALANCES_PER_PERIOD: 2,

  /**
   * Minimum surplus ratio to qualify a category for rebalancing
   * Category must be at least 10% under budget (prorated) to be a source
   */
  MIN_SURPLUS_RATIO: 0.1,

  /**
   * Default timeline extension in weeks for time adjustment path
   */
  DEFAULT_TIMELINE_EXTENSION_WEEKS: 2,

  /**
   * Default savings rate increase percentage for rate adjustment path
   */
  DEFAULT_SAVINGS_RATE_INCREASE: 0.05, // 5%

  /**
   * Default freeze duration in weeks for freeze protocol
   */
  DEFAULT_FREEZE_DURATION_WEEKS: 4,

  /**
   * Maximum number of recovery sessions to keep per user
   */
  MAX_RECOVERY_SESSIONS_PER_USER: 50,

  /**
   * Recovery session expiry (days after which abandoned sessions are cleaned up)
   */
  RECOVERY_SESSION_EXPIRY_DAYS: 30,

  /**
   * Target probability for successful goal achievement
   */
  TARGET_PROBABILITY: 0.85, // 85%

  /**
   * Spending drift detection thresholds
   * Controls when "Speed Check" alerts fire based on spending velocity
   */
  DRIFT_DETECTION: {
    /** Minimum days elapsed before drift alerts can fire (prevents noise) */
    MIN_ELAPSED_DAYS: 3,
    /** Minimum velocity ratio to trigger alert (1.3 = 30% over pace) */
    VELOCITY_RATIO_THRESHOLD: 1.3,
    /** Only alert if projected overspend within this many days */
    ALERT_HORIZON_DAYS: 7,
    /** Don't alert with fewer than this many days remaining */
    MIN_DAYS_REMAINING: 2,
  } as const,
} as const;

/**
 * Recovery path configurations
 */
export const RECOVERY_PATHS = {
  [GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE]: {
    id: GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE,
    name: 'Smart Swap',
    descriptionTemplate: 'Cover this with your {fromCategory} surplus',
    effort: 'None' as const,
    icon: 'refresh-cw',
  },
  [GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT]: {
    id: GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
    name: 'Timeline Flex',
    descriptionTemplate: 'Extend your {goalName} deadline by {weeks} weeks',
    effort: 'Low' as const,
    icon: 'clock',
  },
  [GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT]: {
    id: GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT,
    name: 'Savings Boost',
    descriptionTemplate: 'Increase savings rate by {rate}% for {weeks} weeks',
    effort: 'Medium' as const,
    icon: 'trending-up',
  },
  [GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL]: {
    id: GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL,
    name: 'Category Pause',
    descriptionTemplate: 'Pause spending in {category} for {weeks} weeks',
    effort: 'High' as const,
    icon: 'pause-circle',
  },
} as const;


/**
 * Concrete daily action templates by spending category
 *
 * Each category has a list of actions sorted by minimum overage threshold.
 * The `weeklySavings` estimate helps users see the monetary impact of each action.
 * Categories not listed here fall back to 'other'.
 */
export const ACTION_TEMPLATES: Record<string, Array<{ minOverage: number; action: string; weeklySavings: number }>> = {
  'food-dining': [
    { minOverage: 0, action: 'Pack lunch instead of eating out \u2014 saves ~$12/day', weeklySavings: 60 },
    { minOverage: 50, action: 'Cook at home 4+ nights this week', weeklySavings: 80 },
    { minOverage: 100, action: 'Skip delivery apps for 2 weeks', weeklySavings: 45 },
    { minOverage: 200, action: 'Meal prep on Sunday to cover weekday meals', weeklySavings: 100 },
  ],
  'cat-streaming': [
    { minOverage: 0, action: 'Free entertainment this weekend (parks, library, etc.)', weeklySavings: 30 },
    { minOverage: 50, action: 'Pause one streaming subscription temporarily', weeklySavings: 15 },
    { minOverage: 100, action: 'Host a potluck instead of going out', weeklySavings: 40 },
  ],
  'entertainment': [
    { minOverage: 0, action: 'Free entertainment this weekend (parks, library, etc.)', weeklySavings: 30 },
    { minOverage: 50, action: 'Pause one streaming subscription temporarily', weeklySavings: 15 },
    { minOverage: 100, action: 'Host a potluck instead of going out', weeklySavings: 40 },
  ],
  'shopping': [
    { minOverage: 0, action: 'Apply the 48-hour rule: wait before non-essential purchases', weeklySavings: 25 },
    { minOverage: 50, action: 'Unsubscribe from promotional emails to reduce impulse buys', weeklySavings: 30 },
    { minOverage: 100, action: 'No-spend challenge for the rest of the week', weeklySavings: 50 },
  ],
  'transportation': [
    { minOverage: 0, action: 'Combine errands to reduce trips', weeklySavings: 15 },
    { minOverage: 50, action: 'Use public transit or carpool 2 days this week', weeklySavings: 25 },
  ],
  'other': [
    { minOverage: 0, action: "Review this week's spending and identify one area to cut back", weeklySavings: 20 },
    { minOverage: 50, action: 'Set a daily spending cap and track it', weeklySavings: 35 },
    { minOverage: 100, action: 'Challenge yourself to a 3-day no-spend period', weeklySavings: 50 },
  ],
};

/**
 * Non-judgmental message templates
 * These are supportive messages that help users feel in control
 */
export const SUPPORTIVE_MESSAGES = {
  BUDGET_EXCEEDED: {
    headlines: [
      "Let's recalculate your route",
      'Time for a quick course correction',
      'Your GPS is recalculating',
      "Let's find your new path forward",
    ],
    subtexts: [
      'Spending more than planned happens to everyone. Here are three ways to get back on track.',
      "One detour doesn't change your destination. Let's explore your options.",
      "You've taken a different turn - here's how to reach {goal}.",
      "This is a detour, not a dead end. Let's recalculate together.",
    ],
  },
  BUDGET_WARNING: {
    headlines: [
      "You're approaching your limit",
      'Quick check-in on your budget',
      'Heads up on your spending',
    ],
    subtexts: [
      "You're close to your budget limit. Here's how things look.",
      'A quick update on where you stand this period.',
      'Keeping you informed so you can stay in control.',
    ],
  },
} as const;

/**
 * Opik trace names for GPS operations
 */
export const GPS_TRACE_NAMES = {
  RECALCULATE: 'gps_rerouter_cognitive_chain',
  DETECT_BUDGET: 'detect_budget_status',
  CALCULATE_IMPACT: 'calculate_goal_impact',
  GENERATE_PATHS: 'generate_recovery_paths',
  SELECT_PATH: 'select_recovery_path',
} as const;
