/**
 * Tool Selection Interface
 *
 * Interfaces for GEPA-based tool selection optimization.
 */

import {
  UserProfileFeatures,
  ProfileCondition,
  ToolSelectionRule,
  OptimizedToolPolicy,
  ToolSelectionRecord,
  ExtractedPattern,
  ToolRecommendation,
} from '../optimizer.types';
import { RecoveryTool } from '../optimizer.constants';

/**
 * Interface for tool optimizer service
 */
export interface IToolOptimizer {
  /**
   * Optimize tool selection based on historical data
   *
   * @returns Optimized tool policy
   */
  optimizeToolSelection(): Promise<OptimizedToolPolicy>;

  /**
   * Get tool recommendation for a user profile
   *
   * @param userProfile - User's profile features
   * @param policy - Optional specific policy to use (default: active policy)
   * @returns Tool recommendation with confidence
   */
  recommendTool(
    userProfile: UserProfileFeatures,
    policy?: OptimizedToolPolicy,
  ): Promise<ToolRecommendation>;

  /**
   * Record a tool selection for future learning
   *
   * @param record - Tool selection record
   */
  recordSelection(record: ToolSelectionRecord): Promise<void>;

  /**
   * Get the currently active policy
   *
   * @returns Active policy or null if none exists
   */
  getActivePolicy(): Promise<OptimizedToolPolicy | null>;

  /**
   * Refresh the policy cache
   *
   * Invalidates the current cache and reloads from database.
   * Uses distributed locking to prevent race conditions during refresh.
   *
   * @returns The refreshed policy or null if no active rules exist
   */
  refreshPolicy(): Promise<OptimizedToolPolicy | null>;

  /**
   * Invalidate the policy cache
   *
   * Removes the cached policy from Redis and local cache.
   * Useful when policy needs to be reloaded on next access.
   */
  invalidateCache(): Promise<void>;
}

/**
 * Interface for pattern analysis
 */
export interface IPatternAnalyzer {
  /**
   * Analyze historical data to extract patterns
   *
   * @param historicalData - Historical selection records
   * @returns Extracted patterns
   */
  analyzePatterns(historicalData: ToolSelectionRecord[]): Promise<ExtractedPattern[]>;

  /**
   * Calculate success rate for a tool given conditions
   *
   * @param tool - The recovery tool
   * @param conditions - Profile conditions
   * @param data - Historical data to analyze
   * @returns Success rate and sample size
   */
  calculateSuccessRate(
    tool: RecoveryTool,
    conditions: ProfileCondition[],
    data: ToolSelectionRecord[],
  ): { successRate: number; sampleSize: number };
}

/**
 * Interface for rule generation
 */
export interface IRuleGenerator {
  /**
   * Generate rules from extracted patterns
   *
   * @param patterns - Extracted patterns
   * @returns Generated rules
   */
  generateRules(patterns: ExtractedPattern[]): ToolSelectionRule[];

  /**
   * Validate and filter rules based on quality criteria
   *
   * @param rules - Rules to validate
   * @returns Valid rules
   */
  validateRules(rules: ToolSelectionRule[]): ToolSelectionRule[];

  /**
   * Merge overlapping rules
   *
   * @param rules - Rules to merge
   * @returns Merged rules
   */
  mergeRules(rules: ToolSelectionRule[]): ToolSelectionRule[];
}

/**
 * Pattern analysis configuration
 */
export interface PatternAnalysisConfig {
  /** Minimum sample size for pattern detection */
  minSampleSize: number;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Features to analyze */
  features: (keyof UserProfileFeatures)[];
  /** Number of bins for continuous features */
  binCount?: number;
}

/**
 * Feature bin for discretizing continuous values
 */
export interface FeatureBin {
  /** Feature name */
  feature: keyof UserProfileFeatures;
  /** Lower bound (inclusive) */
  lowerBound: number;
  /** Upper bound (exclusive) */
  upperBound: number;
  /** Label for the bin */
  label: string;
}

/**
 * Tool performance statistics
 */
export interface ToolPerformanceStats {
  /** The tool */
  tool: RecoveryTool;
  /** Total selections */
  totalSelections: number;
  /** Successful outcomes */
  successfulOutcomes: number;
  /** Success rate */
  successRate: number;
  /** Average recovery time in days */
  avgRecoveryDays?: number;
  /** Average final probability */
  avgFinalProbability?: number;
}

/**
 * Profile segment for analysis
 */
export interface ProfileSegment {
  /** Segment identifier */
  id: string;
  /** Conditions defining the segment */
  conditions: ProfileCondition[];
  /** Number of users in segment */
  userCount: number;
  /** Performance by tool */
  toolPerformance: ToolPerformanceStats[];
  /** Best performing tool */
  bestTool: RecoveryTool;
}

// Re-export for convenience
export type {
  UserProfileFeatures,
  ProfileCondition,
  ToolSelectionRule,
  OptimizedToolPolicy,
  ToolSelectionRecord,
  ExtractedPattern,
  ToolRecommendation,
};

export type { RecoveryTool };
