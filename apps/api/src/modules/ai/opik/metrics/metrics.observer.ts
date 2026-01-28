/**
 * Metrics Observer
 *
 * Singleton class for tracking observability metrics:
 * - Semaphore utilization and queue length
 * - Cache hit/miss rates
 * - Retry counts and success rates
 * - Evaluation latencies (histogram buckets)
 * - Error rates by type
 *
 * Designed for production monitoring and debugging.
 */

import { Logger } from '@nestjs/common';
import { llmSemaphore, getInFlightCount } from './metrics.utils';

const logger = new Logger('MetricsObserver');

// ==========================================
// TYPES
// ==========================================

/**
 * Histogram bucket configuration for latency tracking
 */
export interface HistogramBucket {
  /** Upper bound of the bucket in milliseconds */
  le: number;
  /** Count of observations in this bucket */
  count: number;
}

/**
 * Latency histogram with predefined buckets
 */
export interface LatencyHistogram {
  /** Histogram buckets */
  buckets: HistogramBucket[];
  /** Total count of observations */
  count: number;
  /** Sum of all observations in milliseconds */
  sum: number;
  /** Minimum observed value */
  min: number;
  /** Maximum observed value */
  max: number;
}

/**
 * Error statistics by type
 */
export interface ErrorStats {
  /** Error type/name */
  type: string;
  /** Count of errors */
  count: number;
  /** Timestamp of last error */
  lastOccurrence: Date;
}

/**
 * Complete metrics snapshot
 */
export interface MetricsSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: Date;
  /** Semaphore metrics */
  semaphore: {
    availablePermits: number;
    queueLength: number;
    maxPermits: number;
    utilizationPercent: number;
  };
  /** In-flight request metrics */
  inFlight: {
    count: number;
  };
  /** Cache metrics */
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
  };
  /** Retry metrics */
  retry: {
    totalRetries: number;
    totalSuccesses: number;
    totalFailures: number;
    successRate: number;
  };
  /** Latency metrics by operation */
  latencies: Record<string, LatencyHistogram>;
  /** Error metrics by type */
  errors: {
    total: number;
    byType: ErrorStats[];
  };
}

/**
 * Trace context for observer correlation
 * Use UtilTraceContext from metrics.utils for retry/singleFlight
 */
export interface ObserverTraceContext {
  /** Distributed trace ID */
  traceId?: string;
  /** Current span ID */
  spanId?: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Sampling decision */
  sampled?: boolean;
}

// ==========================================
// DEFAULT HISTOGRAM BUCKETS
// ==========================================

/**
 * Default latency histogram buckets (in milliseconds)
 * Aligned with common Prometheus/OpenTelemetry bucket patterns
 */
const DEFAULT_HISTOGRAM_BUCKETS_MS = [
  10, // 10ms - very fast operations
  25, // 25ms
  50, // 50ms - fast operations
  100, // 100ms
  250, // 250ms - typical operations
  500, // 500ms
  1000, // 1s - slow operations
  2500, // 2.5s
  5000, // 5s - very slow operations
  10000, // 10s - extremely slow
  30000, // 30s - timeout threshold
  Infinity, // overflow bucket
];

// ==========================================
// METRICS OBSERVER CLASS
// ==========================================

/**
 * Singleton metrics observer for tracking system observability metrics
 */
class MetricsObserverImpl {
  private static instance: MetricsObserverImpl;

  // Cache metrics
  private cacheHits = 0;
  private cacheMisses = 0;

  // Retry metrics
  private retryCount = 0;
  private successCount = 0;
  private failureCount = 0;

  // Latency histograms by metric name
  private latencyHistograms: Map<string, LatencyHistogram> = new Map();

  // Error tracking
  private errorsByType: Map<string, ErrorStats> = new Map();

  // Configuration
  private readonly maxPermits: number;
  private readonly histogramBuckets: number[];

  private constructor() {
    // Get max permits from the semaphore (default 2)
    this.maxPermits = 2; // MAX_CONCURRENT_LLM_CALLS from constants
    this.histogramBuckets = [...DEFAULT_HISTOGRAM_BUCKETS_MS];
    logger.log('MetricsObserver initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MetricsObserverImpl {
    if (!MetricsObserverImpl.instance) {
      MetricsObserverImpl.instance = new MetricsObserverImpl();
    }
    return MetricsObserverImpl.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    MetricsObserverImpl.instance = new MetricsObserverImpl();
  }

  // ==========================================
  // CACHE METRICS
  // ==========================================

  /**
   * Record a cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get cache hit rate (0-1)
   */
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total === 0 ? 0 : this.cacheHits / total;
  }

  // ==========================================
  // RETRY METRICS
  // ==========================================

  /**
   * Record a retry attempt
   */
  recordRetry(): void {
    this.retryCount++;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.successCount++;
  }

  /**
   * Record a failed operation (after all retries exhausted)
   */
  recordFailure(): void {
    this.failureCount++;
  }

  /**
   * Get success rate (0-1)
   */
  getSuccessRate(): number {
    const total = this.successCount + this.failureCount;
    return total === 0 ? 1 : this.successCount / total;
  }

  // ==========================================
  // ERROR METRICS
  // ==========================================

  /**
   * Record an error by type
   * @param errorType - The type/name of the error
   */
  recordError(errorType: string): void {
    const existing = this.errorsByType.get(errorType);
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
    } else {
      this.errorsByType.set(errorType, {
        type: errorType,
        count: 1,
        lastOccurrence: new Date(),
      });
    }
  }

  /**
   * Record an error from an Error object
   * @param error - The error object
   */
  recordErrorFromException(error: unknown): void {
    let errorType = 'Unknown';
    if (error instanceof Error) {
      errorType = error.name || error.constructor.name || 'Error';
    } else if (typeof error === 'string') {
      errorType = 'StringError';
    }
    this.recordError(errorType);
  }

  // ==========================================
  // LATENCY METRICS
  // ==========================================

  /**
   * Record a latency observation
   * @param metric - Name of the metric/operation
   * @param durationMs - Duration in milliseconds
   */
  recordLatency(metric: string, durationMs: number): void {
    let histogram = this.latencyHistograms.get(metric);
    if (!histogram) {
      histogram = this.createEmptyHistogram();
      this.latencyHistograms.set(metric, histogram);
    }

    // Update histogram
    histogram.count++;
    histogram.sum += durationMs;
    histogram.min = Math.min(histogram.min, durationMs);
    histogram.max = Math.max(histogram.max, durationMs);

    // Update buckets (cumulative histogram)
    for (const bucket of histogram.buckets) {
      if (durationMs <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Create an empty histogram with configured buckets
   */
  private createEmptyHistogram(): LatencyHistogram {
    return {
      buckets: this.histogramBuckets.map((le) => ({ le, count: 0 })),
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
    };
  }

  /**
   * Get average latency for a metric
   * @param metric - Name of the metric
   */
  getAverageLatency(metric: string): number {
    const histogram = this.latencyHistograms.get(metric);
    if (!histogram || histogram.count === 0) {
      return 0;
    }
    return histogram.sum / histogram.count;
  }

  /**
   * Get approximate percentile latency using histogram buckets
   * @param metric - Name of the metric
   * @param percentile - Percentile (0-100)
   */
  getPercentileLatency(metric: string, percentile: number): number {
    const histogram = this.latencyHistograms.get(metric);
    if (!histogram || histogram.count === 0) {
      return 0;
    }

    const targetCount = (percentile / 100) * histogram.count;

    // Find the bucket that contains the target percentile
    for (let i = 0; i < histogram.buckets.length; i++) {
      if (histogram.buckets[i].count >= targetCount) {
        // Linear interpolation within bucket
        const prevCount = i > 0 ? histogram.buckets[i - 1].count : 0;
        const prevLe = i > 0 ? histogram.buckets[i - 1].le : 0;
        const currentLe = histogram.buckets[i].le;

        if (currentLe === Infinity) {
          return histogram.max;
        }

        const bucketCount = histogram.buckets[i].count - prevCount;
        if (bucketCount === 0) {
          return prevLe;
        }

        const fraction = (targetCount - prevCount) / bucketCount;
        return prevLe + fraction * (currentLe - prevLe);
      }
    }

    return histogram.max;
  }

  // ==========================================
  // STATS RETRIEVAL
  // ==========================================

  /**
   * Get complete metrics snapshot
   */
  getStats(): MetricsSnapshot {
    const cacheTotal = this.cacheHits + this.cacheMisses;
    const operationTotal = this.successCount + this.failureCount;

    return {
      timestamp: new Date(),
      semaphore: {
        availablePermits: llmSemaphore.availablePermits,
        queueLength: llmSemaphore.queueLength,
        maxPermits: this.maxPermits,
        utilizationPercent:
          ((this.maxPermits - llmSemaphore.availablePermits) / this.maxPermits) * 100,
      },
      inFlight: {
        count: getInFlightCount(),
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: this.getCacheHitRate(),
        totalRequests: cacheTotal,
      },
      retry: {
        totalRetries: this.retryCount,
        totalSuccesses: this.successCount,
        totalFailures: this.failureCount,
        successRate: operationTotal === 0 ? 1 : this.successCount / operationTotal,
      },
      latencies: Object.fromEntries(this.latencyHistograms),
      errors: {
        total: Array.from(this.errorsByType.values()).reduce((sum, e) => sum + e.count, 0),
        byType: Array.from(this.errorsByType.values()),
      },
    };
  }

  /**
   * Get stats for a specific latency metric
   * @param metric - Name of the metric
   */
  getLatencyStats(
    metric: string,
  ): { avg: number; p50: number; p95: number; p99: number; count: number } | null {
    const histogram = this.latencyHistograms.get(metric);
    if (!histogram || histogram.count === 0) {
      return null;
    }

    return {
      avg: this.getAverageLatency(metric),
      p50: this.getPercentileLatency(metric, 50),
      p95: this.getPercentileLatency(metric, 95),
      p99: this.getPercentileLatency(metric, 99),
      count: histogram.count,
    };
  }

  /**
   * Reset all metrics (for testing or periodic cleanup)
   */
  reset(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.retryCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.latencyHistograms.clear();
    this.errorsByType.clear();
    logger.debug('MetricsObserver metrics reset');
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Create a timer that can be stopped to record latency
   * @param metric - Name of the metric
   * @returns Stop function that records the latency when called
   */
  startTimer(metric: string): () => number {
    const startTime = performance.now();
    return () => {
      const durationMs = performance.now() - startTime;
      this.recordLatency(metric, durationMs);
      return durationMs;
    };
  }

  /**
   * Wrap an async function to automatically record its latency
   * @param metric - Name of the metric
   * @param fn - Async function to wrap
   */
  async withLatencyTracking<T>(metric: string, fn: () => Promise<T>): Promise<T> {
    const stopTimer = this.startTimer(metric);
    try {
      const result = await fn();
      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

/**
 * Export the class for testing and advanced use cases
 */
export { MetricsObserverImpl };

/**
 * Proxy-based singleton that always delegates to the current instance
 * This allows proper reset behavior for testing while maintaining
 * a simple API for production usage.
 */
export const MetricsObserver: MetricsObserverImpl = new Proxy({} as MetricsObserverImpl, {
  get(_target, prop: keyof MetricsObserverImpl) {
    const instance = MetricsObserverImpl.getInstance();
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

/**
 * Helper to reset observer (for testing)
 * Creates a fresh instance, and the proxy automatically delegates to it
 */
export const resetMetricsObserver = (): void => {
  MetricsObserverImpl.resetInstance();
};
