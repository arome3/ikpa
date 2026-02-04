/**
 * Import Cron Service
 *
 * Background jobs for import processing:
 * - Retry failed jobs
 * - Clean up old completed jobs
 * - Process stuck jobs
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImportJobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { LocalStorageAdapter } from './storage';

@Injectable()
export class ImportCronService {
  private readonly logger = new Logger(ImportCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageAdapter,
  ) {}

  /**
   * Clean up old completed/failed jobs and their files
   * Runs daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldJobs(): Promise<void> {
    this.logger.log('Starting import job cleanup...');

    try {
      // Find jobs older than 30 days that are completed or failed
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldJobs = await this.prisma.importJob.findMany({
        where: {
          status: {
            in: [ImportJobStatus.COMPLETED, ImportJobStatus.FAILED],
          },
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
        select: {
          id: true,
          storagePath: true,
        },
      });

      this.logger.log(`Found ${oldJobs.length} old jobs to clean up`);

      // Delete files and jobs
      let deletedFiles = 0;
      let deletedJobs = 0;

      for (const job of oldJobs) {
        try {
          // Delete stored file if exists
          if (job.storagePath) {
            const exists = await this.storage.exists(job.storagePath);
            if (exists) {
              await this.storage.delete(job.storagePath);
              deletedFiles++;
            }
          }

          // Delete job and transactions (cascade)
          await this.prisma.importJob.delete({
            where: { id: job.id },
          });
          deletedJobs++;
        } catch (error) {
          this.logger.warn(
            `Failed to clean up job ${job.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }
      }

      this.logger.log(
        `Cleanup complete: ${deletedJobs} jobs, ${deletedFiles} files deleted`,
      );
    } catch (error) {
      this.logger.error(
        `Job cleanup failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Handle stuck processing jobs
   * Runs every 15 minutes
   */
  @Cron('*/15 * * * *')
  async handleStuckJobs(): Promise<void> {
    try {
      // Find jobs stuck in PROCESSING for more than 30 minutes
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      const stuckJobs = await this.prisma.importJob.findMany({
        where: {
          status: ImportJobStatus.PROCESSING,
          updatedAt: {
            lt: thirtyMinutesAgo,
          },
        },
        select: {
          id: true,
          userId: true,
          source: true,
        },
      });

      if (stuckJobs.length === 0) {
        return;
      }

      this.logger.warn(`Found ${stuckJobs.length} stuck jobs`);

      // Mark them as failed
      for (const job of stuckJobs) {
        await this.prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: ImportJobStatus.FAILED,
            errorMessage: 'Processing timed out. Please try uploading again.',
          },
        });

        this.logger.log(`Marked stuck job ${job.id} as failed`);
      }
    } catch (error) {
      this.logger.error(
        `Stuck job handler failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Clean up abandoned import email addresses
   * Runs weekly on Sunday at 4 AM
   */
  @Cron('0 4 * * 0')
  async cleanupAbandonedEmails(): Promise<void> {
    this.logger.log('Starting abandoned email cleanup...');

    try {
      // Find email addresses not used in 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const abandonedEmails = await this.prisma.importEmailAddress.findMany({
        where: {
          OR: [
            {
              lastUsedAt: {
                lt: sixMonthsAgo,
              },
            },
            {
              lastUsedAt: null,
              createdAt: {
                lt: sixMonthsAgo,
              },
            },
          ],
        },
        select: {
          id: true,
          emailAddress: true,
        },
      });

      if (abandonedEmails.length === 0) {
        this.logger.log('No abandoned email addresses found');
        return;
      }

      this.logger.log(`Found ${abandonedEmails.length} abandoned email addresses`);

      // Deactivate (don't delete) for security audit trail
      await this.prisma.importEmailAddress.updateMany({
        where: {
          id: {
            in: abandonedEmails.map((e) => e.id),
          },
        },
        data: {
          isActive: false,
        },
      });

      this.logger.log(
        `Deactivated ${abandonedEmails.length} abandoned email addresses`,
      );
    } catch (error) {
      this.logger.error(
        `Abandoned email cleanup failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  /**
   * Generate import statistics for monitoring
   * Runs hourly
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateStats(): Promise<void> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      // Count jobs by status in last 24 hours
      const stats = await this.prisma.importJob.groupBy({
        by: ['status', 'source'],
        where: {
          createdAt: {
            gte: oneDayAgo,
          },
        },
        _count: true,
      });

      // Count total transactions created
      const transactionsCreated = await this.prisma.parsedTransaction.count({
        where: {
          status: 'CREATED',
          createdAt: {
            gte: oneDayAgo,
          },
        },
      });

      // Log summary
      const summary = stats.reduce(
        (acc, stat) => {
          acc[`${stat.source}_${stat.status}`] = stat._count;
          return acc;
        },
        {} as Record<string, number>,
      );

      this.logger.log(
        `Import stats (24h): ${JSON.stringify(summary)}, transactions created: ${transactionsCreated}`,
      );
    } catch (error) {
      this.logger.error(
        `Stats generation failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }
}
