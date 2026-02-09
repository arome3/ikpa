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
import { BudgetService } from './budget.service';
import { GpsService } from './gps.service';
import { ProgressService } from './progress';
import { GpsNotificationService } from './notification';
import { RecoveryStatus, GpsEventType } from '@prisma/client';
import { subDays, startOfMonth } from 'date-fns';

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
    private readonly budgetService: BudgetService,
    private readonly gpsService: GpsService,
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
    timeZone: 'UTC',
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
    let deactivatedRebalances = 0;
    let abandonedSessions = 0;
    let milestonesChecked = 0;
    let deletedNotifications = 0;

    try {
      // 1. Deactivate expired adjustments and freezes
      const { adjustments, freezes } = await this.recoveryActionService.deactivateExpired();
      deactivatedAdjustments = adjustments;
      deactivatedFreezes = freezes;

      // 1b. Reset rebalances from previous budget periods
      // Only run at period boundaries (first hour of the month) to avoid unnecessary DB calls
      const now = new Date();
      if (now.getDate() === 1 && now.getHours() === 0) {
        const periodStart = startOfMonth(now);
        deactivatedRebalances = await this.recoveryActionService.resetPeriodRebalances(periodStart);
      }

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
          deactivatedRebalances,
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
   * Daily drift detection job
   * Runs at 7 AM UTC timezone to detect spending velocity drift
   * across all users with active budgets.
   *
   * Schedule: '0 7 * * *'
   */
  @Cron('0 7 * * *', {
    name: 'gps-drift-detection',
    timeZone: 'UTC',
  })
  async runDriftDetection(): Promise<void> {
    const lockKey = 'gps:cron:drift-detection';
    const lockValue = randomUUID();
    const startTime = Date.now();

    const lockAcquired = await this.redisService.acquireLock(
      lockKey,
      5 * 60 * 1000, // 5 min TTL
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('GPS drift detection job skipped: another instance is already processing');
      return;
    }

    this.logger.log('Starting GPS drift detection job');

    const trace = this.opikService.createTrace({
      name: 'gps_drift_detection_job',
      input: { trigger: 'cron', schedule: '0 7 * * *' },
      metadata: { job: 'gps-drift-detection', version: '1.0' },
      tags: ['gps', 'cron', 'drift-detection'],
    });

    let totalUsers = 0;
    let driftsDetected = 0;
    let notificationsSent = 0;

    try {
      // Get distinct user IDs from active budgets
      const userBudgets = await this.prisma.budget.findMany({
        where: { isActive: true },
        select: { userId: true },
        distinct: ['userId'],
      });

      totalUsers = userBudgets.length;

      for (const { userId } of userBudgets) {
        try {
          const drifts = await this.budgetService.findCategoriesWithDrift(userId);

          for (const drift of drifts) {
            driftsDetected++;

            const notification = await this.notificationService.createDriftNotification(
              userId,
              drift.categoryId,
              drift.categoryName,
              drift.velocity.velocityRatio,
              drift.velocity.projectedOverspendDate,
              drift.velocity.courseCorrectionDaily,
              drift.currency,
            );

            if (notification) {
              notificationsSent++;

              // Track analytics event
              await this.prisma.gpsAnalyticsEvent.create({
                data: {
                  userId,
                  eventType: GpsEventType.DRIFT_DETECTED,
                  eventData: {
                    categoryId: drift.categoryId,
                    categoryName: drift.categoryName,
                    velocityRatio: drift.velocity.velocityRatio,
                    projectedOverspendDate: drift.velocity.projectedOverspendDate?.toISOString() ?? null,
                    courseCorrectionDaily: drift.velocity.courseCorrectionDaily,
                    detectedBy: 'cron',
                  },
                },
              });
            }
          }
        } catch (error) {
          // Individual user failures don't break the batch
          this.logger.warn(
            `[runDriftDetection] Failed for user ${userId}: ${error}`,
          );
        }
      }

      const duration = Date.now() - startTime;

      this.opikService.endTrace(trace, {
        success: true,
        result: { totalUsers, driftsDetected, notificationsSent, durationMs: duration },
      });

      this.logger.log(
        `GPS drift detection completed: ${totalUsers} users scanned, ` +
          `${driftsDetected} drifts detected, ${notificationsSent} notifications sent (${duration}ms)`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`GPS drift detection job failed: ${errorMessage}`);
    } finally {
      await this.redisService.releaseLock(lockKey, lockValue);
      await this.opikService.flush();
    }
  }


  /**
   * Proactive forecast check job
   * Runs every 6 hours to check all users' spending velocity and send
   * forecast alerts for categories where projectedTotal > budget * 0.9
   * and daysElapsed > 5 (to avoid early-period noise).
   *
   * Schedule: '0 every-6-hours'
   */
  @Cron('0 */6 * * *', {
    name: 'gps-forecast-check',
    timeZone: 'UTC',
  })
  async runForecastCheck(): Promise<void> {
    const lockKey = 'gps:cron:forecast-check';
    const lockValue = randomUUID();
    const startTime = Date.now();

    const lockAcquired = await this.redisService.acquireLock(
      lockKey,
      5 * 60 * 1000, // 5 min TTL
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('GPS forecast check job skipped: another instance is already processing');
      return;
    }

    this.logger.log('Starting GPS forecast check job');

    const trace = this.opikService.createTrace({
      name: 'gps_forecast_check_job',
      input: { trigger: 'cron', schedule: '0 */6 * * *' },
      metadata: { job: 'gps-forecast-check', version: '1.0' },
      tags: ['gps', 'cron', 'forecast'],
    });

    let totalUsers = 0;
    let forecastsChecked = 0;
    let notificationsSent = 0;

    try {
      // Get distinct user IDs from active budgets
      const userBudgets = await this.prisma.budget.findMany({
        where: { isActive: true },
        select: { userId: true },
        distinct: ['userId'],
      });

      totalUsers = userBudgets.length;

      for (const { userId } of userBudgets) {
        try {
          const forecasts = await this.budgetService.getAllProactiveForecasts(userId);

          for (const forecast of forecasts) {
            forecastsChecked++;

            // Only alert when:
            // 1. projectedTotal > budget * 0.9 (projected to exceed 90% of budget)
            // 2. We need to figure out daysElapsed > 5
            const periodStart = this.budgetService.getPeriodStartDate('MONTHLY');
            const now = new Date();
            const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)));

            if (forecast.projectedTotal > forecast.budgeted * 0.9 && daysElapsed > 5) {
              const notification = await this.notificationService.createForecastNotification(
                userId,
                forecast.categoryId,
                forecast.categoryName,
                forecast.projectedTotal,
                forecast.budgeted,
                forecast.suggestedDailyLimit,
                forecast.currency,
              );

              if (notification) {
                notificationsSent++;
              }
            }
          }
        } catch (error) {
          // Individual user failures don't break the batch
          this.logger.warn(
            `[runForecastCheck] Failed for user ${userId}: ${error}`,
          );
        }
      }

      const duration = Date.now() - startTime;

      this.opikService.endTrace(trace, {
        success: true,
        result: { totalUsers, forecastsChecked, notificationsSent, durationMs: duration },
      });

      this.logger.log(
        `GPS forecast check completed: ${totalUsers} users scanned, ` +
          `${forecastsChecked} forecasts checked, ${notificationsSent} notifications sent (${duration}ms)`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`GPS forecast check job failed: ${errorMessage}`);
    } finally {
      await this.redisService.releaseLock(lockKey, lockValue);
      await this.opikService.flush();
    }
  }

  /**
   * Weekly recovery progress check
   * Runs every Sunday at 9 AM UTC timezone
   *
   * Checks all active recovery sessions for progress and:
   * - Marks completed sessions (endDate passed) as COMPLETED or records adherence
   * - Sends notification with results
   *
   * Schedule: '0 9 * * 0'
   */
  @Cron('0 9 * * 0', {
    name: 'gps-recovery-progress-check',
    timeZone: 'UTC',
  })
  async runRecoveryProgressCheck(): Promise<void> {
    const lockKey = 'gps:cron:recovery-progress';
    const lockValue = randomUUID();
    const startTime = Date.now();

    const lockAcquired = await this.redisService.acquireLock(
      lockKey,
      5 * 60 * 1000,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('GPS recovery progress check skipped: another instance is already processing');
      return;
    }

    this.logger.log('Starting GPS weekly recovery progress check');

    let sessionsChecked = 0;
    let completedSessions = 0;
    let notificationsSent = 0;

    try {
      // Find all active sessions (PATH_SELECTED or IN_PROGRESS) with a selected path
      const activeSessions = await this.prisma.recoverySession.findMany({
        where: {
          status: { in: [RecoveryStatus.PATH_SELECTED, RecoveryStatus.IN_PROGRESS] },
          selectedPathId: { not: null },
          selectedAt: { not: null },
        },
        select: {
          id: true,
          userId: true,
          category: true,
          selectedPathId: true,
          selectedAt: true,
          overspendAmount: true,
        },
        take: 200,
      });

      for (const session of activeSessions) {
        sessionsChecked++;
        try {
          const progress = await this.gpsService.getRecoveryProgress(session.userId, session.id);

          // If session is completed or failed, update its status
          if (progress.status === 'completed' || progress.status === 'failed') {
            completedSessions++;
            await this.prisma.recoverySession.update({
              where: { id: session.id },
              data: {
                status: RecoveryStatus.COMPLETED,
                updatedAt: new Date(),
              },
            });

            // Send notification with results
            await this.notificationService.createBudgetNotification(
              session.userId,
              session.category,
              session.category,
              'BUDGET_WARNING',
              0,
            );
            notificationsSent++;
          }
        } catch (error) {
          this.logger.warn(
            `[runRecoveryProgressCheck] Failed for session ${session.id}: ${error}`,
          );
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `GPS recovery progress check completed: ${sessionsChecked} sessions checked, ` +
        `${completedSessions} completed, ${notificationsSent} notifications sent (${duration}ms)`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GPS recovery progress check failed: ${errorMessage}`);
    } finally {
      await this.redisService.releaseLock(lockKey, lockValue);
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
      timezone: 'UTC',
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
