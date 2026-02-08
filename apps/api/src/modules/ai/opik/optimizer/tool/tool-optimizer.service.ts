/**
 * Tool Optimizer Service
 *
 * GEPA-based optimizer for GPS Re-Router tool selection.
 * Learns optimal tool recommendations from historical data.
 *
 * Key Features:
 * - Pattern extraction from user selection history
 * - Rule generation with confidence scoring
 * - Profile-based tool recommendations
 * - Policy versioning and persistence
 * - Full Opik tracing with accuracy feedback
 *
 * Recovery Tools:
 * - time_adjustment: Extend goal deadline
 * - rate_adjustment: Increase savings rate
 * - freeze_protocol: Pause category spending
 *
 * @example
 * ```typescript
 * // Get tool recommendation
 * const recommendation = await toolOptimizer.recommendTool({
 *   incomeStability: 0.8,
 *   savingsRate: 0.15,
 *   dependencyRatio: 0.25,
 *   slipSeverity: 'moderate',
 * });
 * // { tool: 'rate_adjustment', confidence: 0.72 }
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { RedisService } from '../../../../../redis/redis.service';
import { OpikService } from '../../opik.service';
import { PatternAnalyzer } from './pattern-analyzer';
import { RuleGenerator } from './rule-generator';
import { AlertService } from '../alerting/alert.service';
import {
  IToolOptimizer,
  UserProfileFeatures,
  ProfileCondition,
  ToolSelectionRule,
  OptimizedToolPolicy,
  ToolSelectionRecord,
  ToolRecommendation,
} from '../interfaces';
import {
  RecoveryTool,
  RECOVERY_TOOLS,
  GEPA_DEFAULT_TOOL,
  TRACE_GEPA_OPTIMIZATION,
  SPAN_PATTERN_ANALYSIS,
  SPAN_RULE_GENERATION,
  FEEDBACK_TOOL_POLICY_ACCURACY,
} from '../optimizer.constants';

/** Redis cache key for tool optimizer policy */
const CACHE_KEY_POLICY = 'optimizer:tool:policy:current';

/** Cache TTL in seconds (1 hour) */
const CACHE_TTL_SECONDS = 3600;

/** Lock key for policy updates */
const LOCK_KEY_POLICY_UPDATE = 'optimizer:tool:policy:lock';

/** Lock TTL in milliseconds (30 seconds) */
const LOCK_TTL_MS = 30000;

@Injectable()
export class ToolOptimizerService implements IToolOptimizer {
  private readonly logger = new Logger(ToolOptimizerService.name);

  /**
   * Local in-memory cache for Redis fallback.
   * Used when Redis is unavailable (graceful degradation).
   */
  private localCachePolicy: OptimizedToolPolicy | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly opikService: OpikService,
    private readonly patternAnalyzer: PatternAnalyzer,
    private readonly ruleGenerator: RuleGenerator,
    private readonly alertService: AlertService,
  ) {}

  /**
   * Optimize tool selection based on historical data
   */
  async optimizeToolSelection(): Promise<OptimizedToolPolicy> {
    const experimentId = randomUUID();
    const startTime = Date.now();
    const version = `v${Date.now()}`;

    this.logger.log(`Starting GEPA optimization: ${experimentId}`);

    // Create database record
    await this.prisma.optimizerExperiment.create({
      data: {
        id: experimentId,
        type: 'GEPA',
        name: `tool-optimization-${experimentId.slice(0, 8)}`,
        config: { version },
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Create Opik trace
    const trace = this.opikService.createTrace({
      name: TRACE_GEPA_OPTIMIZATION,
      input: {
        experimentId,
        version,
      },
      metadata: {
        experimentType: 'gepa',
        recoveryTools: RECOVERY_TOOLS,
      },
      tags: ['optimizer', 'gepa', 'tool-selection'],
    });

    try {
      // Load historical data
      const historicalData = await this.loadHistoricalData();

      // Pattern analysis
      const patternSpan = trace
        ? this.opikService.createGeneralSpan({
            trace: trace.trace,
            name: SPAN_PATTERN_ANALYSIS,
            input: { dataSize: historicalData.length },
          })
        : null;

      const patterns = await this.patternAnalyzer.analyzePatterns(historicalData);

      if (patternSpan) {
        this.opikService.endSpan(patternSpan, {
          output: { patternsFound: patterns.length },
        });
      }

      // Rule generation
      const ruleSpan = trace
        ? this.opikService.createGeneralSpan({
            trace: trace.trace,
            name: SPAN_RULE_GENERATION,
            input: { patternsCount: patterns.length },
          })
        : null;

      let rules = this.ruleGenerator.generateRules(patterns);
      rules = this.ruleGenerator.validateRules(rules);
      rules = this.ruleGenerator.mergeRules(rules);

      if (ruleSpan) {
        this.opikService.endSpan(ruleSpan, {
          output: { rulesGenerated: rules.length },
        });
      }

      // Calculate policy metrics
      const coveragePercentage = this.calculateCoverage(rules, historicalData);
      const averageConfidence =
        rules.length > 0 ? rules.reduce((sum, r) => sum + r.confidence, 0) / rules.length : 0;

      // Create policy
      const policy: OptimizedToolPolicy = {
        version,
        rules,
        defaultTool: GEPA_DEFAULT_TOOL as RecoveryTool,
        metrics: {
          totalDataPoints: historicalData.length,
          coveragePercentage,
          averageConfidence,
        },
      };

      // Save rules and deactivate old ones atomically
      await this.prisma.$transaction(async (tx) => {
        // Save new rules
        await tx.toolSelectionRuleRecord.createMany({
          data: policy.rules.map((rule) => ({
            experimentId,
            version: policy.version,
            condition: rule.condition as unknown as Prisma.InputJsonValue,
            recommendedTool: rule.recommendedTool,
            confidence: rule.confidence,
            sampleSize: rule.sampleSize,
            successRate: rule.successRate,
            isActive: true,
          })),
        });

        // Deactivate old rules
        await tx.toolSelectionRuleRecord.updateMany({
          where: {
            version: { not: version },
            isActive: true,
          },
          data: { isActive: false },
        });
      });

      // Update cache (Redis with local fallback)
      await this.setCachedPolicy(policy);

      // Calculate and record accuracy
      const accuracy = await this.calculatePolicyAccuracy(policy, historicalData);

      if (trace) {
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: FEEDBACK_TOOL_POLICY_ACCURACY,
          value: accuracy,
          category: 'custom',
          comment: `Policy ${version}: ${rules.length} rules, ${(accuracy * 100).toFixed(1)}% accuracy`,
        });
      }

      // Update experiment
      const durationMs = Date.now() - startTime;
      await this.prisma.optimizerExperiment.update({
        where: { id: experimentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: {
            version,
            rulesCount: rules.length,
            accuracy,
            metrics: policy.metrics,
          },
        },
      });

      this.opikService.endTrace(trace, {
        success: true,
        result: {
          version,
          rulesCount: rules.length,
          accuracy,
          durationMs,
        },
      });

      this.logger.log(
        `GEPA optimization completed: ${rules.length} rules, ` +
          `${(accuracy * 100).toFixed(1)}% accuracy, ${(coveragePercentage * 100).toFixed(1)}% coverage`,
      );

      return policy;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.optimizerExperiment.update({
        where: { id: experimentId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: errorMessage,
        },
      });

      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`GEPA optimization failed: ${errorMessage}`);

      // Send alert for the failure
      await this.alertService.sendOptimizationFailure(
        experimentId,
        'GEPA',
        error instanceof Error ? error : errorMessage,
        {
          version,
        },
      );

      throw error;
    } finally {
      await this.opikService.flush();
    }
  }

  /**
   * Get tool recommendation for a user profile
   */
  async recommendTool(
    userProfile: UserProfileFeatures,
    policy?: OptimizedToolPolicy,
  ): Promise<ToolRecommendation> {
    // Validate input
    const validation = this.validateUserProfile(userProfile);
    if (!validation.valid) {
      this.logger.warn(`Invalid user profile: ${validation.errors.join(', ')}`);
      // Return default with low confidence for invalid input
      return {
        tool: GEPA_DEFAULT_TOOL as RecoveryTool,
        confidence: 0.3,
        alternatives: this.getDefaultAlternatives(GEPA_DEFAULT_TOOL as RecoveryTool),
      };
    }

    const activePolicy = policy ?? (await this.getActivePolicy());

    if (!activePolicy || activePolicy.rules.length === 0) {
      return {
        tool: GEPA_DEFAULT_TOOL as RecoveryTool,
        confidence: 0.5,
        alternatives: [],
      };
    }

    // Find matching rules
    const matchingRules = activePolicy.rules.filter((rule) =>
      this.matchesConditions(userProfile, rule.condition),
    );

    if (matchingRules.length === 0) {
      return {
        tool: activePolicy.defaultTool,
        confidence: 0.5,
        alternatives: this.getDefaultAlternatives(activePolicy.defaultTool),
      };
    }

    // Sort by confidence and get best match
    matchingRules.sort((a, b) => b.confidence - a.confidence);
    const bestRule = matchingRules[0];

    // Calculate alternatives from other matching rules
    const alternatives = matchingRules
      .slice(1)
      .filter((rule) => rule.recommendedTool !== bestRule.recommendedTool)
      .slice(0, 2)
      .map((rule) => ({
        tool: rule.recommendedTool,
        confidence: rule.confidence,
      }));

    return {
      tool: bestRule.recommendedTool,
      confidence: bestRule.confidence,
      matchedRuleId: bestRule.id,
      alternatives,
    };
  }

  /**
   * Record a tool selection for future learning
   */
  async recordSelection(record: ToolSelectionRecord): Promise<void> {
    await this.prisma.toolSelectionHistory.create({
      data: {
        userId: record.userId,
        sessionId: record.sessionId,
        selectedTool: record.selectedTool,
        userProfile: record.userProfile as unknown as Prisma.InputJsonValue,
        outcome: record.outcome as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.debug(
      `Recorded tool selection: ${record.selectedTool} for user ${record.userId}`,
    );
  }

  /**
   * Get the currently active policy
   *
   * Uses Redis-based distributed caching with local fallback.
   * This ensures consistent policy access across multiple service instances.
   */
  async getActivePolicy(): Promise<OptimizedToolPolicy | null> {
    // Try to get from Redis cache first
    const cachedPolicy = await this.getCachedPolicy();
    if (cachedPolicy) {
      return cachedPolicy;
    }

    // Load from database
    const policy = await this.loadPolicyFromDatabase();
    if (policy) {
      // Cache the loaded policy
      await this.setCachedPolicy(policy);
    }

    return policy;
  }

  /**
   * Refresh the policy cache
   *
   * Invalidates the current cache and reloads from database.
   * Uses distributed locking to prevent race conditions during refresh.
   *
   * @returns The refreshed policy or null if no active rules exist
   */
  async refreshPolicy(): Promise<OptimizedToolPolicy | null> {
    const lockValue = randomUUID();

    // Acquire lock for policy refresh
    const lockAcquired = await this.redisService.acquireLock(
      LOCK_KEY_POLICY_UPDATE,
      LOCK_TTL_MS,
      lockValue,
    );

    if (!lockAcquired) {
      this.logger.warn('Could not acquire lock for policy refresh, using existing cache');
      return this.getActivePolicy();
    }

    try {
      this.logger.log('Refreshing tool optimizer policy cache');

      // Invalidate cache
      await this.invalidateCache();

      // Load fresh policy from database
      const policy = await this.loadPolicyFromDatabase();

      if (policy) {
        // Cache the fresh policy
        await this.setCachedPolicy(policy);
        this.logger.log(`Policy cache refreshed: ${policy.version} with ${policy.rules.length} rules`);
      } else {
        this.logger.log('No active policy found during refresh');
      }

      return policy;
    } finally {
      // Release lock
      await this.redisService.releaseLock(LOCK_KEY_POLICY_UPDATE, lockValue);
    }
  }

  /**
   * Invalidate the policy cache
   *
   * Removes the cached policy from Redis and local cache.
   * Useful when policy needs to be reloaded on next access.
   */
  async invalidateCache(): Promise<void> {
    // Clear local cache
    this.localCachePolicy = null;

    // Clear Redis cache
    const deleted = await this.redisService.del(CACHE_KEY_POLICY);
    if (deleted) {
      this.logger.debug('Policy cache invalidated');
    }
  }

  /**
   * Get cached policy from Redis with local fallback
   */
  private async getCachedPolicy(): Promise<OptimizedToolPolicy | null> {
    // Try Redis first
    if (this.redisService.isAvailable()) {
      const cached = await this.redisService.get<OptimizedToolPolicy>(CACHE_KEY_POLICY);
      if (cached) {
        // Update local cache for fallback
        this.localCachePolicy = cached;
        return cached;
      }
    }

    // Fall back to local cache if Redis is unavailable
    if (this.localCachePolicy) {
      this.logger.debug('Using local cache fallback for policy');
      return this.localCachePolicy;
    }

    return null;
  }

  /**
   * Set cached policy in Redis with local fallback
   *
   * Uses atomic SET with TTL to ensure consistent expiration.
   */
  private async setCachedPolicy(policy: OptimizedToolPolicy): Promise<void> {
    // Always update local cache for fallback
    this.localCachePolicy = policy;

    // Try to set in Redis
    if (this.redisService.isAvailable()) {
      const success = await this.redisService.set(
        CACHE_KEY_POLICY,
        policy,
        CACHE_TTL_SECONDS,
      );

      if (success) {
        this.logger.debug(`Policy cached in Redis: ${policy.version} (TTL: ${CACHE_TTL_SECONDS}s)`);
      } else {
        this.logger.warn('Failed to cache policy in Redis, using local cache only');
      }
    } else {
      this.logger.warn('Redis unavailable, using local cache only');
    }
  }

  /**
   * Load policy from database
   */
  private async loadPolicyFromDatabase(): Promise<OptimizedToolPolicy | null> {
    const activeRules = await this.prisma.toolSelectionRuleRecord.findMany({
      where: { isActive: true },
      orderBy: { confidence: 'desc' },
    });

    if (activeRules.length === 0) {
      return null;
    }

    const version = activeRules[0].version;

    return {
      version,
      rules: activeRules.map((r) => ({
        id: r.id,
        condition: r.condition as unknown as ProfileCondition[],
        recommendedTool: r.recommendedTool as RecoveryTool,
        confidence: r.confidence,
        sampleSize: r.sampleSize,
        successRate: r.successRate,
      })),
      defaultTool: GEPA_DEFAULT_TOOL as RecoveryTool,
      metrics: {
        totalDataPoints: 0,
        coveragePercentage: 0,
        averageConfidence:
          activeRules.reduce((sum, r) => sum + r.confidence, 0) / activeRules.length,
      },
    };
  }

  /**
   * Load historical selection data
   */
  private async loadHistoricalData(): Promise<ToolSelectionRecord[]> {
    const records = await this.prisma.toolSelectionHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit to recent records
    });

    return records.map((r) => ({
      userId: r.userId,
      sessionId: r.sessionId,
      selectedTool: r.selectedTool as RecoveryTool,
      userProfile: r.userProfile as unknown as UserProfileFeatures,
      outcome: r.outcome as unknown as { success: boolean; recoveryDays?: number; finalProbability?: number },
    }));
  }

  /**
   * Validate user profile features
   * Ensures all values are within expected ranges
   */
  private validateUserProfile(profile: UserProfileFeatures): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate continuous features are in 0-1 range
    if (profile.incomeStability < 0 || profile.incomeStability > 1) {
      errors.push(`incomeStability must be 0-1, got ${profile.incomeStability}`);
    }
    if (profile.savingsRate < 0 || profile.savingsRate > 1) {
      errors.push(`savingsRate must be 0-1, got ${profile.savingsRate}`);
    }
    if (profile.dependencyRatio < 0 || profile.dependencyRatio > 1) {
      errors.push(`dependencyRatio must be 0-1, got ${profile.dependencyRatio}`);
    }

    // Validate categorical feature
    const validSeverities = ['minor', 'moderate', 'severe'];
    if (!validSeverities.includes(profile.slipSeverity)) {
      errors.push(`slipSeverity must be one of ${validSeverities.join(', ')}, got ${profile.slipSeverity}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Calculate coverage percentage
   */
  private calculateCoverage(rules: ToolSelectionRule[], data: ToolSelectionRecord[]): number {
    if (data.length === 0) return 0;

    let covered = 0;
    for (const record of data) {
      const hasMatch = rules.some((rule) =>
        this.matchesConditions(record.userProfile, rule.condition),
      );
      if (hasMatch) covered++;
    }

    return covered / data.length;
  }

  /**
   * Get the historical success rate of a specific tool for similar user profiles.
   *
   * In a multi-armed bandit scenario, different tools may perform well for the same
   * profile type. This method calculates how well a specific tool has historically
   * performed for profiles similar to the given one.
   *
   * @param tool - The recovery tool to evaluate
   * @param profile - The user profile features to match against
   * @param data - Historical tool selection records
   * @returns The success rate (0-1) of the tool for similar profiles, or null if no data
   *
   * @example
   * ```typescript
   * const rate = this.getHistoricalToolSuccessRate(
   *   'rate_adjustment',
   *   { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' },
   *   historicalRecords
   * );
   * // Returns 0.75 if 75% of similar profiles succeeded with rate_adjustment
   * ```
   */
  private getHistoricalToolSuccessRate(
    tool: RecoveryTool,
    profile: UserProfileFeatures,
    data: ToolSelectionRecord[],
  ): number | null {
    // Filter records that used this tool and have similar profile characteristics
    // "Similar" means same severity category and within tolerance for numeric features
    const NUMERIC_TOLERANCE = 0.2; // Consider profiles within 20% as similar

    const similarRecords = data.filter((record) => {
      if (record.selectedTool !== tool) return false;

      // Must have same slip severity (categorical)
      if (record.userProfile.slipSeverity !== profile.slipSeverity) return false;

      // Check numeric features are within tolerance
      const incomeClose =
        Math.abs(record.userProfile.incomeStability - profile.incomeStability) <= NUMERIC_TOLERANCE;
      const savingsClose =
        Math.abs(record.userProfile.savingsRate - profile.savingsRate) <= NUMERIC_TOLERANCE;
      const dependencyClose =
        Math.abs(record.userProfile.dependencyRatio - profile.dependencyRatio) <= NUMERIC_TOLERANCE;

      // Require at least 2 of 3 numeric features to be close
      const closeCount = [incomeClose, savingsClose, dependencyClose].filter(Boolean).length;
      return closeCount >= 2;
    });

    if (similarRecords.length === 0) {
      return null;
    }

    const successes = similarRecords.filter((r) => r.outcome.success).length;
    return successes / similarRecords.length;
  }

  /**
   * Calculate policy accuracy on historical data using multi-armed bandit aware scoring.
   *
   * In a multi-armed bandit scenario, multiple tools can be "correct" for a given profile.
   * This method avoids penalizing the policy when the user succeeded with a different tool
   * that has a good historical success rate for that profile type.
   *
   * **Scoring Formula:**
   *
   * | Policy matches user | Outcome | Score | Rationale |
   * |---------------------|---------|-------|-----------|
   * | Yes | Success | 1.0 | Perfect agreement on a working choice |
   * | Yes | Failure | 0.0 | Both agreed on a failing choice |
   * | No | Success, user tool >= policy tool rate | 0.8 | Acceptable disagreement - user's choice equally valid |
   * | No | Success, user tool < policy tool rate | 0.5 | Policy might be better, but user succeeded |
   * | No | Failure, policy tool > user tool rate | 0.7 | Policy would have recommended better |
   * | No | Failure, policy tool <= user tool rate | 0.3 | Disagreement with no clear winner |
   *
   * @param policy - The optimized tool policy to evaluate
   * @param data - Historical tool selection records
   * @returns Weighted accuracy score between 0 and 1
   */
  private async calculatePolicyAccuracy(
    policy: OptimizedToolPolicy,
    data: ToolSelectionRecord[],
  ): Promise<number> {
    if (data.length === 0) return 0;

    let weightedScore = 0;
    let totalWeight = 0;

    for (const record of data) {
      const recommendation = await this.recommendTool(record.userProfile, policy);
      const weight = recommendation.confidence > 0.5 ? 1.5 : 1; // Weight confident recommendations higher
      totalWeight += weight;

      if (recommendation.tool === record.selectedTool) {
        // Policy agrees with user choice
        if (record.outcome.success) {
          // User chose right, policy agrees = perfect
          weightedScore += weight * 1.0;
        } else {
          // User chose wrong, policy also suggested wrong = bad
          weightedScore += weight * 0.0;
        }
      } else {
        // Policy disagrees with user choice
        const policyToolRate = this.getHistoricalToolSuccessRate(
          recommendation.tool,
          record.userProfile,
          data,
        );
        const userToolRate = this.getHistoricalToolSuccessRate(
          record.selectedTool,
          record.userProfile,
          data,
        );

        if (record.outcome.success) {
          // User was successful with different tool
          // In multi-armed bandit, multiple tools can be "correct" for a profile
          if (userToolRate !== null && policyToolRate !== null) {
            if (userToolRate >= policyToolRate) {
              // User's tool is equally good or better - acceptable disagreement
              weightedScore += weight * 0.8;
            } else {
              // User succeeded but policy's tool historically performs better
              // Give partial credit - user still succeeded
              weightedScore += weight * 0.5;
            }
          } else {
            // Insufficient data to compare - give benefit of doubt since user succeeded
            weightedScore += weight * 0.6;
          }
        } else {
          // User failed - check if policy's recommended tool would have been better
          if (policyToolRate !== null && userToolRate !== null) {
            if (policyToolRate > userToolRate) {
              // Policy would have suggested a better tool
              weightedScore += weight * 0.7;
            } else {
              // Policy's tool isn't demonstrably better - disagreement with no clear winner
              weightedScore += weight * 0.3;
            }
          } else if (policyToolRate !== null && policyToolRate > 0.5) {
            // We have data for policy's tool and it's decent
            weightedScore += weight * 0.5;
          } else {
            // Insufficient data - neutral score
            weightedScore += weight * 0.3;
          }
        }
      }
    }

    return totalWeight > 0 ? weightedScore / totalWeight : 0;
  }

  /**
   * Check if profile matches conditions
   */
  private matchesConditions(profile: UserProfileFeatures, conditions: ProfileCondition[]): boolean {
    for (const condition of conditions) {
      const value = profile[condition.feature];

      switch (condition.operator) {
        case 'eq':
          if (value !== condition.value) return false;
          break;
        case 'gt':
          if (typeof value !== 'number' || value <= (condition.value as number)) return false;
          break;
        case 'lt':
          if (typeof value !== 'number' || value >= (condition.value as number)) return false;
          break;
        case 'gte':
          if (typeof value !== 'number' || value < (condition.value as number)) return false;
          break;
        case 'lte':
          if (typeof value !== 'number' || value > (condition.value as number)) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !(condition.value as unknown[]).includes(value)) return false;
          break;
      }
    }

    return true;
  }

  /**
   * Get default alternatives when no rules match
   */
  private getDefaultAlternatives(
    defaultTool: RecoveryTool,
  ): Array<{ tool: RecoveryTool; confidence: number }> {
    return RECOVERY_TOOLS.filter((tool) => tool !== defaultTool).map((tool) => ({
      tool,
      confidence: 0.3,
    }));
  }
}
