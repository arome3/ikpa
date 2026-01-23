/**
 * Future Self Cron Service
 *
 * Handles scheduled generation of weekly "Letters from 2045" for subscribed users.
 * Runs every Monday at 9 AM to deliver motivational letters at the start of the week.
 *
 * Features:
 * - Distributed locking prevents duplicate runs across multiple instances
 * - Batch processing with configurable concurrency for scalability
 * - Error isolation (one user's error doesn't affect others)
 * - Full Opik tracing for monitoring batch job performance
 * - Retry queue for failed letter generations with exponential backoff
 * - Graceful handling of generation failures
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { OpikService } from '../ai/opik/opik.service';
import { RedisService } from '../../redis';
import { PrismaService } from '../../prisma/prisma.service';
import { FutureSelfService } from './future-self.service';
import { LetterTrigger } from '@prisma/client';

// ==========================================
// RETRY CONFIGURATION
// ==========================================

/** Maximum retry attempts per user */
const MAX_RETRY_ATTEMPTS = 3;

/** Retry delays in milliseconds (exponential backoff) */
const RETRY_DELAYS_MS = [
  5 * 60 * 1000,   // 5 minutes
  15 * 60 * 1000,  // 15 minutes
  60 * 60 * 1000,  // 1 hour
];

/** Redis key prefix for retry queue */
const RETRY_QUEUE_KEY = 'future_self:retry_queue';

/** TTL for retry queue entries (24 hours) */
const RETRY_QUEUE_TTL_SEC = 24 * 60 * 60;

/**
 * Configuration for batch processing
 */
interface BatchConfig {
  /** Number of users to process concurrently */
  concurrency: number;
  /** Lock TTL in milliseconds (should exceed max job duration) */
  lockTtlMs: number;
  /** Interval to extend lock during processing */
  lockExtendIntervalMs: number;
}

/**
 * Result of processing a single user
 */
interface UserProcessResult {
  userId: string;
  success: boolean;
  letterId?: string;
  error?: string;
  durationMs: number;
}

/**
 * Retry queue entry
 */
interface RetryEntry {
  userId: string;
  attemptCount: number;
  lastAttempt: number;
  nextRetry: number;
  lastError: string;
}

@Injectable()
export class FutureSelfCronService {
  private readonly logger = new Logger(FutureSelfCronService.name);

  /** Lock key for distributed coordination */
  private readonly LOCK_KEY = 'future_self:cron:weekly-letter-generation';

  /** Lock key for retry job */
  private readonly RETRY_LOCK_KEY = 'future_self:cron:retry-failed-letters';

  /** Default batch processing configuration */
  private readonly batchConfig: BatchConfig = {
    concurrency: 5, // Process 5 users in parallel (letter gen is expensive)
    lockTtlMs: 60 * 60 * 1000, // Default 60 minutes lock TTL (used for non-dynamic scenarios)
    lockExtendIntervalMs: 10 * 60 * 1000, // Extend lock every 10 minutes
  };

  /** Estimated time per user for letter generation (in ms) */
  private readonly ESTIMATED_TIME_PER_USER_MS = 30 * 1000; // 30 seconds avg

  /** Minimum lock TTL (5 minutes) */
  private readonly MIN_LOCK_TTL_MS = 5 * 60 * 1000;

  /** Maximum lock TTL (3 hours) */
  private readonly MAX_LOCK_TTL_MS = 3 * 60 * 60 * 1000;

  /** Buffer multiplier for safety margin */
  private readonly LOCK_TTL_BUFFER_MULTIPLIER = 1.5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly futureSelfService: FutureSelfService,
    private readonly opikService: OpikService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Weekly letter generation job
   * Runs at 9:00 AM every Monday
   *
   * Schedule: '0 9 * * 1'
   * - 0: minute (0)
   * - 9: hour (9 AM)
   * - *: day of month (every day)
   * - *: month (every month)
   * - 1: day of week (Monday)
   */
  @Cron('0 9 * * 1', {
    name: 'weekly-future-self-letter-generation',
    timeZone: 'Africa/Lagos', // WAT timezone for Africa-focused app
  })
  async generateWeeklyLetters(): Promise<void> {
    const lockValue = randomUUID();
    const startTime = Date.now();

    // Get eligible users first to calculate dynamic lock TTL
    const users = await this.getEligibleUsers();
    const userCount = users.length;

    // Calculate dynamic lock TTL based on user count
    const dynamicLockTtl = this.calculateDynamicLockTtl(userCount);

    this.logger.log(
      `Calculated dynamic lock TTL: ${Math.round(dynamicLockTtl / 1000 / 60)} minutes for ${userCount} users`,
    );

    // Try to acquire distributed lock with dynamic TTL
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      dynamicLockTtl,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.log(
        'Weekly letter generation job skipped: another instance is already processing',
      );
      return;
    }

    this.logger.log(`Starting weekly Future Self letter generation batch job for ${userCount} users`);

    // Create Opik trace for the batch job
    const trace = this.opikService.createTrace({
      name: 'weekly_future_self_letter_batch',
      input: { trigger: 'cron', schedule: '0 9 * * 1' },
      metadata: {
        job: 'weekly-future-self-letter-generation',
        version: '1.0',
        concurrency: this.batchConfig.concurrency,
      },
      tags: ['future-self', 'cron', 'batch', 'llm'],
    });

    // Set up lock extension interval with dynamic TTL
    const lockExtendInterval = setInterval(async () => {
      const extended = await this.redisService.extendLock(
        this.LOCK_KEY,
        lockValue,
        dynamicLockTtl,
      );
      if (extended) {
        this.logger.debug('Lock extended for batch job');
      }
    }, this.batchConfig.lockExtendIntervalMs);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    try {
      // Users already fetched above for dynamic TTL calculation
      this.logger.log(
        `Processing ${users.length} eligible users for weekly letters with concurrency ${this.batchConfig.concurrency}`,
      );

      // Process users in batches with controlled concurrency
      const results = await this.processUsersInBatches(
        users.map((u) => u.id),
        this.batchConfig.concurrency,
      );

      // Aggregate results
      for (const result of results) {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          errors.push({ userId: result.userId, error: result.error || 'Unknown error' });
        }
      }

      const duration = Date.now() - startTime;
      const avgDurationPerUser = results.length > 0 ? duration / results.length : 0;

      // End trace with success
      this.opikService.endTrace(trace, {
        success: true,
        result: {
          totalEligibleUsers: users.length,
          successCount,
          errorCount,
          skippedCount,
          durationMs: duration,
          avgDurationPerUserMs: Math.round(avgDurationPerUser),
          concurrency: this.batchConfig.concurrency,
        },
      });

      this.logger.log(
        `Completed weekly letter generation: ` +
          `${successCount} success, ${errorCount} errors, ${skippedCount} skipped ` +
          `(${duration}ms total, ${Math.round(avgDurationPerUser)}ms avg/user)`,
      );

      // Log errors summary if any
      if (errors.length > 0 && errors.length <= 10) {
        this.logger.warn(`Errors: ${JSON.stringify(errors)}`);
      } else if (errors.length > 10) {
        this.logger.warn(`${errors.length} errors occurred. First 10: ${JSON.stringify(errors.slice(0, 10))}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // End trace with error
      this.opikService.endTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(`Weekly letter generation batch job failed: ${errorMessage}`);
    } finally {
      // Clear lock extension interval
      clearInterval(lockExtendInterval);

      // Release the distributed lock
      await this.redisService.releaseLock(this.LOCK_KEY, lockValue);

      // Flush Opik traces to ensure they're sent
      await this.opikService.flush();
    }
  }

  /**
   * Get users eligible for weekly letter generation
   *
   * Criteria:
   * - weeklyReportEnabled: true (opted in to weekly communications)
   * - onboardingCompleted: true (has financial data)
   * - Has at least one financial snapshot (has data to simulate)
   */
  private async getEligibleUsers(): Promise<Array<{ id: string; name: string | null }>> {
    return this.prisma.user.findMany({
      where: {
        weeklyReportEnabled: true,
        onboardingCompleted: true,
        snapshots: {
          some: {}, // Has at least one snapshot
        },
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  /**
   * Calculate dynamic lock TTL based on user count
   *
   * Formula: (userCount / concurrency) * timePerUser * bufferMultiplier
   * Clamped between MIN_LOCK_TTL_MS and MAX_LOCK_TTL_MS
   *
   * @param userCount - Number of users to process
   * @returns Lock TTL in milliseconds
   */
  private calculateDynamicLockTtl(userCount: number): number {
    // Calculate batches needed
    const batchCount = Math.ceil(userCount / this.batchConfig.concurrency);

    // Calculate estimated time
    const estimatedTimeMs = batchCount * this.ESTIMATED_TIME_PER_USER_MS;

    // Apply buffer for safety margin
    const bufferedTimeMs = Math.round(estimatedTimeMs * this.LOCK_TTL_BUFFER_MULTIPLIER);

    // Clamp between min and max
    return Math.max(
      this.MIN_LOCK_TTL_MS,
      Math.min(this.MAX_LOCK_TTL_MS, bufferedTimeMs),
    );
  }

  /**
   * Process users in batches with controlled concurrency
   */
  private async processUsersInBatches(
    userIds: string[],
    concurrency: number,
  ): Promise<UserProcessResult[]> {
    const results: UserProcessResult[] = [];

    // Process in chunks of 'concurrency' size
    for (let i = 0; i < userIds.length; i += concurrency) {
      const batch = userIds.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map((userId) => this.processUser(userId)),
      );

      results.push(...batchResults);

      // Log progress every 50 users
      if ((i + batch.length) % 50 === 0 || i + batch.length === userIds.length) {
        this.logger.log(
          `Progress: ${i + batch.length}/${userIds.length} users processed`,
        );
      }
    }

    return results;
  }

  /**
   * Process a single user's letter generation
   */
  private async processUser(userId: string): Promise<UserProcessResult> {
    const startTime = Date.now();

    try {
      // Generate letter with WEEKLY_SCHEDULED trigger
      const letter = await this.futureSelfService.getLetter(
        userId,
        LetterTrigger.WEEKLY_SCHEDULED,
      );

      // Remove from retry queue if present (successful generation)
      await this.removeFromRetryQueue(userId);

      return {
        userId,
        success: true,
        letterId: letter.id,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(`Failed to generate letter for user ${userId}: ${errorMessage}`);

      // Add to retry queue for later attempt
      await this.addToRetryQueue(userId, errorMessage);

      return {
        userId,
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // ==========================================
  // RETRY QUEUE MANAGEMENT
  // ==========================================

  /**
   * Retry job for failed letter generations
   * Runs every hour to retry failed letters with exponential backoff
   *
   * Schedule: '0 * * * *'
   * - 0: minute (0)
   * - *: every hour
   */
  @Cron('0 * * * *', {
    name: 'retry-failed-future-self-letters',
    timeZone: 'Africa/Lagos',
  })
  async retryFailedLetters(): Promise<void> {
    const lockValue = randomUUID();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.RETRY_LOCK_KEY,
      10 * 60 * 1000, // 10 minute lock
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('Retry job skipped: another instance is already processing');
      return;
    }

    try {
      const now = Date.now();
      const retryEntries = await this.getRetryQueue();

      // Filter entries ready for retry
      const readyForRetry = retryEntries.filter(
        (entry) => entry.nextRetry <= now && entry.attemptCount < MAX_RETRY_ATTEMPTS,
      );

      if (readyForRetry.length === 0) {
        this.logger.debug('No letters ready for retry');
        return;
      }

      this.logger.log(`Retrying ${readyForRetry.length} failed letter generations`);

      let successCount = 0;
      let failCount = 0;

      for (const entry of readyForRetry) {
        try {
          // Generate letter (success means no exception thrown)
          await this.futureSelfService.getLetter(
            entry.userId,
            LetterTrigger.WEEKLY_SCHEDULED,
          );

          await this.removeFromRetryQueue(entry.userId);
          successCount++;

          this.logger.log(
            `Retry successful for user ${entry.userId} (attempt ${entry.attemptCount + 1})`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failCount++;

          // Update retry entry with new attempt
          await this.updateRetryEntry(entry.userId, entry.attemptCount + 1, errorMessage);

          if (entry.attemptCount + 1 >= MAX_RETRY_ATTEMPTS) {
            this.logger.error(
              `Max retries exhausted for user ${entry.userId}: ${errorMessage}`,
            );
          } else {
            this.logger.warn(
              `Retry ${entry.attemptCount + 1}/${MAX_RETRY_ATTEMPTS} failed for user ${entry.userId}: ${errorMessage}`,
            );
          }
        }
      }

      this.logger.log(
        `Retry job completed: ${successCount} success, ${failCount} failed`,
      );
    } finally {
      await this.redisService.releaseLock(this.RETRY_LOCK_KEY, lockValue);
    }
  }

  /**
   * Add a failed user to the retry queue
   */
  private async addToRetryQueue(userId: string, error: string): Promise<void> {
    try {
      const existing = await this.getRetryEntry(userId);
      const attemptCount = existing ? existing.attemptCount + 1 : 1;

      if (attemptCount > MAX_RETRY_ATTEMPTS) {
        this.logger.warn(`Max retries already reached for user ${userId}`);
        return;
      }

      const retryDelay = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)];
      const entry: RetryEntry = {
        userId,
        attemptCount,
        lastAttempt: Date.now(),
        nextRetry: Date.now() + retryDelay,
        lastError: error,
      };

      await this.redisService.set(
        `${RETRY_QUEUE_KEY}:${userId}`,
        entry,
        RETRY_QUEUE_TTL_SEC,
      );

      this.logger.debug(
        `Added user ${userId} to retry queue (attempt ${attemptCount}, retry in ${retryDelay / 1000}s)`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to add user ${userId} to retry queue: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Update an existing retry entry
   */
  private async updateRetryEntry(
    userId: string,
    attemptCount: number,
    error: string,
  ): Promise<void> {
    if (attemptCount >= MAX_RETRY_ATTEMPTS) {
      // Max retries reached - remove from queue
      await this.removeFromRetryQueue(userId);
      return;
    }

    const retryDelay = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)];
    const entry: RetryEntry = {
      userId,
      attemptCount,
      lastAttempt: Date.now(),
      nextRetry: Date.now() + retryDelay,
      lastError: error,
    };

    try {
      await this.redisService.set(
        `${RETRY_QUEUE_KEY}:${userId}`,
        entry,
        RETRY_QUEUE_TTL_SEC,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to update retry entry for user ${userId}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Remove a user from the retry queue (on success)
   */
  private async removeFromRetryQueue(userId: string): Promise<void> {
    try {
      await this.redisService.del(`${RETRY_QUEUE_KEY}:${userId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to remove user ${userId} from retry queue: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a specific retry entry
   */
  private async getRetryEntry(userId: string): Promise<RetryEntry | null> {
    try {
      return await this.redisService.get<RetryEntry>(`${RETRY_QUEUE_KEY}:${userId}`);
    } catch {
      return null;
    }
  }

  /**
   * Get all entries in the retry queue
   */
  private async getRetryQueue(): Promise<RetryEntry[]> {
    try {
      // Get all keys matching the retry queue pattern
      const keys = await this.redisService.keys(`${RETRY_QUEUE_KEY}:*`);

      if (keys.length === 0) {
        return [];
      }

      const entries: RetryEntry[] = [];
      for (const key of keys) {
        const entry = await this.redisService.get<RetryEntry>(key);
        if (entry) {
          entries.push(entry);
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  // ==========================================
  // STATUS AND MANUAL TRIGGERS
  // ==========================================

  /**
   * Health check endpoint for the cron service
   */
  getJobStatus(): {
    jobName: string;
    schedule: string;
    timezone: string;
    description: string;
    batchConfig: BatchConfig;
  } {
    return {
      jobName: 'weekly-future-self-letter-generation',
      schedule: '0 9 * * 1',
      timezone: 'Africa/Lagos',
      description: 'Generates personalized Future Self letters for subscribed users every Monday at 9 AM WAT',
      batchConfig: this.batchConfig,
    };
  }

  /**
   * Get retry queue status
   */
  async getRetryQueueStatus(): Promise<{
    queueSize: number;
    entries: Array<{
      userId: string;
      attemptCount: number;
      nextRetryIn: string;
    }>;
  }> {
    const entries = await this.getRetryQueue();
    const now = Date.now();

    return {
      queueSize: entries.length,
      entries: entries.map((e) => ({
        userId: e.userId,
        attemptCount: e.attemptCount,
        nextRetryIn:
          e.nextRetry > now
            ? `${Math.round((e.nextRetry - now) / 1000 / 60)} minutes`
            : 'ready',
      })),
    };
  }

  /**
   * Manually trigger letter generation (for testing/admin purposes)
   */
  async triggerManualRun(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.generateWeeklyLetters();
      return { success: true, message: 'Manual run completed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Manually trigger retry job (for testing/admin purposes)
   */
  async triggerRetryRun(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.retryFailedLetters();
      return { success: true, message: 'Retry run completed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
