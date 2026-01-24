import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { RiskLevel, RelationshipType, Frequency, Currency } from '@prisma/client';
import {
  RISK_THRESHOLDS,
  UBUNTU_MESSAGES,
  RELATIONSHIP_CATEGORIES,
} from '../constants';
import {
  DependencyRatioComponents,
  DependencyRatioResult,
  UbuntuMessage,
} from '../interfaces';

/**
 * Family support record with normalized types
 */
interface FamilySupportInput {
  amount: Decimal | number;
  frequency: Frequency;
  relationship: RelationshipType;
  isActive: boolean;
}

/**
 * Dependency Ratio Calculator
 *
 * Calculates the dependency ratio (family support / income) and categorizes
 * it by relationship type. Uses culturally-calibrated thresholds where
 * 10-35% is considered "healthy" not problematic.
 *
 * Ubuntu Philosophy: Supporting family is a VALUE, not a problem.
 */
@Injectable()
export class DependencyRatioCalculator {
  private readonly logger = new Logger(DependencyRatioCalculator.name);

  /**
   * Calculate the full dependency ratio result
   */
  calculate(
    familySupport: FamilySupportInput[],
    monthlyIncome: number,
    currency: Currency,
    previousRatio?: number,
  ): DependencyRatioResult {
    const components = this.calculateComponents(familySupport);
    const monthlyTotal = this.sumComponents(components);
    const totalRatio = monthlyIncome > 0 ? monthlyTotal / monthlyIncome : 0;
    const riskLevel = this.determineRiskLevel(totalRatio);
    const message = this.getMessage(riskLevel);
    const trend = this.calculateTrend(totalRatio, previousRatio);

    this.logger.debug(
      `[calculate] ratio=${totalRatio.toFixed(4)}, ` +
        `monthly=${monthlyTotal}, income=${monthlyIncome}, ` +
        `riskLevel=${riskLevel}, trend=${trend}`,
    );

    return {
      totalRatio: Number(totalRatio.toFixed(4)),
      riskLevel,
      components,
      monthlyTotal,
      monthlyIncome,
      currency,
      message,
      trend,
    };
  }

  /**
   * Calculate component breakdown by relationship category
   */
  private calculateComponents(
    familySupport: FamilySupportInput[],
  ): DependencyRatioComponents {
    const activeSupport = familySupport.filter((s) => s.isActive);

    const parentSupport = this.sumByRelationships(
      activeSupport,
      RELATIONSHIP_CATEGORIES.PARENT_SUPPORT as unknown as RelationshipType[],
    );
    const siblingEducation = this.sumByRelationships(
      activeSupport,
      RELATIONSHIP_CATEGORIES.SIBLING_EDUCATION as unknown as RelationshipType[],
    );
    const extendedFamily = this.sumByRelationships(
      activeSupport,
      RELATIONSHIP_CATEGORIES.EXTENDED_FAMILY as unknown as RelationshipType[],
    );
    const communityContribution = this.sumByRelationships(
      activeSupport,
      RELATIONSHIP_CATEGORIES.COMMUNITY_CONTRIBUTION as unknown as RelationshipType[],
    );

    return {
      parentSupport,
      siblingEducation,
      extendedFamily,
      communityContribution,
    };
  }

  /**
   * Sum monthly amounts for specific relationship types
   */
  private sumByRelationships(
    support: FamilySupportInput[],
    relationships: RelationshipType[],
  ): number {
    return support
      .filter((s) => relationships.includes(s.relationship))
      .reduce((sum, s) => sum + this.toMonthly(s.amount, s.frequency), 0);
  }

  /**
   * Sum all component values
   */
  private sumComponents(components: DependencyRatioComponents): number {
    return (
      components.parentSupport +
      components.siblingEducation +
      components.extendedFamily +
      components.communityContribution
    );
  }

  /**
   * Convert any frequency to monthly amount
   */
  private toMonthly(amount: Decimal | number, frequency: Frequency): number {
    const value = typeof amount === 'number' ? amount : Number(amount);
    const multiplier = this.getMonthlyMultiplier(frequency);
    return value * multiplier;
  }

  /**
   * Get multiplier to convert frequency to monthly
   */
  private getMonthlyMultiplier(frequency: Frequency): number {
    switch (frequency) {
      case 'DAILY':
        return 30;
      case 'WEEKLY':
        return 4.33;
      case 'BIWEEKLY':
        return 2.17;
      case 'MONTHLY':
        return 1;
      case 'QUARTERLY':
        return 0.33;
      case 'ANNUALLY':
        return 0.083;
      case 'ONE_TIME':
        return 0; // One-time doesn't count towards monthly ratio
      default:
        return 1;
    }
  }

  /**
   * Determine risk level based on ratio
   *
   * Culturally calibrated thresholds:
   * - GREEN: 0-10% - Sustainable
   * - ORANGE: 10-35% - Moderate (healthy in African context)
   * - RED: 35%+ - Review Needed
   */
  private determineRiskLevel(ratio: number): RiskLevel {
    if (ratio <= RISK_THRESHOLDS.GREEN_MAX) {
      return 'GREEN';
    }
    if (ratio <= RISK_THRESHOLDS.ORANGE_MAX) {
      return 'ORANGE';
    }
    return 'RED';
  }

  /**
   * Get appropriate message for risk level
   */
  private getMessage(riskLevel: RiskLevel): UbuntuMessage {
    return UBUNTU_MESSAGES[riskLevel];
  }

  /**
   * Calculate trend compared to previous ratio
   */
  private calculateTrend(
    currentRatio: number,
    previousRatio?: number,
  ): 'improving' | 'stable' | 'increasing' {
    if (previousRatio === undefined) {
      return 'stable';
    }

    const diff = currentRatio - previousRatio;
    const threshold = 0.01; // 1% change threshold

    if (diff < -threshold) {
      return 'improving'; // Ratio decreased
    }
    if (diff > threshold) {
      return 'increasing'; // Ratio increased
    }
    return 'stable';
  }

  /**
   * Calculate the impact of an emergency on goal probability
   *
   * This is a simplified calculation - in reality, it would integrate
   * with the Monte Carlo simulation engine for more accurate projections.
   */
  calculateEmergencyImpact(
    emergencyAmount: number,
    currentGoalProbability: number,
    emergencyFundBalance: number,
    monthlyIncome: number,
  ): { newProbability: number; recoveryWeeks: number } {
    // If emergency fund covers it, minimal impact
    if (emergencyFundBalance >= emergencyAmount) {
      const fundRatio = emergencyAmount / emergencyFundBalance;
      const probabilityDrop = fundRatio * 0.05; // Max 5% drop if using all fund
      return {
        newProbability: Math.max(0, currentGoalProbability - probabilityDrop),
        recoveryWeeks: Math.ceil(emergencyAmount / (monthlyIncome * 0.1)), // 10% savings rate recovery
      };
    }

    // If emergency fund doesn't cover it, larger impact
    const shortfall = emergencyAmount - emergencyFundBalance;
    const monthsOfIncome = shortfall / monthlyIncome;
    const probabilityDrop = Math.min(0.15, monthsOfIncome * 0.05); // Max 15% drop

    return {
      newProbability: Math.max(0, currentGoalProbability - probabilityDrop),
      recoveryWeeks: Math.ceil(emergencyAmount / (monthlyIncome * 0.15)), // 15% aggressive recovery
    };
  }
}
