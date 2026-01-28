/**
 * Metrics Utilities
 *
 * Shared utility functions for G-Eval metrics:
 * - Semaphore for rate limiting concurrent LLM calls
 * - Retry logic with exponential backoff
 * - Input validation and sanitization
 * - Single-flight pattern for cache stampede prevention
 */

import { Logger } from '@nestjs/common';
import {
  MAX_CONCURRENT_LLM_CALLS,
  MAX_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  RETRY_JITTER_FACTOR,
  MAX_INPUT_LENGTH,
  MAX_OUTPUT_LENGTH,
  SINGLE_FLIGHT_TIMEOUT_MS,
  SEMAPHORE_MAX_QUEUE_LENGTH,
  SEMAPHORE_WAIT_TIMEOUT_MS,
  RETRY_BUDGET_WINDOW_MS,
  RETRY_BUDGET_MAX_RETRIES,
} from './metrics.constants';

const logger = new Logger('MetricsUtils');

// ==========================================
// CUSTOM ERROR TYPES
// ==========================================

/**
 * Error thrown when a single-flight request times out
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when semaphore queue is full (backpressure)
 */
export class BackpressureError extends Error {
  constructor(
    message: string,
    public readonly queueLength: number,
    public readonly maxQueueLength: number,
  ) {
    super(message);
    this.name = 'BackpressureError';
  }
}

/**
 * Error thrown when retry budget is exhausted
 */
export class RetryBudgetExhaustedError extends Error {
  constructor(
    message: string,
    public readonly retriesInWindow: number,
    public readonly windowMs: number,
  ) {
    super(message);
    this.name = 'RetryBudgetExhaustedError';
  }
}

// ==========================================
// SEMAPHORE FOR RATE LIMITING
// ==========================================

/**
 * Waiter entry in the semaphore queue
 */
interface SemaphoreWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * Options for semaphore configuration
 */
export interface SemaphoreOptions {
  /** Maximum queue length before rejecting (default: SEMAPHORE_MAX_QUEUE_LENGTH) */
  maxQueueLength?: number;
  /** Maximum wait time in ms (default: SEMAPHORE_WAIT_TIMEOUT_MS) */
  waitTimeoutMs?: number;
}

/**
 * Simple semaphore for limiting concurrent operations
 * Thread-safe within a single Node.js process
 * Includes backpressure handling and wait timeout
 */
class Semaphore {
  private permits: number;
  private readonly maxPermits: number;
  private readonly waitQueue: SemaphoreWaiter[] = [];
  private readonly maxQueueLength: number;
  private readonly waitTimeoutMs: number;

  constructor(maxPermits: number, options: SemaphoreOptions = {}) {
    this.maxPermits = maxPermits;
    this.permits = maxPermits;
    this.maxQueueLength = options.maxQueueLength ?? SEMAPHORE_MAX_QUEUE_LENGTH;
    this.waitTimeoutMs = options.waitTimeoutMs ?? SEMAPHORE_WAIT_TIMEOUT_MS;
  }

  /**
   * Acquire a permit, waiting if necessary
   * @throws {BackpressureError} if queue is full
   * @throws {TimeoutError} if wait times out
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    // Check backpressure
    if (this.waitQueue.length >= this.maxQueueLength) {
      throw new BackpressureError(
        `Semaphore queue full: ${this.waitQueue.length}/${this.maxQueueLength}`,
        this.waitQueue.length,
        this.maxQueueLength,
      );
    }

    // Wait for a permit to become available with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue on timeout
        const index = this.waitQueue.findIndex((w) => w.timeoutId === timeoutId);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(
          new TimeoutError(
            `Semaphore acquire timed out after ${this.waitTimeoutMs}ms`,
            this.waitTimeoutMs,
          ),
        );
      }, this.waitTimeoutMs);

      this.waitQueue.push({ resolve, reject, timeoutId });
    });
  }

  /**
   * Release a permit
   */
  release(): void {
    if (this.waitQueue.length > 0) {
      // Give permit to next waiter
      const next = this.waitQueue.shift();
      if (next) {
        clearTimeout(next.timeoutId);
        next.resolve();
      }
    } else {
      // Return permit to pool
      this.permits = Math.min(this.permits + 1, this.maxPermits);
    }
  }

  /**
   * Execute a function with a permit
   * Bulletproof: ensures permit is always released even on synchronous errors
   */
  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    // Acquire first - if this throws, no permit was taken
    await this.acquire();

    // Once we have the permit, ensure it's always released
    let result: T;
    try {
      result = await fn();
    } catch (error) {
      this.release();
      throw error;
    }
    this.release();
    return result;
  }

  /**
   * Get current available permits (for monitoring)
   */
  get availablePermits(): number {
    return this.permits;
  }

  /**
   * Get current queue length (for monitoring)
   */
  get queueLength(): number {
    return this.waitQueue.length;
  }

  /**
   * Get max queue length (for monitoring)
   */
  get maxQueue(): number {
    return this.maxQueueLength;
  }
}

/** Global semaphore for LLM calls */
export const llmSemaphore = new Semaphore(MAX_CONCURRENT_LLM_CALLS);

// ==========================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ==========================================

/**
 * Error types that are retryable
 */
const RETRYABLE_ERROR_PATTERNS = [
  /rate limit/i,
  /429/,
  /503/,
  /502/,
  /timeout/i,
  /ETIMEDOUT/,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /network/i,
  /overloaded/i,
];

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorString = `${error.name} ${error.message}`;
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(errorString));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateBackoffDelay(attempt: number): number {
  // Exponential backoff: base * 2^attempt
  const exponentialDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, RETRY_MAX_DELAY_MS);

  // Add jitter (randomize by ±JITTER_FACTOR)
  const jitter = cappedDelay * RETRY_JITTER_FACTOR * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================
// RETRY BUDGET TRACKING
// ==========================================

/**
 * Sliding window retry budget tracker
 * Tracks retries in a configurable time window to prevent retry storms
 */
class RetryBudget {
  private readonly retryTimestamps: number[] = [];
  private readonly windowMs: number;
  private readonly maxRetries: number;

  constructor(
    windowMs: number = RETRY_BUDGET_WINDOW_MS,
    maxRetries: number = RETRY_BUDGET_MAX_RETRIES,
  ) {
    this.windowMs = windowMs;
    this.maxRetries = maxRetries;
  }

  /**
   * Clean up timestamps outside the sliding window
   */
  private cleanupOldEntries(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.retryTimestamps.length > 0 && this.retryTimestamps[0] < cutoff) {
      this.retryTimestamps.shift();
    }
  }

  /**
   * Check if retry budget is available
   */
  canRetry(): boolean {
    this.cleanupOldEntries();
    return this.retryTimestamps.length < this.maxRetries;
  }

  /**
   * Record a retry attempt
   * @returns true if retry was recorded, false if budget exhausted
   */
  recordRetry(): boolean {
    this.cleanupOldEntries();
    if (this.retryTimestamps.length >= this.maxRetries) {
      return false;
    }
    this.retryTimestamps.push(Date.now());
    return true;
  }

  /**
   * Get current retry budget statistics
   */
  getStats(): {
    retriesInWindow: number;
    maxRetries: number;
    windowMs: number;
    budgetRemaining: number;
    budgetExhausted: boolean;
  } {
    this.cleanupOldEntries();
    const retriesInWindow = this.retryTimestamps.length;
    return {
      retriesInWindow,
      maxRetries: this.maxRetries,
      windowMs: this.windowMs,
      budgetRemaining: Math.max(0, this.maxRetries - retriesInWindow),
      budgetExhausted: retriesInWindow >= this.maxRetries,
    };
  }

  /**
   * Reset the retry budget (for testing)
   */
  reset(): void {
    this.retryTimestamps.length = 0;
  }
}

/** Global retry budget tracker */
const retryBudget = new RetryBudget();

/**
 * Get retry budget statistics
 */
export function getRetryBudgetStats(): ReturnType<RetryBudget['getStats']> {
  return retryBudget.getStats();
}

/**
 * Reset retry budget (for testing purposes)
 */
export function resetRetryBudget(): void {
  retryBudget.reset();
}

/**
 * Simplified trace context for utility functions
 * Use this for passing trace correlation through retry/singleFlight utilities.
 * For full Opik trace context, use TraceContext from opik/interfaces.
 */
export interface UtilTraceContext {
  /** Distributed trace ID (e.g., W3C trace-id) */
  traceId?: string;
  /** Current span ID */
  spanId?: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Sampling decision */
  sampled?: boolean;
}

/**
 * Options for retry wrapper
 */
export interface RetryOptions {
  /** Maximum number of attempts (default: MAX_RETRY_ATTEMPTS) */
  maxAttempts?: number;
  /** Function to check if error is retryable (default: isRetryableError) */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry with attempt number and error */
  onRetry?: (attempt: number, error: unknown) => void;
  /** Optional trace context for distributed tracing correlation */
  traceContext?: UtilTraceContext;
  /** Whether to respect the global retry budget (default: true) */
  respectBudget?: boolean;
}

/**
 * Execute a function with retry logic
 *
 * @example
 * const result = await withRetry(
 *   () => anthropicService.generate(prompt),
 *   { maxAttempts: 3 }
 * );
 *
 * // With trace context for distributed tracing
 * const result = await withRetry(
 *   () => anthropicService.generate(prompt),
 *   {
 *     maxAttempts: 3,
 *     traceContext: { traceId: 'abc123', spanId: 'span456' }
 *   }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = MAX_RETRY_ATTEMPTS,
    isRetryable = isRetryableError,
    onRetry,
    traceContext,
    respectBudget = true,
  } = options;

  let lastError: unknown;

  // Format trace context for logging
  const tracePrefix = traceContext?.traceId
    ? `[trace:${traceContext.traceId}${traceContext.spanId ? `:${traceContext.spanId}` : ''}] `
    : '';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < maxAttempts - 1 && isRetryable(error)) {
        // Check retry budget before attempting
        if (respectBudget) {
          const budgetStats = retryBudget.getStats();
          if (budgetStats.budgetExhausted) {
            logger.warn(
              `${tracePrefix}Retry budget exhausted: ${budgetStats.retriesInWindow}/${budgetStats.maxRetries} retries in ${budgetStats.windowMs}ms window`,
            );
            throw new RetryBudgetExhaustedError(
              `Retry budget exhausted: ${budgetStats.retriesInWindow}/${budgetStats.maxRetries} retries in ${budgetStats.windowMs}ms window`,
              budgetStats.retriesInWindow,
              budgetStats.windowMs,
            );
          }
          retryBudget.recordRetry();
        }

        const delay = calculateBackoffDelay(attempt);

        logger.warn(
          `${tracePrefix}Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );

        onRetry?.(attempt + 1, error);
        await sleep(delay);
      } else {
        // Not retryable or max attempts reached
        if (traceContext?.traceId) {
          logger.error(
            `${tracePrefix}Operation failed after ${attempt + 1} attempts: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
        throw error;
      }
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

// ==========================================
// INPUT VALIDATION
// ==========================================

/**
 * Result of input validation
 */
export interface ValidationResult {
  isValid: boolean;
  sanitizedInput: string;
  sanitizedOutput: string;
  errors: string[];
}

/**
 * Validate and sanitize metric inputs
 *
 * @param input - User input text
 * @param output - LLM output text
 * @returns Validation result with sanitized values
 */
export function validateAndSanitizeInput(
  input: string | undefined | null,
  output: string | undefined | null,
): ValidationResult {
  const errors: string[] = [];

  // Handle null/undefined
  let sanitizedInput = input ?? '';
  let sanitizedOutput = output ?? '';

  // OPTIMIZATION: Check and truncate length BEFORE Unicode normalization
  // This is more efficient as normalization can be expensive on long strings
  // and we want to avoid processing data that will be discarded anyway
  if (sanitizedInput.length > MAX_INPUT_LENGTH) {
    errors.push(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`);
    sanitizedInput = sanitizedInput.slice(0, MAX_INPUT_LENGTH);
  }

  if (sanitizedOutput.length > MAX_OUTPUT_LENGTH) {
    errors.push(`Output exceeds maximum length of ${MAX_OUTPUT_LENGTH} characters`);
    sanitizedOutput = sanitizedOutput.slice(0, MAX_OUTPUT_LENGTH);
  }

  // Remove null bytes BEFORE normalization (can cause issues in some systems)
  sanitizedInput = sanitizedInput.replace(/\0/g, '');
  sanitizedOutput = sanitizedOutput.replace(/\0/g, '');

  // Normalize Unicode (NFC form) - now operating on truncated data
  try {
    sanitizedInput = sanitizedInput.normalize('NFC');
    sanitizedOutput = sanitizedOutput.normalize('NFC');
  } catch {
    errors.push('Failed to normalize Unicode');
  }

  // Remove control characters (except newlines and tabs)
  // eslint-disable-next-line no-control-regex
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  sanitizedInput = sanitizedInput.replace(controlCharRegex, '');
  sanitizedOutput = sanitizedOutput.replace(controlCharRegex, '');

  return {
    isValid: errors.length === 0,
    sanitizedInput,
    sanitizedOutput,
    errors,
  };
}

// ==========================================
// SINGLE-FLIGHT PATTERN
// ==========================================

/**
 * In-memory map of in-flight requests
 * Key: cache key, Value: promise of the result
 */
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Options for single-flight deduplication
 */
export interface SingleFlightOptions {
  /** Optional trace context for distributed tracing correlation */
  traceContext?: UtilTraceContext;
  /** Timeout in milliseconds (default: SINGLE_FLIGHT_TIMEOUT_MS) */
  timeoutMs?: number;
}

/**
 * Execute a function with single-flight deduplication
 *
 * If multiple calls arrive for the same key while a request is in-flight,
 * they all wait for and receive the same result.
 *
 * @example
 * const result = await singleFlight(
 *   cacheKey,
 *   () => anthropicService.generate(prompt)
 * );
 *
 * // With trace context for distributed tracing
 * const result = await singleFlight(
 *   cacheKey,
 *   () => anthropicService.generate(prompt),
 *   { traceContext: { traceId: 'abc123', spanId: 'span456' } }
 * );
 */
export async function singleFlight<T>(
  key: string,
  fn: () => Promise<T>,
  options: SingleFlightOptions = {},
): Promise<T> {
  const { traceContext, timeoutMs = SINGLE_FLIGHT_TIMEOUT_MS } = options;

  // Format trace context for logging
  const tracePrefix = traceContext?.traceId
    ? `[trace:${traceContext.traceId}${traceContext.spanId ? `:${traceContext.spanId}` : ''}] `
    : '';

  // Check if there's already an in-flight request for this key
  const existing = inFlightRequests.get(key);
  if (existing) {
    logger.debug(`${tracePrefix}Single-flight: reusing in-flight request for ${key}`);
    return existing as Promise<T>;
  }

  logger.debug(`${tracePrefix}Single-flight: starting new request for ${key}`);

  // Create timeout promise
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      // Clean up in-flight map on timeout
      inFlightRequests.delete(key);
      logger.warn(`${tracePrefix}Single-flight: request timed out after ${timeoutMs}ms for ${key}`);
      reject(new TimeoutError(`Single-flight request timed out after ${timeoutMs}ms`, timeoutMs));
    }, timeoutMs);
  });

  // Create the actual request promise with cleanup
  const requestPromise = fn().finally(() => {
    // Clean up after completion (success or failure)
    clearTimeout(timeoutId);
    inFlightRequests.delete(key);
    logger.debug(`${tracePrefix}Single-flight: completed request for ${key}`);
  });

  // Race between the request and timeout
  const racedPromise = Promise.race([requestPromise, timeoutPromise]);

  inFlightRequests.set(key, racedPromise);

  return racedPromise;
}

/**
 * Get current in-flight request count (for monitoring)
 */
export function getInFlightCount(): number {
  return inFlightRequests.size;
}

// ==========================================
// MONITORING HELPERS
// ==========================================

/**
 * Get current metrics utility statistics
 */
export function getMetricsUtilStats(): {
  semaphoreAvailable: number;
  semaphoreQueueLength: number;
  inFlightRequests: number;
} {
  return {
    semaphoreAvailable: llmSemaphore.availablePermits,
    semaphoreQueueLength: llmSemaphore.queueLength,
    inFlightRequests: getInFlightCount(),
  };
}
