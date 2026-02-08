/**
 * Future Self Simulator Constants
 *
 * Configuration values and defaults for the Future Self feature.
 */

/**
 * The age of the "future self" writing letters
 * Based on typical retirement age for financial planning
 */
export const FUTURE_AGE = 60;

/**
 * Time horizons for visualization slider
 */
export const TIME_HORIZONS = ['6mo', '1yr', '5yr', '10yr', '20yr'] as const;

/**
 * Minimum savings rate to be considered "on track"
 * Users below this threshold get empathetic/encouraging letters
 * Users above get celebratory letters
 */
export const MIN_SAVINGS_RATE_ON_TRACK = 0.15;

/**
 * Cache TTL for simulation results (5 minutes)
 */
export const SIMULATION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache TTL for letters (30 minutes - letters are expensive to generate)
 */
export const LETTER_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Maximum tokens for letter generation
 * Note: DEFAULT_ANTHROPIC_MODEL is now in shared anthropic module
 */
export const LETTER_MAX_TOKENS = 1000;

/**
 * Maximum tokens for tone evaluation
 */
export const TONE_EVAL_MAX_TOKENS = 200;

// ==========================================
// OPIK TRACE NAMES
// ==========================================

/**
 * Trace name for simulation generation
 */
export const TRACE_FUTURE_SELF_SIMULATION = 'future_self_simulation';

/**
 * Trace name for letter generation
 */
export const TRACE_FUTURE_SELF_LETTER = 'future_self_letter';

/**
 * Span name for getting user context
 */
export const SPAN_GET_USER_CONTEXT = 'get_user_context';

/**
 * Span name for running simulation
 */
export const SPAN_RUN_SIMULATION = 'run_simulation';

/**
 * Span name for letter generation LLM call
 */
export const SPAN_GENERATE_LETTER = 'generate_letter';

/**
 * Span name for tone evaluation LLM call
 */
export const SPAN_EVALUATE_TONE = 'evaluate_tone';

/**
 * Span name for content moderation check
 */
export const SPAN_CONTENT_MODERATION = 'content_moderation';

/**
 * Feedback name for tone empathy score
 */
export const FEEDBACK_TONE_EMPATHY = 'ToneEmpathy';

/**
 * Trace name for conversation
 */
export const TRACE_FUTURE_SELF_CONVERSATION = 'future_self_conversation';

/**
 * Span names for conversation tracing
 */
export const SPAN_LOAD_CONVERSATION_CONTEXT = 'load_conversation_context';
export const SPAN_GENERATE_RESPONSE = 'generate_response';
export const SPAN_MODERATE_RESPONSE = 'moderate_response';

/**
 * Span names for enrichUserContext retrieval tracing
 */
export const SPAN_FETCH_EXPENSES = 'fetch_recent_expenses';
export const SPAN_FETCH_SUBSCRIPTIONS = 'fetch_subscription_cancellations';
export const SPAN_FETCH_CONTRIBUTIONS = 'fetch_goal_contributions';
export const SPAN_FETCH_EXPENSE_AGGREGATE = 'fetch_expense_aggregate';
export const SPAN_FETCH_GPS_RECOVERY = 'fetch_gps_recovery_context';

/**
 * Feedback name for commitment conversion
 */
export const FEEDBACK_COMMITMENT_CONVERSION = 'commitment_conversion';

/**
 * Feedback name for composite letter quality
 */
export const FEEDBACK_LETTER_QUALITY_COMPOSITE = 'letter_quality_composite';

/**
 * Feedback name for cultural sensitivity score
 */
export const FEEDBACK_CULTURAL_SENSITIVITY = 'CulturalSensitivity';

/**
 * A/B test name for letter mode framing (gratitude vs regret)
 */
export const AB_TEST_LETTER_MODE = 'letter-mode-framing';

/**
 * Trace name for event-triggered letter generation
 */
export const TRACE_FUTURE_SELF_TRIGGERED = 'future_self_triggered_letter';

/**
 * Rate limit for conversation endpoint (5 per minute)
 */
export const CONVERSATION_RATE_LIMIT = {
  ttl: 60000,
  limit: 5,
};

// ==========================================
// RATE LIMITING
// ==========================================

/**
 * Rate limit for letter endpoint (3 per minute)
 */
export const LETTER_RATE_LIMIT = {
  ttl: 60000,
  limit: 3,
};

/**
 * Rate limit for simulation endpoint (5 per minute)
 */
export const SIMULATION_RATE_LIMIT = {
  ttl: 60000,
  limit: 5,
};

// ==========================================
// PAGINATION LIMITS
// ==========================================

/**
 * Maximum offset for letter history pagination
 * Prevents slow DB queries with very large offsets
 */
export const MAX_PAGINATION_OFFSET = 10000;

/**
 * Maximum limit for letter history pagination
 */
export const MAX_PAGINATION_LIMIT = 50;

// ==========================================
// IDEMPOTENCY
// ==========================================

/**
 * TTL for letter generation idempotency key (30 seconds)
 * Prevents duplicate letter generation from rapid requests
 */
export const LETTER_IDEMPOTENCY_TTL_SEC = 30;

/**
 * Redis key prefix for letter generation idempotency
 */
export const LETTER_IDEMPOTENCY_KEY_PREFIX = 'future_self:letter_gen';
