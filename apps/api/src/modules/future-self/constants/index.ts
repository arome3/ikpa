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
