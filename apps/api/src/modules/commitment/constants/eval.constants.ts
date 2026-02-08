/**
 * Commitment Coach Evaluation Constants
 *
 * Trace names and feedback metric names for Opik integration.
 */

export const COMMITMENT_TRACE_NAMES = {
  COACH_AGENT: 'commitment_coach_agent_trace',
  NEGOTIATION_START: 'commitment_negotiation_start',
  NEGOTIATION_CONTINUE: 'commitment_negotiation_continue',
  UPGRADE_CHECK: 'commitment_upgrade_check',
  STAKE_CREATION: 'commitment_stake_creation',
};

export const COMMITMENT_FEEDBACK_METRICS = {
  /** Whether the recommendation was appropriate for the user's financial situation (0 or 1) */
  RECOMMENDATION_QUALITY: 'recommendation_quality',
  /** How well the stake amount was calibrated to the user's income (0 to 1 continuous) */
  STAKE_CALIBRATION_ACCURACY: 'stake_calibration_accuracy',
  /** Ratio of tool calls to total turns — measures how efficiently the agent gathers context */
  NEGOTIATION_EFFECTIVENESS: 'negotiation_effectiveness',
  /** Whether the user accepted the recommendation */
  RECOMMENDATION_ACCEPTED: 'recommendation_accepted',
  /** Financial safety: stake was within 10% income cap */
  FINANCIAL_SAFETY: 'financial_safety',
};
