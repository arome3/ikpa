/**
 * Tool Optimizer Cron Service
 *
 * Scheduled tasks for running GEPA tool selection optimization.
 * Runs weekly on Sunday at 4:00 AM WAT (Africa/Lagos).
 *
 * Training data is loaded from the database via DatasetService.
 * Historical tool selection data is also stored in ToolSelectionHistory.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../../../redis';
import { ToolOptimizerService } from './tool-optimizer.service';
import { OptimizedToolPolicy } from '../interfaces';
import { OPTIMIZER_CRON_LOCK_TTL_MS, OPTIMIZER_LOCK_PREFIX } from '../optimizer.constants';
import { DatasetService } from '../dataset';

/** Lock TTL in human-readable format for logging */
const LOCK_TTL_MINUTES = OPTIMIZER_CRON_LOCK_TTL_MS / 60000;

@Injectable()
export class ToolOptimizerCronService {
  private readonly logger = new Logger(ToolOptimizerCronService.name);
  private readonly LOCK_KEY = `${OPTIMIZER_LOCK_PREFIX}:tool`;

  constructor(
    private readonly redisService: RedisService,
    private readonly toolOptimizer: ToolOptimizerService,
    private readonly datasetService: DatasetService,
  ) {}

  /**
   * Safely release a distributed lock, handling Redis failures gracefully.
   *
   * If Redis is unavailable during lock release, the lock will automatically
   * expire after the TTL (${LOCK_TTL_MINUTES} minutes). This is an acceptable
   * recovery mechanism since:
   * 1. The operation has already completed (successfully or with error)
   * 2. The TTL ensures the lock won't be held indefinitely
   * 3. Other instances will be able to acquire the lock after TTL expiry
   *
   * @param lockKey - The Redis lock key
   * @param lockValue - The unique lock value for ownership verification
   */
  private async safeReleaseLock(lockKey: string, lockValue: string): Promise<void> {
    try {
      await this.redisService.releaseLock(lockKey, lockValue);
    } catch (error) {
      // Lock release failure is recoverable - the lock will auto-expire after TTL.
      // Log as WARN (not ERROR) since this is a degraded but acceptable state.
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to release lock "${lockKey}" (value: ${lockValue}): ${errorMessage}. ` +
          `Lock will auto-expire in ${LOCK_TTL_MINUTES} minutes via TTL.`,
      );
    }
  }

  /**
   * Weekly optimization - runs Sunday at 4:00 AM Africa/Lagos time
   *
   * Analyzes the week's tool selection history to:
   * 1. Extract patterns from successful/unsuccessful selections
   * 2. Generate new rules for tool recommendations
   * 3. Update the active policy
   *
   * This ensures the GPS Re-Router learns from user behavior
   * and improves recommendations over time.
   */
  @Cron('0 4 * * 0', {
    name: 'tool-optimizer-weekly',
    timeZone: 'Africa/Lagos',
  })
  async runWeeklyOptimization(): Promise<OptimizedToolPolicy | null> {
    const lockValue = randomUUID();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      OPTIMIZER_CRON_LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('Tool optimizer skipped: another instance is processing');
      return null;
    }

    this.logger.log('Starting weekly tool selection optimization');

    try {
      // Load any supplementary training data from database
      const supplementaryData = await this.loadSupplementaryTrainingData();
      if (supplementaryData && supplementaryData.length > 0) {
        this.logger.log(`Loaded ${supplementaryData.length} supplementary training items`);
      }

      const policy = await this.toolOptimizer.optimizeToolSelection();

      this.logger.log(
        `Weekly tool optimization completed: ` +
          `${policy.rules.length} rules, ` +
          `${(policy.metrics.coveragePercentage * 100).toFixed(1)}% coverage, ` +
          `${(policy.metrics.averageConfidence * 100).toFixed(1)}% avg confidence`,
      );

      return policy;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Weekly tool optimization failed: ${errorMessage}`);
      return null;
    } finally {
      await this.safeReleaseLock(this.LOCK_KEY, lockValue);
    }
  }

  /**
   * Load supplementary training data from database
   *
   * This complements the historical ToolSelectionHistory data
   * with any curated training examples stored as datasets.
   *
   * @returns Array of training data items or null
   */
  private async loadSupplementaryTrainingData(): Promise<unknown[] | null> {
    try {
      const dataset = await this.datasetService.getActiveToolDataset();
      return dataset;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to load supplementary tool training data: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get the current supplementary training dataset (for inspection/debugging)
   */
  async getSupplementaryDataset(): Promise<unknown[] | null> {
    return this.loadSupplementaryTrainingData();
  }

  /**
   * Manually trigger optimization (for testing/admin)
   */
  async triggerManualOptimization(): Promise<OptimizedToolPolicy> {
    return this.toolOptimizer.optimizeToolSelection();
  }

  /**
   * Get the current active policy
   */
  async getActivePolicy(): Promise<OptimizedToolPolicy | null> {
    return this.toolOptimizer.getActivePolicy();
  }

  /**
   * Get job status for health checks
   */
  getJobStatus(): {
    jobName: string;
    schedule: string;
    timezone: string;
    description: string;
  } {
    return {
      jobName: 'tool-optimizer-weekly',
      schedule: '0 4 * * 0',
      timezone: 'Africa/Lagos',
      description: 'Weekly GEPA optimization for GPS Re-Router tool selection',
    };
  }
}
