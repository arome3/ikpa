/**
 * Metrics Observer Unit Tests
 *
 * Tests cover:
 * - Cache hit/miss tracking
 * - Retry and success rate tracking
 * - Latency histogram recording
 * - Error tracking by type
 * - Stats retrieval
 * - Singleton behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsObserver,
  MetricsObserverImpl,
  resetMetricsObserver,
} from '../metrics.observer';

describe('MetricsObserver', () => {
  beforeEach(() => {
    // Reset the observer before each test
    resetMetricsObserver();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MetricsObserverImpl.getInstance();
      const instance2 = MetricsObserverImpl.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset to new instance when resetInstance is called', () => {
      const instance1 = MetricsObserverImpl.getInstance();
      instance1.recordCacheHit();

      MetricsObserverImpl.resetInstance();
      const instance2 = MetricsObserverImpl.getInstance();

      expect(instance2.getStats().cache.hits).toBe(0);
    });

    it('should export a singleton MetricsObserver instance', () => {
      expect(MetricsObserver).toBeDefined();
      expect(typeof MetricsObserver.recordCacheHit).toBe('function');
    });
  });

  describe('Cache Metrics', () => {
    it('should record cache hits', () => {
      MetricsObserver.recordCacheHit();
      MetricsObserver.recordCacheHit();
      MetricsObserver.recordCacheHit();

      const stats = MetricsObserver.getStats();
      expect(stats.cache.hits).toBe(3);
    });

    it('should record cache misses', () => {
      MetricsObserver.recordCacheMiss();
      MetricsObserver.recordCacheMiss();

      const stats = MetricsObserver.getStats();
      expect(stats.cache.misses).toBe(2);
    });

    it('should calculate correct hit rate', () => {
      // 3 hits, 1 miss = 75% hit rate
      MetricsObserver.recordCacheHit();
      MetricsObserver.recordCacheHit();
      MetricsObserver.recordCacheHit();
      MetricsObserver.recordCacheMiss();

      const stats = MetricsObserver.getStats();
      expect(stats.cache.hitRate).toBe(0.75);
      expect(stats.cache.totalRequests).toBe(4);
    });

    it('should return 0 hit rate when no requests', () => {
      const hitRate = MetricsObserver.getCacheHitRate();
      expect(hitRate).toBe(0);
    });
  });

  describe('Retry Metrics', () => {
    it('should record retries', () => {
      MetricsObserver.recordRetry();
      MetricsObserver.recordRetry();

      const stats = MetricsObserver.getStats();
      expect(stats.retry.totalRetries).toBe(2);
    });

    it('should record successes', () => {
      MetricsObserver.recordSuccess();
      MetricsObserver.recordSuccess();
      MetricsObserver.recordSuccess();

      const stats = MetricsObserver.getStats();
      expect(stats.retry.totalSuccesses).toBe(3);
    });

    it('should record failures', () => {
      MetricsObserver.recordFailure();

      const stats = MetricsObserver.getStats();
      expect(stats.retry.totalFailures).toBe(1);
    });

    it('should calculate correct success rate', () => {
      // 4 successes, 1 failure = 80% success rate
      MetricsObserver.recordSuccess();
      MetricsObserver.recordSuccess();
      MetricsObserver.recordSuccess();
      MetricsObserver.recordSuccess();
      MetricsObserver.recordFailure();

      const stats = MetricsObserver.getStats();
      expect(stats.retry.successRate).toBe(0.8);
    });

    it('should return 100% success rate when no operations', () => {
      const successRate = MetricsObserver.getSuccessRate();
      expect(successRate).toBe(1);
    });
  });

  describe('Error Metrics', () => {
    it('should record errors by type', () => {
      MetricsObserver.recordError('NetworkError');
      MetricsObserver.recordError('NetworkError');
      MetricsObserver.recordError('TimeoutError');

      const stats = MetricsObserver.getStats();
      expect(stats.errors.total).toBe(3);
      expect(stats.errors.byType).toHaveLength(2);

      const networkError = stats.errors.byType.find((e) => e.type === 'NetworkError');
      expect(networkError?.count).toBe(2);

      const timeoutError = stats.errors.byType.find((e) => e.type === 'TimeoutError');
      expect(timeoutError?.count).toBe(1);
    });

    it('should record errors from exception objects', () => {
      MetricsObserver.recordErrorFromException(new TypeError('Invalid type'));
      MetricsObserver.recordErrorFromException(new RangeError('Out of range'));

      const stats = MetricsObserver.getStats();
      expect(stats.errors.total).toBe(2);

      const typeError = stats.errors.byType.find((e) => e.type === 'TypeError');
      expect(typeError).toBeDefined();

      const rangeError = stats.errors.byType.find((e) => e.type === 'RangeError');
      expect(rangeError).toBeDefined();
    });

    it('should handle non-Error exceptions', () => {
      MetricsObserver.recordErrorFromException('string error');
      MetricsObserver.recordErrorFromException(null);
      MetricsObserver.recordErrorFromException(undefined);

      const stats = MetricsObserver.getStats();
      expect(stats.errors.total).toBe(3);
    });

    it('should update lastOccurrence on repeated errors', async () => {
      MetricsObserver.recordError('TestError');

      const stats1 = MetricsObserver.getStats();
      const firstOccurrence = stats1.errors.byType.find(
        (e) => e.type === 'TestError',
      )?.lastOccurrence;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      MetricsObserver.recordError('TestError');

      const stats2 = MetricsObserver.getStats();
      const secondOccurrence = stats2.errors.byType.find(
        (e) => e.type === 'TestError',
      )?.lastOccurrence;

      expect(secondOccurrence?.getTime()).toBeGreaterThanOrEqual(firstOccurrence!.getTime());
    });
  });

  describe('Latency Metrics', () => {
    it('should record latency observations', () => {
      MetricsObserver.recordLatency('test_metric', 100);
      MetricsObserver.recordLatency('test_metric', 200);
      MetricsObserver.recordLatency('test_metric', 300);

      const stats = MetricsObserver.getStats();
      expect(stats.latencies['test_metric']).toBeDefined();
      expect(stats.latencies['test_metric'].count).toBe(3);
      expect(stats.latencies['test_metric'].sum).toBe(600);
    });

    it('should track min and max values', () => {
      MetricsObserver.recordLatency('min_max_test', 50);
      MetricsObserver.recordLatency('min_max_test', 150);
      MetricsObserver.recordLatency('min_max_test', 100);

      const stats = MetricsObserver.getStats();
      expect(stats.latencies['min_max_test'].min).toBe(50);
      expect(stats.latencies['min_max_test'].max).toBe(150);
    });

    it('should populate histogram buckets correctly', () => {
      // Record values in different buckets
      MetricsObserver.recordLatency('bucket_test', 5); // <= 10ms bucket
      MetricsObserver.recordLatency('bucket_test', 15); // <= 25ms bucket
      MetricsObserver.recordLatency('bucket_test', 75); // <= 100ms bucket
      MetricsObserver.recordLatency('bucket_test', 3000); // <= 5000ms bucket

      const stats = MetricsObserver.getStats();
      const histogram = stats.latencies['bucket_test'];

      // Buckets are cumulative
      const bucket10 = histogram.buckets.find((b) => b.le === 10);
      const bucket25 = histogram.buckets.find((b) => b.le === 25);
      const bucket100 = histogram.buckets.find((b) => b.le === 100);
      const bucket5000 = histogram.buckets.find((b) => b.le === 5000);

      expect(bucket10?.count).toBe(1); // Only 5ms
      expect(bucket25?.count).toBe(2); // 5ms and 15ms
      expect(bucket100?.count).toBe(3); // 5ms, 15ms, and 75ms
      expect(bucket5000?.count).toBe(4); // All values
    });

    it('should calculate average latency', () => {
      MetricsObserver.recordLatency('avg_test', 100);
      MetricsObserver.recordLatency('avg_test', 200);
      MetricsObserver.recordLatency('avg_test', 300);

      const avg = MetricsObserver.getAverageLatency('avg_test');
      expect(avg).toBe(200);
    });

    it('should return 0 for non-existent metric average', () => {
      const avg = MetricsObserver.getAverageLatency('non_existent');
      expect(avg).toBe(0);
    });

    it('should calculate percentile latency', () => {
      // Record 100 values from 1 to 100
      for (let i = 1; i <= 100; i++) {
        MetricsObserver.recordLatency('percentile_test', i);
      }

      const p50 = MetricsObserver.getPercentileLatency('percentile_test', 50);
      const p95 = MetricsObserver.getPercentileLatency('percentile_test', 95);
      const p99 = MetricsObserver.getPercentileLatency('percentile_test', 99);

      // Due to histogram bucket approximation, values should be in reasonable ranges
      expect(p50).toBeGreaterThan(0);
      expect(p95).toBeGreaterThan(p50);
      expect(p99).toBeGreaterThanOrEqual(p95);
    });

    it('should return 0 percentile for non-existent metric', () => {
      const p50 = MetricsObserver.getPercentileLatency('non_existent', 50);
      expect(p50).toBe(0);
    });

    it('should get comprehensive latency stats', () => {
      MetricsObserver.recordLatency('stats_test', 100);
      MetricsObserver.recordLatency('stats_test', 200);
      MetricsObserver.recordLatency('stats_test', 300);

      const stats = MetricsObserver.getLatencyStats('stats_test');

      expect(stats).not.toBeNull();
      expect(stats?.avg).toBe(200);
      expect(stats?.count).toBe(3);
      expect(stats?.p50).toBeDefined();
      expect(stats?.p95).toBeDefined();
      expect(stats?.p99).toBeDefined();
    });

    it('should return null for non-existent metric stats', () => {
      const stats = MetricsObserver.getLatencyStats('non_existent');
      expect(stats).toBeNull();
    });
  });

  describe('Timer Utilities', () => {
    it('should start and stop timer', async () => {
      const stopTimer = MetricsObserver.startTimer('timer_test');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = stopTimer();

      expect(duration).toBeGreaterThanOrEqual(40); // Allow some variance
      expect(duration).toBeLessThan(200); // Should not take too long

      const stats = MetricsObserver.getStats();
      expect(stats.latencies['timer_test'].count).toBe(1);
    });

    it('should track latency with async wrapper', async () => {
      const result = await MetricsObserver.withLatencyTracking('async_test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'success';
      });

      expect(result).toBe('success');

      const stats = MetricsObserver.getStats();
      expect(stats.latencies['async_test'].count).toBe(1);
      expect(stats.latencies['async_test'].sum).toBeGreaterThanOrEqual(15);
    });

    it('should track latency even on error', async () => {
      await expect(
        MetricsObserver.withLatencyTracking('error_test', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');

      const stats = MetricsObserver.getStats();
      expect(stats.latencies['error_test'].count).toBe(1);
    });
  });

  describe('Semaphore Metrics', () => {
    it('should include semaphore stats in snapshot', () => {
      const stats = MetricsObserver.getStats();

      expect(stats.semaphore).toBeDefined();
      expect(typeof stats.semaphore.availablePermits).toBe('number');
      expect(typeof stats.semaphore.queueLength).toBe('number');
      expect(typeof stats.semaphore.maxPermits).toBe('number');
      expect(typeof stats.semaphore.utilizationPercent).toBe('number');
    });

    it('should calculate utilization percentage', () => {
      const stats = MetricsObserver.getStats();

      // Utilization should be between 0 and 100
      expect(stats.semaphore.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(stats.semaphore.utilizationPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('In-Flight Metrics', () => {
    it('should include in-flight count in snapshot', () => {
      const stats = MetricsObserver.getStats();

      expect(stats.inFlight).toBeDefined();
      expect(typeof stats.inFlight.count).toBe('number');
    });
  });

  describe('Stats Snapshot', () => {
    it('should include timestamp in snapshot', () => {
      const stats = MetricsObserver.getStats();

      expect(stats.timestamp).toBeInstanceOf(Date);
      expect(stats.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should provide complete snapshot structure', () => {
      const stats = MetricsObserver.getStats();

      expect(stats).toHaveProperty('timestamp');
      expect(stats).toHaveProperty('semaphore');
      expect(stats).toHaveProperty('inFlight');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('retry');
      expect(stats).toHaveProperty('latencies');
      expect(stats).toHaveProperty('errors');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      // Populate some metrics
      MetricsObserver.recordCacheHit();
      MetricsObserver.recordCacheMiss();
      MetricsObserver.recordRetry();
      MetricsObserver.recordSuccess();
      MetricsObserver.recordFailure();
      MetricsObserver.recordError('TestError');
      MetricsObserver.recordLatency('test', 100);

      // Reset
      MetricsObserver.reset();

      const stats = MetricsObserver.getStats();

      expect(stats.cache.hits).toBe(0);
      expect(stats.cache.misses).toBe(0);
      expect(stats.retry.totalRetries).toBe(0);
      expect(stats.retry.totalSuccesses).toBe(0);
      expect(stats.retry.totalFailures).toBe(0);
      expect(stats.errors.total).toBe(0);
      expect(Object.keys(stats.latencies)).toHaveLength(0);
    });
  });

  describe('Multiple Metric Types', () => {
    it('should track multiple latency metrics independently', () => {
      MetricsObserver.recordLatency('metric_a', 100);
      MetricsObserver.recordLatency('metric_b', 200);
      MetricsObserver.recordLatency('metric_a', 150);

      const stats = MetricsObserver.getStats();

      expect(stats.latencies['metric_a'].count).toBe(2);
      expect(stats.latencies['metric_a'].sum).toBe(250);

      expect(stats.latencies['metric_b'].count).toBe(1);
      expect(stats.latencies['metric_b'].sum).toBe(200);
    });
  });
});
