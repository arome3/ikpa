import { describe, it, expect, beforeEach } from 'vitest';
import { CardContentCalculator } from '../calculators';
import {
  FutureSelfSource,
  CommitmentSource,
  MilestoneSource,
  RecoverySource,
  PrivacySettings,
} from '../interfaces';

describe('CardContentCalculator', () => {
  let calculator: CardContentCalculator;

  const defaultPrivacy: PrivacySettings = {
    anonymizeAmounts: true,
    revealActualNumbers: false,
    includePersonalData: false,
    requirePreview: true,
  };

  const revealedPrivacy: PrivacySettings = {
    anonymizeAmounts: false,
    revealActualNumbers: true,
    includePersonalData: true,
    requirePreview: true,
  };

  beforeEach(() => {
    calculator = new CardContentCalculator();
  });

  describe('generateContent', () => {
    describe('FUTURE_SELF type', () => {
      const futureSelfSource: FutureSelfSource = {
        letterId: 'letter-123',
        content: 'That ₦20,000 you saved in January 2026? It became ₦5,000,000 by 2045. Your future self is proud.',
        userAge: 28,
        futureAge: 60,
        currentNetWorth: 1000000,
        wealthDifference20yr: 2850000,
        currentSavingsRate: 0.1,
        optimizedSavingsRate: 0.25,
        createdAt: new Date(),
      };

      it('should generate content with anonymized amounts', () => {
        const result = calculator.generateContent(
          'FUTURE_SELF',
          { type: 'FUTURE_SELF', data: futureSelfSource },
          defaultPrivacy,
        );

        expect(result.headline).toBe('A Letter From My Future Self');
        expect(result.subheadline).toContain('60-year-old');
        expect(result.keyMetric.label).toBe('Potential 20-year wealth gain');
        expect(result.keyMetric.value).toMatch(/^\+\d+%$/); // Should be percentage
        expect(result.hashtags).toContain('#FutureMe');
        expect(result.gradient).toHaveLength(2);
        expect(result.quote).toBeDefined();
      });

      it('should generate content with revealed amounts', () => {
        const result = calculator.generateContent(
          'FUTURE_SELF',
          { type: 'FUTURE_SELF', data: futureSelfSource },
          revealedPrivacy,
        );

        expect(result.keyMetric.value).toMatch(/^₦/); // Should be currency
      });

      it('should extract a quote from the letter content', () => {
        const result = calculator.generateContent(
          'FUTURE_SELF',
          { type: 'FUTURE_SELF', data: futureSelfSource },
          defaultPrivacy,
        );

        expect(result.quote).toBeTruthy();
        expect(result.quote!.length).toBeLessThanOrEqual(500);
      });
    });

    describe('COMMITMENT type', () => {
      const commitmentSource: CommitmentSource = {
        contractId: 'contract-123',
        goalName: 'Emergency Fund',
        stakeType: 'SOCIAL',
        stakeAmount: null,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        successProbability: 0.78,
        createdAt: new Date(),
      };

      it('should generate content for SOCIAL stake type', () => {
        const result = calculator.generateContent(
          'COMMITMENT',
          { type: 'COMMITMENT', data: commitmentSource },
          defaultPrivacy,
        );

        expect(result.headline).toBe('I Made a Commitment');
        expect(result.subheadline).toContain('Emergency Fund');
        expect(result.subheadline).toContain('accountability partner');
        expect(result.keyMetric.label).toBe('Accountability partner');
        expect(result.hashtags).toContain('#Committed');
      });

      it('should generate content for ANTI_CHARITY stake type', () => {
        const antiCharitySource: CommitmentSource = {
          ...commitmentSource,
          stakeType: 'ANTI_CHARITY',
          stakeAmount: 50000,
        };

        const result = calculator.generateContent(
          'COMMITMENT',
          { type: 'COMMITMENT', data: antiCharitySource },
          defaultPrivacy,
        );

        expect(result.subheadline).toContain('money on the line');
      });

      it('should generate content for LOSS_POOL stake type', () => {
        const lossPoolSource: CommitmentSource = {
          ...commitmentSource,
          stakeType: 'LOSS_POOL',
          stakeAmount: 100000,
        };

        const result = calculator.generateContent(
          'COMMITMENT',
          { type: 'COMMITMENT', data: lossPoolSource },
          defaultPrivacy,
        );

        expect(result.subheadline).toContain('Locked funds');
      });
    });

    describe('MILESTONE type', () => {
      const milestoneSource: MilestoneSource = {
        goalId: 'goal-123',
        goalName: 'New Laptop',
        targetAmount: 500000,
        currentAmount: 500000,
        daysToAchieve: 90,
        completedAt: new Date(),
        category: 'MAJOR_PURCHASE',
      };

      it('should generate content for achieved milestone', () => {
        const result = calculator.generateContent(
          'MILESTONE',
          { type: 'MILESTONE', data: milestoneSource },
          defaultPrivacy,
        );

        expect(result.headline).toBe('Goal Achieved!');
        expect(result.subheadline).toContain('New Laptop');
        expect(result.subheadline).toContain('3 months'); // 90 days = ~3 months
        expect(result.keyMetric.label).toBe('Goal Amount');
        expect(result.hashtags).toContain('#GoalCrusher');
      });

      it('should format timeframe correctly for different durations', () => {
        const quickGoal: MilestoneSource = {
          ...milestoneSource,
          daysToAchieve: 5,
        };

        const result = calculator.generateContent(
          'MILESTONE',
          { type: 'MILESTONE', data: quickGoal },
          defaultPrivacy,
        );

        expect(result.subheadline).toContain('5 days');
      });
    });

    describe('RECOVERY type', () => {
      const recoverySource: RecoverySource = {
        sessionId: 'session-123',
        category: 'Entertainment',
        overspendAmount: 25000,
        previousProbability: 0.65,
        newProbability: 0.82,
        probabilityRestored: 0.17,
        selectedPath: 'category_freeze',
        completedAt: new Date(),
      };

      it('should generate content for recovery', () => {
        const result = calculator.generateContent(
          'RECOVERY',
          { type: 'RECOVERY', data: recoverySource },
          defaultPrivacy,
        );

        expect(result.headline).toBe('Back on Track');
        expect(result.subheadline).toContain('Entertainment');
        expect(result.keyMetric.label).toBe('Goal probability restored');
        expect(result.keyMetric.value).toBe('+17%');
        expect(result.quote).toContain('Category Freeze');
        expect(result.hashtags).toContain('#BackOnTrack');
      });
    });
  });

  describe('gradient selection', () => {
    it('should return valid gradient colors for each type', () => {
      const futureSelfSource: FutureSelfSource = {
        letterId: 'letter-123',
        content: 'Test content.',
        userAge: 28,
        futureAge: 60,
        currentNetWorth: 1000000,
        wealthDifference20yr: 2850000,
        currentSavingsRate: 0.1,
        optimizedSavingsRate: 0.25,
        createdAt: new Date(),
      };

      const result = calculator.generateContent(
        'FUTURE_SELF',
        { type: 'FUTURE_SELF', data: futureSelfSource },
        defaultPrivacy,
      );

      expect(result.gradient).toHaveLength(2);
      expect(result.gradient[0]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(result.gradient[1]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
