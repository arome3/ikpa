import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { DependencyRatioCalculator } from '../calculators';

describe('DependencyRatioCalculator', () => {
  let calculator: DependencyRatioCalculator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DependencyRatioCalculator],
    }).compile();

    calculator = module.get<DependencyRatioCalculator>(DependencyRatioCalculator);
  });

  describe('calculate', () => {
    it('should calculate GREEN risk level for low ratio (0-10%)', () => {
      const familySupport = [
        {
          amount: new Decimal(20000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 500000, 'NGN');

      expect(result.totalRatio).toBe(0.04);
      expect(result.riskLevel).toBe('GREEN');
      expect(result.components.parentSupport).toBe(20000);
      expect(result.monthlyTotal).toBe(20000);
      expect(result.message.headline).toContain('well-balanced');
    });

    it('should calculate ORANGE risk level for moderate ratio (10-35%)', () => {
      const familySupport = [
        {
          amount: new Decimal(40000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
        {
          amount: new Decimal(25000),
          frequency: 'MONTHLY' as const,
          relationship: 'SIBLING' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN');

      expect(result.totalRatio).toBeCloseTo(0.186, 2);
      expect(result.riskLevel).toBe('ORANGE');
      expect(result.components.parentSupport).toBe(40000);
      expect(result.components.siblingEducation).toBe(25000);
      expect(result.message.headline).toContain('Family comes first');
    });

    it('should calculate RED risk level for high ratio (35%+)', () => {
      const familySupport = [
        {
          amount: new Decimal(80000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
        {
          amount: new Decimal(50000),
          frequency: 'MONTHLY' as const,
          relationship: 'SIBLING' as const,
          isActive: true,
        },
        {
          amount: new Decimal(30000),
          frequency: 'MONTHLY' as const,
          relationship: 'EXTENDED_FAMILY' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN');

      expect(result.totalRatio).toBeGreaterThan(0.35);
      expect(result.riskLevel).toBe('RED');
      expect(result.message.headline).toContain('heavy load');
    });

    it('should correctly categorize relationships', () => {
      const familySupport = [
        {
          amount: new Decimal(40000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
        {
          amount: new Decimal(20000),
          frequency: 'MONTHLY' as const,
          relationship: 'SPOUSE' as const,
          isActive: true,
        },
        {
          amount: new Decimal(25000),
          frequency: 'MONTHLY' as const,
          relationship: 'SIBLING' as const,
          isActive: true,
        },
        {
          amount: new Decimal(10000),
          frequency: 'MONTHLY' as const,
          relationship: 'EXTENDED_FAMILY' as const,
          isActive: true,
        },
        {
          amount: new Decimal(5000),
          frequency: 'MONTHLY' as const,
          relationship: 'COMMUNITY' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 500000, 'NGN');

      expect(result.components.parentSupport).toBe(60000); // PARENT + SPOUSE
      expect(result.components.siblingEducation).toBe(25000);
      expect(result.components.extendedFamily).toBe(10000);
      expect(result.components.communityContribution).toBe(5000);
    });

    it('should normalize weekly frequency to monthly', () => {
      const familySupport = [
        {
          amount: new Decimal(10000),
          frequency: 'WEEKLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN');

      // Weekly amount * 4.33 = monthly
      expect(result.components.parentSupport).toBeCloseTo(43300, 0);
    });

    it('should normalize annual frequency to monthly', () => {
      const familySupport = [
        {
          amount: new Decimal(120000),
          frequency: 'ANNUALLY' as const,
          relationship: 'SIBLING' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN');

      // Annual amount * 0.083 = monthly
      expect(result.components.siblingEducation).toBeCloseTo(9960, 0);
    });

    it('should ignore inactive family support', () => {
      const familySupport = [
        {
          amount: new Decimal(40000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
        {
          amount: new Decimal(50000),
          frequency: 'MONTHLY' as const,
          relationship: 'SIBLING' as const,
          isActive: false, // Inactive
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN');

      expect(result.monthlyTotal).toBe(40000); // Only active support counted
      expect(result.components.siblingEducation).toBe(0);
    });

    it('should handle zero income gracefully', () => {
      const familySupport = [
        {
          amount: new Decimal(40000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 0, 'NGN');

      expect(result.totalRatio).toBe(0); // Avoid division by zero
    });

    it('should handle empty family support array', () => {
      const result = calculator.calculate([], 350000, 'NGN');

      expect(result.totalRatio).toBe(0);
      expect(result.riskLevel).toBe('GREEN');
      expect(result.monthlyTotal).toBe(0);
    });

    it('should calculate improving trend when ratio decreased', () => {
      const familySupport = [
        {
          amount: new Decimal(40000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN', 0.2);

      expect(result.trend).toBe('improving');
    });

    it('should calculate increasing trend when ratio increased', () => {
      const familySupport = [
        {
          amount: new Decimal(70000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN', 0.1);

      expect(result.trend).toBe('increasing');
    });

    it('should calculate stable trend when ratio unchanged', () => {
      const familySupport = [
        {
          amount: new Decimal(40000),
          frequency: 'MONTHLY' as const,
          relationship: 'PARENT' as const,
          isActive: true,
        },
      ];

      const result = calculator.calculate(familySupport, 350000, 'NGN', 0.114);

      expect(result.trend).toBe('stable');
    });
  });

  describe('calculateEmergencyImpact', () => {
    it('should calculate minimal impact when fund covers emergency', () => {
      const result = calculator.calculateEmergencyImpact(
        100000, // emergency amount
        0.72,   // current probability
        250000, // emergency fund
        350000, // monthly income
      );

      expect(result.newProbability).toBeGreaterThan(0.65);
      expect(result.recoveryWeeks).toBeGreaterThan(0);
    });

    it('should calculate larger impact when fund is insufficient', () => {
      const result = calculator.calculateEmergencyImpact(
        200000, // emergency amount (more than fund)
        0.72,   // current probability
        50000,  // emergency fund (insufficient)
        350000, // monthly income
      );

      expect(result.newProbability).toBeLessThan(0.70);
      // With 15% recovery rate: 200000 / (350000 * 0.15) = ~4 weeks
      expect(result.recoveryWeeks).toBeGreaterThan(0);
      expect(result.recoveryWeeks).toBeLessThanOrEqual(8);
    });

    it('should not drop probability below 0', () => {
      const result = calculator.calculateEmergencyImpact(
        1000000, // large emergency
        0.1,     // low probability
        0,       // no fund
        100000,  // low income
      );

      expect(result.newProbability).toBeGreaterThanOrEqual(0);
    });
  });
});
