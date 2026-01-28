/**
 * Local In-Memory LRU Cache
 *
 * Provides a fallback cache when Redis is unavailable.
 * Features:
 * - LRU eviction policy with configurable max size
 * - TTL-based expiration with automatic cleanup
 * - Thread-safe within Node.js single-threaded model
 * - Statistics for monitoring
 *
 * @example
 * ```typescript
 * const cache = new LocalCache<MetricResult>({ maxSize: 1000, defaultTtlSeconds: 60 });
 *
 * // Set with default TTL
 * cache.set('key1', { score: 5, reason: 'good' });
 *
 * // Set with custom TTL
 * cache.set('key2', { score: 4, reason: 'ok' }, 120);
 *
 * // Get (returns undefined if expired or not found)
 * const result = cache.get<MetricResult>('key1');
 *
 * // Check stats
 * const stats = cache.getStats();
 * console.log(`Hit rate: ${stats.hitRate}%`);
 * ```
 */

import { Logger } from '@nestjs/common';
import {
  METRICS_LOCAL_CACHE_MAX_SIZE,
  METRICS_LOCAL_CACHE_TTL_SECONDS,
} from './metrics.constants';

const logger = new Logger('LocalCache');

/**
 * Cache entry with value, expiration time, and access tracking
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessedAt: number;
}

/**
 * Configuration options for LocalCache
 */
export interface LocalCacheOptions {
  /** Maximum number of entries (default from env or 1000) */
  maxSize?: number;
  /** Default TTL in seconds (default from env or 60) */
  defaultTtlSeconds?: number;
  /** Interval for cleanup in milliseconds (default 30000) */
  cleanupIntervalMs?: number;
}

/**
 * Cache statistics for monitoring
 */
export interface LocalCacheStats {
  /** Total number of entries currently in cache */
  size: number;
  /** Maximum allowed entries */
  maxSize: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Hit rate as percentage (0-100) */
  hitRate: number;
  /** Number of entries evicted due to LRU */
  evictions: number;
  /** Number of entries expired due to TTL */
  expirations: number;
}

/**
 * Local in-memory LRU cache with TTL support
 *
 * Generic type T represents the type of values stored in the cache
 */
export class LocalCache<T = unknown> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTtlSeconds: number;
  private readonly cleanupIntervalMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private expirations = 0;

  constructor(options: LocalCacheOptions = {}) {
    this.maxSize = options.maxSize ?? METRICS_LOCAL_CACHE_MAX_SIZE;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? METRICS_LOCAL_CACHE_TTL_SECONDS;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 30000;

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get a value from the cache
   * Returns undefined if not found or expired
   */
  get<V = T>(key: string): V | undefined {
    const entry = this.cache.get(key) as CacheEntry<V> | undefined;

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.expirations++;
      this.misses++;
      return undefined;
    }

    // Update last accessed time for LRU
    entry.lastAccessedAt = Date.now();
    this.hits++;
    return entry.value;
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to store
   * @param ttlSeconds TTL in seconds (uses default if not provided)
   */
  set<V = T>(key: string, value: V, ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const now = Date.now();

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<V> = {
      value,
      expiresAt: now + ttl * 1000,
      lastAccessedAt: now,
    };

    // Cast through unknown since V may differ from T at runtime
    this.cache.set(key, entry as unknown as CacheEntry<T>);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Local cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): LocalCacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      evictions: this.evictions,
      expirations: this.expirations,
    };
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.expirations = 0;
  }

  /**
   * Destroy the cache and stop cleanup timer
   * Call this when shutting down to prevent memory leaks
   */
  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.evictions++;
      logger.debug(`LRU evicted key: ${oldestKey.substring(0, 50)}...`);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.expirations++;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupIntervalMs);

    // Allow Node.js to exit even if timer is running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup
   */
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * Global local cache instance for metrics
 * Singleton pattern for shared fallback cache
 */
let globalMetricsCache: LocalCache | null = null;

/**
 * Get or create the global metrics local cache
 */
export function getGlobalMetricsCache(): LocalCache {
  if (!globalMetricsCache) {
    globalMetricsCache = new LocalCache({
      maxSize: METRICS_LOCAL_CACHE_MAX_SIZE,
      defaultTtlSeconds: METRICS_LOCAL_CACHE_TTL_SECONDS,
    });
    logger.log('Global metrics local cache initialized');
  }
  return globalMetricsCache;
}

/**
 * Reset the global cache (for testing)
 */
export function resetGlobalMetricsCache(): void {
  if (globalMetricsCache) {
    globalMetricsCache.destroy();
    globalMetricsCache = null;
  }
}
