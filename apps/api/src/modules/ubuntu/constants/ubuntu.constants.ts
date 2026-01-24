/**
 * Ubuntu Manager Constants
 *
 * The Ubuntu Manager recognizes that in African cultures, supporting family
 * is a VALUE, not a problem. It reframes family transfers as "Social Capital
 * Investment" and provides non-judgmental adjustments for family emergencies.
 *
 * Ubuntu Philosophy: "I am because we are."
 */

/**
 * Risk level thresholds for dependency ratio
 * Culturally calibrated - Orange zone (10-35%) is considered "healthy" not problematic
 */
export const RISK_THRESHOLDS = {
  GREEN_MAX: 0.10,      // 0-10% - Sustainable
  ORANGE_MAX: 0.35,     // 10-35% - Moderate (healthy in African context)
  // Above 35% is RED - Review Needed
} as const;

/**
 * Adjustment recovery time estimates (in weeks)
 */
export const RECOVERY_WEEKS = {
  EMERGENCY_FUND_TAP: 12,    // Recommended if fund >= 50% of need
  GOAL_TIMELINE_EXTEND: 4,   // Extend deadline by 4 weeks
  SAVINGS_RATE_REDUCE: 8,    // Temporarily reduce by 50%
} as const;

/**
 * Non-judgmental messaging - no shame words like "failed", "problem", "leakage"
 */
export const UBUNTU_MESSAGES = {
  GREEN: {
    headline: 'Your family support is well-balanced',
    subtext: "You're building wealth while honoring your responsibilities to loved ones.",
  },
  ORANGE: {
    headline: 'Family comes first - and so does your future',
    subtext: 'Consider building a dedicated family support fund alongside your goals.',
  },
  RED: {
    headline: "You're carrying a heavy load for your family",
    subtext: "Let's explore ways to meet your family obligations while protecting your financial future.",
  },
} as const;

/**
 * Opik trace names for observability
 */
export const TRACE_NAMES = {
  GET_DEPENDENCY_RATIO: 'ubuntu_get_dependency_ratio',
  ADD_FAMILY_SUPPORT: 'ubuntu_add_family_support',
  GET_ADJUSTMENTS: 'ubuntu_get_adjustments',
  HANDLE_EMERGENCY: 'ubuntu_handle_emergency',
  REPORT_EMERGENCY: 'ubuntu_report_emergency',
} as const;

/**
 * Opik metric names for tracking
 */
export const METRICS = {
  CULTURAL_SENSITIVITY: 'CulturalSensitivity',
  DEPENDENCY_RATIO_HEALTH: 'DependencyRatioHealth',
  FAMILY_EMERGENCY_RECOVERY_TIME: 'FamilyEmergencyRecoveryTime',
  OBLIGATION_TRACKING_ADOPTION: 'ObligationTrackingAdoption',
} as const;

/**
 * Relationship type categorization for dependency ratio breakdown
 */
export const RELATIONSHIP_CATEGORIES = {
  PARENT_SUPPORT: ['PARENT', 'SPOUSE', 'CHILD'],
  SIBLING_EDUCATION: ['SIBLING'],
  EXTENDED_FAMILY: ['EXTENDED_FAMILY', 'OTHER'],
  COMMUNITY_CONTRIBUTION: ['FRIEND', 'COMMUNITY'],
} as const;

/**
 * Emergency fund tap threshold (50% of need)
 */
export const EMERGENCY_FUND_TAP_THRESHOLD = 0.5;

/**
 * Goal timeline extension duration (weeks)
 */
export const GOAL_TIMELINE_EXTENSION_WEEKS = 4;

/**
 * Temporary savings rate reduction percentage
 */
export const TEMPORARY_SAVINGS_REDUCTION = 0.5;
