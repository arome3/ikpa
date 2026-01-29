/**
 * Framing Optimizer Cron Service
 *
 * Scheduled tasks for running framing A/B experiments.
 * Runs weekly on Monday at 2:00 AM WAT (Africa/Lagos).
 *
 * Datasets are loaded from the database via DatasetService.
 * Use the seeding mechanism or API to populate datasets.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../../../redis';
import { FramingOptimizerService } from './framing-optimizer.service';
import { FramingExperimentConfig, FramingExperimentResult, FramingDatasetItem } from '../interfaces';
import { OPTIMIZER_CRON_LOCK_TTL_MS, OPTIMIZER_LOCK_PREFIX } from '../optimizer.constants';
import { DatasetService } from '../dataset';
import { OpikDatasetService } from '../opik-dataset';

/** Lock TTL in human-readable format for logging */
const LOCK_TTL_MINUTES = OPTIMIZER_CRON_LOCK_TTL_MS / 60000;

/**
 * Default experiment configuration for Shark Auditor framing test
 * Note: datasetName is used for logging; actual data comes from DatasetService
 */
const SHARK_AUDITOR_EXPERIMENT: FramingExperimentConfig = {
  name: 'shark-auditor-monthly-vs-annual',
  baselinePrompt: `You found a subscription: {{name}}
Monthly cost: {{monthly}}

Based on this subscription, should the user KEEP or CANCEL it?
Consider the monthly expense and provide a clear recommendation.`,
  variantPrompt: `You found a subscription: {{name}}
Monthly cost: {{monthly}}
Annual cost: {{annual}} ({{monthly}} × 12)

When you see the annual total, should the user KEEP or CANCEL it?
Consider the annual expense and provide a clear recommendation.`,
  datasetName: 'subscription_decisions',
  metricName: 'CancellationRate',
  nSamples: 50,
  maxRounds: 5,
};

/**
 * Fallback dataset used when no database dataset is available
 * This ensures the cron job doesn't fail during initial setup
 */
const FALLBACK_FRAMING_DATASET: FramingDatasetItem[] = [
  {
    name: 'Netflix Premium',
    monthly: '₦4,400',
    annual: '₦52,800',
    category: 'streaming',
  },
  {
    name: 'Spotify Family',
    monthly: '₦2,950',
    annual: '₦35,400',
    category: 'streaming',
  },
];

@Injectable()
export class FramingOptimizerCronService {
  private readonly logger = new Logger(FramingOptimizerCronService.name);
  private readonly LOCK_KEY = `${OPTIMIZER_LOCK_PREFIX}:framing`;

  constructor(
    private readonly redisService: RedisService,
    private readonly framingOptimizer: FramingOptimizerService,
    private readonly datasetService: DatasetService,
    private readonly opikDatasetService: OpikDatasetService,
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
   * Weekly framing experiment - runs Monday at 2:00 AM Africa/Lagos time
   *
   * Tests whether showing annual cost (vs just monthly) increases
   * cancellation rate for zombie subscriptions in Shark Auditor.
   *
   * Hypothesis: Showing ₦52,800/year has more psychological impact
   * than ₦4,400/month for the same Netflix subscription.
   */
  @Cron('0 2 * * 1', {
    name: 'framing-optimizer-weekly',
    timeZone: 'Africa/Lagos',
  })
  async runWeeklyFramingExperiment(): Promise<FramingExperimentResult | null> {
    const lockValue = randomUUID();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      OPTIMIZER_CRON_LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('Framing optimizer skipped: another instance is processing');
      return null;
    }

    this.logger.log('Starting weekly framing experiment');

    try {
      // Load dataset from database
      const dataset = await this.loadDataset();
      this.logger.log(`Loaded ${dataset.length} items for framing experiment`);

      const result = await this.framingOptimizer.runExperiment(SHARK_AUDITOR_EXPERIMENT);

      // Link dataset to experiment trace for visibility in Opik UI
      if (result.experimentId) {
        await this.opikDatasetService.linkDatasetToTrace({
          traceId: result.experimentId,
          datasetName: SHARK_AUDITOR_EXPERIMENT.datasetName,
          context: {
            experimentType: 'framing',
            itemCount: dataset.length,
            winner: result.analysis.winner,
            improvement: result.analysis.improvement,
          },
        });
      }

      this.logger.log(
        `Weekly framing experiment completed: ` +
          `winner=${result.analysis.winner || 'inconclusive'}, ` +
          `improvement=${result.analysis.improvement.toFixed(2)}%, ` +
          `p-value=${result.analysis.pValue.toFixed(4)}`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Weekly framing experiment failed: ${errorMessage}`);
      return null;
    } finally {
      await this.safeReleaseLock(this.LOCK_KEY, lockValue);
    }
  }

  /**
   * Load framing dataset from database with fallback
   *
   * @returns Array of framing dataset items
   */
  private async loadDataset(): Promise<FramingDatasetItem[]> {
    try {
      const dataset = await this.datasetService.getActiveFramingDataset();

      if (dataset && dataset.length > 0) {
        return dataset;
      }

      this.logger.warn('No active framing dataset found, using fallback');
      return FALLBACK_FRAMING_DATASET;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to load framing dataset: ${errorMessage}`);
      return FALLBACK_FRAMING_DATASET;
    }
  }

  /**
   * Get the current active dataset (for inspection/debugging)
   */
  async getActiveDataset(): Promise<FramingDatasetItem[]> {
    return this.loadDataset();
  }

  /**
   * Manually trigger the framing experiment (for testing/admin)
   *
   * @param config - Optional custom configuration
   */
  async triggerManualExperiment(
    config?: Partial<FramingExperimentConfig>,
  ): Promise<FramingExperimentResult> {
    const experimentConfig = {
      ...SHARK_AUDITOR_EXPERIMENT,
      ...config,
      name: config?.name || `manual-${SHARK_AUDITOR_EXPERIMENT.name}-${Date.now()}`,
    };

    return this.framingOptimizer.runExperiment(experimentConfig);
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
      jobName: 'framing-optimizer-weekly',
      schedule: '0 2 * * 1',
      timezone: 'Africa/Lagos',
      description: 'Weekly A/B test comparing monthly vs annual subscription framing',
    };
  }
}
