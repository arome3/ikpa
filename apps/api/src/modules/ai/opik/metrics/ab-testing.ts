/**
 * A/B Testing Support for Metrics
 *
 * Enables running experiments with different evaluation criteria variants.
 * Supports deterministic assignment by user/trace ID for consistent experiences.
 *
 * Features:
 * - Register A/B tests with multiple variants
 * - Deterministic variant selection by user/trace ID
 * - Track results per variant
 * - Export comparison statistics
 *
 * @example
 * ```typescript
 * const manager = new ABTestManager();
 *
 * // Register a test
 * manager.registerTest({
 *   name: 'tone-strictness',
 *   variants: [
 *     { id: 'control', weight: 50, criteria: { threshold: 0.7 } },
 *     { id: 'strict', weight: 50, criteria: { threshold: 0.85 } },
 *   ],
 *   enabled: true,
 * });
 *
 * // Select variant for a user
 * const variant = manager.selectVariant('tone-strictness', 'user-123');
 *
 * // Track results
 * manager.trackResult('tone-strictness', variant.id, { score: 4.2, passed: true });
 * ```
 */

import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Variant configuration for A/B tests
 */
export interface ABTestVariant {
  /** Unique identifier for this variant */
  id: string;

  /** Weight for selection (0-100, relative to other variants) */
  weight: number;

  /**
   * Criteria overrides for this variant
   * Type is flexible to support different metric configurations
   */
  criteria: Record<string, unknown>;
}

/**
 * A/B test configuration
 */
export interface ABTestConfig {
  /** Unique name for the test */
  name: string;

  /** List of variants with weights */
  variants: ABTestVariant[];

  /** Whether the test is currently active */
  enabled: boolean;

  /** Optional description */
  description?: string;

  /** Optional start date */
  startDate?: Date;

  /** Optional end date */
  endDate?: Date;
}

/**
 * Result tracking for a single evaluation
 */
export interface ABTestResult {
  /** Test name */
  testName: string;

  /** Variant ID */
  variantId: string;

  /** Evaluation score */
  score: number;

  /** Whether evaluation passed */
  passed: boolean;

  /** Timestamp */
  timestamp: Date;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated statistics per variant
 */
export interface VariantStats {
  /** Variant ID */
  variantId: string;

  /** Total number of evaluations */
  count: number;

  /** Number of passed evaluations */
  passCount: number;

  /** Number of failed evaluations */
  failCount: number;

  /** Pass rate (0-1) */
  passRate: number;

  /** Average score */
  averageScore: number;

  /** Standard deviation of scores */
  scoreStdDev: number;

  /** Min score */
  minScore: number;

  /** Max score */
  maxScore: number;
}

/**
 * Comparison statistics between variants
 */
export interface ABTestComparisonStats {
  /** Test name */
  testName: string;

  /** Per-variant statistics */
  variants: VariantStats[];

  /** Total evaluations across all variants */
  totalEvaluations: number;

  /** Statistical significance (if enough data) */
  isSignificant?: boolean;

  /** Winning variant (if significant) */
  winningVariant?: string;

  /** Time period */
  periodStart?: Date;

  /** Time period end */
  periodEnd?: Date;
}

/**
 * A/B Test Manager
 *
 * Manages A/B test registration, variant selection, and result tracking.
 * Uses deterministic hashing for consistent variant assignment.
 */
export class ABTestManager {
  private readonly logger = new Logger(ABTestManager.name);
  private readonly tests = new Map<string, ABTestConfig>();
  private readonly results = new Map<string, ABTestResult[]>();

  /**
   * Maximum results to keep in memory per test
   * Prevents unbounded memory growth
   */
  private readonly maxResultsPerTest: number;

  constructor(options: { maxResultsPerTest?: number } = {}) {
    this.maxResultsPerTest = options.maxResultsPerTest ?? 10000;
  }

  /**
   * Register a new A/B test
   *
   * @param config - Test configuration
   * @throws Error if test with same name already exists
   */
  registerTest(config: ABTestConfig): void {
    // Validate configuration
    this.validateTestConfig(config);

    if (this.tests.has(config.name)) {
      this.logger.warn(`A/B test "${config.name}" already exists, updating configuration`);
    }

    this.tests.set(config.name, config);
    this.results.set(config.name, []);

    this.logger.log(
      `Registered A/B test "${config.name}" with ${config.variants.length} variants`,
    );
  }

  /**
   * Unregister an A/B test
   *
   * @param testName - Name of the test to remove
   * @returns true if test was removed, false if it didn't exist
   */
  unregisterTest(testName: string): boolean {
    const deleted = this.tests.delete(testName);
    this.results.delete(testName);

    if (deleted) {
      this.logger.log(`Unregistered A/B test "${testName}"`);
    }

    return deleted;
  }

  /**
   * Get a registered test configuration
   *
   * @param testName - Name of the test
   * @returns Test configuration or undefined if not found
   */
  getTest(testName: string): ABTestConfig | undefined {
    return this.tests.get(testName);
  }

  /**
   * Get all registered tests
   *
   * @returns Array of test configurations
   */
  getAllTests(): ABTestConfig[] {
    return Array.from(this.tests.values());
  }

  /**
   * Enable or disable a test
   *
   * @param testName - Name of the test
   * @param enabled - Whether to enable or disable
   * @returns true if test was updated, false if not found
   */
  setTestEnabled(testName: string, enabled: boolean): boolean {
    const test = this.tests.get(testName);
    if (!test) {
      return false;
    }

    test.enabled = enabled;
    this.logger.log(`A/B test "${testName}" ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  /**
   * Select a variant for a user/trace ID
   *
   * Uses deterministic hashing so the same ID always gets the same variant.
   *
   * @param testName - Name of the test
   * @param identifier - User ID, trace ID, or any consistent identifier
   * @returns Selected variant or undefined if test not found/disabled
   */
  selectVariant(testName: string, identifier: string): ABTestVariant | undefined {
    const test = this.tests.get(testName);

    if (!test) {
      this.logger.warn(`A/B test "${testName}" not found`);
      return undefined;
    }

    if (!test.enabled) {
      this.logger.debug(`A/B test "${testName}" is disabled`);
      return undefined;
    }

    // Check date bounds
    const now = new Date();
    if (test.startDate && now < test.startDate) {
      this.logger.debug(`A/B test "${testName}" has not started yet`);
      return undefined;
    }
    if (test.endDate && now > test.endDate) {
      this.logger.debug(`A/B test "${testName}" has ended`);
      return undefined;
    }

    // Deterministic selection based on hash
    const hash = this.hashIdentifier(testName, identifier);
    const variant = this.selectByWeight(test.variants, hash);

    this.logger.debug(
      `Selected variant "${variant.id}" for test "${testName}" (identifier: ${identifier})`,
    );

    return variant;
  }

  /**
   * Track evaluation result for a variant
   *
   * @param testName - Name of the test
   * @param variantId - ID of the variant used
   * @param result - Evaluation result data
   */
  trackResult(
    testName: string,
    variantId: string,
    result: { score: number; passed: boolean; metadata?: Record<string, unknown> },
  ): void {
    const test = this.tests.get(testName);
    if (!test) {
      this.logger.warn(`Cannot track result: A/B test "${testName}" not found`);
      return;
    }

    // Validate variant exists
    const variant = test.variants.find((v) => v.id === variantId);
    if (!variant) {
      this.logger.warn(
        `Cannot track result: Variant "${variantId}" not found in test "${testName}"`,
      );
      return;
    }

    let results = this.results.get(testName);
    if (!results) {
      results = [];
      this.results.set(testName, results);
    }

    // Add result
    results.push({
      testName,
      variantId,
      score: result.score,
      passed: result.passed,
      timestamp: new Date(),
      metadata: result.metadata,
    });

    // Trim if over limit (keep most recent)
    if (results.length > this.maxResultsPerTest) {
      const toRemove = results.length - this.maxResultsPerTest;
      results.splice(0, toRemove);
    }
  }

  /**
   * Get comparison statistics for a test
   *
   * @param testName - Name of the test
   * @param since - Optional start date for filtering results
   * @returns Comparison statistics or undefined if test not found
   */
  getComparisonStats(testName: string, since?: Date): ABTestComparisonStats | undefined {
    const test = this.tests.get(testName);
    if (!test) {
      return undefined;
    }

    const results = this.results.get(testName) || [];
    const filteredResults = since
      ? results.filter((r) => r.timestamp >= since)
      : results;

    // Group by variant
    const variantResults = new Map<string, ABTestResult[]>();
    for (const variant of test.variants) {
      variantResults.set(variant.id, []);
    }
    for (const result of filteredResults) {
      const arr = variantResults.get(result.variantId);
      if (arr) {
        arr.push(result);
      }
    }

    // Calculate stats per variant
    const variantStats: VariantStats[] = [];
    for (const variant of test.variants) {
      const results = variantResults.get(variant.id) || [];
      variantStats.push(this.calculateVariantStats(variant.id, results));
    }

    // Determine significance and winner (simplified chi-squared test)
    const { isSignificant, winningVariant } = this.determineSignificance(variantStats);

    return {
      testName,
      variants: variantStats,
      totalEvaluations: filteredResults.length,
      isSignificant,
      winningVariant,
      periodStart: since,
      periodEnd: new Date(),
    };
  }

  /**
   * Export all results for a test (for external analysis)
   *
   * @param testName - Name of the test
   * @returns Array of results or empty array if test not found
   */
  exportResults(testName: string): ABTestResult[] {
    return this.results.get(testName) || [];
  }

  /**
   * Clear all results for a test
   *
   * @param testName - Name of the test
   */
  clearResults(testName: string): void {
    this.results.set(testName, []);
    this.logger.log(`Cleared results for A/B test "${testName}"`);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Validate test configuration
   */
  private validateTestConfig(config: ABTestConfig): void {
    if (!config.name || config.name.trim() === '') {
      throw new Error('A/B test name is required');
    }

    if (!config.variants || config.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    // Validate variants
    const variantIds = new Set<string>();
    let totalWeight = 0;

    for (const variant of config.variants) {
      if (!variant.id || variant.id.trim() === '') {
        throw new Error('Variant ID is required');
      }

      if (variantIds.has(variant.id)) {
        throw new Error(`Duplicate variant ID: ${variant.id}`);
      }
      variantIds.add(variant.id);

      if (variant.weight <= 0) {
        throw new Error(`Variant weight must be positive: ${variant.id}`);
      }

      totalWeight += variant.weight;
    }

    if (totalWeight <= 0) {
      throw new Error('Total variant weights must be positive');
    }
  }

  /**
   * Hash identifier for deterministic selection
   * Combines test name and identifier for uniqueness
   */
  private hashIdentifier(testName: string, identifier: string): number {
    const combined = `${testName}:${identifier}`;
    const hash = crypto.createHash('md5').update(combined).digest();

    // Convert first 4 bytes to unsigned integer and normalize to 0-1
    const value = hash.readUInt32BE(0);
    return value / 0xffffffff;
  }

  /**
   * Select variant based on weights
   * Hash value should be in range [0, 1)
   */
  private selectByWeight(variants: ABTestVariant[], hash: number): ABTestVariant {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight / totalWeight;
      if (hash < cumulative) {
        return variant;
      }
    }

    // Fallback to last variant (should not happen)
    return variants[variants.length - 1];
  }

  /**
   * Calculate statistics for a variant
   */
  private calculateVariantStats(variantId: string, results: ABTestResult[]): VariantStats {
    if (results.length === 0) {
      return {
        variantId,
        count: 0,
        passCount: 0,
        failCount: 0,
        passRate: 0,
        averageScore: 0,
        scoreStdDev: 0,
        minScore: 0,
        maxScore: 0,
      };
    }

    const passCount = results.filter((r) => r.passed).length;
    const scores = results.map((r) => r.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = sum / scores.length;

    // Calculate standard deviation
    const squaredDiffs = scores.map((s) => Math.pow(s - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    return {
      variantId,
      count: results.length,
      passCount,
      failCount: results.length - passCount,
      passRate: passCount / results.length,
      averageScore: mean,
      scoreStdDev: stdDev,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    };
  }

  /**
   * Determine statistical significance (simplified)
   * Uses a basic approach - for production, consider proper statistical tests
   */
  private determineSignificance(variantStats: VariantStats[]): {
    isSignificant: boolean;
    winningVariant?: string;
  } {
    // Need at least 100 samples per variant for significance
    const minSamples = 100;
    const hasEnoughData = variantStats.every((v) => v.count >= minSamples);

    if (!hasEnoughData) {
      return { isSignificant: false };
    }

    // Find variant with highest pass rate
    let best: VariantStats | null = null;
    let secondBest: VariantStats | null = null;

    for (const variant of variantStats) {
      if (!best || variant.passRate > best.passRate) {
        secondBest = best;
        best = variant;
      } else if (!secondBest || variant.passRate > secondBest.passRate) {
        secondBest = variant;
      }
    }

    if (!best || !secondBest) {
      return { isSignificant: false };
    }

    // Simplified significance: > 5% difference and > 1000 total samples
    const totalSamples = variantStats.reduce((sum, v) => sum + v.count, 0);
    const difference = Math.abs(best.passRate - secondBest.passRate);
    const isSignificant = difference > 0.05 && totalSamples > 1000;

    return {
      isSignificant,
      winningVariant: isSignificant ? best.variantId : undefined,
    };
  }
}
