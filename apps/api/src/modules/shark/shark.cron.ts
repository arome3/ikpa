/**
 * Shark Auditor Cron Service
 *
 * Scheduled jobs for subscription monitoring and zombie detection.
 * Runs weekly to identify unused subscriptions and alert users.
 *
 * Features:
 * - Distributed locking to prevent duplicate runs
 * - Cursor-based pagination for memory efficiency at scale
 * - Per-user timeout to prevent blocking
 * - Lock health monitoring with automatic abort on failure
 *
 * @module SharkCronService
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { OpikService } from '../ai/opik/opik.service';
import { RedisService } from '../../redis';
import { PrismaService } from '../../prisma/prisma.service';
import { ZombieDetectorCalculator } from './calculators';
import { SubscriptionStatus, SwipeAction } from '@prisma/client';

/**
 * Batch processing configuration
 */
interface BatchConfig {
  /** Number of users to process concurrently */
  concurrency: number;
  /** Lock time-to-live in milliseconds */
  lockTtlMs: number;
  /** How often to extend the lock in milliseconds */
  lockExtendIntervalMs: number;
  /** Number of users to fetch per cursor page */
  cursorPageSize: number;
  /** Maximum time in ms to process a single user */
  perUserTimeoutMs: number;
}

/**
 * Result of processing a single user's subscriptions
 */
interface UserAuditResult {
  userId: string;
  success: boolean;
  subscriptionsAnalyzed: number;
  zombiesFound: number;
  potentialSavings: number;
  error?: string;
  durationMs: number;
  timedOut?: boolean;
}

/**
 * Aggregated batch job statistics
 */
interface BatchJobStats {
  totalUsersProcessed: number;
  totalSubscriptionsAnalyzed: number;
  totalZombiesFound: number;
  totalPotentialSavings: number;
  errorCount: number;
  timeoutCount: number;
}

@Injectable()
export class SharkCronService {
  private readonly logger = new Logger(SharkCronService.name);

  private readonly LOCK_KEY = 'shark:cron:weekly-zombie-detection';

  /** Flag to signal job should abort (set when lock extension fails) */
  private shouldAbort = false;

  private readonly batchConfig: BatchConfig = {
    concurrency: 10,
    lockTtlMs: 30 * 60 * 1000, // 30 minutes
    lockExtendIntervalMs: 5 * 60 * 1000, // 5 minutes
    cursorPageSize: 100, // Fetch 100 users at a time
    perUserTimeoutMs: 30 * 1000, // 30 seconds max per user
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly redisService: RedisService,
    private readonly zombieDetector: ZombieDetectorCalculator,
  ) {}

  /**
   * Weekly zombie detection job
   * Runs every Sunday at 6:00 AM WAT
   *
   * Schedule: '0 6 * * 0'
   * - 0: minute (0)
   * - 6: hour (6 AM)
   * - *: day of month (every day)
   * - *: month (every month)
   * - 0: day of week (Sunday)
   */
  @Cron('0 6 * * 0', {
    name: 'weekly-zombie-detection',
    timeZone: 'Africa/Lagos',
  })
  async detectZombiesWeekly(): Promise<void> {
    const lockValue = randomUUID();
    const startTime = Date.now();
    this.shouldAbort = false;

    // Acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      this.batchConfig.lockTtlMs,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.log('Weekly zombie detection skipped: another instance is processing');
      return;
    }

    this.logger.log('Starting weekly zombie detection batch job');

    const trace = this.opikService.createTrace({
      name: 'weekly_zombie_detection_batch',
      input: { trigger: 'cron', schedule: '0 6 * * 0' },
      metadata: {
        job: 'weekly-zombie-detection',
        version: '2.0',
        concurrency: this.batchConfig.concurrency,
        cursorPageSize: this.batchConfig.cursorPageSize,
        perUserTimeoutMs: this.batchConfig.perUserTimeoutMs,
      },
      tags: ['shark', 'cron', 'batch', 'zombie-detection'],
    });

    // Set up lock extension with error handling
    const lockExtendInterval = setInterval(async () => {
      try {
        const extended = await this.redisService.extendLock(
          this.LOCK_KEY,
          lockValue,
          this.batchConfig.lockTtlMs,
        );

        if (!extended) {
          this.logger.error('Lock extension failed - lock may have been stolen. Aborting job.');
          this.shouldAbort = true;
          clearInterval(lockExtendInterval);
        }
      } catch (error) {
        this.logger.error(
          `Lock extension error: ${error instanceof Error ? error.message : 'Unknown error'}. Aborting job.`,
        );
        this.shouldAbort = true;
        clearInterval(lockExtendInterval);
      }
    }, this.batchConfig.lockExtendIntervalMs);

    const stats: BatchJobStats = {
      totalUsersProcessed: 0,
      totalSubscriptionsAnalyzed: 0,
      totalZombiesFound: 0,
      totalPotentialSavings: 0,
      errorCount: 0,
      timeoutCount: 0,
    };

    try {
      // Process users with cursor-based pagination
      await this.processAllUsersWithCursor(stats);

      const duration = Date.now() - startTime;

      this.opikService.endTrace(trace, {
        success: !this.shouldAbort,
        result: {
          ...stats,
          durationMs: duration,
          aborted: this.shouldAbort,
        },
      });

      if (this.shouldAbort) {
        this.logger.warn(
          `Weekly zombie detection aborted: ${stats.totalUsersProcessed} users processed before abort`,
        );
      } else {
        this.logger.log(
          `Weekly zombie detection complete: ${stats.totalUsersProcessed} users, ` +
            `${stats.totalSubscriptionsAnalyzed} subscriptions, ${stats.totalZombiesFound} zombies found, ` +
            `potential savings: ${stats.totalPotentialSavings}, timeouts: ${stats.timeoutCount} (${duration}ms)`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.opikService.endTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(`Weekly zombie detection failed: ${errorMessage}`);
    } finally {
      clearInterval(lockExtendInterval);
      await this.redisService.releaseLock(this.LOCK_KEY, lockValue);
      await this.opikService.flush();
    }
  }

  /**
   * Process all users using cursor-based pagination for memory efficiency.
   * This avoids loading all user IDs into memory at once.
   */
  private async processAllUsersWithCursor(stats: BatchJobStats): Promise<void> {
    let cursor: string | undefined;
    let pageCount = 0;

    while (!this.shouldAbort) {
      // Fetch a page of users with cursor
      const users = await this.prisma.user.findMany({
        where: {
          subscriptions: {
            some: {
              isActive: true,
              status: { not: SubscriptionStatus.CANCELLED },
            },
          },
        },
        select: { id: true },
        take: this.batchConfig.cursorPageSize,
        ...(cursor && {
          skip: 1, // Skip the cursor record itself
          cursor: { id: cursor },
        }),
        orderBy: { id: 'asc' },
      });

      if (users.length === 0) {
        break; // No more users to process
      }

      pageCount++;
      this.logger.debug(`Processing page ${pageCount} with ${users.length} users`);

      // Process this page of users in batches
      const userIds = users.map((u) => u.id);
      const pageResults = await this.processUsersInBatches(userIds);

      // Aggregate results
      for (const result of pageResults) {
        stats.totalUsersProcessed++;
        if (result.success) {
          stats.totalSubscriptionsAnalyzed += result.subscriptionsAnalyzed;
          stats.totalZombiesFound += result.zombiesFound;
          stats.totalPotentialSavings += result.potentialSavings;
        } else {
          stats.errorCount++;
        }
        if (result.timedOut) {
          stats.timeoutCount++;
        }
      }

      // Log progress every page
      this.logger.log(
        `Progress: ${stats.totalUsersProcessed} users processed, ${stats.totalZombiesFound} zombies found`,
      );

      // Update cursor for next page
      cursor = users[users.length - 1].id;

      // If we got fewer users than page size, we've reached the end
      if (users.length < this.batchConfig.cursorPageSize) {
        break;
      }
    }
  }

  /**
   * Process users in batches with controlled concurrency
   */
  private async processUsersInBatches(userIds: string[]): Promise<UserAuditResult[]> {
    const results: UserAuditResult[] = [];

    for (let i = 0; i < userIds.length && !this.shouldAbort; i += this.batchConfig.concurrency) {
      const batch = userIds.slice(i, i + this.batchConfig.concurrency);

      const batchResults = await Promise.all(
        batch.map((userId) => this.processUserWithTimeout(userId)),
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process a single user with timeout protection.
   * Prevents slow users from blocking the entire batch.
   */
  private async processUserWithTimeout(userId: string): Promise<UserAuditResult> {
    const startTime = Date.now();

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<UserAuditResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error('User processing timed out'));
        }, this.batchConfig.perUserTimeoutMs);
      });

      // Race between actual processing and timeout
      const result = await Promise.race([
        this.processUserSubscriptions(userId),
        timeoutPromise,
      ]);

      return result;
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'User processing timed out';

      return {
        userId,
        success: false,
        subscriptionsAnalyzed: 0,
        zombiesFound: 0,
        potentialSavings: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
        timedOut: isTimeout,
      };
    }
  }

  /**
   * Process a single user's subscriptions for zombie detection
   */
  private async processUserSubscriptions(userId: string): Promise<UserAuditResult> {
    const startTime = Date.now();

    try {
      // Get user's active subscriptions with last swipe decision
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          userId,
          isActive: true,
          status: { not: SubscriptionStatus.CANCELLED },
        },
        include: {
          swipeDecisions: {
            orderBy: { decidedAt: 'desc' },
            take: 1,
          },
        },
      });

      // Filter out subscriptions marked as KEEP
      const subscriptionsToAnalyze = subscriptions.filter((s) => {
        const lastDecision = s.swipeDecisions?.[0];
        return lastDecision?.action !== SwipeAction.KEEP;
      });

      if (subscriptionsToAnalyze.length === 0) {
        return {
          userId,
          success: true,
          subscriptionsAnalyzed: 0,
          zombiesFound: 0,
          potentialSavings: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Analyze for zombies
      const results = await this.zombieDetector.analyze(
        userId,
        subscriptionsToAnalyze.map((s) => ({
          ...s,
          monthlyCost: s.monthlyCost,
          annualCost: s.annualCost,
        })),
      );

      // Build a map for O(1) zombie lookup (fixes O(n²) issue)
      const zombieIdSet = new Set(
        results.filter((r) => r.status === SubscriptionStatus.ZOMBIE).map((r) => r.id),
      );

      // Batch update zombie statuses
      if (zombieIdSet.size > 0) {
        await this.prisma.subscription.updateMany({
          where: { id: { in: Array.from(zombieIdSet) } },
          data: { status: SubscriptionStatus.ZOMBIE },
        });
      }

      // Calculate potential savings using the map for O(1) lookup
      const potentialSavings = subscriptionsToAnalyze
        .filter((s) => zombieIdSet.has(s.id))
        .reduce((sum, s) => sum + Number(s.annualCost), 0);

      return {
        userId,
        success: true,
        subscriptionsAnalyzed: subscriptionsToAnalyze.length,
        zombiesFound: zombieIdSet.size,
        potentialSavings,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        userId,
        success: false,
        subscriptionsAnalyzed: 0,
        zombiesFound: 0,
        potentialSavings: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get job status for health checks
   */
  getJobStatus(): {
    jobName: string;
    schedule: string;
    timezone: string;
    description: string;
    config: BatchConfig;
  } {
    return {
      jobName: 'weekly-zombie-detection',
      schedule: '0 6 * * 0',
      timezone: 'Africa/Lagos',
      description: 'Detects zombie subscriptions for all users every Sunday at 6 AM WAT',
      config: this.batchConfig,
    };
  }

  /**
   * Manual trigger for testing/admin purposes
   */
  async triggerManualRun(): Promise<{ success: boolean; message: string }> {
    try {
      await this.detectZombiesWeekly();
      return { success: true, message: 'Manual zombie detection completed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
