import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UbuntuController } from '../ubuntu.controller';
import { UbuntuService } from '../ubuntu.service';
import { DependencyRatioResult, AdjustmentsResponse, AdjustmentResult } from '../interfaces';

describe('UbuntuController', () => {
  let controller: UbuntuController;
  let mockService: any;

  const mockUserId = 'user-123';

  beforeEach(() => {
    // Create fresh mocks for each test
    mockService = {
      getDependencyRatio: vi.fn(),
      addFamilySupport: vi.fn(),
      reportEmergency: vi.fn(),
      getAdjustmentOptions: vi.fn(),
      handleEmergency: vi.fn(),
    };

    // Directly instantiate controller with mock service
    controller = new UbuntuController(mockService as UbuntuService);
  });

  describe('getDependencyRatio', () => {
    it('should return dependency ratio with components', async () => {
      const mockResult: DependencyRatioResult = {
        totalRatio: 0.186,
        riskLevel: 'ORANGE',
        components: {
          parentSupport: 40000,
          siblingEducation: 25000,
          extendedFamily: 10000,
          communityContribution: 0,
        },
        monthlyTotal: 75000,
        monthlyIncome: 350000,
        currency: 'NGN',
        message: {
          headline: 'Family comes first - and so does your future',
          subtext: 'Consider building a dedicated family support fund alongside your goals.',
        },
        trend: 'stable',
      };

      mockService.getDependencyRatio.mockResolvedValue(mockResult);

      const result = await controller.getDependencyRatio(mockUserId);

      expect(result.totalRatio).toBe(0.186);
      expect(result.riskLevel).toBe('ORANGE');
      expect(result.components.parentSupport).toBe(40000);
      expect(result.message.headline).toContain('Family comes first');
      expect(mockService.getDependencyRatio).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('addFamilySupport', () => {
    it('should create family support with reframed label', async () => {
      const mockSupport = {
        id: 'support-123',
        name: 'Mom',
        relationship: 'PARENT',
        amount: 40000,
        currency: 'NGN',
        frequency: 'MONTHLY',
        description: 'Monthly upkeep',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        reframedLabel: 'Social Capital Investment',
      };

      mockService.addFamilySupport.mockResolvedValue(mockSupport);

      const result = await controller.addFamilySupport(mockUserId, {
        name: 'Mom',
        relationship: 'PARENT',
        amount: 40000,
        frequency: 'MONTHLY',
        description: 'Monthly upkeep',
      });

      expect(result.id).toBe('support-123');
      expect(result.reframedLabel).toBe('Social Capital Investment');
      expect(mockService.addFamilySupport).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({ name: 'Mom', relationship: 'PARENT' }),
      );
    });
  });

  describe('reportEmergency', () => {
    it('should create emergency with PENDING status', async () => {
      const mockEmergency = {
        id: 'emergency-123',
        type: 'MEDICAL',
        recipientName: 'Mom',
        relationship: 'PARENT',
        amount: 100000,
        currency: 'NGN',
        description: 'Hospital bills',
        status: 'PENDING',
        reportedAt: new Date(),
      };

      mockService.reportEmergency.mockResolvedValue(mockEmergency);

      const result = await controller.reportEmergency(mockUserId, {
        type: 'MEDICAL',
        recipientName: 'Mom',
        relationship: 'PARENT',
        amount: 100000,
        description: 'Hospital bills',
      });

      expect(result.id).toBe('emergency-123');
      expect(result.status).toBe('PENDING');
      expect(result.message).toContain('adjustment options');
    });
  });

  describe('getAdjustmentOptions', () => {
    it('should return three adjustment options', async () => {
      const mockResponse: AdjustmentsResponse = {
        emergencyId: 'emergency-123',
        emergencyAmount: 100000,
        recipientName: 'Mom',
        relationship: 'PARENT',
        originalGoalProbability: 0.72,
        options: [
          {
            type: 'EMERGENCY_FUND_TAP',
            label: 'Use Emergency Fund',
            description: 'Your emergency fund can cover this need completely.',
            recoveryWeeks: 12,
            newGoalProbability: 0.68,
            recommended: true,
            available: true,
            details: {
              availableFund: 250000,
              amountToTap: 100000,
              remainingFund: 150000,
            },
          },
          {
            type: 'GOAL_TIMELINE_EXTEND',
            label: 'Extend Goal Deadline',
            description: 'Add 4 weeks to your goal deadline.',
            recoveryWeeks: 4,
            newGoalProbability: 0.69,
            recommended: false,
            available: true,
            details: {
              extensionWeeks: 4,
            },
          },
          {
            type: 'SAVINGS_RATE_REDUCE',
            label: 'Temporarily Reduce Savings',
            description: 'Reduce your savings rate by 50% for 8 weeks.',
            recoveryWeeks: 8,
            newGoalProbability: 0.67,
            recommended: false,
            available: true,
            details: {
              currentRate: 0.2,
              temporaryRate: 0.1,
              durationWeeks: 8,
            },
          },
        ],
      };

      mockService.getAdjustmentOptions.mockResolvedValue(mockResponse);

      const result = await controller.getAdjustmentOptions(mockUserId, 'emergency-123');

      expect(result.options).toHaveLength(3);
      expect(result.options[0].type).toBe('EMERGENCY_FUND_TAP');
      expect(result.options[0].recommended).toBe(true);
      expect(result.message).toContain('family comes first');
    });
  });

  describe('applyAdjustment', () => {
    it('should apply adjustment and return result', async () => {
      const mockResult: AdjustmentResult = {
        emergencyId: 'emergency-123',
        status: 'RESOLVED',
        adjustmentType: 'EMERGENCY_FUND_TAP',
        recoveryWeeks: 12,
        originalGoalProbability: 0.72,
        newGoalProbability: 0.68,
        message: "Your family is important, and so is your future.",
        details: {
          amountToTap: 100000,
          remainingFund: 150000,
        },
      };

      mockService.handleEmergency.mockResolvedValue(mockResult);

      const result = await controller.applyAdjustment(mockUserId, {
        emergencyId: 'emergency-123',
        adjustmentType: 'EMERGENCY_FUND_TAP',
      });

      expect(result.status).toBe('RESOLVED');
      expect(result.adjustmentType).toBe('EMERGENCY_FUND_TAP');
      expect(result.recoveryWeeks).toBe(12);
      expect(result.message).toContain('family is important');
      expect(mockService.handleEmergency).toHaveBeenCalledWith(
        mockUserId,
        'emergency-123',
        'EMERGENCY_FUND_TAP',
      );
    });
  });
});
