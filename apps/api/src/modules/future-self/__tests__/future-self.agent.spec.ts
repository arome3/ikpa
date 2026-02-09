import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FutureSelfAgent } from '../agents/future-self.agent';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpikService } from '../../ai/opik/opik.service';
import { MetricsService } from '../../ai/opik/metrics';
import { SimulationEngineCalculator } from '../../finance/calculators';
import { AnthropicService } from '../../ai/anthropic';
import { ContentModerationService } from '../services/content-moderation.service';
import {
  FutureSelfUserNotFoundException,
  InsufficientUserDataException,
} from '../exceptions';

describe('FutureSelfAgent', () => {
  let agent: FutureSelfAgent;
  let prismaService: {
    user: { findUnique: Mock };
  };
  let simulationEngine: {
    runDualPathSimulation: Mock;
  };
  let anthropicService: {
    isAvailable: Mock;
    getModel: Mock;
    generate: Mock;
  };
  let opikService: {
    createTrace: Mock;
    endTrace: Mock;
    createToolSpan: Mock;
    createLLMSpan: Mock;
    endSpan: Mock;
    endLLMSpan: Mock;
    addFeedback: Mock;
  };

  const mockUserId = 'user-123';

  const mockUser = {
    id: mockUserId,
    firstName: 'Aisha',
    dateOfBirth: new Date('1998-06-15'),
    city: 'New York',
    country: 'US',
    currency: 'USD',
    goals: [
      {
        name: 'House Down Payment',
        targetAmount: 2000000,
        targetDate: new Date('2027-12-31'),
        isActive: true,
        priority: 1,
      },
    ],
    financialSnapshots: [
      {
        monthlyIncome: 400000,
        monthlyExpenses: 320000,
        totalAssets: 700000,
        totalLiabilities: 200000,
      },
    ],
  };

  const mockSimulationOutput = {
    currentPath: {
      probability: 0.45,
      projectedNetWorth: {
        '6mo': 550000,
        '1yr': 620000,
        '5yr': 2100000,
        '10yr': 4800000,
        '20yr': 12000000,
      },
      achieveGoalDate: null,
      confidenceIntervals: {
        '6mo': { low: 500000, high: 600000 },
        '1yr': { low: 550000, high: 700000 },
        '5yr': { low: 1500000, high: 2700000 },
        '10yr': { low: 3500000, high: 6100000 },
        '20yr': { low: 8000000, high: 16000000 },
      },
    },
    optimizedPath: {
      probability: 0.85,
      projectedNetWorth: {
        '6mo': 580000,
        '1yr': 700000,
        '5yr': 3200000,
        '10yr': 8500000,
        '20yr': 28000000,
      },
      achieveGoalDate: new Date('2026-08-15'),
      confidenceIntervals: {
        '6mo': { low: 520000, high: 640000 },
        '1yr': { low: 620000, high: 780000 },
        '5yr': { low: 2500000, high: 3900000 },
        '10yr': { low: 6500000, high: 10500000 },
        '20yr': { low: 20000000, high: 36000000 },
      },
      requiredSavingsRate: 0.18,
    },
    wealthDifference: {
      '6mo': 30000,
      '1yr': 80000,
      '5yr': 1100000,
      '10yr': 3700000,
      '20yr': 16000000,
    },
    metadata: {
      iterations: 10000,
      durationMs: 150,
      simulatedAt: new Date(),
      currency: 'NGN',
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
    };

    const mockSimulationEngine = {
      runDualPathSimulation: vi.fn(),
    };

    const mockAnthropic = {
      isAvailable: vi.fn().mockReturnValue(true),
      getModel: vi.fn().mockReturnValue('claude-sonnet-4-20250514'),
      generate: vi.fn(),
    };

    const mockOpik = {
      createTrace: vi.fn().mockReturnValue({
        trace: {},
        traceId: 'trace-123',
        traceName: 'test_trace',
        startedAt: new Date(),
      }),
      endTrace: vi.fn(),
      createToolSpan: vi.fn().mockReturnValue({
        span: {},
        spanId: 'span-123',
        name: 'test_span',
        startedAt: new Date(),
      }),
      createLLMSpan: vi.fn().mockReturnValue({
        span: {},
        spanId: 'llm-span-123',
        name: 'llm_span',
        startedAt: new Date(),
      }),
      endSpan: vi.fn(),
      endLLMSpan: vi.fn(),
      addFeedback: vi.fn(),
    };

    const mockContentModeration = {
      moderateContent: vi.fn().mockResolvedValue({ isApproved: true, flags: [] }),
    };

    const mockMetricsService = {
      evaluateTone: vi.fn().mockResolvedValue({ score: 4, reason: 'Good empathy' }),
      checkSafety: vi.fn().mockResolvedValue({ score: 1, reason: 'Safe' }),
      evaluate: vi.fn().mockResolvedValue({
        success: true,
        results: {},
        aggregated: { averageScore: 0.8, passCount: 5, failCount: 0, totalCount: 5 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FutureSelfAgent,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SimulationEngineCalculator, useValue: mockSimulationEngine },
        { provide: AnthropicService, useValue: mockAnthropic },
        { provide: OpikService, useValue: mockOpik },
        { provide: ContentModerationService, useValue: mockContentModeration },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    agent = module.get<FutureSelfAgent>(FutureSelfAgent);
    prismaService = module.get(PrismaService);
    simulationEngine = module.get(SimulationEngineCalculator);
    anthropicService = module.get(AnthropicService);
    opikService = module.get(OpikService);
  });

  describe('generateSimulation', () => {
    it('should generate a dual-path simulation successfully', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      simulationEngine.runDualPathSimulation.mockResolvedValue(mockSimulationOutput);

      const result = await agent.generateSimulation(mockUserId);

      expect(result).toBeDefined();
      expect(result.currentBehavior.savingsRate).toBe(0.2); // (400k - 320k) / 400k
      expect(result.withIKPA.savingsRate).toBe(0.18);
      expect(result.difference_20yr).toBe(16000000);
      expect(opikService.createTrace).toHaveBeenCalled();
      expect(opikService.endTrace).toHaveBeenCalled();
    });

    it('should throw FutureSelfUserNotFoundException when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(agent.generateSimulation(mockUserId)).rejects.toThrow(
        FutureSelfUserNotFoundException,
      );
    });

    it('should throw InsufficientUserDataException when no financial snapshot', async () => {
      const userWithoutSnapshot = { ...mockUser, financialSnapshots: [] };
      prismaService.user.findUnique.mockResolvedValue(userWithoutSnapshot);

      await expect(agent.generateSimulation(mockUserId)).rejects.toThrow(
        InsufficientUserDataException,
      );
    });

    it('should throw InsufficientUserDataException when income is zero', async () => {
      const userWithZeroIncome = {
        ...mockUser,
        financialSnapshots: [
          {
            monthlyIncome: 0,
            monthlyExpenses: 0,
            totalAssets: 100000,
            totalLiabilities: 0,
          },
        ],
      };
      prismaService.user.findUnique.mockResolvedValue(userWithZeroIncome);

      await expect(agent.generateSimulation(mockUserId)).rejects.toThrow(
        InsufficientUserDataException,
      );
    });
  });

  describe('generateLetter', () => {
    const mockLetterResponse = {
      content: `Dear Aisha,

I'm writing this from the balcony of our flat in Victoria Island.
Yes, OUR flat—we own it now, mortgage-free.

Keep going. I'm proof it works.

With love from your future,
Aisha (Age 60)`,
      usage: {
        promptTokens: 500,
        completionTokens: 200,
        totalTokens: 700,
      },
      model: 'claude-sonnet-4-20250514',
      stopReason: 'end_turn',
    };

    const mockToneResponse = {
      content: '{"score": 4, "reasoning": "Warm and personal with specific details"}',
      usage: { promptTokens: 300, completionTokens: 50, totalTokens: 350 },
      model: 'claude-sonnet-4-20250514',
      stopReason: 'end_turn',
    };

    it('should generate a personalized letter successfully', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      simulationEngine.runDualPathSimulation.mockResolvedValue(mockSimulationOutput);
      anthropicService.generate
        .mockResolvedValueOnce(mockLetterResponse)
        .mockResolvedValueOnce(mockToneResponse);

      const result = await agent.generateLetter(mockUserId);

      expect(result).toBeDefined();
      expect(result.content).toContain('Dear Aisha');
      expect(result.userAge).toBe(27); // Age calculated from DOB
      expect(result.futureAge).toBe(60);
      expect(result.simulationData).toBeDefined();
      expect(opikService.createLLMSpan).toHaveBeenCalled();
      expect(opikService.addFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ToneEmpathy',
          value: 4,
        }),
      );
    });

    it('should handle tone evaluation failures gracefully', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      simulationEngine.runDualPathSimulation.mockResolvedValue(mockSimulationOutput);
      anthropicService.generate
        .mockResolvedValueOnce(mockLetterResponse)
        .mockRejectedValueOnce(new Error('Evaluation failed'));

      const result = await agent.generateLetter(mockUserId);

      // Letter should still be generated even if tone evaluation fails
      expect(result).toBeDefined();
      expect(result.content).toContain('Dear Aisha');
    });
  });

  describe('getTimeline', () => {
    it('should return timeline projection for 10 years', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      simulationEngine.runDualPathSimulation.mockResolvedValue(mockSimulationOutput);

      const result = await agent.getTimeline(mockUserId, 10);

      expect(result).toBeDefined();
      expect(result.currentPath).toBe(4800000);
      expect(result.optimizedPath).toBe(8500000);
      expect(result.difference).toBe(3700000);
      expect(result.years).toBe(10);
    });

    it('should map years to correct horizon', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      simulationEngine.runDualPathSimulation.mockResolvedValue(mockSimulationOutput);

      // Test 1 year maps to '1yr' horizon
      const result1 = await agent.getTimeline(mockUserId, 1);
      expect(result1.currentPath).toBe(620000);

      // Test 5 years maps to '5yr' horizon
      const result5 = await agent.getTimeline(mockUserId, 5);
      expect(result5.currentPath).toBe(2100000);

      // Test 25 years maps to '20yr' horizon (max)
      const result25 = await agent.getTimeline(mockUserId, 25);
      expect(result25.currentPath).toBe(12000000);
    });
  });

  describe('getUserContext', () => {
    it('should build user context correctly', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const context = await agent.getUserContext(mockUserId);

      expect(context.name).toBe('Aisha');
      expect(context.city).toBe('New York');
      expect(context.currency).toBe('NGN');
      expect(context.goals).toHaveLength(1);
      expect(context.goals[0].name).toBe('House Down Payment');
      expect(context.currentSavingsRate).toBe(0.2); // (400k - 320k) / 400k
    });

    it('should calculate age from date of birth', async () => {
      // Mock user born in 1998, so age should be around 27-28
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const context = await agent.getUserContext(mockUserId);

      // Age should be calculated from DOB (1998-06-15)
      const expectedAge = new Date().getFullYear() - 1998;
      expect(context.age).toBeGreaterThanOrEqual(expectedAge - 1);
      expect(context.age).toBeLessThanOrEqual(expectedAge);
    });

    it('should use default name when firstName is missing', async () => {
      const userWithoutName = { ...mockUser, firstName: null };
      prismaService.user.findUnique.mockResolvedValue(userWithoutName);

      const context = await agent.getUserContext(mockUserId);

      expect(context.name).toBe('Friend');
    });
  });
});
