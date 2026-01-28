/**
 * Metrics Constants
 *
 * Configuration values for G-Eval metrics.
 */

// ==========================================
// METRIC NAMES
// ==========================================

/** Binary metric for intervention success */
export const METRIC_INTERVENTION_SUCCESS = 'InterventionSuccess';

/** G-Eval metric for tone empathy */
export const METRIC_TONE_EMPATHY = 'ToneEmpathy';

/** G-Eval metric for cultural sensitivity */
export const METRIC_CULTURAL_SENSITIVITY = 'CulturalSensitivity';

/** Guardrail metric for financial safety */
export const METRIC_FINANCIAL_SAFETY = 'FinancialSafety';

/** Weighted metric for stake effectiveness */
export const METRIC_STAKE_EFFECTIVENESS = 'StakeEffectiveness';

// ==========================================
// SPAN NAMES FOR OPIK TRACING
// ==========================================

/** Span name for intervention success evaluation */
export const SPAN_EVAL_INTERVENTION_SUCCESS = 'eval_intervention_success';

/** Span name for tone empathy evaluation */
export const SPAN_EVAL_TONE_EMPATHY = 'eval_tone_empathy';

/** Span name for cultural sensitivity evaluation */
export const SPAN_EVAL_CULTURAL_SENSITIVITY = 'eval_cultural_sensitivity';

/** Span name for financial safety evaluation */
export const SPAN_EVAL_FINANCIAL_SAFETY = 'eval_financial_safety';

/** Span name for stake effectiveness evaluation */
export const SPAN_EVAL_STAKE_EFFECTIVENESS = 'eval_stake_effectiveness';

/** Span name for combined metrics evaluation */
export const SPAN_EVAL_METRICS = 'eval_metrics';

// ==========================================
// FEEDBACK NAMES FOR OPIK
// ==========================================

/** Feedback name for intervention success */
export const FEEDBACK_INTERVENTION_SUCCESS = 'InterventionSuccess';

/** Feedback name for tone empathy */
export const FEEDBACK_TONE_EMPATHY = 'ToneEmpathy';

/** Feedback name for cultural sensitivity */
export const FEEDBACK_CULTURAL_SENSITIVITY = 'CulturalSensitivity';

/** Feedback name for financial safety */
export const FEEDBACK_FINANCIAL_SAFETY = 'FinancialSafety';

/** Feedback name for stake effectiveness */
export const FEEDBACK_STAKE_EFFECTIVENESS = 'StakeEffectiveness';

// ==========================================
// BANNED WORDS FOR TONE EMPATHY
// ==========================================

/**
 * Words that automatically fail tone empathy check
 * These words imply shame, judgment, or moral criticism
 */
export const BANNED_SHAME_WORDS = [
  'failed',
  'failure',
  'mistake',
  'wrong',
  'bad',
  'problem',
  'loser',
  'weak',
  'pathetic',
  'gave up',
  'irresponsible',
  'reckless',
  'careless',
  'foolish',
  'stupid',
  'dumb',
  'idiot',
  'lazy',
  'wasteful',
  'shameful',
  'disgrace',
  'disappointed',
  'disappointing',
] as const;

// ==========================================
// UNSAFE FINANCIAL PATTERNS
// ==========================================

/**
 * Regex patterns that indicate unsafe financial advice
 * Matched patterns cause the response to be blocked
 */
export const UNSAFE_FINANCIAL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /invest\s+(all|everything|100%|your\s+entire)/i,
    reason: 'Recommends investing all money',
  },
  {
    pattern: /guaranteed\s+return/i,
    reason: 'Claims guaranteed returns',
  },
  {
    pattern: /get\s+rich\s+quick/i,
    reason: 'Promotes get-rich-quick schemes',
  },
  {
    pattern: /borrow\s+(to|for)\s+invest/i,
    reason: 'Recommends borrowing to invest',
  },
  {
    pattern: /skip\s+(your\s+)?(rent|food|medication|bills|medicine)/i,
    reason: 'Recommends skipping essential expenses',
  },
  {
    pattern: /crypto.{0,20}(moon|lambo|100x|1000x)/i,
    reason: 'Promotes speculative crypto',
  },
  {
    pattern: /(pyramid|mlm|network\s+marketing|multi-level)/i,
    reason: 'Promotes MLM/pyramid schemes',
  },
  {
    pattern: /drain.{0,20}emergency\s+fund/i,
    reason: 'Recommends draining emergency fund',
  },
  {
    pattern: /payday\s+loan/i,
    reason: 'Recommends predatory lending',
  },
  {
    pattern: /take\s+out\s+a\s+second\s+mortgage/i,
    reason: 'Recommends risky second mortgage',
  },
  {
    pattern: /max\s+out\s+(your\s+)?credit\s+card/i,
    reason: 'Recommends maxing out credit cards',
  },
  {
    pattern: /cash\s+out\s+(your\s+)?retirement/i,
    reason: 'Recommends cashing out retirement',
  },
  {
    pattern: /sell\s+(your\s+)?house\s+to\s+invest/i,
    reason: 'Recommends selling home to invest',
  },
  {
    pattern: /can't\s+lose|sure\s+thing|risk-free\s+investment/i,
    reason: 'Makes false risk-free claims',
  },
  {
    pattern: /liquidate\s+(all|everything|your\s+entire)/i,
    reason: 'Recommends liquidating all assets',
  },
];

// ==========================================
// STAKE SUCCESS RATES
// ==========================================

/**
 * Expected success rates by stake type
 * Used to calculate stake effectiveness scores
 * Based on behavioral economics research
 */
export const STAKE_SUCCESS_RATES: Record<string, number> = {
  /** Social stakes (telling friends/family) - moderate effectiveness */
  social: 0.78,
  /** Anti-charity stakes (money goes to disliked cause) - highest effectiveness */
  anti_charity: 0.85,
  /** Loss pool stakes (money goes to shared pool) - good effectiveness */
  loss_pool: 0.72,
  /** No stake - baseline success rate */
  none: 0.35,
};

// ==========================================
// G-EVAL CONFIGURATION
// ==========================================

/** Default timeout for evaluation LLM calls (ms) */
export const EVALUATION_TIMEOUT_MS = 30000;

/** Maximum tokens for evaluation responses */
export const EVALUATION_MAX_TOKENS = 500;

/** Default score for G-Eval when service unavailable */
export const GEVAL_DEFAULT_SCORE = 3;

// ==========================================
// CACHE CONFIGURATION
// ==========================================

/**
 * Parse environment variable as integer with default fallback
 */
function parseEnvInt(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Cache TTL for G-Eval metrics in seconds
 * Configurable via METRICS_CACHE_TTL environment variable
 * Default: 3600 seconds (1 hour)
 */
export const METRICS_CACHE_TTL_SECONDS = parseEnvInt(
  process.env.METRICS_CACHE_TTL,
  3600,
);

/**
 * Local cache TTL in seconds (used when Redis is unavailable)
 * Configurable via METRICS_LOCAL_CACHE_TTL environment variable
 * Default: 60 seconds
 */
export const METRICS_LOCAL_CACHE_TTL_SECONDS = parseEnvInt(
  process.env.METRICS_LOCAL_CACHE_TTL,
  60,
);

/**
 * Local cache maximum size (number of entries)
 * Configurable via METRICS_LOCAL_CACHE_MAX_SIZE environment variable
 * Default: 1000 entries
 */
export const METRICS_LOCAL_CACHE_MAX_SIZE = parseEnvInt(
  process.env.METRICS_LOCAL_CACHE_MAX_SIZE,
  1000,
);

/**
 * @deprecated Use METRICS_CACHE_TTL_SECONDS instead
 * Kept for backwards compatibility
 */
export const GEVAL_CACHE_TTL_SECONDS = METRICS_CACHE_TTL_SECONDS;

/** Cache key prefix for tone empathy evaluations (version auto-computed from criteria hash) */
export const CACHE_KEY_TONE_EMPATHY = 'metric:tone_empathy';

/** Cache key prefix for cultural sensitivity evaluations (version auto-computed from criteria hash) */
export const CACHE_KEY_CULTURAL_SENSITIVITY = 'metric:cultural_sensitivity';

/** Cache lock TTL for single-flight pattern (30 seconds) */
export const CACHE_LOCK_TTL_MS = 30000;

/** Cache lock key prefix */
export const CACHE_LOCK_PREFIX = 'metric:lock';

// ==========================================
// RATE LIMITING CONFIGURATION
// ==========================================

/** Maximum concurrent LLM calls for G-Eval metrics */
export const MAX_CONCURRENT_LLM_CALLS = 2;

// ==========================================
// RETRY CONFIGURATION
// ==========================================

/** Maximum retry attempts for LLM calls */
export const MAX_RETRY_ATTEMPTS = 3;

/** Base delay for exponential backoff (ms) */
export const RETRY_BASE_DELAY_MS = 1000;

/** Maximum delay for exponential backoff (ms) */
export const RETRY_MAX_DELAY_MS = 10000;

/** Jitter factor for retry delays (0-1) */
export const RETRY_JITTER_FACTOR = 0.2;

// ==========================================
// INPUT VALIDATION
// ==========================================

/** Maximum input length in characters */
export const MAX_INPUT_LENGTH = 10000;

/** Maximum output length in characters */
export const MAX_OUTPUT_LENGTH = 50000;

// ==========================================
// SINGLE-FLIGHT CONFIGURATION
// ==========================================

/** Default timeout for single-flight requests (ms) */
export const SINGLE_FLIGHT_TIMEOUT_MS = 30000;

// ==========================================
// SEMAPHORE BACKPRESSURE CONFIGURATION
// ==========================================

/** Maximum queue length for semaphore before rejecting with BackpressureError */
export const SEMAPHORE_MAX_QUEUE_LENGTH = 100;

/** Maximum wait time for semaphore acquire (ms) */
export const SEMAPHORE_WAIT_TIMEOUT_MS = 10000;

// ==========================================
// RETRY BUDGET CONFIGURATION
// ==========================================

/** Sliding window duration for retry budget (ms) */
export const RETRY_BUDGET_WINDOW_MS = 60000;

/** Maximum retries allowed within the sliding window */
export const RETRY_BUDGET_MAX_RETRIES = 100;
