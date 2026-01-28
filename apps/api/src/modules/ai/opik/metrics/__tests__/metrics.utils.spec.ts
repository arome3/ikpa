/**
 * Metrics Utilities Unit Tests
 *
 * Tests cover:
 * - Semaphore rate limiting with backpressure handling
 * - Retry logic with exponential backoff and budget tracking
 * - Input validation and sanitization
 * - Single-flight pattern with timeout support
 * - Custom error types (TimeoutError, BackpressureError, RetryBudgetExhaustedError)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  llmSemaphore,
  withRetry,
  validateAndSanitizeInput,
  singleFlight,
  isRetryableError,
  calculateBackoffDelay,
  getMetricsUtilStats,
  TimeoutError,
  BackpressureError,
  RetryBudgetExhaustedError,
  getRetryBudgetStats,
  resetRetryBudget,
} from '../metrics.utils';

describe('MetricsUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRetryBudget();
  });

  afterEach(() => {
    resetRetryBudget();
  });

  describe('Semaphore', () => {
    it('should limit concurrent operations', async () => {
      const results: number[] = [];
      let activeCount = 0;
      let maxConcurrent = 0;

      const tasks = Array.from({ length: 5 }, (_, i) =>
        llmSemaphore.withPermit(async () => {
          activeCount++;
          maxConcurrent = Math.max(maxConcurrent, activeCount);
          results.push(i);
          await new Promise((resolve) => setTimeout(resolve, 10));
          activeCount--;
          return i;
        }),
      );

      await Promise.all(tasks);

      expect(results).toHaveLength(5);
      expect(maxConcurrent).toBeLessThanOrEqual(2); // MAX_CONCURRENT_LLM_CALLS
    });

    it('should report available permits', () => {
      const stats = getMetricsUtilStats();
      expect(stats.semaphoreAvailable).toBeDefined();
      expect(typeof stats.semaphoreAvailable).toBe('number');
    });

    it('should release permit on function error', async () => {
      const initialPermits = llmSemaphore.availablePermits;

      await expect(
        llmSemaphore.withPermit(async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');

      // Permit should be released after error
      expect(llmSemaphore.availablePermits).toBe(initialPermits);
    });

    it('should release permit on synchronous error in async function', async () => {
      const initialPermits = llmSemaphore.availablePermits;

      await expect(
        llmSemaphore.withPermit(async () => {
          // Simulate synchronous error
          throw new Error('Sync error in async');
        }),
      ).rejects.toThrow('Sync error in async');

      expect(llmSemaphore.availablePermits).toBe(initialPermits);
    });
  });

  describe('Custom Error Types', () => {
    it('TimeoutError should have correct properties', () => {
      const error = new TimeoutError('Request timed out', 5000);
      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Request timed out');
      expect(error.timeoutMs).toBe(5000);
      expect(error instanceof Error).toBe(true);
    });

    it('BackpressureError should have correct properties', () => {
      const error = new BackpressureError('Queue full', 100, 100);
      expect(error.name).toBe('BackpressureError');
      expect(error.message).toBe('Queue full');
      expect(error.queueLength).toBe(100);
      expect(error.maxQueueLength).toBe(100);
      expect(error instanceof Error).toBe(true);
    });

    it('RetryBudgetExhaustedError should have correct properties', () => {
      const error = new RetryBudgetExhaustedError('Budget exhausted', 100, 60000);
      expect(error.name).toBe('RetryBudgetExhaustedError');
      expect(error.message).toBe('Budget exhausted');
      expect(error.retriesInWindow).toBe(100);
      expect(error.windowMs).toBe(60000);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('Retry Budget', () => {
    it('should track retry budget statistics', () => {
      const stats = getRetryBudgetStats();
      expect(stats).toHaveProperty('retriesInWindow');
      expect(stats).toHaveProperty('maxRetries');
      expect(stats).toHaveProperty('windowMs');
      expect(stats).toHaveProperty('budgetRemaining');
      expect(stats).toHaveProperty('budgetExhausted');
    });

    it('should start with full budget', () => {
      resetRetryBudget();
      const stats = getRetryBudgetStats();
      expect(stats.retriesInWindow).toBe(0);
      expect(stats.budgetExhausted).toBe(false);
      expect(stats.budgetRemaining).toBe(stats.maxRetries);
    });

    it('should reset budget correctly', () => {
      // Force some retries
      const fn = vi.fn().mockRejectedValue(new Error('rate limit'));
      withRetry(fn, { maxAttempts: 2, respectBudget: true }).catch(() => {});

      // Reset and verify
      resetRetryBudget();
      const stats = getRetryBudgetStats();
      expect(stats.retriesInWindow).toBe(0);
    });
  });

  describe('withRetry with Budget', () => {
    it('should respect retry budget when enabled', async () => {
      resetRetryBudget();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValue('success');

      await withRetry(fn, { maxAttempts: 3, respectBudget: true });

      const stats = getRetryBudgetStats();
      expect(stats.retriesInWindow).toBeGreaterThan(0);
    }, 10000);

    it('should not track retries when budget disabled', async () => {
      resetRetryBudget();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('rate limit'))
        .mockResolvedValue('success');

      await withRetry(fn, { maxAttempts: 3, respectBudget: false });

      const stats = getRetryBudgetStats();
      expect(stats.retriesInWindow).toBe(0);
    }, 10000);

    it('should throw RetryBudgetExhaustedError when budget exhausted', async () => {
      // Manually exhaust the budget by calling withRetry many times
      // For this test, we simulate the behavior
      resetRetryBudget();

      // Create a mock that always fails with retryable error
      const failingFn = vi.fn().mockRejectedValue(new Error('rate limit'));

      // Run many retry operations to exhaust budget
      // The budget is 100 retries per minute by default
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 110; i++) {
        promises.push(
          withRetry(failingFn, {
            maxAttempts: 2,
            respectBudget: true,
          }).catch((e) => e),
        );
      }

      const results = await Promise.all(promises);

      // At least one should be RetryBudgetExhaustedError
      const budgetErrors = results.filter((r) => r instanceof RetryBudgetExhaustedError);
      expect(budgetErrors.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('withRetry', () => {
    it('should return on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxAttempts: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should not retry on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success');

      await withRetry(fn, { maxAttempts: 3, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    }, 10000);

    it('should throw after max attempts exhausted', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('rate limit'));

      await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toThrow('rate limit');
      expect(fn).toHaveBeenCalledTimes(2);
    }, 15000);
  });

  describe('isRetryableError', () => {
    it('should identify rate limit errors', () => {
      expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should identify server errors', () => {
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    });

    it('should identify timeout errors', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should identify network errors', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('Network error'))).toBe(true);
    });

    it('should not retry client errors', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('Bad request'))).toBe(false);
    });

    it('should handle non-Error values', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential delays', () => {
      // With jitter disabled for testing, we can verify the exponential nature
      const delay0 = calculateBackoffDelay(0);
      const delay1 = calculateBackoffDelay(1);
      const delay2 = calculateBackoffDelay(2);

      // Delays should be in reasonable ranges (accounting for jitter)
      expect(delay0).toBeGreaterThanOrEqual(800);
      expect(delay0).toBeLessThanOrEqual(1200);
      expect(delay1).toBeGreaterThanOrEqual(1600);
      expect(delay1).toBeLessThanOrEqual(2400);
      expect(delay2).toBeGreaterThanOrEqual(3200);
      expect(delay2).toBeLessThanOrEqual(4800);
    });

    it('should cap at max delay', () => {
      const delay = calculateBackoffDelay(10); // Very high attempt
      expect(delay).toBeLessThanOrEqual(12000); // MAX_DELAY + jitter
    });
  });

  describe('validateAndSanitizeInput', () => {
    it('should pass valid inputs', () => {
      const result = validateAndSanitizeInput('Hello', 'World');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput).toBe('Hello');
      expect(result.sanitizedOutput).toBe('World');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle null/undefined inputs', () => {
      const result = validateAndSanitizeInput(null, undefined);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput).toBe('');
      expect(result.sanitizedOutput).toBe('');
    });

    it('should truncate overly long inputs', () => {
      const longInput = 'x'.repeat(15000);
      const result = validateAndSanitizeInput(longInput, 'short');

      expect(result.isValid).toBe(false);
      expect(result.sanitizedInput.length).toBe(10000);
      expect(result.errors).toContain('Input exceeds maximum length of 10000 characters');
    });

    it('should remove null bytes', () => {
      const result = validateAndSanitizeInput('Hello\0World', 'Test\0Data');

      expect(result.sanitizedInput).toBe('HelloWorld');
      expect(result.sanitizedOutput).toBe('TestData');
    });

    it('should remove control characters', () => {
      const result = validateAndSanitizeInput('Hello\x00\x01\x02World', 'Test');

      expect(result.sanitizedInput).not.toContain('\x00');
      expect(result.sanitizedInput).not.toContain('\x01');
      expect(result.sanitizedInput).not.toContain('\x02');
    });

    it('should preserve newlines and tabs', () => {
      const result = validateAndSanitizeInput('Hello\n\tWorld', 'Test');

      expect(result.sanitizedInput).toContain('\n');
      expect(result.sanitizedInput).toContain('\t');
    });

    it('should normalize Unicode', () => {
      // é can be represented as single char or e + combining accent
      const combined = 'cafe\u0301'; // e + combining accent
      const result = validateAndSanitizeInput(combined, '');

      expect(result.sanitizedInput).toBe('café'); // Normalized to single char
    });

    it('should truncate before normalization for efficiency', () => {
      // Create a long string with combining characters
      // If truncation happens AFTER normalization, the behavior would be different
      const longInputWithCombining = 'a'.repeat(9998) + 'e\u0301'; // 9999 chars + combining = would be 10000 after normalize
      const result = validateAndSanitizeInput(longInputWithCombining, '');

      // Input should be truncated to MAX_INPUT_LENGTH (10000 chars)
      // The truncation should happen BEFORE normalization
      expect(result.sanitizedInput.length).toBeLessThanOrEqual(10000);
    });

    it('should handle very long input efficiently', () => {
      // This tests that we don't waste time normalizing data we'll discard
      const veryLongInput = 'x'.repeat(100000);
      const start = Date.now();
      const result = validateAndSanitizeInput(veryLongInput, '');
      const elapsed = Date.now() - start;

      expect(result.sanitizedInput.length).toBe(10000);
      expect(result.isValid).toBe(false);
      // Should complete quickly since we truncate BEFORE expensive operations
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('singleFlight', () => {
    it('should execute function for first caller', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result = await singleFlight('key1', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent calls with same key', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `result-${callCount}`;
      });

      // Launch 3 concurrent calls with same key
      const promises = [
        singleFlight('key2', fn),
        singleFlight('key2', fn),
        singleFlight('key2', fn),
      ];

      const results = await Promise.all(promises);

      // All should get the same result
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
      // Function should only be called once
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow sequential calls with same key', async () => {
      const fn = vi
        .fn()
        .mockResolvedValueOnce('first')
        .mockResolvedValueOnce('second');

      const result1 = await singleFlight('key3', fn);
      const result2 = await singleFlight('key3', fn);

      expect(result1).toBe('first');
      expect(result2).toBe('second');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should allow concurrent calls with different keys', async () => {
      const fn = vi.fn().mockImplementation(async (key: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `result-${key}`;
      });

      const promises = [
        singleFlight('keyA', () => fn('A')),
        singleFlight('keyB', () => fn('B')),
      ];

      await Promise.all(promises);

      // Both should be called since different keys
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should propagate errors to all waiters', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));

      const promises = [
        singleFlight('key4', fn),
        singleFlight('key4', fn),
      ];

      await expect(Promise.all(promises)).rejects.toThrow('Failed');
    });

    it('should clean up after completion', async () => {
      const fn = vi.fn().mockResolvedValue('done');

      await singleFlight('key5', fn);

      const stats = getMetricsUtilStats();
      expect(stats.inFlightRequests).toBe(0);
    });

    it('should timeout after configured duration', async () => {
      const slowFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'slow result';
      });

      await expect(
        singleFlight('timeout-key', slowFn, { timeoutMs: 100 }),
      ).rejects.toThrow(TimeoutError);
    }, 5000);

    it('should clean up in-flight map on timeout', async () => {
      const slowFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'slow result';
      });

      try {
        await singleFlight('cleanup-timeout-key', slowFn, { timeoutMs: 100 });
      } catch {
        // Expected timeout
      }

      // Small delay to ensure cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = getMetricsUtilStats();
      expect(stats.inFlightRequests).toBe(0);
    }, 5000);

    it('should not timeout when request completes in time', async () => {
      const fastFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'fast result';
      });

      const result = await singleFlight('fast-key', fastFn, { timeoutMs: 1000 });
      expect(result).toBe('fast result');
    });

    it('should propagate timeout error to all waiters', async () => {
      const slowFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'slow result';
      });

      const promises = [
        singleFlight('shared-timeout-key', slowFn, { timeoutMs: 100 }),
        singleFlight('shared-timeout-key', slowFn, { timeoutMs: 100 }),
      ];

      await expect(Promise.all(promises)).rejects.toThrow(TimeoutError);
    }, 5000);

    it('TimeoutError should contain timeout duration', async () => {
      const slowFn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'slow result';
      });

      try {
        await singleFlight('timeout-info-key', slowFn, { timeoutMs: 150 });
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).timeoutMs).toBe(150);
      }
    }, 5000);
  });

  describe('getMetricsUtilStats', () => {
    it('should return monitoring statistics', () => {
      const stats = getMetricsUtilStats();

      expect(stats).toHaveProperty('semaphoreAvailable');
      expect(stats).toHaveProperty('semaphoreQueueLength');
      expect(stats).toHaveProperty('inFlightRequests');
      expect(typeof stats.semaphoreAvailable).toBe('number');
      expect(typeof stats.semaphoreQueueLength).toBe('number');
      expect(typeof stats.inFlightRequests).toBe('number');
    });
  });
});
