/**
 * Anthropic Service Constants
 *
 * Configuration values for Claude API interactions.
 */

/**
 * Default Claude model for API calls
 * claude-sonnet-4-20250514 provides good balance of quality and speed
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// ==========================================
// RETRY CONFIGURATION
// ==========================================

/** Maximum number of retry attempts */
export const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
export const RETRY_BASE_DELAY_MS = 1000;

/** Maximum delay between retries (ms) */
export const MAX_RETRY_DELAY_MS = 10000;

// ==========================================
// CIRCUIT BREAKER CONFIGURATION
// ==========================================

/** Circuit breaker: failures before opening circuit */
export const CIRCUIT_BREAKER_THRESHOLD = 5;

/** Circuit breaker: time to wait before half-open (ms) */
export const CIRCUIT_BREAKER_RESET_MS = 60000;

// ==========================================
// TIMEOUT CONFIGURATION
// ==========================================

/** Default timeout for API calls (ms) - 90 seconds for long-form generation */
export const DEFAULT_API_TIMEOUT_MS = 90000;

/** Shorter timeout for evaluation calls (ms) - 30 seconds */
export const EVALUATION_API_TIMEOUT_MS = 30000;

// ==========================================
// TOKEN LIMITS
// ==========================================

/** Maximum tokens for letter/long-form generation */
export const LETTER_MAX_TOKENS = 1000;

/** Maximum tokens for evaluation responses */
export const EVALUATION_MAX_TOKENS = 500;

/** Maximum tokens for short evaluation responses */
export const SHORT_EVALUATION_MAX_TOKENS = 200;
