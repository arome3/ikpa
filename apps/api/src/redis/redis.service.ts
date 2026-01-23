import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis Service
 *
 * Provides Redis connectivity and common operations including:
 * - Connection lifecycle management
 * - Distributed locking for cron jobs
 * - Cache operations
 *
 * Uses ioredis for robust Redis connectivity with automatic reconnection.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not configured. Distributed locking and caching will be disabled.',
      );
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000); // Exponential backoff
        },
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.logger.error(`Redis error: ${error.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Redis connection closed');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed gracefully');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get the raw Redis client for advanced operations
   */
  getClient(): Redis | null {
    return this.client;
  }

  // ==========================================
  // DISTRIBUTED LOCKING
  // ==========================================

  /**
   * Acquire a distributed lock
   *
   * Uses Redis SET with NX (only if not exists) and PX (expiration in ms)
   * for atomic lock acquisition with automatic expiration.
   *
   * @param lockKey - Unique key for the lock
   * @param ttlMs - Lock expiration in milliseconds (prevents deadlocks)
   * @param lockValue - Unique value to identify lock owner (for safe release)
   * @returns true if lock acquired, false if already held by another process
   */
  async acquireLock(lockKey: string, ttlMs: number, lockValue: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      this.logger.warn(`Cannot acquire lock ${lockKey}: Redis not available`);
      return true; // Allow operation to proceed if Redis is down (graceful degradation)
    }

    try {
      const result = await this.client.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
      const acquired = result === 'OK';

      if (acquired) {
        this.logger.debug(`Lock acquired: ${lockKey} (TTL: ${ttlMs}ms)`);
      } else {
        this.logger.debug(`Lock already held: ${lockKey}`);
      }

      return acquired;
    } catch (error) {
      this.logger.error(
        `Failed to acquire lock ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return true; // Graceful degradation
    }
  }

  /**
   * Release a distributed lock
   *
   * Only releases if the lock value matches (prevents releasing another process's lock)
   *
   * @param lockKey - The lock key to release
   * @param lockValue - The value used when acquiring (must match)
   * @returns true if released, false if lock was not held or value mismatch
   */
  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return true;
    }

    // Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.client.eval(script, 1, lockKey, lockValue);
      const released = result === 1;

      if (released) {
        this.logger.debug(`Lock released: ${lockKey}`);
      }

      return released;
    } catch (error) {
      this.logger.error(
        `Failed to release lock ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Extend a lock's TTL (useful for long-running operations)
   *
   * @param lockKey - The lock key to extend
   * @param lockValue - The value used when acquiring (must match)
   * @param ttlMs - New TTL in milliseconds
   * @returns true if extended, false if lock not held
   */
  async extendLock(lockKey: string, lockValue: string, ttlMs: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return true;
    }

    // Lua script for atomic check-and-extend
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await this.client.eval(script, 1, lockKey, lockValue, ttlMs.toString());
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to extend lock ${lockKey}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  // ==========================================
  // CACHE OPERATIONS
  // ==========================================

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Cache get failed for ${key}: ${error instanceof Error ? error.message : 'Unknown'}`);
      return null;
    }
  }

  /**
   * Set a value only if it doesn't exist (SETNX pattern)
   *
   * Useful for idempotency checks - returns true only for the first caller.
   *
   * @param key - The key to set
   * @param value - The value to set
   * @param ttlSeconds - TTL in seconds (required for idempotency to prevent stale keys)
   * @returns true if key was set (first caller), false if already exists
   */
  async setNx<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      // If Redis is unavailable, allow the operation (graceful degradation)
      return true;
    }

    try {
      const serialized = JSON.stringify(value);
      // SET key value EX ttl NX - atomically set with TTL only if not exists
      const result = await this.client.set(key, serialized, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`SetNx failed for ${key}: ${error instanceof Error ? error.message : 'Unknown'}`);
      // On error, allow operation to proceed (graceful degradation)
      return true;
    }
  }

  /**
   * Set a cached value with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      this.logger.error(`Cache set failed for ${key}: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  /**
   * Delete a cached value
   */
  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Cache delete failed for ${key}: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  /**
   * Find keys matching a pattern
   *
   * WARNING: This uses KEYS command which is O(N) and can block Redis.
   * Only use for small, bounded keyspaces like retry queues.
   * For large datasets, consider using SCAN with scanKeys() instead.
   *
   * @param pattern - Redis glob-style pattern (e.g., "prefix:*")
   * @returns Array of matching keys, empty array on error
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(
        `Keys lookup failed for pattern ${pattern}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return [];
    }
  }

  /**
   * Safely iterate over keys matching a pattern using SCAN
   *
   * Preferred over keys() for large datasets as SCAN is non-blocking.
   *
   * @param pattern - Redis glob-style pattern
   * @param count - Hint for how many keys to return per iteration (default: 100)
   * @returns Array of matching keys
   */
  async scanKeys(pattern: string, count = 100): Promise<string[]> {
    if (!this.client || !this.isConnected) {
      return [];
    }

    try {
      const results: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          count,
        );
        cursor = nextCursor;
        results.push(...keys);
      } while (cursor !== '0');

      return results;
    } catch (error) {
      this.logger.error(
        `Scan keys failed for pattern ${pattern}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return [];
    }
  }
}
