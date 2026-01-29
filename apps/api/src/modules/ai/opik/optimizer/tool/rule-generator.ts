/**
 * Rule Generator
 *
 * Generates tool selection rules from extracted patterns.
 * Validates, filters, and merges rules to create an optimized policy.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  IRuleGenerator,
  ExtractedPattern,
  ToolSelectionRule,
  ProfileCondition,
} from '../interfaces';
import {
  GEPA_MIN_SAMPLE_SIZE,
  GEPA_MIN_CONFIDENCE,
  GEPA_MIN_SUCCESS_RATE,
} from '../optimizer.constants';

@Injectable()
export class RuleGenerator implements IRuleGenerator {
  private readonly logger = new Logger(RuleGenerator.name);

  /**
   * Generate rules from extracted patterns
   */
  generateRules(patterns: ExtractedPattern[]): ToolSelectionRule[] {
    const rules: ToolSelectionRule[] = [];

    for (const pattern of patterns) {
      rules.push({
        id: randomUUID(),
        condition: pattern.conditions,
        recommendedTool: pattern.bestTool,
        confidence: pattern.confidence,
        sampleSize: pattern.sampleSize,
        successRate: pattern.successRate,
      });
    }

    this.logger.log(`Generated ${rules.length} rules from ${patterns.length} patterns`);

    return rules;
  }

  /**
   * Validate and filter rules based on quality criteria
   */
  validateRules(rules: ToolSelectionRule[]): ToolSelectionRule[] {
    const validRules = rules.filter((rule) => {
      // Check minimum sample size
      if (rule.sampleSize < GEPA_MIN_SAMPLE_SIZE) {
        this.logger.debug(`Rule ${rule.id} rejected: sample size ${rule.sampleSize} < ${GEPA_MIN_SAMPLE_SIZE}`);
        return false;
      }

      // Check minimum confidence
      if (rule.confidence < GEPA_MIN_CONFIDENCE) {
        this.logger.debug(`Rule ${rule.id} rejected: confidence ${rule.confidence.toFixed(2)} < ${GEPA_MIN_CONFIDENCE}`);
        return false;
      }

      // Check minimum success rate
      if (rule.successRate < GEPA_MIN_SUCCESS_RATE) {
        this.logger.debug(`Rule ${rule.id} rejected: success rate ${rule.successRate.toFixed(2)} < ${GEPA_MIN_SUCCESS_RATE}`);
        return false;
      }

      // Check condition validity
      if (!this.isValidCondition(rule.condition)) {
        this.logger.debug(`Rule ${rule.id} rejected: invalid conditions`);
        return false;
      }

      return true;
    });

    this.logger.log(`Validated ${validRules.length} of ${rules.length} rules`);

    return validRules;
  }

  /**
   * Merge overlapping rules
   *
   * When multiple rules cover similar conditions, keeps the one
   * with higher confidence or merges them if they recommend the same tool.
   */
  mergeRules(rules: ToolSelectionRule[]): ToolSelectionRule[] {
    if (rules.length <= 1) return rules;

    // Sort by specificity (more conditions = more specific) then by confidence
    const sorted = [...rules].sort((a, b) => {
      const specificityDiff = b.condition.length - a.condition.length;
      if (specificityDiff !== 0) return specificityDiff;
      return b.confidence - a.confidence;
    });

    const merged: ToolSelectionRule[] = [];
    const processedIds = new Set<string>();

    for (const rule of sorted) {
      if (processedIds.has(rule.id)) continue;

      // Find rules that can be merged with this one
      const overlapping = sorted.filter(
        (other) =>
          other.id !== rule.id &&
          !processedIds.has(other.id) &&
          this.rulesOverlap(rule, other),
      );

      if (overlapping.length === 0) {
        merged.push(rule);
        processedIds.add(rule.id);
        continue;
      }

      // Check if overlapping rules recommend the same tool
      const sameToolRules = overlapping.filter(
        (other) => other.recommendedTool === rule.recommendedTool,
      );

      if (sameToolRules.length > 0) {
        // Merge rules with same tool recommendation
        const allRulesToMerge = [rule, ...sameToolRules];
        const mergedRule = this.mergeRulesWithSameTool(allRulesToMerge);
        merged.push(mergedRule);
        allRulesToMerge.forEach((r) => processedIds.add(r.id));
      } else {
        // Keep the higher confidence rule
        merged.push(rule);
        processedIds.add(rule.id);
      }
    }

    // Remove duplicate or subsumed rules
    const deduplicated = this.removeDuplicates(merged);

    this.logger.log(`Merged ${rules.length} rules into ${deduplicated.length}`);

    return deduplicated;
  }

  /**
   * Check if conditions are valid
   */
  private isValidCondition(conditions: ProfileCondition[]): boolean {
    for (const condition of conditions) {
      // Check feature is valid
      const validFeatures = ['incomeStability', 'savingsRate', 'dependencyRatio', 'slipSeverity'];
      if (!validFeatures.includes(condition.feature)) {
        return false;
      }

      // Check operator is valid
      const validOperators = ['eq', 'gt', 'lt', 'gte', 'lte', 'in'];
      if (!validOperators.includes(condition.operator)) {
        return false;
      }

      // Check value is present
      if (condition.value === undefined || condition.value === null) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if two rules have overlapping conditions
   */
  private rulesOverlap(rule1: ToolSelectionRule, rule2: ToolSelectionRule): boolean {
    // Rules overlap if they share common condition features
    const features1 = new Set(rule1.condition.map((c) => c.feature));
    const features2 = new Set(rule2.condition.map((c) => c.feature));

    const commonFeatures = [...features1].filter((f) => features2.has(f));

    // Consider overlapping if they share more than half of their features
    const overlapRatio = commonFeatures.length / Math.max(features1.size, features2.size);
    return overlapRatio > 0.5;
  }

  /**
   * Merge rules that recommend the same tool
   */
  private mergeRulesWithSameTool(rules: ToolSelectionRule[]): ToolSelectionRule {
    if (rules.length === 1) return rules[0];

    // Use the most common conditions across all rules
    const conditionCounts = new Map<string, { condition: ProfileCondition; count: number }>();

    for (const rule of rules) {
      for (const condition of rule.condition) {
        const key = this.conditionKey(condition);
        const existing = conditionCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          conditionCounts.set(key, { condition, count: 1 });
        }
      }
    }

    // Keep conditions that appear in majority of rules
    const majorityThreshold = rules.length / 2;
    const mergedConditions = [...conditionCounts.values()]
      .filter((entry) => entry.count >= majorityThreshold)
      .map((entry) => entry.condition);

    // Calculate merged statistics
    const totalSamples = rules.reduce((sum, r) => sum + r.sampleSize, 0);
    const weightedSuccessRate =
      rules.reduce((sum, r) => sum + r.successRate * r.sampleSize, 0) / totalSamples;
    const maxConfidence = Math.max(...rules.map((r) => r.confidence));

    return {
      id: randomUUID(),
      condition: mergedConditions.length > 0 ? mergedConditions : rules[0].condition,
      recommendedTool: rules[0].recommendedTool,
      confidence: maxConfidence,
      sampleSize: totalSamples,
      successRate: weightedSuccessRate,
    };
  }

  /**
   * Create a unique key for a condition
   */
  private conditionKey(condition: ProfileCondition): string {
    return `${condition.feature}:${condition.operator}:${JSON.stringify(condition.value)}`;
  }

  /**
   * Remove duplicate rules
   */
  private removeDuplicates(rules: ToolSelectionRule[]): ToolSelectionRule[] {
    const seen = new Set<string>();
    const unique: ToolSelectionRule[] = [];

    for (const rule of rules) {
      const key = this.ruleKey(rule);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rule);
      }
    }

    return unique;
  }

  /**
   * Create a unique key for a rule
   */
  private ruleKey(rule: ToolSelectionRule): string {
    const sortedConditions = [...rule.condition].sort((a, b) =>
      this.conditionKey(a).localeCompare(this.conditionKey(b)),
    );
    return `${rule.recommendedTool}:${sortedConditions.map((c) => this.conditionKey(c)).join('|')}`;
  }
}
