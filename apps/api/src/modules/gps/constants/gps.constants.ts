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
    TIME_ADJUSTMENT: 'time_adjustment',
    RATE_ADJUSTMENT: 'rate_adjustment',
    FREEZE_PROTOCOL: 'freeze_protocol',
  } as const,

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
} as const;

/**
 * Recovery path configurations
 */
export const RECOVERY_PATHS = {
  [GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT]: {
    id: GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT,
    name: 'Timeline Flex',
    descriptionTemplate: 'Extend your goal deadline by {weeks} weeks',
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
      "You've taken a different turn - here's how to reach your goal.",
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
