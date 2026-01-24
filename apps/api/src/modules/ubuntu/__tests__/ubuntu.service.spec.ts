import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { UbuntuService } from '../ubuntu.service';
import { DependencyRatioCalculator } from '../calculators';
import {
  EmergencyNotFoundException,
  NoActiveEmergencyException,
  EmergencyAlreadyResolvedException,
} from '../exceptions';

describe('UbuntuService', () => {
  let service: UbuntuService;
  let mockPrisma: any;
  let mockOpik: any;
  let calculator: DependencyRatioCalculator;
  let mockSimulationEngine: any;

  const mockUserId = 'user-123';

  beforeEach(() => {
    // Create fresh mocks for each test
    mockPrisma = {
      user: { findUnique: vi.fn() },
      familySupport: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), count: vi.fn() },
      incomeSource: { findMany: vi.fn() },
      savingsAccount: { findMany: vi.fn(), update: vi.fn() },
      goal: { findFirst: vi.fn(), update: vi.fn() },
      familyEmergency: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      dependencyRatioHistory: { findFirst: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
      savingsRateAdjustment: { create: vi.fn() },
      financialSnapshot: { findFirst: vi.fn() },
      expense: { findMany: vi.fn() },
      debt: { findMany: vi.fn() },
      $transaction: vi.fn().mockImplementation((cb) => cb(mockPrisma)),
    };

    mockOpik = {
      createTrace: vi.fn().mockReturnValue({ trace: {} }),
      endTrace: vi.fn(),
    };

    // Mock simulation engine
    mockSimulationEngine = {
      runDualPathSimulation: vi.fn().mockResolvedValue({
        currentPath: { probability: 0.65 },
        optimizedPath: { probability: 0.85, requiredSavingsRate: 0.25 },
      }),
    };

    calculator = new DependencyRatioCalculator();

    // Directly instantiate service with mocks (now with 4 arguments)
    service = new UbuntuService(mockPrisma, mockOpik, calculator, mockSimulationEngine);
  });

  describe('getDependencyRatio', () => {
    it('should calculate dependency ratio with components', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ currency: 'NGN' });
      mockPrisma.familySupport.findMany.mockResolvedValue([
        {
          id: 'support-1',
          userId: mockUserId,
          name: 'Mom',
          relationship: 'PARENT',
          amount: new Decimal(40000),
          frequency: 'MONTHLY',
          isActive: true,
        },
        {
          id: 'support-2',
          userId: mockUserId,
          name: 'Brother',
          relationship: 'SIBLING',
          amount: new Decimal(25000),
          frequency: 'MONTHLY',
          isActive: true,
        },
      ]);
      mockPrisma.incomeSource.findMany.mockResolvedValue([
        {
          id: 'income-1',
          userId: mockUserId,
          amount: new Decimal(350000),
          frequency: 'MONTHLY',
          isActive: true,
        },
      ]);
      mockPrisma.dependencyRatioHistory.findFirst.mockResolvedValue(null);
      mockPrisma.dependencyRatioHistory.upsert.mockResolvedValue({});

      const result = await service.getDependencyRatio(mockUserId);

      expect(result.totalRatio).toBeCloseTo(0.186, 2);
      expect(result.riskLevel).toBe('ORANGE');
      expect(result.components.parentSupport).toBe(40000);
      expect(result.components.siblingEducation).toBe(25000);
      expect(result.monthlyTotal).toBe(65000);
      expect(result.monthlyIncome).toBe(350000);
      expect(mockOpik.createTrace).toHaveBeenCalled();
      expect(mockOpik.endTrace).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ success: true }),
      );
    });

    it('should return GREEN risk level for low dependency ratio', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ currency: 'NGN' });
      mockPrisma.familySupport.findMany.mockResolvedValue([
        {
          id: 'support-1',
          userId: mockUserId,
          name: 'Mom',
          relationship: 'PARENT',
          amount: new Decimal(20000),
          frequency: 'MONTHLY',
          isActive: true,
        },
      ]);
      mockPrisma.incomeSource.findMany.mockResolvedValue([
        {
          id: 'income-1',
          userId: mockUserId,
          amount: new Decimal(500000),
          frequency: 'MONTHLY',
          isActive: true,
        },
      ]);
      mockPrisma.dependencyRatioHistory.findFirst.mockResolvedValue(null);
      mockPrisma.dependencyRatioHistory.upsert.mockResolvedValue({});

      const result = await service.getDependencyRatio(mockUserId);

      expect(result.riskLevel).toBe('GREEN');
      expect(result.totalRatio).toBeLessThanOrEqual(0.1);
    });
  });

  describe('addFamilySupport', () => {
    it('should create family support and return reframed label', async () => {
      const mockSupport = {
        id: 'support-new',
        userId: mockUserId,
        name: 'Mom',
        relationship: 'PARENT',
        amount: new Decimal(40000),
        currency: 'NGN',
        frequency: 'MONTHLY',
        description: 'Monthly upkeep',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue({ currency: 'NGN' });
      mockPrisma.familySupport.create.mockResolvedValue(mockSupport);

      const result = await service.addFamilySupport(mockUserId, {
        name: 'Mom',
        relationship: 'PARENT',
        amount: 40000,
        frequency: 'MONTHLY',
        description: 'Monthly upkeep',
      });

      expect(result.id).toBe('support-new');
      expect(result.reframedLabel).toBe('Social Capital Investment');
      expect(mockPrisma.familySupport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          name: 'Mom',
          relationship: 'PARENT',
        }),
      });
    });
  });

  describe('reportEmergency', () => {
    it('should create emergency with PENDING status', async () => {
      const mockEmergency = {
        id: 'emergency-1',
        userId: mockUserId,
        type: 'MEDICAL',
        recipientName: 'Mom',
        relationship: 'PARENT',
        amount: new Decimal(100000),
        currency: 'NGN',
        description: 'Hospital bills',
        status: 'PENDING',
        reportedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue({ currency: 'NGN' });
      mockPrisma.goal.findFirst.mockResolvedValue({
        id: 'goal-1',
        currentAmount: new Decimal(100000),
        targetAmount: new Decimal(500000),
      });
      mockPrisma.familyEmergency.create.mockResolvedValue(mockEmergency);

      const result = await service.reportEmergency(mockUserId, {
        type: 'MEDICAL',
        recipientName: 'Mom',
        relationship: 'PARENT',
        amount: 100000,
        description: 'Hospital bills',
      });

      expect(result.id).toBe('emergency-1');
      expect(result.status).toBe('PENDING');
      expect(result.type).toBe('MEDICAL');
    });
  });

  describe('getAdjustmentOptions', () => {
    it('should return three adjustment options', async () => {
      const mockEmergency = {
        id: 'emergency-1',
        userId: mockUserId,
        type: 'MEDICAL',
        recipientName: 'Mom',
        relationship: 'PARENT',
        amount: new Decimal(100000),
        status: 'PENDING',
        originalGoalProbability: new Decimal(0.72),
      };

      mockPrisma.familyEmergency.findFirst.mockResolvedValue(mockEmergency);
      mockPrisma.savingsAccount.findMany.mockResolvedValue([
        {
          id: 'account-1',
          balance: new Decimal(250000),
          isEmergencyFund: true,
          type: 'BANK_ACCOUNT',
        },
      ]);
      mockPrisma.incomeSource.findMany.mockResolvedValue([
        {
          id: 'income-1',
          amount: new Decimal(350000),
          frequency: 'MONTHLY',
          isActive: true,
        },
      ]);
      mockPrisma.goal.findFirst.mockResolvedValue({
        id: 'goal-1',
        targetDate: new Date('2026-06-01'),
      });
      // Add missing mocks for getUserSavingsRate and calculateMonthlyExpenses
      mockPrisma.financialSnapshot.findFirst.mockResolvedValue({
        savingsRate: new Decimal(0.2),
      });
      mockPrisma.expense.findMany.mockResolvedValue([]);

      const result = await service.getAdjustmentOptions(mockUserId, 'emergency-1');

      expect(result.options).toHaveLength(3);
      expect(result.options[0].type).toBe('EMERGENCY_FUND_TAP');
      expect(result.options[1].type).toBe('GOAL_TIMELINE_EXTEND');
      expect(result.options[2].type).toBe('SAVINGS_RATE_REDUCE');
      expect(result.emergencyAmount).toBe(100000);
    });

    it('should throw EmergencyNotFoundException when emergency not found', async () => {
      mockPrisma.familyEmergency.findFirst.mockResolvedValue(null);

      await expect(
        service.getAdjustmentOptions(mockUserId, 'non-existent'),
      ).rejects.toThrow(EmergencyNotFoundException);
    });

    it('should throw NoActiveEmergencyException when status is not PENDING', async () => {
      mockPrisma.familyEmergency.findFirst.mockResolvedValue({
        id: 'emergency-1',
        status: 'RESOLVED',
      });

      await expect(
        service.getAdjustmentOptions(mockUserId, 'emergency-1'),
      ).rejects.toThrow(NoActiveEmergencyException);
    });
  });

  describe('handleEmergency', () => {
    it('should apply EMERGENCY_FUND_TAP adjustment', async () => {
      const mockEmergency = {
        id: 'emergency-1',
        userId: mockUserId,
        amount: new Decimal(100000),
        status: 'PENDING',
        originalGoalProbability: new Decimal(0.72),
        currency: 'NGN',
      };

      mockPrisma.familyEmergency.findFirst.mockResolvedValue(mockEmergency);
      mockPrisma.savingsAccount.findMany.mockResolvedValue([
        { balance: new Decimal(250000), isEmergencyFund: true },
      ]);
      mockPrisma.incomeSource.findMany.mockResolvedValue([
        { amount: new Decimal(350000), frequency: 'MONTHLY', isActive: true },
      ]);
      mockPrisma.familyEmergency.update.mockResolvedValue({
        ...mockEmergency,
        status: 'RESOLVED',
      });

      const result = await service.handleEmergency(
        mockUserId,
        'emergency-1',
        'EMERGENCY_FUND_TAP',
      );

      expect(result.status).toBe('RESOLVED');
      expect(result.adjustmentType).toBe('EMERGENCY_FUND_TAP');
      expect(result.recoveryWeeks).toBe(12);
      expect(result.details.amountToTap).toBe(100000);
      expect(result.details.remainingFund).toBe(150000);
    });

    it('should apply GOAL_TIMELINE_EXTEND adjustment', async () => {
      const mockEmergency = {
        id: 'emergency-1',
        userId: mockUserId,
        amount: new Decimal(100000),
        status: 'PENDING',
        originalGoalProbability: new Decimal(0.72),
      };
      const mockGoal = {
        id: 'goal-1',
        targetDate: new Date('2026-06-01'),
      };

      mockPrisma.familyEmergency.findFirst.mockResolvedValue(mockEmergency);
      mockPrisma.savingsAccount.findMany.mockResolvedValue([
        { balance: new Decimal(50000), isEmergencyFund: true },
      ]);
      mockPrisma.incomeSource.findMany.mockResolvedValue([
        { amount: new Decimal(350000), frequency: 'MONTHLY', isActive: true },
      ]);
      mockPrisma.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrisma.goal.update.mockResolvedValue(mockGoal);
      mockPrisma.familyEmergency.update.mockResolvedValue({
        ...mockEmergency,
        status: 'RESOLVED',
      });

      const result = await service.handleEmergency(
        mockUserId,
        'emergency-1',
        'GOAL_TIMELINE_EXTEND',
      );

      expect(result.status).toBe('RESOLVED');
      expect(result.adjustmentType).toBe('GOAL_TIMELINE_EXTEND');
      expect(result.recoveryWeeks).toBe(4);
      expect(result.details.extensionWeeks).toBe(4);
    });

    it('should throw EmergencyAlreadyResolvedException when already resolved', async () => {
      mockPrisma.familyEmergency.findFirst.mockResolvedValue({
        id: 'emergency-1',
        status: 'RESOLVED',
      });

      await expect(
        service.handleEmergency(mockUserId, 'emergency-1', 'EMERGENCY_FUND_TAP'),
      ).rejects.toThrow(EmergencyAlreadyResolvedException);
    });
  });

  describe('reframeTransactionLabel', () => {
    it('should reframe Gift/Transfer to Social Capital Investment', () => {
      const result = service.reframeTransactionLabel('Gift/Transfer');
      expect(result).toBe('Social Capital Investment');
    });

    it('should reframe Transfer to Family Support', () => {
      const result = service.reframeTransactionLabel('Transfer');
      expect(result).toBe('Family Support');
    });

    it('should return original label if no reframe exists', () => {
      const result = service.reframeTransactionLabel('Unknown Category');
      expect(result).toBe('Unknown Category');
    });
  });
});
