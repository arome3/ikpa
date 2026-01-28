/**
 * Metrics Integration Tests with Real Redis
 *
 * These tests verify the caching behavior, failure scenarios, and performance
 * characteristics of the metrics system when integrated with a real Redis instance.
 *
 * Prerequisites:
 * - Set REDIS_URL environment variable to connect to a real Redis instance
 * - Or run Redis locally at redis://localhost:6379
 *
 * Run tests with: pnpm test src/modules/ai/opik/metrics/__tests__/metrics.integration.spec.ts
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { ToneEmpathyMetric } from '../tone-empathy.metric';
import { AnthropicService } from '../../../anthropic';
import { DatasetItem, MetricResult } from '../interfaces';
import {
  CACHE_KEY_TONE_EMPATHY,
  GEVAL_CACHE_TTL_SECONDS,
  MAX_CONCURRENT_LLM_CALLS,
} from '../metrics.constants';
import { getMetricsUtilStats } from '../metrics.utils';

// ==========================================
// TEST CONFIGURATION
// ==========================================

const TEST_REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_REDIS_DB = 15; // Use DB 15 for integration tests to avoid conflicts
const SHORT_TTL_SECONDS = 2; // Short TTL for testing expiration

/**
 * Create a minimal RedisService-compatible object for testing
 * This mimics the RedisService interface without NestJS dependencies
 */
class TestRedisService {
  private client: Redis | null = null;
  private connected = false;
  private simulateFailure = false;

  async connect(): Promise<void> {
    try {
      this.client = new Redis(TEST_REDIS_URL, {
        db: TEST_REDIS_DB,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        lazyConnect: true,
      });

      this.client.on('error', () => {
        this.connected = false;
      });

      this.client.on('connect', () => {
        this.connected = true;
      });

      await this.client.connect();
      this.connected = true;
    } catch {
      this.connected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }

  isAvailable(): boolean {
    return this.connected && !this.simulateFailure && this.client !== null;
  }

  getClient(): Redis | null {
    return this.client;
  }

  // Simulate Redis failures for testing
  setSimulateFailure(value: boolean): void {
    this.simulateFailure = value;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client!.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client!.setex(key, ttlSeconds, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.del(key);
      return true;
    } catch {
      return false;
    }
  }

  async flushDb(): Promise<void> {
    if (this.client) {
      await this.client.flushdb();
    }
  }

  async getTtl(key: string): Promise<number> {
    if (!this.client) return -2;
    return this.client.ttl(key);
  }
}

/**
 * Create a mock AnthropicService for testing
 */
function createMockAnthropicService(
  generateFn?: ReturnType<typeof vi.fn>,
): Partial<AnthropicService> {
  const mockGenerate = generateFn || vi.fn().mockResolvedValue({
    content: JSON.stringify({ score: 5, reason: 'Very empathetic response' }),
    model: 'claude-sonnet-4-20250514',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  });

  return {
    isAvailable: vi.fn().mockReturnValue(true),
    generate: mockGenerate,
  };
}

/**
 * Generate cache key using the same algorithm as the metric
 */
function generateCacheKey(input: string, output: string): string {
  const contentHash = createHash('sha256')
    .update(`${input}|${output}`)
    .digest('hex')
    .slice(0, 32);
  return `${CACHE_KEY_TONE_EMPATHY}:${contentHash}`;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================
// INTEGRATION TESTS
// ==========================================

describe('Metrics Integration Tests with Real Redis', () => {
  let redisService: TestRedisService;
  let redisAvailable = false;

  beforeAll(async () => {
    redisService = new TestRedisService();
    await redisService.connect();
    redisAvailable = redisService.isAvailable();

    if (!redisAvailable) {
      console.warn(
        '\n[SKIP] Redis not available. Set REDIS_URL or run Redis locally to enable integration tests.\n' +
        'Skipping Redis integration tests...\n'
      );
    }
  });

  afterAll(async () => {
    if (redisService) {
      await redisService.disconnect();
    }
  });

  beforeEach(async () => {
    if (redisAvailable) {
      // Clean up test database before each test
      await redisService.flushDb();
      // Reset failure simulation
      redisService.setSimulateFailure(false);
    }
  });

  // ==========================================
  // TEST SETUP VERIFICATION
  // ==========================================

  describe('Test Setup', () => {
    it('should correctly detect Redis availability', () => {
      // This test always runs and verifies the test setup is working
      expect(typeof redisAvailable).toBe('boolean');

      if (!redisAvailable) {
        console.log('[INFO] Redis is not available - integration tests will be skipped');
        console.log('[INFO] To run these tests, start Redis and set REDIS_URL environment variable');
      } else {
        console.log('[INFO] Redis is available - running integration tests');
      }
    });

    it('should have TestRedisService properly initialized', () => {
      expect(redisService).toBeDefined();
      expect(typeof redisService.isAvailable).toBe('function');
      expect(typeof redisService.get).toBe('function');
      expect(typeof redisService.set).toBe('function');
    });
  });

  // ==========================================
  // CACHE BEHAVIOR TESTS
  // ==========================================

  describe('Cache Behavior Tests', () => {
    it.skipIf(!redisAvailable)('should return cached result with metadata.cached=true on cache hit', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 4, reason: 'Warm and supportive' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'I overspent this month', output: '' };
      const llmOutput = "Let's recalculate your budget together. These things happen to everyone.";

      // First call - should call LLM and cache
      const result1 = await metric.score(datasetItem, llmOutput);
      expect(result1.score).toBe(4);
      expect(result1.reason).toBe('Warm and supportive');
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Second call - should return cached result
      const result2 = await metric.score(datasetItem, llmOutput);
      expect(result2.score).toBe(4);
      expect(result2.reason).toBe('Warm and supportive');
      expect(result2.metadata?.cached).toBe(true);
      expect(mockGenerate).toHaveBeenCalledTimes(1); // Still 1 - no new LLM call
    });

    it.skipIf(!redisAvailable)('should call LLM on cache miss (mock Anthropic, real Redis)', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 5, reason: 'Exceptionally empathetic' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'Unique input for cache miss test', output: '' };
      const llmOutput = 'Unique output for cache miss test';

      // Verify cache is empty
      const cacheKey = generateCacheKey(datasetItem.input, llmOutput);
      const cachedBefore = await redisService.get(cacheKey);
      expect(cachedBefore).toBeNull();

      // Call metric - should be a cache miss and call LLM
      const result = await metric.score(datasetItem, llmOutput);
      expect(result.score).toBe(5);
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Verify result is now cached
      // Give a small delay for async cache write
      await sleep(100);
      const cachedAfter = await redisService.get<MetricResult>(cacheKey);
      expect(cachedAfter).not.toBeNull();
      expect(cachedAfter?.score).toBe(5);
    });

    it.skipIf(!redisAvailable)('should handle TTL expiration correctly', async () => {
      const mockGenerate = vi.fn()
        .mockResolvedValueOnce({
          content: JSON.stringify({ score: 4, reason: 'First evaluation' }),
          model: 'claude-sonnet-4-20250514',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ score: 5, reason: 'Second evaluation' }),
          model: 'claude-sonnet-4-20250514',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'TTL test input', output: '' };
      const llmOutput = 'TTL test output';
      const cacheKey = generateCacheKey(datasetItem.input, llmOutput);

      // Manually set a short-lived cache entry
      const shortLivedResult: MetricResult = {
        score: 4,
        reason: 'Cached with short TTL',
        metadata: { model: 'test' },
      };
      await redisService.set(cacheKey, shortLivedResult, SHORT_TTL_SECONDS);

      // Verify cache hit
      const result1 = await metric.score(datasetItem, llmOutput);
      expect(result1.score).toBe(4);
      expect(result1.metadata?.cached).toBe(true);
      expect(mockGenerate).toHaveBeenCalledTimes(0);

      // Wait for TTL to expire
      await sleep((SHORT_TTL_SECONDS + 1) * 1000);

      // Verify cache miss and new LLM call
      const result2 = await metric.score(datasetItem, llmOutput);
      expect(result2.score).toBe(4); // From mock
      expect(result2.metadata?.cached).toBeUndefined();
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    }, 10000); // Extended timeout for TTL test

    it.skipIf(!redisAvailable)('should handle concurrent access for same key (single-flight pattern)', async () => {
      let callCount = 0;
      const mockGenerate = vi.fn().mockImplementation(async () => {
        callCount++;
        // Simulate some processing time
        await sleep(100);
        return {
          content: JSON.stringify({ score: 5, reason: `Evaluation #${callCount}` }),
          model: 'claude-sonnet-4-20250514',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'Concurrent test input', output: '' };
      const llmOutput = 'Concurrent test output - unique for this test';

      // Launch multiple concurrent requests for the same input
      const promises = [
        metric.score(datasetItem, llmOutput),
        metric.score(datasetItem, llmOutput),
        metric.score(datasetItem, llmOutput),
      ];

      const results = await Promise.all(promises);

      // All results should have the same score (from single-flight deduplication)
      expect(results[0].score).toBe(results[1].score);
      expect(results[1].score).toBe(results[2].score);

      // LLM should only be called once due to single-flight pattern
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    });

    it.skipIf(!redisAvailable)('should allow different keys to be processed concurrently', async () => {
      let callOrder: string[] = [];
      const mockGenerate = vi.fn().mockImplementation(async (_prompt: string) => {
        // Extract a unique identifier from the prompt for tracking
        const match = _prompt.match(/Input #(\d+)/);
        const id = match ? match[1] : 'unknown';
        callOrder.push(`start-${id}`);
        await sleep(50);
        callOrder.push(`end-${id}`);
        return {
          content: JSON.stringify({ score: 5, reason: `Evaluation for input ${id}` }),
          model: 'claude-sonnet-4-20250514',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      // Create different inputs
      const inputs = [
        { input: 'Input #1 - unique', output: 'Output 1' },
        { input: 'Input #2 - unique', output: 'Output 2' },
      ];

      const promises = inputs.map((item) =>
        metric.score({ input: item.input, output: '' }, item.output),
      );

      const results = await Promise.all(promises);

      // Both should have results
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.score).toBe(5);
      });

      // Both LLM calls should have been made
      expect(mockGenerate).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================
  // FAILURE SCENARIO TESTS
  // ==========================================

  describe('Failure Scenario Tests', () => {
    it.skipIf(!redisAvailable)('should gracefully handle Redis connection failure mid-operation', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 4, reason: 'Evaluated despite Redis issues' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'Failure test input', output: '' };
      const llmOutput = 'Failure test output';

      // Simulate Redis failure
      redisService.setSimulateFailure(true);

      // Should still work by falling back to LLM (no cache available)
      const result = await metric.score(datasetItem, llmOutput);
      expect(result.score).toBe(4);
      expect(result.reason).toBe('Evaluated despite Redis issues');
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Restore Redis
      redisService.setSimulateFailure(false);
    });

    it.skipIf(!redisAvailable)('should recover when Redis comes back online', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 5, reason: 'Recovery test' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'Recovery test input', output: '' };
      const llmOutput = 'Recovery test output - unique';

      // Step 1: Redis down - should work via LLM
      redisService.setSimulateFailure(true);
      const result1 = await metric.score(datasetItem, llmOutput);
      expect(result1.score).toBe(5);
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Step 2: Redis back online
      redisService.setSimulateFailure(false);

      // Step 3: Call again - should call LLM (cache was not populated when Redis was down)
      const result2 = await metric.score(datasetItem, llmOutput);
      expect(result2.score).toBe(5);
      expect(mockGenerate).toHaveBeenCalledTimes(2);

      // Wait for cache write
      await sleep(100);

      // Step 4: Call again - should hit cache now
      const result3 = await metric.score(datasetItem, llmOutput);
      expect(result3.score).toBe(5);
      expect(result3.metadata?.cached).toBe(true);
      expect(mockGenerate).toHaveBeenCalledTimes(2); // No new call
    });

    it.skipIf(!redisAvailable)('should continue evaluation when Redis is unavailable (graceful degradation)', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 3, reason: 'Neutral response' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      const anthropicService = createMockAnthropicService(mockGenerate);

      // Create metric with no Redis service (null)
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        undefined, // No Redis service
      );

      const datasetItem: DatasetItem = { input: 'No Redis test', output: '' };
      const llmOutput = 'No Redis test output';

      // Should work without Redis
      const result = await metric.score(datasetItem, llmOutput);
      expect(result.score).toBe(3);
      expect(result.metadata?.cached).toBeUndefined();
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Second call should also go to LLM (no caching available)
      const result2 = await metric.score(datasetItem, llmOutput);
      expect(result2.score).toBe(3);
      expect(mockGenerate).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================
  // PERFORMANCE TESTS
  // ==========================================

  describe('Performance Tests', () => {
    it.skipIf(!redisAvailable)('should return cached responses significantly faster than LLM calls', async () => {
      const LLM_DELAY_MS = 200; // Simulate LLM latency
      const mockGenerate = vi.fn().mockImplementation(async () => {
        await sleep(LLM_DELAY_MS);
        return {
          content: JSON.stringify({ score: 5, reason: 'Fast test' }),
          model: 'claude-sonnet-4-20250514',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'Performance test input', output: '' };
      const llmOutput = 'Performance test output - unique string for caching';

      // First call - measures LLM time
      const startLLM = Date.now();
      await metric.score(datasetItem, llmOutput);
      const llmTime = Date.now() - startLLM;

      // Wait for cache write
      await sleep(100);

      // Second call - measures cache time
      const startCache = Date.now();
      const cachedResult = await metric.score(datasetItem, llmOutput);
      const cacheTime = Date.now() - startCache;

      // Assertions
      expect(cachedResult.metadata?.cached).toBe(true);
      expect(cacheTime).toBeLessThan(llmTime);
      expect(cacheTime).toBeLessThan(50); // Cache should be under 50ms

      // Cache should be at least 2x faster than LLM
      const speedup = llmTime / cacheTime;
      expect(speedup).toBeGreaterThan(2);
    });

    it.skipIf(!redisAvailable)('should properly limit concurrency via semaphore', async () => {
      let activeCount = 0;
      let maxConcurrent = 0;

      const mockGenerate = vi.fn().mockImplementation(async () => {
        activeCount++;
        maxConcurrent = Math.max(maxConcurrent, activeCount);
        await sleep(50); // Simulate LLM processing
        activeCount--;
        return {
          content: JSON.stringify({ score: 5, reason: 'Concurrency test' }),
          model: 'claude-sonnet-4-20250514',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      // Launch many concurrent requests with different inputs
      const promises = Array.from({ length: 6 }, (_, i) =>
        metric.score(
          { input: `Semaphore test input ${i}`, output: '' },
          `Semaphore test output ${i} - unique`,
        ),
      );

      await Promise.all(promises);

      // Should never exceed the semaphore limit
      expect(maxConcurrent).toBeLessThanOrEqual(MAX_CONCURRENT_LLM_CALLS);
    });

    it.skipIf(!redisAvailable)('should report accurate semaphore statistics', async () => {
      const stats = getMetricsUtilStats();

      expect(stats).toHaveProperty('semaphoreAvailable');
      expect(stats).toHaveProperty('semaphoreQueueLength');
      expect(stats).toHaveProperty('inFlightRequests');

      // With no active requests, semaphore should be at max
      expect(stats.semaphoreAvailable).toBe(MAX_CONCURRENT_LLM_CALLS);
      expect(stats.semaphoreQueueLength).toBe(0);
    });
  });

  // ==========================================
  // CACHE KEY AND TTL VERIFICATION TESTS
  // ==========================================

  describe('Cache Key and TTL Verification', () => {
    it.skipIf(!redisAvailable)('should use correct cache key format', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 5, reason: 'Cache key test' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'Cache key format test', output: '' };
      const llmOutput = 'Cache key format test output';

      await metric.score(datasetItem, llmOutput);
      await sleep(100);

      // Verify the key exists in Redis with expected format
      const expectedKey = generateCacheKey(datasetItem.input, llmOutput);
      expect(expectedKey).toMatch(/^metric:tone_empathy:v\d+:[a-f0-9]{32}$/);

      const cached = await redisService.get(expectedKey);
      expect(cached).not.toBeNull();
    });

    it.skipIf(!redisAvailable)('should set correct TTL on cached entries', async () => {
      const mockGenerate = vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 5, reason: 'TTL verification test' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'TTL verification test input', output: '' };
      const llmOutput = 'TTL verification test output';

      await metric.score(datasetItem, llmOutput);
      await sleep(100);

      // Check TTL
      const cacheKey = generateCacheKey(datasetItem.input, llmOutput);
      const ttl = await redisService.getTtl(cacheKey);

      // TTL should be close to GEVAL_CACHE_TTL_SECONDS (within 10 seconds margin)
      expect(ttl).toBeGreaterThan(GEVAL_CACHE_TTL_SECONDS - 10);
      expect(ttl).toBeLessThanOrEqual(GEVAL_CACHE_TTL_SECONDS);
    });
  });

  // ==========================================
  // FAST PATH (BANNED WORDS) TESTS
  // ==========================================

  describe('Fast Path - Banned Words with Redis', () => {
    it.skipIf(!redisAvailable)('should NOT cache banned word results (fast path)', async () => {
      const mockGenerate = vi.fn();
      const anthropicService = createMockAnthropicService(mockGenerate);
      const metric = new ToneEmpathyMetric(
        anthropicService as AnthropicService,
        redisService as any,
      );

      const datasetItem: DatasetItem = { input: 'Banned word test', output: '' };
      const llmOutput = 'You failed at budgeting.'; // Contains banned word

      // First call - should detect banned word
      const result1 = await metric.score(datasetItem, llmOutput);
      expect(result1.score).toBe(1);
      expect(result1.metadata?.fastPath).toBe(true);
      expect(result1.metadata?.bannedWord).toBe('failed');
      expect(mockGenerate).not.toHaveBeenCalled();

      // Check that result is NOT cached
      await sleep(100);
      const cacheKey = generateCacheKey(datasetItem.input, llmOutput);
      const cached = await redisService.get(cacheKey);
      expect(cached).toBeNull(); // Banned word results should not be cached

      // Second call - should still detect banned word (no cache needed)
      const result2 = await metric.score(datasetItem, llmOutput);
      expect(result2.score).toBe(1);
      expect(result2.metadata?.fastPath).toBe(true);
      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });
});
