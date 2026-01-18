/**
 * Commitment Device Engine Constants
 *
 * Configuration values and constants for the Commitment Device Engine.
 * Research shows users with stakes are 3x more likely to achieve their goals.
 */

/**
 * Main commitment constants configuration
 */
export const COMMITMENT_CONSTANTS = {
  /**
   * Minimum stake amount for ANTI_CHARITY and LOSS_POOL types
   * Set to 1000 NGN (roughly $1-2 USD equivalent)
   */
  MINIMUM_STAKE_AMOUNT: 1000,

  /**
   * Maximum stake amount (safety limit)
   * Set to 500,000 NGN (roughly $500 USD equivalent)
   */
  MAXIMUM_STAKE_AMOUNT: 500000,

  /**
   * Default verification method
   */
  DEFAULT_VERIFICATION_METHOD: 'SELF_REPORT' as const,

  /**
   * Referee invitation expiry in days
   */
  REFEREE_INVITE_EXPIRY_DAYS: 7,

  /**
   * Referee verification token expiry in days
   * JWT tokens for verification links expire after this many days
   */
  REFEREE_VERIFICATION_TOKEN_DAYS: 30,

  /**
   * Maximum number of referees per user
   */
  MAX_REFEREES_PER_USER: 10,

  /**
   * Maximum active commitments per goal
   */
  MAX_COMMITMENTS_PER_GOAL: 1,

  /**
   * Minimum deadline lead time in days (must be at least 7 days from now)
   */
  MINIMUM_DEADLINE_DAYS: 7,

  /**
   * Maximum deadline extension in days from original deadline
   * Users can extend their deadline up to 90 days from the original
   */
  MAX_DEADLINE_EXTENSION_DAYS: 90,

  /**
   * Hours before deadline to send reminder
   */
  REMINDER_HOURS_BEFORE: [168, 24, 1], // 7 days, 1 day, 1 hour

  /**
   * Success rate multipliers by stake type (research-backed)
   */
  SUCCESS_RATE_MULTIPLIERS: {
    SOCIAL: 2.0, // 2x more likely with social accountability
    ANTI_CHARITY: 3.0, // 3x more likely with anti-charity stake
    LOSS_POOL: 2.5, // 2.5x more likely with loss pool
  },

  /**
   * Verification window in hours after deadline
   * Referee has this many hours to verify before auto-processing
   */
  VERIFICATION_WINDOW_HOURS: 72, // 3 days

  /**
   * Stake type identifiers
   */
  STAKE_TYPES: {
    SOCIAL: 'SOCIAL',
    ANTI_CHARITY: 'ANTI_CHARITY',
    LOSS_POOL: 'LOSS_POOL',
  } as const,

  /**
   * Commitment status identifiers
   */
  COMMITMENT_STATUSES: {
    ACTIVE: 'ACTIVE',
    PENDING_VERIFICATION: 'PENDING_VERIFICATION',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  } as const,
} as const;

/**
 * Stake type configurations
 */
export const STAKE_CONFIGS = {
  [COMMITMENT_CONSTANTS.STAKE_TYPES.SOCIAL]: {
    id: 'SOCIAL',
    name: 'Social Accountability',
    description: 'A referee you choose will verify your progress',
    requiresAmount: false,
    requiresReferee: true,
    successRateBoost: '78%', // Research shows 78% success rate
    icon: 'users',
  },
  [COMMITMENT_CONSTANTS.STAKE_TYPES.ANTI_CHARITY]: {
    id: 'ANTI_CHARITY',
    name: 'Anti-Charity Stake',
    description: 'If you miss your goal, your stake goes to a cause you oppose',
    requiresAmount: true,
    requiresReferee: false,
    successRateBoost: '85%',
    icon: 'shield-alert',
  },
  [COMMITMENT_CONSTANTS.STAKE_TYPES.LOSS_POOL]: {
    id: 'LOSS_POOL',
    name: 'Loss Pool',
    description: 'Your stake is locked and only released when you achieve your goal',
    requiresAmount: true,
    requiresReferee: false,
    successRateBoost: '81%',
    icon: 'lock',
  },
} as const;

/**
 * Supportive messages for commitment events
 * Non-judgmental messaging following the same pattern as GPS Re-Router
 */
export const COMMITMENT_MESSAGES = {
  CREATED: {
    headlines: [
      "You've raised the stakes",
      'Your commitment is locked in',
      'Challenge accepted',
      "You're playing to win",
    ],
    subtexts: [
      'Research shows you are now 3x more likely to achieve your goal.',
      'Your accountability system is now active. You got this.',
      "Stakes create focus. You've just increased your success probability.",
      'Commitment + stakes = results. Your future self will thank you.',
    ],
  },
  DEADLINE_APPROACHING: {
    headlines: [
      'Your deadline is approaching',
      "Time to finish strong",
      "You're in the home stretch",
    ],
    subtexts: [
      'You still have time to reach your goal. Keep pushing.',
      "Remember why you started. The finish line is in sight.",
      'Every step counts. Stay focused on your target.',
    ],
  },
  SUCCEEDED: {
    headlines: [
      'You did it!',
      'Goal achieved!',
      'Commitment fulfilled!',
      'Success!',
    ],
    subtexts: [
      'Your discipline paid off. Your stake is being released.',
      'Proof that stakes work. You set a goal and crushed it.',
      'This is what commitment looks like. Celebrate your win.',
      'You made a promise to yourself and kept it. Amazing.',
    ],
  },
  FAILED: {
    headlines: [
      "Let's learn from this",
      'A setback, not the end',
      'Time for a new approach',
    ],
    subtexts: [
      'Your stake is being processed. Consider what you might do differently next time.',
      'This outcome can fuel your next commitment. Many successful people try multiple times.',
      'The fact that you tried puts you ahead of most. Ready to try again with a new strategy?',
    ],
  },
} as const;

/**
 * Opik trace names for commitment operations
 */
export const COMMITMENT_TRACE_NAMES = {
  CREATE: 'commitment_create',
  VERIFY: 'commitment_verify',
  CANCEL: 'commitment_cancel',
  ENFORCE: 'commitment_enforce',
  INVITE_REFEREE: 'commitment_invite_referee',
  PROCESS_SUCCESS: 'commitment_process_success',
  PROCESS_FAILURE: 'commitment_process_failure',
} as const;

/**
 * Opik metric names for commitment analytics
 */
export const COMMITMENT_METRICS = {
  STAKE_EFFECTIVENESS: 'stake_effectiveness',
  REFEREE_ENGAGEMENT: 'referee_engagement',
  COMMITMENT_STRENGTH: 'commitment_strength',
  RETRY_RATE: 'retry_rate',
  STAKE_TYPE_CONVERSION: 'stake_type_conversion',
} as const;
