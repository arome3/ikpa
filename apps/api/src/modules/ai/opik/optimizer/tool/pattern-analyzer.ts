/**
 * Pattern Analyzer
 *
 * Extracts patterns from historical tool selection data for GEPA optimization.
 * Identifies which user profile features correlate with successful tool outcomes.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IPatternAnalyzer,
  UserProfileFeatures,
  ProfileCondition,
  ToolSelectionRecord,
  ExtractedPattern,
  FeatureBin,
  ProfileSegment,
  ToolPerformanceStats,
} from '../interfaces';
import {
  RecoveryTool,
  RECOVERY_TOOLS,
  GEPA_MIN_SAMPLE_SIZE,
  GEPA_MIN_CONFIDENCE,
  SLIP_SEVERITY_LEVELS,
} from '../optimizer.constants';

/**
 * Default bins for continuous features
 */
const DEFAULT_BINS: Record<Exclude<keyof UserProfileFeatures, 'slipSeverity'>, FeatureBin[]> = {
  incomeStability: [
    { feature: 'incomeStability', lowerBound: 0, upperBound: 0.3, label: 'unstable' },
    { feature: 'incomeStability', lowerBound: 0.3, upperBound: 0.7, label: 'moderate' },
    { feature: 'incomeStability', lowerBound: 0.7, upperBound: 1.01, label: 'stable' },
  ],
  savingsRate: [
    { feature: 'savingsRate', lowerBound: 0, upperBound: 0.1, label: 'low' },
    { feature: 'savingsRate', lowerBound: 0.1, upperBound: 0.2, label: 'moderate' },
    { feature: 'savingsRate', lowerBound: 0.2, upperBound: 1.01, label: 'high' },
  ],
  dependencyRatio: [
    { feature: 'dependencyRatio', lowerBound: 0, upperBound: 0.15, label: 'low' },
    { feature: 'dependencyRatio', lowerBound: 0.15, upperBound: 0.35, label: 'moderate' },
    { feature: 'dependencyRatio', lowerBound: 0.35, upperBound: 1.01, label: 'high' },
  ],
};

@Injectable()
export class PatternAnalyzer implements IPatternAnalyzer {
  private readonly logger = new Logger(PatternAnalyzer.name);

  /**
   * Analyze historical data to extract patterns
   *
   * Identifies user profile segments and which tools perform
   * best for each segment based on success rates.
   */
  async analyzePatterns(historicalData: ToolSelectionRecord[]): Promise<ExtractedPattern[]> {
    if (historicalData.length < GEPA_MIN_SAMPLE_SIZE) {
      this.logger.warn(`Insufficient data for pattern analysis: ${historicalData.length} records`);
      return [];
    }

    const patterns: ExtractedPattern[] = [];

    // Analyze by single feature first
    patterns.push(...this.analyzeSingleFeaturePatterns(historicalData));

    // Analyze by feature combinations
    patterns.push(...this.analyzeFeatureCombinations(historicalData));

    // Filter by minimum confidence and sample size
    const validPatterns = patterns.filter(
      (p) => p.confidence >= GEPA_MIN_CONFIDENCE && p.sampleSize >= GEPA_MIN_SAMPLE_SIZE,
    );

    // Sort by confidence (descending)
    validPatterns.sort((a, b) => b.confidence - a.confidence);

    this.logger.log(`Extracted ${validPatterns.length} valid patterns from ${historicalData.length} records`);

    return validPatterns;
  }

  /**
   * Calculate success rate for a tool given conditions
   */
  calculateSuccessRate(
    tool: RecoveryTool,
    conditions: ProfileCondition[],
    data: ToolSelectionRecord[],
  ): { successRate: number; sampleSize: number } {
    // Filter data to records matching conditions
    const matchingRecords = data.filter((record) => this.matchesConditions(record.userProfile, conditions));

    // Filter to records that selected this tool
    const toolRecords = matchingRecords.filter((record) => record.selectedTool === tool);

    if (toolRecords.length === 0) {
      return { successRate: 0, sampleSize: 0 };
    }

    // Calculate success rate
    const successCount = toolRecords.filter((record) => record.outcome.success).length;
    const successRate = successCount / toolRecords.length;

    return {
      successRate,
      sampleSize: toolRecords.length,
    };
  }

  /**
   * Analyze patterns based on single features
   */
  private analyzeSingleFeaturePatterns(data: ToolSelectionRecord[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];

    // Continuous features
    for (const [feature, bins] of Object.entries(DEFAULT_BINS)) {
      for (const bin of bins) {
        const conditions: ProfileCondition[] = [
          { feature: feature as keyof UserProfileFeatures, operator: 'gte', value: bin.lowerBound },
          { feature: feature as keyof UserProfileFeatures, operator: 'lt', value: bin.upperBound },
        ];

        const bestTool = this.findBestTool(data, conditions);
        if (bestTool) {
          patterns.push(bestTool);
        }
      }
    }

    // Categorical feature: slipSeverity
    for (const severity of SLIP_SEVERITY_LEVELS) {
      const conditions: ProfileCondition[] = [
        { feature: 'slipSeverity', operator: 'eq', value: severity },
      ];

      const bestTool = this.findBestTool(data, conditions);
      if (bestTool) {
        patterns.push(bestTool);
      }
    }

    return patterns;
  }

  /**
   * Analyze patterns based on feature combinations
   */
  private analyzeFeatureCombinations(data: ToolSelectionRecord[]): ExtractedPattern[] {
    const patterns: ExtractedPattern[] = [];

    // Combine incomeStability with slipSeverity
    for (const stabilityBin of DEFAULT_BINS.incomeStability) {
      for (const severity of SLIP_SEVERITY_LEVELS) {
        const conditions: ProfileCondition[] = [
          { feature: 'incomeStability', operator: 'gte', value: stabilityBin.lowerBound },
          { feature: 'incomeStability', operator: 'lt', value: stabilityBin.upperBound },
          { feature: 'slipSeverity', operator: 'eq', value: severity },
        ];

        const bestTool = this.findBestTool(data, conditions);
        if (bestTool) {
          patterns.push(bestTool);
        }
      }
    }

    // Combine savingsRate with dependencyRatio
    for (const savingsBin of DEFAULT_BINS.savingsRate) {
      for (const depBin of DEFAULT_BINS.dependencyRatio) {
        const conditions: ProfileCondition[] = [
          { feature: 'savingsRate', operator: 'gte', value: savingsBin.lowerBound },
          { feature: 'savingsRate', operator: 'lt', value: savingsBin.upperBound },
          { feature: 'dependencyRatio', operator: 'gte', value: depBin.lowerBound },
          { feature: 'dependencyRatio', operator: 'lt', value: depBin.upperBound },
        ];

        const bestTool = this.findBestTool(data, conditions);
        if (bestTool) {
          patterns.push(bestTool);
        }
      }
    }

    return patterns;
  }

  /**
   * Find the best performing tool for given conditions
   */
  private findBestTool(
    data: ToolSelectionRecord[],
    conditions: ProfileCondition[],
  ): ExtractedPattern | null {
    const matchingRecords = data.filter((record) => this.matchesConditions(record.userProfile, conditions));

    if (matchingRecords.length < GEPA_MIN_SAMPLE_SIZE) {
      return null;
    }

    // Calculate performance for each tool
    const toolPerformance: ToolPerformanceStats[] = [];

    for (const tool of RECOVERY_TOOLS) {
      const toolRecords = matchingRecords.filter((r) => r.selectedTool === tool);
      if (toolRecords.length === 0) continue;

      const successCount = toolRecords.filter((r) => r.outcome.success).length;

      toolPerformance.push({
        tool,
        totalSelections: toolRecords.length,
        successfulOutcomes: successCount,
        successRate: successCount / toolRecords.length,
        avgRecoveryDays: this.calculateAverage(
          toolRecords
            .filter((r) => r.outcome.recoveryDays !== undefined)
            .map((r) => r.outcome.recoveryDays!),
        ),
        avgFinalProbability: this.calculateAverage(
          toolRecords
            .filter((r) => r.outcome.finalProbability !== undefined)
            .map((r) => r.outcome.finalProbability!),
        ),
      });
    }

    if (toolPerformance.length === 0) {
      return null;
    }

    // Find best tool by success rate (with minimum sample requirement)
    // Use GEPA_MIN_SAMPLE_SIZE / 2 as minimum per-tool threshold within a segment
    const minToolSamples = Math.max(5, Math.floor(GEPA_MIN_SAMPLE_SIZE / 2));
    const validTools = toolPerformance.filter((t) => t.totalSelections >= minToolSamples);
    if (validTools.length === 0) {
      return null;
    }

    const best = validTools.reduce((prev, curr) =>
      curr.successRate > prev.successRate ? curr : prev,
    );

    // Calculate confidence based on sample size and success rate consistency
    const confidence = this.calculateConfidence(best.totalSelections, best.successRate);

    return {
      conditions,
      bestTool: best.tool,
      successRate: best.successRate,
      sampleSize: matchingRecords.length,
      confidence,
    };
  }

  /**
   * Check if a user profile matches given conditions
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
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
      }
    }

    return true;
  }

  /**
   * Calculate average of array values
   */
  private calculateAverage(values: number[]): number | undefined {
    if (values.length === 0) return undefined;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate confidence score based on sample size and success rate
   *
   * Uses Wilson score interval lower bound as a conservative confidence estimate
   */
  private calculateConfidence(sampleSize: number, successRate: number): number {
    // Wilson score interval lower bound (95% confidence)
    const z = 1.96; // z-score for 95% confidence
    const p = successRate;
    const n = sampleSize;

    if (n === 0) return 0;

    // Wilson score interval
    const denominator = 1 + (z * z) / n;
    const center = p + (z * z) / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

    const lowerBound = (center - spread) / denominator;

    // Normalize to 0-1 range
    return Math.max(0, Math.min(1, lowerBound));
  }
}
