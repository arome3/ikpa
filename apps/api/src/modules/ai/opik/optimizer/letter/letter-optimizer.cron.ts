/**
 * Letter Optimizer Cron Service
 *
 * Scheduled tasks for running evolutionary prompt optimization.
 * Runs monthly on the 1st day at 3:00 AM UTC.
 *
 * Datasets are loaded from the database via DatasetService.
 * Use the seeding mechanism or API to populate datasets.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { RedisService } from '../../../../../redis';
import { LetterOptimizerService } from './letter-optimizer.service';
import { PopulationConfig, EvolutionResult, EvaluationDatasetItem } from '../interfaces';
import { OPTIMIZER_CRON_LOCK_TTL_MS, OPTIMIZER_LOCK_PREFIX } from '../optimizer.constants';
import { DatasetService } from '../dataset';

/** Lock TTL in human-readable format for logging */
const LOCK_TTL_MINUTES = OPTIMIZER_CRON_LOCK_TTL_MS / 60000;

/**
 * Base prompt for Future Self letters
 * This is the seed prompt that will be evolved
 */
const FUTURE_SELF_BASE_PROMPT = `Write a letter from {{name}}'s future self in the year 2045.

Current situation:
- Age: {{age}} years old
- Current savings rate: {{savingsRate}}%
- Projected net worth in 20 years at current rate: {{currentNetWorth}}
- Projected net worth with optimized savings: {{optimizedNetWorth}}

The letter should:
1. Be warm and encouraging, not judgmental
2. Acknowledge the challenges of saving consistently
3. Paint a vivid picture of future financial freedom
4. Gently encourage increasing the savings rate
5. Reference specific life milestones that money enables

Remember: This is a supportive friend, not a lecturing parent.`;

/**
 * Fallback evaluation dataset for letter optimization
 * Used when no database dataset is available
 */
const FALLBACK_LETTER_DATASET: EvaluationDatasetItem[] = [
  {
    input: {
      name: 'Chidi',
      age: 28,
      savingsRate: 10,
      currentNetWorth: '₦15,000,000',
      optimizedNetWorth: '₦45,000,000',
    },
  },
  {
    input: {
      name: 'Amara',
      age: 32,
      savingsRate: 5,
      currentNetWorth: '₦8,000,000',
      optimizedNetWorth: '₦35,000,000',
    },
  },
  {
    input: {
      name: 'Emeka',
      age: 25,
      savingsRate: 15,
      currentNetWorth: '₦25,000,000',
      optimizedNetWorth: '₦65,000,000',
    },
  },
  {
    input: {
      name: 'Ngozi',
      age: 35,
      savingsRate: 8,
      currentNetWorth: '₦12,000,000',
      optimizedNetWorth: '₦40,000,000',
    },
  },
  {
    input: {
      name: 'Tunde',
      age: 30,
      savingsRate: 3,
      currentNetWorth: '₦5,000,000',
      optimizedNetWorth: '₦28,000,000',
    },
  },
];

/**
 * Default configuration for monthly evolution
 */
const DEFAULT_EVOLUTION_CONFIG: Partial<PopulationConfig> = {
  populationSize: 10,
  generations: 5,
  survivalRate: 0.3,
  mutationRate: 0.2,
  elitismCount: 2,
};

@Injectable()
export class LetterOptimizerCronService {
  private readonly logger = new Logger(LetterOptimizerCronService.name);
  private readonly LOCK_KEY = `${OPTIMIZER_LOCK_PREFIX}:letter`;

  constructor(
    private readonly redisService: RedisService,
    private readonly letterOptimizer: LetterOptimizerService,
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
   * Monthly evolution run - runs on 1st of each month at 3:00 AM UTC time
   *
   * Evolves the Future Self letter prompt to maximize ToneEmpathy scores.
   * This creates progressively better prompts that resonate emotionally
   * with users while maintaining financial guidance.
   */
  @Cron('0 3 1 * *', {
    name: 'letter-optimizer-monthly',
    timeZone: 'UTC',
  })
  async runMonthlyEvolution(): Promise<EvolutionResult | null> {
    const lockValue = randomUUID();

    // Try to acquire distributed lock
    const lockAcquired = await this.redisService.acquireLock(
      this.LOCK_KEY,
      OPTIMIZER_CRON_LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.debug('Letter optimizer skipped: another instance is processing');
      return null;
    }

    this.logger.log('Starting monthly letter evolution');

    try {
      // Load dataset from database
      const dataset = await this.loadDataset();
      this.logger.log(`Loaded ${dataset.length} items for letter evolution`);

      const result = await this.letterOptimizer.evolvePrompt(
        FUTURE_SELF_BASE_PROMPT,
        dataset,
        DEFAULT_EVOLUTION_CONFIG,
      );

      this.logger.log(
        `Monthly letter evolution completed: ` +
          `best fitness=${result.bestPrompt.fitness.toFixed(2)}, ` +
          `improvement=${result.improvementPercentage.toFixed(2)}%`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Monthly letter evolution failed: ${errorMessage}`);
      return null;
    } finally {
      await this.safeReleaseLock(this.LOCK_KEY, lockValue);
    }
  }

  /**
   * Load letter dataset from database with fallback
   *
   * @returns Array of evaluation dataset items
   */
  private async loadDataset(): Promise<EvaluationDatasetItem[]> {
    try {
      const dataset = await this.datasetService.getActiveLetterDataset();

      if (dataset && dataset.length > 0) {
        return dataset;
      }

      this.logger.warn('No active letter dataset found, using fallback');
      return FALLBACK_LETTER_DATASET;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to load letter dataset: ${errorMessage}`);
      return FALLBACK_LETTER_DATASET;
    }
  }

  /**
   * Manually trigger evolution (for testing/admin)
   *
   * @param basePrompt - Optional custom base prompt
   * @param dataset - Optional custom dataset (uses database dataset if not provided)
   * @param config - Optional custom configuration
   */
  async triggerManualEvolution(
    basePrompt?: string,
    dataset?: EvaluationDatasetItem[],
    config?: Partial<PopulationConfig>,
  ): Promise<EvolutionResult> {
    const evaluationDataset = dataset ?? (await this.loadDataset());

    return this.letterOptimizer.evolvePrompt(
      basePrompt ?? FUTURE_SELF_BASE_PROMPT,
      evaluationDataset,
      config ?? DEFAULT_EVOLUTION_CONFIG,
    );
  }

  /**
   * Get the current base prompt
   */
  getBasePrompt(): string {
    return FUTURE_SELF_BASE_PROMPT;
  }

  /**
   * Get the evaluation dataset from database
   */
  async getEvaluationDataset(): Promise<EvaluationDatasetItem[]> {
    return this.loadDataset();
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
      jobName: 'letter-optimizer-monthly',
      schedule: '0 3 1 * *',
      timezone: 'UTC',
      description: 'Monthly evolutionary optimization of Future Self letter prompts',
    };
  }
}
