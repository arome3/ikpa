/**
 * Redis Throttler Storage
 *
 * Implements ThrottlerStorage interface using Redis for distributed rate limiting.
 * This ensures rate limits are consistent across multiple server instances.
 *
 * Features:
 * - Distributed rate limiting across server instances
 * - Graceful degradation to in-memory when Redis unavailable
 * - Automatic cleanup via Redis TTL
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly keyPrefix = 'throttle:';

  // Fallback in-memory storage when Redis is unavailable
  private readonly memoryStorage = new Map<
    string,
    { hits: number; expiresAt: number; blocked: boolean; blockExpiresAt: number }
  >();

  constructor(private readonly redisService: RedisService) {}

  onModuleInit(): void {
    if (this.redisService.isAvailable()) {
      this.logger.log('Redis throttler storage initialized');
    } else {
      this.logger.warn('Redis unavailable - using in-memory throttler storage');
    }
  }

  /**
   * Increment hit count for a key
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = `${this.keyPrefix}${throttlerName}:${key}`;

    // Try Redis first
    if (this.redisService.isAvailable()) {
      return this.incrementRedis(fullKey, ttl, limit, blockDuration);
    }

    // Fallback to in-memory
    return this.incrementMemory(fullKey, ttl, limit, blockDuration);
  }

  /**
   * Increment using Redis
   */
  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisService.getClient();
    if (!client) {
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }

    try {
      const blockKey = `${key}:blocked`;

      // Check if blocked
      const blockedTTL = await client.pttl(blockKey);
      if (blockedTTL > 0) {
        const hits = await client.get(key);
        return {
          totalHits: parseInt(hits || '0', 10),
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire: blockedTTL,
        };
      }

      // Increment hit count
      const hits = await client.incr(key);

      // Set TTL if this is the first hit
      if (hits === 1) {
        await client.pexpire(key, ttl);
      }

      // Get remaining TTL
      const remainingTTL = await client.pttl(key);

      // Check if limit exceeded and should block
      if (hits > limit && blockDuration > 0) {
        await client.set(blockKey, '1', 'PX', blockDuration);
        return {
          totalHits: hits,
          timeToExpire: remainingTTL > 0 ? remainingTTL : 0,
          isBlocked: true,
          timeToBlockExpire: blockDuration,
        };
      }

      return {
        totalHits: hits,
        timeToExpire: remainingTTL > 0 ? remainingTTL : 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (error) {
      this.logger.error(
        `Redis throttler error: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      // Fallback to memory on error
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }
  }

  /**
   * Increment using in-memory storage (fallback)
   */
  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();

    // Clean expired entries periodically
    this.cleanupMemoryStorage();

    let record = this.memoryStorage.get(key);

    // Check if blocked
    if (record && record.blocked && record.blockExpiresAt > now) {
      return {
        totalHits: record.hits,
        timeToExpire: Math.max(0, record.expiresAt - now),
        isBlocked: true,
        timeToBlockExpire: record.blockExpiresAt - now,
      };
    }

    // Create or update record
    if (!record || record.expiresAt <= now) {
      record = {
        hits: 1,
        expiresAt: now + ttl,
        blocked: false,
        blockExpiresAt: 0,
      };
    } else {
      record.hits++;
    }

    // Check if should block
    if (record.hits > limit && blockDuration > 0) {
      record.blocked = true;
      record.blockExpiresAt = now + blockDuration;
    }

    this.memoryStorage.set(key, record);

    return {
      totalHits: record.hits,
      timeToExpire: Math.max(0, record.expiresAt - now),
      isBlocked: record.blocked,
      timeToBlockExpire: record.blocked ? record.blockExpiresAt - now : 0,
    };
  }

  /**
   * Clean up expired in-memory entries
   */
  private cleanupMemoryStorage(): void {
    const now = Date.now();
    for (const [key, record] of this.memoryStorage.entries()) {
      if (record.expiresAt <= now && (!record.blocked || record.blockExpiresAt <= now)) {
        this.memoryStorage.delete(key);
      }
    }
  }
}
