/**
 * Story Cards Cron Service
 *
 * Handles scheduled tasks for the Story Cards system:
 * - Daily cleanup of expired cards (3 AM)
 * - Daily cleanup of inactive (soft-deleted) cards after 30 days (4 AM)
 *
 * Features:
 * - Distributed locking to prevent concurrent execution across instances
 * - Graceful degradation when Redis is unavailable
 * - Detailed logging for observability
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/** Lock key for expired cards cleanup */
const EXPIRED_CLEANUP_LOCK_KEY = 'story_cards:cron:expired_cleanup';

/** Lock key for inactive cards cleanup */
const INACTIVE_CLEANUP_LOCK_KEY = 'story_cards:cron:inactive_cleanup';

/** Lock TTL in milliseconds (5 minutes) */
const LOCK_TTL_MS = 5 * 60 * 1000;

/** Number of days after which inactive cards are permanently deleted */
const INACTIVE_RETENTION_DAYS = 30;

/** Result of a cleanup operation */
interface CleanupResult {
  deletedCount: number;
  error?: string;
}

@Injectable()
export class StoryCardsCronService {
  private readonly logger = new Logger(StoryCardsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Clean up expired story cards daily at 3 AM Africa/Lagos time
   *
   * Deletes cards where expiresAt < now. Cards that have passed their
   * expiration date are no longer accessible and can be safely removed.
   *
   * IDEMPOTENCY:
   * - Uses distributed lock to prevent concurrent execution
   * - Only deletes cards that have expired (date check is inherently idempotent)
   * - Safe to retry if process crashes (lock has TTL)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'story-cards-expired-cleanup',
    timeZone: 'Africa/Lagos',
  })
  async cleanupExpiredCards(): Promise<CleanupResult> {
    const lockValue = randomUUID();
    const startTime = Date.now();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      EXPIRED_CLEANUP_LOCK_KEY,
      LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('Expired cards cleanup skipped: another instance is processing');
      return { deletedCount: 0 };
    }

    this.logger.log('Starting expired story cards cleanup');

    try {
      // Delete all cards where expiresAt has passed
      const result = await this.prisma.storyCard.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      const duration = Date.now() - startTime;

      this.logger.log(
        `[cleanupExpiredCards] Deleted ${result.count} expired cards (${duration}ms)`,
      );

      return { deletedCount: result.count };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[cleanupExpiredCards] Failed: ${errorMessage}`);
      return { deletedCount: 0, error: errorMessage };
    } finally {
      await this.redisService.releaseLock(EXPIRED_CLEANUP_LOCK_KEY, lockValue);
    }
  }

  /**
   * Clean up inactive (soft-deleted) cards daily at 4 AM Africa/Lagos time
   *
   * Permanently deletes cards where:
   * - isActive = false (soft-deleted)
   * - updatedAt is older than INACTIVE_RETENTION_DAYS (30 days)
   *
   * This gives users a grace period to recover accidentally deleted cards.
   *
   * IDEMPOTENCY:
   * - Uses distributed lock to prevent concurrent execution
   * - Only deletes cards meeting both criteria (idempotent check)
   * - Safe to retry if process crashes
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM, {
    name: 'story-cards-inactive-cleanup',
    timeZone: 'Africa/Lagos',
  })
  async cleanupInactiveCards(): Promise<CleanupResult> {
    const lockValue = randomUUID();
    const startTime = Date.now();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      INACTIVE_CLEANUP_LOCK_KEY,
      LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('Inactive cards cleanup skipped: another instance is processing');
      return { deletedCount: 0 };
    }

    this.logger.log('Starting inactive story cards cleanup');

    try {
      // Calculate the threshold date (30 days ago)
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - INACTIVE_RETENTION_DAYS);

      // Delete all inactive cards older than the threshold
      const result = await this.prisma.storyCard.deleteMany({
        where: {
          isActive: false,
          updatedAt: { lt: thresholdDate },
        },
      });

      const duration = Date.now() - startTime;

      this.logger.log(
        `[cleanupInactiveCards] Deleted ${result.count} inactive cards older than ${INACTIVE_RETENTION_DAYS} days (${duration}ms)`,
      );

      return { deletedCount: result.count };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[cleanupInactiveCards] Failed: ${errorMessage}`);
      return { deletedCount: 0, error: errorMessage };
    } finally {
      await this.redisService.releaseLock(INACTIVE_CLEANUP_LOCK_KEY, lockValue);
    }
  }

  /**
   * Health check for cron jobs
   *
   * Returns information about scheduled jobs for monitoring.
   */
  getJobStatus(): Array<{
    jobName: string;
    schedule: string;
    timezone: string;
    description: string;
  }> {
    return [
      {
        jobName: 'story-cards-expired-cleanup',
        schedule: CronExpression.EVERY_DAY_AT_3AM,
        timezone: 'Africa/Lagos',
        description: 'Daily cleanup of expired story cards',
      },
      {
        jobName: 'story-cards-inactive-cleanup',
        schedule: CronExpression.EVERY_DAY_AT_4AM,
        timezone: 'Africa/Lagos',
        description: `Daily cleanup of inactive cards after ${INACTIVE_RETENTION_DAYS} days`,
      },
    ];
  }

  /**
   * Manually trigger expired cards cleanup (for testing/admin)
   */
  async triggerExpiredCleanup(): Promise<CleanupResult> {
    return this.cleanupExpiredCards();
  }

  /**
   * Manually trigger inactive cards cleanup (for testing/admin)
   */
  async triggerInactiveCleanup(): Promise<CleanupResult> {
    return this.cleanupInactiveCards();
  }
}
