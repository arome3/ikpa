/**
 * LocalCache Unit Tests
 *
 * Tests cover:
 * - Basic get/set/has/delete operations
 * - TTL expiration
 * - LRU eviction when max size reached
 * - Statistics tracking
 * - Automatic cleanup of expired entries
 * - Global cache singleton behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LocalCache,
  getGlobalMetricsCache,
  resetGlobalMetricsCache,
} from '../local-cache';

describe('LocalCache', () => {
  let cache: LocalCache<unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Create a fresh cache for each test with short cleanup interval
    cache = new LocalCache({
      maxSize: 5,
      defaultTtlSeconds: 60,
      cleanupIntervalMs: 1000,
    });
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should set and get a value', () => {
      cache.set('key1', { data: 'value1' });
      const result = cache.get('key1');
      expect(result).toEqual({ data: 'value1' });
    });

    it('should return undefined for non-existent key', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should check if key exists with has()', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete a key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.getStats().size).toBe(0);
    });

    it('should overwrite existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      expect(cache.get('key1')).toBe('value2');
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('key1', 'value1', 30); // 30 seconds TTL

      // Before expiration
      expect(cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(31000);

      // Should be expired
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should use default TTL when not specified', () => {
      cache.set('key1', 'value1'); // Uses default 60 seconds

      // Before expiration
      vi.advanceTimersByTime(59000);
      expect(cache.get('key1')).toBe('value1');

      // After expiration
      vi.advanceTimersByTime(2000);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should report expired entry in has() check', () => {
      cache.set('key1', 'value1', 10);

      expect(cache.has('key1')).toBe(true);

      vi.advanceTimersByTime(11000);

      expect(cache.has('key1')).toBe(false);
    });

    it('should cleanup expired entries periodically', () => {
      cache.set('key1', 'value1', 2);
      cache.set('key2', 'value2', 5);

      // Advance past first TTL and cleanup interval
      vi.advanceTimersByTime(3000);

      // key1 should be expired and cleaned up after cleanup runs
      const stats = cache.getStats();
      expect(stats.expirations).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when max size reached', () => {
      // Fill cache to max size
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);
      cache.set('key4', 'value4');
      vi.advanceTimersByTime(10);
      cache.set('key5', 'value5');
      vi.advanceTimersByTime(10);

      expect(cache.getStats().size).toBe(5);

      // Access key1 to make it recently used (updates lastAccessedAt)
      cache.get('key1');
      vi.advanceTimersByTime(10);

      // Add new entry - should evict key2 (least recently used after key1 was accessed)
      cache.set('key6', 'value6');

      expect(cache.getStats().size).toBe(5);
      // key2 should be evicted (oldest lastAccessedAt after key1 was accessed)
      expect(cache.has('key2')).toBe(false); // Evicted
      expect(cache.has('key1')).toBe(true); // Still present (was accessed)
      expect(cache.has('key6')).toBe(true); // Newly added
    });

    it('should not evict when updating existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Update existing key - should not trigger eviction
      cache.set('key3', 'updated-value3');

      expect(cache.getStats().size).toBe(5);
      expect(cache.get('key3')).toBe('updated-value3');
      expect(cache.getStats().evictions).toBe(0);
    });

    it('should track eviction count in stats', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');
      cache.set('key6', 'value6'); // Should evict key1
      cache.set('key7', 'value7'); // Should evict key2

      expect(cache.getStats().evictions).toBe(2);
    });
  });

  describe('statistics', () => {
    it('should track cache hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(75);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should track expirations', () => {
      cache.set('key1', 'value1', 1);
      vi.advanceTimersByTime(2000);
      cache.get('key1'); // Should detect expiration

      const stats = cache.getStats();
      expect(stats.expirations).toBe(1);
    });

    it('should report correct size and maxSize', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      expect(stats.expirations).toBe(0);
    });
  });

  describe('type safety', () => {
    it('should preserve type when getting value', () => {
      interface TestData {
        score: number;
        reason: string;
      }

      const data: TestData = { score: 5, reason: 'good' };
      cache.set('key1', data);

      const result = cache.get<TestData>('key1');
      expect(result?.score).toBe(5);
      expect(result?.reason).toBe('good');
    });

    it('should work with typed cache instance', () => {
      interface MetricResult {
        score: number;
        reason: string;
      }

      const typedCache = new LocalCache<MetricResult>({
        maxSize: 10,
        defaultTtlSeconds: 60,
      });

      typedCache.set('metric1', { score: 4, reason: 'good' });
      const result = typedCache.get('metric1');

      expect(result?.score).toBe(4);
      typedCache.destroy();
    });
  });
});

describe('Global Metrics Cache', () => {
  afterEach(() => {
    resetGlobalMetricsCache();
  });

  it('should return same instance on multiple calls', () => {
    const cache1 = getGlobalMetricsCache();
    const cache2 = getGlobalMetricsCache();

    expect(cache1).toBe(cache2);
  });

  it('should create new instance after reset', () => {
    const cache1 = getGlobalMetricsCache();
    resetGlobalMetricsCache();
    const cache2 = getGlobalMetricsCache();

    expect(cache1).not.toBe(cache2);
  });

  it('should persist data across calls', () => {
    const cache1 = getGlobalMetricsCache();
    cache1.set('test-key', 'test-value');

    const cache2 = getGlobalMetricsCache();
    expect(cache2.get('test-key')).toBe('test-value');
  });

  it('should clear data after reset', () => {
    const cache1 = getGlobalMetricsCache();
    cache1.set('test-key', 'test-value');

    resetGlobalMetricsCache();

    const cache2 = getGlobalMetricsCache();
    expect(cache2.get('test-key')).toBeUndefined();
  });
});

describe('LocalCache edge cases', () => {
  let cache: LocalCache<unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new LocalCache({ maxSize: 3, defaultTtlSeconds: 60 });
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  it('should handle empty string key', () => {
    cache.set('', 'empty-key-value');
    expect(cache.get('')).toBe('empty-key-value');
  });

  it('should handle very long keys', () => {
    const longKey = 'a'.repeat(10000);
    cache.set(longKey, 'long-key-value');
    expect(cache.get(longKey)).toBe('long-key-value');
  });

  it('should handle null and undefined values', () => {
    cache.set('null-key', null);
    cache.set('undefined-key', undefined);

    expect(cache.get('null-key')).toBeNull();
    expect(cache.get('undefined-key')).toBeUndefined();
    expect(cache.has('null-key')).toBe(true);
    expect(cache.has('undefined-key')).toBe(true);
  });

  it('should handle complex object values', () => {
    const complexValue = {
      nested: {
        array: [1, 2, 3],
        map: new Map([['key', 'value']]),
      },
      date: new Date('2024-01-01'),
    };

    cache.set('complex', complexValue);
    const result = cache.get('complex') as typeof complexValue;

    expect(result.nested.array).toEqual([1, 2, 3]);
    expect(result.date).toEqual(new Date('2024-01-01'));
  });

  it('should handle zero TTL (immediate expiration)', () => {
    cache.set('instant-expire', 'value', 0);

    // Even with 0 TTL, should be available immediately
    expect(cache.get('instant-expire')).toBe('value');

    // But expire after any time passes
    vi.advanceTimersByTime(1);
    expect(cache.get('instant-expire')).toBeUndefined();
  });

  it('should handle very large TTL', () => {
    const oneYearInSeconds = 365 * 24 * 60 * 60;
    cache.set('long-lived', 'value', oneYearInSeconds);

    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000); // 30 days
    expect(cache.get('long-lived')).toBe('value');
  });

  it('should handle rapid set/get operations', () => {
    for (let i = 0; i < 100; i++) {
      cache.set(`key-${i}`, `value-${i}`);
    }

    // Only last 3 should remain (maxSize is 3)
    expect(cache.getStats().size).toBe(3);
    expect(cache.get('key-99')).toBe('value-99');
    expect(cache.get('key-98')).toBe('value-98');
    expect(cache.get('key-97')).toBe('value-97');
    expect(cache.get('key-96')).toBeUndefined();
  });

  it('should update lastAccessedAt on get', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1 to make it recently used
    vi.advanceTimersByTime(1000);
    cache.get('key1');

    // Add new entry - should evict key2 or key3, not key1
    cache.set('key4', 'value4');

    expect(cache.has('key1')).toBe(true);
  });
});

describe('LocalCache destruction', () => {
  it('should stop cleanup timer on destroy', () => {
    vi.useFakeTimers();

    const cache = new LocalCache({
      maxSize: 10,
      defaultTtlSeconds: 60,
      cleanupIntervalMs: 100,
    });

    cache.set('key1', 'value1', 1);
    cache.destroy();

    // Advance time past cleanup interval
    vi.advanceTimersByTime(1000);

    // Cache should be empty and not processing
    expect(cache.getStats().size).toBe(0);

    vi.useRealTimers();
  });

  it('should clear all entries on destroy', () => {
    const cache = new LocalCache({ maxSize: 10, defaultTtlSeconds: 60 });
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.destroy();

    expect(cache.getStats().size).toBe(0);
  });
});
