import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { UserService } from '../user/user.service';
import { OpikService } from '../ai/opik/opik.service';
import { RedisService } from '../../redis';
import { FinanceService } from './finance.service';

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
  previousScore?: number | null;
  newScore?: number;
  change?: number;
  error?: string;
  durationMs: number;
}

/**
 * Finance Cron Service
 *
 * Handles scheduled calculation of Cash Flow Scores for all active users.
 * Runs daily at 2 AM to ensure scores are fresh when users check in the morning.
 *
 * Features:
 * - Distributed locking prevents duplicate runs across multiple instances
 * - Batch processing with configurable concurrency for scalability
 * - Error isolation (one user's error doesn't affect others)
 * - Full Opik tracing for monitoring batch job performance
 * - Alert logging for significant score changes (>5 points)
 * - Graceful handling of calculation failures
 */
@Injectable()
export class FinanceCronService {
  private readonly logger = new Logger(FinanceCronService.name);

  /** Lock key for distributed coordination */
  private readonly LOCK_KEY = 'finance:cron:daily-score-calculation';

  /** Default batch processing configuration */
  private readonly batchConfig: BatchConfig = {
    concurrency: 10, // Process 10 users in parallel
    lockTtlMs: 30 * 60 * 1000, // 30 minutes lock TTL
    lockExtendIntervalMs: 5 * 60 * 1000, // Extend lock every 5 minutes
  };

  constructor(
    private readonly userService: UserService,
    private readonly financeService: FinanceService,
    private readonly opikService: OpikService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Daily Cash Flow Score calculation job
   * Runs at 2:00 AM every day
   *
   * Schedule: '0 2 * * *'
   * - 0: minute (0)
   * - 2: hour (2 AM)
   * - *: day of month (every day)
   * - *: month (every month)
   * - *: day of week (every day)
   */
  @Cron('0 2 * * *', {
    name: 'daily-cash-flow-score-calculation',
    timeZone: 'UTC',
  })
  async calculateDailyScores(): Promise<void> {
    const lockValue = randomUUID();
    const startTime = Date.now();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      this.batchConfig.lockTtlMs,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.log(
        'Daily Cash Flow Score job skipped: another instance is already processing',
      );
      return;
    }

    this.logger.log('Starting daily Cash Flow Score calculation batch job');

    // Create Opik trace for the batch job
    const trace = this.opikService.createTrace({
      name: 'daily_cash_flow_score_batch',
      input: { trigger: 'cron', schedule: '0 2 * * *' },
      metadata: {
        job: 'daily-cash-flow-score-calculation',
        version: '2.0',
        concurrency: this.batchConfig.concurrency,
      },
      tags: ['finance', 'cron', 'batch'],
    });

    // Set up lock extension interval
    const lockExtendInterval = setInterval(async () => {
      const extended = await this.redisService.extendLock(
        this.LOCK_KEY,
        lockValue,
        this.batchConfig.lockTtlMs,
      );
      if (extended) {
        this.logger.debug('Lock extended for batch job');
      }
    }, this.batchConfig.lockExtendIntervalMs);

    let successCount = 0;
    let errorCount = 0;
    let alertCount = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    try {
      // Get all active users (those who have completed onboarding)
      const users = await this.userService.getAllActiveUsers();
      this.logger.log(
        `Found ${users.length} active users to process with concurrency ${this.batchConfig.concurrency}`,
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

          // Check for significant score change (>5 points)
          if (result.previousScore !== null && result.change !== undefined) {
            if (Math.abs(result.change) > 5) {
              alertCount++;
              this.logScoreAlert(
                result.userId,
                result.previousScore!,
                result.newScore!,
                result.change,
              );
            }
          }
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
          totalUsers: users.length,
          successCount,
          errorCount,
          alertCount,
          durationMs: duration,
          avgDurationPerUserMs: Math.round(avgDurationPerUser),
          concurrency: this.batchConfig.concurrency,
        },
      });

      this.logger.log(
        `Completed daily Cash Flow Score calculation: ` +
          `${successCount} success, ${errorCount} errors, ${alertCount} alerts ` +
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

      this.logger.error(`Daily Cash Flow Score batch job failed: ${errorMessage}`);
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
   * Process users in batches with controlled concurrency
   *
   * This prevents overwhelming the database with too many concurrent queries
   * while still parallelizing work for efficiency.
   *
   * @param userIds - Array of user IDs to process
   * @param concurrency - Maximum number of concurrent operations
   * @returns Array of processing results
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

      // Log progress every 100 users
      if ((i + batch.length) % 100 === 0 || i + batch.length === userIds.length) {
        this.logger.log(
          `Progress: ${i + batch.length}/${userIds.length} users processed`,
        );
      }
    }

    return results;
  }

  /**
   * Process a single user's score calculation
   *
   * Isolated error handling ensures one user's failure doesn't affect others.
   */
  private async processUser(userId: string): Promise<UserProcessResult> {
    const startTime = Date.now();

    try {
      // Get previous score for comparison
      const previousScore = await this.financeService.getPreviousScore(userId);

      // Calculate new score
      const result = await this.financeService.calculateCashFlowScore(userId);

      const change = previousScore !== null ? result.finalScore - previousScore : undefined;

      return {
        userId,
        success: true,
        previousScore,
        newScore: result.finalScore,
        change,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(`Failed to calculate score for user ${userId}: ${errorMessage}`);

      return {
        userId,
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Log an alert for significant score changes
   *
   * TODO: In the future, this should trigger notifications via NotificationService
   * For now, it logs the alert for monitoring purposes
   */
  private logScoreAlert(
    userId: string,
    previousScore: number,
    newScore: number,
    change: number,
  ): void {
    const direction = change > 0 ? 'increased' : 'decreased';
    const severity = Math.abs(change) > 10 ? 'SIGNIFICANT' : 'NOTABLE';

    this.logger.warn(
      `[${severity}] User ${userId} Cash Flow Score ${direction} by ${Math.abs(change)} points ` +
        `(${previousScore} → ${newScore})`,
    );
  }

  /**
   * Health check endpoint for the cron service
   * Can be used to verify the cron job is registered and running
   */
  getJobStatus(): {
    jobName: string;
    schedule: string;
    timezone: string;
    description: string;
    batchConfig: BatchConfig;
  } {
    return {
      jobName: 'daily-cash-flow-score-calculation',
      schedule: '0 2 * * *',
      timezone: 'UTC',
      description: 'Calculates Cash Flow Score for all active users daily at 2 AM UTC',
      batchConfig: this.batchConfig,
    };
  }

  /**
   * Manually trigger score calculation (for testing/admin purposes)
   * Should be protected by admin authorization in production
   */
  async triggerManualRun(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await this.calculateDailyScores();
      return { success: true, message: 'Manual run completed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
