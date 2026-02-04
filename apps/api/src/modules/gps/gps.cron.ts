/**
 * GPS Re-Router Cron Service
 *
 * Handles scheduled maintenance tasks for the GPS Re-Router feature:
 * - Deactivate expired savings rate adjustments
 * - Deactivate expired category freezes
 * - Clean up stale recovery sessions
 *
 * Runs hourly to ensure expired adjustments are deactivated promptly.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import { RedisService } from '../../redis';
import { RecoveryActionService } from './recovery-action.service';
import { ProgressService } from './progress';
import { GpsNotificationService } from './notification';
import { RecoveryStatus } from '@prisma/client';
import { subDays } from 'date-fns';

/**
 * Configuration for the cleanup job
 */
interface CleanupConfig {
  /** Session stale threshold in days */
  staleSessionDays: number;
  /** Lock TTL in milliseconds */
  lockTtlMs: number;
}

@Injectable()
export class GpsCronService {
  private readonly logger = new Logger(GpsCronService.name);

  /** Lock key for distributed coordination */
  private readonly LOCK_KEY = 'gps:cron:cleanup';

  /** Cleanup configuration */
  private readonly cleanupConfig: CleanupConfig = {
    staleSessionDays: 7, // Sessions pending for more than 7 days
    lockTtlMs: 5 * 60 * 1000, // 5 minutes lock TTL
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly redisService: RedisService,
    private readonly recoveryActionService: RecoveryActionService,
    private readonly progressService: ProgressService,
    private readonly notificationService: GpsNotificationService,
  ) {}

  /**
   * Hourly GPS cleanup job
   * Runs at the start of every hour
   *
   * Schedule: '0 * * * *'
   * - 0: minute (0)
   * - *: hour (every hour)
   * - *: day of month (every day)
   * - *: month (every month)
   * - *: day of week (every day)
   */
  @Cron('0 * * * *', {
    name: 'gps-cleanup',
    timeZone: 'Africa/Lagos',
  })
  async runCleanup(): Promise<void> {
    const lockValue = randomUUID();
    const startTime = Date.now();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      this.cleanupConfig.lockTtlMs,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('GPS cleanup job skipped: another instance is already processing');
      return;
    }

    this.logger.log('Starting GPS cleanup job');

    // Create Opik trace for the cleanup job
    const trace = this.opikService.createTrace({
      name: 'gps_cleanup_job',
      input: { trigger: 'cron', schedule: '0 * * * *' },
      metadata: {
        job: 'gps-cleanup',
        version: '1.0',
      },
      tags: ['gps', 'cron', 'cleanup'],
    });

    let deactivatedAdjustments = 0;
    let deactivatedFreezes = 0;
    let abandonedSessions = 0;
    let milestonesChecked = 0;
    let deletedNotifications = 0;

    try {
      // 1. Deactivate expired adjustments and freezes
      const { adjustments, freezes } = await this.recoveryActionService.deactivateExpired();
      deactivatedAdjustments = adjustments;
      deactivatedFreezes = freezes;

      // 2. Mark stale PENDING sessions as ABANDONED
      abandonedSessions = await this.abandonStaleSessions();

      // 3. Check milestones for active recovery sessions
      milestonesChecked = await this.checkActiveMilestones();

      // 4. Clean up old notifications
      deletedNotifications = await this.notificationService.deleteOldNotifications(30);

      const duration = Date.now() - startTime;

      // End trace with success
      this.opikService.endTrace(trace, {
        success: true,
        result: {
          deactivatedAdjustments,
          deactivatedFreezes,
          abandonedSessions,
          milestonesChecked,
          deletedNotifications,
          durationMs: duration,
        },
      });

      if (deactivatedAdjustments > 0 || deactivatedFreezes > 0 || abandonedSessions > 0 || deletedNotifications > 0) {
        this.logger.log(
          `GPS cleanup completed: ${deactivatedAdjustments} adjustments, ` +
            `${deactivatedFreezes} freezes deactivated, ${abandonedSessions} sessions abandoned, ` +
            `${milestonesChecked} milestones checked, ${deletedNotifications} notifications deleted (${duration}ms)`,
        );
      } else {
        this.logger.debug(`GPS cleanup completed: nothing to clean up (${duration}ms)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // End trace with error
      this.opikService.endTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(`GPS cleanup job failed: ${errorMessage}`);
    } finally {
      // Release the distributed lock
      await this.redisService.releaseLock(this.LOCK_KEY, lockValue);

      // Flush Opik traces
      await this.opikService.flush();
    }
  }

  /**
   * Mark stale PENDING sessions as ABANDONED
   *
   * A session is considered stale if it's been in PENDING status
   * for more than the configured threshold (default 7 days).
   *
   * This helps keep analytics accurate by identifying users who
   * saw recovery options but never selected one.
   */
  private async abandonStaleSessions(): Promise<number> {
    const staleThreshold = subDays(new Date(), this.cleanupConfig.staleSessionDays);

    const result = await this.prisma.recoverySession.updateMany({
      where: {
        status: RecoveryStatus.PENDING,
        createdAt: { lt: staleThreshold },
      },
      data: {
        status: RecoveryStatus.ABANDONED,
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Check and record milestones for all active recovery sessions
   *
   * This ensures milestones are tracked even if users don't actively
   * check their session status.
   */
  private async checkActiveMilestones(): Promise<number> {
    // Find active sessions (PATH_SELECTED or IN_PROGRESS)
    const activeSessions = await this.prisma.recoverySession.findMany({
      where: {
        status: { in: [RecoveryStatus.PATH_SELECTED, RecoveryStatus.IN_PROGRESS] },
        selectedPathId: { not: null },
        selectedAt: { not: null },
      },
      select: {
        id: true,
        userId: true,
      },
      take: 100, // Process in batches
    });

    let totalMilestones = 0;

    for (const session of activeSessions) {
      try {
        const newMilestones = await this.progressService.checkAndRecordMilestones(
          session.userId,
          session.id,
        );
        totalMilestones += newMilestones.length;
      } catch (error) {
        // Don't let individual session failures break the batch
        this.logger.warn(
          `[checkActiveMilestones] Failed for session ${session.id}: ${error}`,
        );
      }
    }

    return totalMilestones;
  }

  /**
   * Health check endpoint for the cron service
   */
  getJobStatus(): {
    jobName: string;
    schedule: string;
    timezone: string;
    description: string;
    cleanupConfig: CleanupConfig;
  } {
    return {
      jobName: 'gps-cleanup',
      schedule: '0 * * * *',
      timezone: 'Africa/Lagos',
      description: 'Deactivates expired GPS adjustments and freezes, marks stale sessions as abandoned',
      cleanupConfig: this.cleanupConfig,
    };
  }

  /**
   * Manually trigger cleanup (for testing/admin purposes)
   */
  async triggerManualRun(): Promise<{
    success: boolean;
    deactivatedAdjustments: number;
    deactivatedFreezes: number;
    abandonedSessions: number;
    message: string;
  }> {
    try {
      const { adjustments, freezes } = await this.recoveryActionService.deactivateExpired();
      const abandonedSessions = await this.abandonStaleSessions();

      return {
        success: true,
        deactivatedAdjustments: adjustments,
        deactivatedFreezes: freezes,
        abandonedSessions,
        message: 'Manual cleanup completed',
      };
    } catch (error) {
      return {
        success: false,
        deactivatedAdjustments: 0,
        deactivatedFreezes: 0,
        abandonedSessions: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
