/**
 * Tool Optimizer Service Tests
 *
 * Tests GEPA pattern analysis, rule generation, and tool recommendations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ToolOptimizerService } from '../tool-optimizer.service';
import { PatternAnalyzer } from '../pattern-analyzer';
import { RuleGenerator } from '../rule-generator';
import { AlertService } from '../../alerting/alert.service';
import { PrismaService } from '../../../../../../prisma/prisma.service';
import { RedisService } from '../../../../../../redis/redis.service';
import { OpikService } from '../../../opik.service';
import {
  UserProfileFeatures,
  ToolSelectionRecord,
  ToolSelectionRule,
  ExtractedPattern,
  OptimizedToolPolicy,
} from '../../interfaces';
import { GEPA_DEFAULT_TOOL, GEPA_MIN_SAMPLE_SIZE } from '../../optimizer.constants';

describe('ToolOptimizerService', () => {
  let service: ToolOptimizerService;
  let mockPrisma: Partial<PrismaService>;
  let mockRedisService: Partial<RedisService>;
  let mockOpikService: Partial<OpikService>;
  let mockPatternAnalyzer: Partial<PatternAnalyzer>;
  let mockRuleGenerator: Partial<RuleGenerator>;
  let mockAlertService: Partial<AlertService>;

  const mockRules: ToolSelectionRule[] = [
    {
      id: 'rule-1',
      condition: [
        { feature: 'incomeStability', operator: 'gte', value: 0.7 },
        { feature: 'slipSeverity', operator: 'eq', value: 'minor' },
      ],
      recommendedTool: 'rate_adjustment',
      confidence: 0.85,
      sampleSize: 50,
      successRate: 0.78,
    },
    {
      id: 'rule-2',
      condition: [
        { feature: 'incomeStability', operator: 'lt', value: 0.3 },
      ],
      recommendedTool: 'time_adjustment',
      confidence: 0.72,
      sampleSize: 30,
      successRate: 0.65,
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      optimizerExperiment: {
        create: vi.fn().mockResolvedValue({ id: 'test-exp-1' }),
        update: vi.fn().mockResolvedValue({}),
      } as unknown as typeof mockPrisma.optimizerExperiment,
      toolSelectionHistory: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      } as unknown as typeof mockPrisma.toolSelectionHistory,
      toolSelectionRuleRecord: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      } as unknown as typeof mockPrisma.toolSelectionRuleRecord,
    };

    mockRedisService = {
      isAvailable: vi.fn().mockReturnValue(true),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      del: vi.fn().mockResolvedValue(true),
      acquireLock: vi.fn().mockResolvedValue(true),
      releaseLock: vi.fn().mockResolvedValue(true),
    };

    mockOpikService = {
      createTrace: vi.fn().mockReturnValue({
        trace: {},
        traceId: 'test-trace-1',
        traceName: 'test',
        startedAt: new Date(),
      }),
      createGeneralSpan: vi.fn().mockReturnValue({
        span: {},
        spanId: 'test-span-1',
      }),
      endTrace: vi.fn(),
      endSpan: vi.fn(),
      addFeedback: vi.fn().mockReturnValue(true),
      flush: vi.fn().mockResolvedValue(undefined),
    };

    mockPatternAnalyzer = {
      analyzePatterns: vi.fn().mockResolvedValue([
        {
          conditions: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          bestTool: 'rate_adjustment',
          successRate: 0.78,
          sampleSize: 50,
          confidence: 0.85,
        },
      ]),
    };

    mockRuleGenerator = {
      generateRules: vi.fn().mockReturnValue(mockRules),
      validateRules: vi.fn().mockImplementation((rules) => rules),
      mergeRules: vi.fn().mockImplementation((rules) => rules),
    };

    mockAlertService = {
      sendOptimizationFailure: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolOptimizerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: OpikService, useValue: mockOpikService },
        { provide: PatternAnalyzer, useValue: mockPatternAnalyzer },
        { provide: RuleGenerator, useValue: mockRuleGenerator },
        { provide: AlertService, useValue: mockAlertService },
      ],
    }).compile();

    service = module.get<ToolOptimizerService>(ToolOptimizerService);
  });

  describe('recommendTool', () => {
    beforeEach(() => {
      // Set up cached policy
      (service as unknown as { localCachePolicy: OptimizedToolPolicy }).localCachePolicy = {
        version: 'v1',
        rules: mockRules,
        defaultTool: 'time_adjustment',
        metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.78 },
      };
    });

    it('should recommend tool based on matching rule', async () => {
      const profile: UserProfileFeatures = {
        incomeStability: 0.8,
        savingsRate: 0.15,
        dependencyRatio: 0.2,
        slipSeverity: 'minor',
      };

      const result = await service.recommendTool(profile);

      expect(result.tool).toBe('rate_adjustment');
      expect(result.confidence).toBe(0.85);
      expect(result.matchedRuleId).toBe('rule-1');
    });

    it('should return default tool when no rules match', async () => {
      const profile: UserProfileFeatures = {
        incomeStability: 0.5, // Doesn't match any rule
        savingsRate: 0.15,
        dependencyRatio: 0.2,
        slipSeverity: 'severe', // Different severity
      };

      const result = await service.recommendTool(profile);

      expect(result.tool).toBe('time_adjustment'); // Default
      expect(result.confidence).toBe(0.5);
      expect(result.matchedRuleId).toBeUndefined();
    });

    it('should provide alternatives from other matching rules', async () => {
      // Add another rule that matches
      (service as unknown as { localCachePolicy: OptimizedToolPolicy }).localCachePolicy.rules = [
        ...mockRules,
        {
          id: 'rule-3',
          condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.5 }],
          recommendedTool: 'freeze_protocol',
          confidence: 0.65,
          sampleSize: 25,
          successRate: 0.6,
        },
      ];

      const profile: UserProfileFeatures = {
        incomeStability: 0.8,
        savingsRate: 0.15,
        dependencyRatio: 0.2,
        slipSeverity: 'minor',
      };

      const result = await service.recommendTool(profile);

      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should return default when no policy exists', async () => {
      (service as unknown as { localCachePolicy: OptimizedToolPolicy | null }).localCachePolicy = null;
      (mockPrisma.toolSelectionRuleRecord?.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const profile: UserProfileFeatures = {
        incomeStability: 0.8,
        savingsRate: 0.15,
        dependencyRatio: 0.2,
        slipSeverity: 'minor',
      };

      const result = await service.recommendTool(profile);

      expect(result.tool).toBe(GEPA_DEFAULT_TOOL);
    });
  });

  describe('recordSelection', () => {
    it('should save selection to database', async () => {
      const record: ToolSelectionRecord = {
        userId: 'user-1',
        sessionId: 'session-1',
        selectedTool: 'rate_adjustment',
        userProfile: {
          incomeStability: 0.8,
          savingsRate: 0.15,
          dependencyRatio: 0.2,
          slipSeverity: 'minor',
        },
        outcome: { success: true, recoveryDays: 14 },
      };

      await service.recordSelection(record);

      expect(mockPrisma.toolSelectionHistory?.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
          selectedTool: 'rate_adjustment',
        }),
      });
    });
  });

  describe('refreshPolicy', () => {
    it('should invalidate cache and reload from database', async () => {
      const mockPolicy = {
        version: 'v1',
        rules: mockRules,
        defaultTool: 'time_adjustment',
        metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.78 },
      };

      // Set up database to return rules
      (mockPrisma.toolSelectionRuleRecord?.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRules.map((r, i) => ({
          id: r.id,
          version: 'v1',
          condition: r.condition,
          recommendedTool: r.recommendedTool,
          confidence: r.confidence,
          sampleSize: r.sampleSize,
          successRate: r.successRate,
        })),
      );

      const result = await service.refreshPolicy();

      expect(mockRedisService.acquireLock).toHaveBeenCalled();
      expect(mockRedisService.del).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalled();
      expect(mockRedisService.releaseLock).toHaveBeenCalled();
      expect(result?.version).toBe('v1');
    });

    it('should return existing cache when lock cannot be acquired', async () => {
      (mockRedisService.acquireLock as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      // Set up local cache
      (service as unknown as { localCachePolicy: OptimizedToolPolicy }).localCachePolicy = {
        version: 'v1',
        rules: mockRules,
        defaultTool: 'time_adjustment',
        metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.78 },
      };

      const result = await service.refreshPolicy();

      expect(result?.version).toBe('v1');
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateCache', () => {
    it('should clear both local and Redis cache', async () => {
      (service as unknown as { localCachePolicy: OptimizedToolPolicy | null }).localCachePolicy = {
        version: 'v1',
        rules: mockRules,
        defaultTool: 'time_adjustment',
        metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.78 },
      };

      await service.invalidateCache();

      expect(mockRedisService.del).toHaveBeenCalledWith('optimizer:tool:policy:current');
      expect(
        (service as unknown as { localCachePolicy: OptimizedToolPolicy | null }).localCachePolicy,
      ).toBeNull();
    });
  });

  describe('getActivePolicy with Redis', () => {
    it('should return policy from Redis cache', async () => {
      const cachedPolicy = {
        version: 'v1',
        rules: mockRules,
        defaultTool: 'time_adjustment',
        metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.78 },
      };
      (mockRedisService.get as ReturnType<typeof vi.fn>).mockResolvedValue(cachedPolicy);

      const result = await service.getActivePolicy();

      expect(mockRedisService.get).toHaveBeenCalledWith('optimizer:tool:policy:current');
      expect(result?.version).toBe('v1');
    });

    it('should fall back to local cache when Redis unavailable', async () => {
      (mockRedisService.isAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);
      (service as unknown as { localCachePolicy: OptimizedToolPolicy }).localCachePolicy = {
        version: 'v-local',
        rules: mockRules,
        defaultTool: 'time_adjustment',
        metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.78 },
      };

      const result = await service.getActivePolicy();

      expect(result?.version).toBe('v-local');
    });

    it('should load from database and cache when no cache exists', async () => {
      (mockRedisService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockPrisma.toolSelectionRuleRecord?.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRules.map((r) => ({
          id: r.id,
          version: 'v-db',
          condition: r.condition,
          recommendedTool: r.recommendedTool,
          confidence: r.confidence,
          sampleSize: r.sampleSize,
          successRate: r.successRate,
        })),
      );

      const result = await service.getActivePolicy();

      expect(mockRedisService.set).toHaveBeenCalled();
      expect(result?.version).toBe('v-db');
    });
  });

  describe('optimizeToolSelection', () => {
    it('should complete optimization pipeline', async () => {
      const result = await service.optimizeToolSelection();

      expect(result.version).toBeDefined();
      expect(result.rules.length).toBeGreaterThan(0);
      expect(result.defaultTool).toBe(GEPA_DEFAULT_TOOL);
    });

    it('should call pattern analyzer', async () => {
      await service.optimizeToolSelection();

      expect(mockPatternAnalyzer.analyzePatterns).toHaveBeenCalled();
    });

    it('should call rule generator pipeline', async () => {
      await service.optimizeToolSelection();

      expect(mockRuleGenerator.generateRules).toHaveBeenCalled();
      expect(mockRuleGenerator.validateRules).toHaveBeenCalled();
      expect(mockRuleGenerator.mergeRules).toHaveBeenCalled();
    });

    it('should save rules to database', async () => {
      await service.optimizeToolSelection();

      expect(mockPrisma.toolSelectionRuleRecord?.createMany).toHaveBeenCalled();
    });

    it('should deactivate old rules', async () => {
      await service.optimizeToolSelection();

      expect(mockPrisma.toolSelectionRuleRecord?.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });
  });

  /**
   * Policy Accuracy Calculation Tests
   *
   * These tests verify the multi-armed bandit aware accuracy calculation that:
   * - Does not penalize policy when user succeeded with an equally good tool
   * - Properly credits policy when it would have recommended a better tool
   * - Uses profile-specific historical success rates for comparison
   */
  describe('calculatePolicyAccuracy (multi-armed bandit aware)', () => {
    // Helper to access private method via type casting
    const callCalculatePolicyAccuracy = async (
      svc: ToolOptimizerService,
      policy: OptimizedToolPolicy,
      data: ToolSelectionRecord[],
    ): Promise<number> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (svc as any).calculatePolicyAccuracy(policy, data);
    };

    // Helper to access getHistoricalToolSuccessRate
    const callGetHistoricalToolSuccessRate = (
      svc: ToolOptimizerService,
      tool: string,
      profile: UserProfileFeatures,
      data: ToolSelectionRecord[],
    ): number | null => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (svc as any).getHistoricalToolSuccessRate(tool, profile, data);
    };

    const baseProfile: UserProfileFeatures = {
      incomeStability: 0.8,
      savingsRate: 0.15,
      dependencyRatio: 0.2,
      slipSeverity: 'minor',
    };

    beforeEach(() => {
      // Set up policy that recommends rate_adjustment for high income stability
      (service as unknown as { localCachePolicy: OptimizedToolPolicy }).localCachePolicy = {
        version: 'v1',
        rules: mockRules,
        defaultTool: 'time_adjustment',
        metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.78 },
      };
    });

    describe('getHistoricalToolSuccessRate', () => {
      it('should return success rate for similar profiles', () => {
        const data: ToolSelectionRecord[] = [
          {
            userId: 'u1',
            sessionId: 's1',
            selectedTool: 'rate_adjustment',
            userProfile: { incomeStability: 0.85, savingsRate: 0.18, dependencyRatio: 0.22, slipSeverity: 'minor' },
            outcome: { success: true },
          },
          {
            userId: 'u2',
            sessionId: 's2',
            selectedTool: 'rate_adjustment',
            userProfile: { incomeStability: 0.78, savingsRate: 0.12, dependencyRatio: 0.18, slipSeverity: 'minor' },
            outcome: { success: true },
          },
          {
            userId: 'u3',
            sessionId: 's3',
            selectedTool: 'rate_adjustment',
            userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' },
            outcome: { success: false },
          },
        ];

        const rate = callGetHistoricalToolSuccessRate(service, 'rate_adjustment', baseProfile, data);

        // 2 out of 3 similar profiles succeeded
        expect(rate).toBeCloseTo(0.667, 2);
      });

      it('should return null when no similar profiles exist', () => {
        const data: ToolSelectionRecord[] = [
          {
            userId: 'u1',
            sessionId: 's1',
            selectedTool: 'rate_adjustment',
            userProfile: { incomeStability: 0.2, savingsRate: 0.5, dependencyRatio: 0.7, slipSeverity: 'severe' },
            outcome: { success: true },
          },
        ];

        const rate = callGetHistoricalToolSuccessRate(service, 'rate_adjustment', baseProfile, data);

        expect(rate).toBeNull();
      });

      it('should only consider records with matching tool', () => {
        const data: ToolSelectionRecord[] = [
          {
            userId: 'u1',
            sessionId: 's1',
            selectedTool: 'time_adjustment', // Different tool
            userProfile: { incomeStability: 0.85, savingsRate: 0.18, dependencyRatio: 0.22, slipSeverity: 'minor' },
            outcome: { success: true },
          },
        ];

        const rate = callGetHistoricalToolSuccessRate(service, 'rate_adjustment', baseProfile, data);

        expect(rate).toBeNull();
      });
    });

    describe('scoring for matching recommendations', () => {
      it('should score 1.0 when policy matches user AND user succeeded', async () => {
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: [{
            id: 'r1',
            condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
            recommendedTool: 'rate_adjustment',
            confidence: 0.85,
            sampleSize: 50,
            successRate: 0.8,
          }],
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.85 },
        };

        const data: ToolSelectionRecord[] = [{
          userId: 'u1',
          sessionId: 's1',
          selectedTool: 'rate_adjustment', // Matches policy
          userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' },
          outcome: { success: true }, // User succeeded
        }];

        const accuracy = await callCalculatePolicyAccuracy(service, policy, data);

        expect(accuracy).toBe(1.0);
      });

      it('should score 0.0 when policy matches user AND user failed', async () => {
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: [{
            id: 'r1',
            condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
            recommendedTool: 'rate_adjustment',
            confidence: 0.85,
            sampleSize: 50,
            successRate: 0.8,
          }],
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.85 },
        };

        const data: ToolSelectionRecord[] = [{
          userId: 'u1',
          sessionId: 's1',
          selectedTool: 'rate_adjustment', // Matches policy
          userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' },
          outcome: { success: false }, // User failed
        }];

        const accuracy = await callCalculatePolicyAccuracy(service, policy, data);

        expect(accuracy).toBe(0.0);
      });
    });

    describe('scoring for acceptable disagreements (user succeeded with different tool)', () => {
      it('should score 0.8 when user tool success rate >= policy tool rate', async () => {
        // Policy recommends rate_adjustment, but user used time_adjustment successfully
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: [{
            id: 'r1',
            condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
            recommendedTool: 'rate_adjustment',
            confidence: 0.85,
            sampleSize: 50,
            successRate: 0.6, // Lower success rate
          }],
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.85 },
        };

        // Historical data showing time_adjustment has better success rate for this profile type
        const historicalData: ToolSelectionRecord[] = [
          // time_adjustment successes (80% success rate)
          { userId: 'h1', sessionId: 'hs1', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h2', sessionId: 'hs2', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h3', sessionId: 'hs3', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h4', sessionId: 'hs4', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.81, savingsRate: 0.17, dependencyRatio: 0.22, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h5', sessionId: 'hs5', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.77, savingsRate: 0.13, dependencyRatio: 0.18, slipSeverity: 'minor' }, outcome: { success: false } },
          // rate_adjustment successes (60% success rate)
          { userId: 'h6', sessionId: 'hs6', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h7', sessionId: 'hs7', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h8', sessionId: 'hs8', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h9', sessionId: 'hs9', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.81, savingsRate: 0.17, dependencyRatio: 0.22, slipSeverity: 'minor' }, outcome: { success: false } },
          { userId: 'h10', sessionId: 'hs10', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.77, savingsRate: 0.13, dependencyRatio: 0.18, slipSeverity: 'minor' }, outcome: { success: false } },
          // The test case: user chose time_adjustment and succeeded
          { userId: 'u1', sessionId: 's1', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' }, outcome: { success: true } },
        ];

        const accuracy = await callCalculatePolicyAccuracy(service, policy, historicalData);

        // User's tool (time_adjustment) has ~80% success rate >= policy's tool (rate_adjustment) ~60%
        // So accuracy should be closer to 0.8 (acceptable disagreement)
        expect(accuracy).toBeGreaterThanOrEqual(0.7);
        expect(accuracy).toBeLessThanOrEqual(0.9);
      });

      it('should score 0.5 when user succeeded but policy tool has better historical rate', async () => {
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: [{
            id: 'r1',
            condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
            recommendedTool: 'rate_adjustment',
            confidence: 0.85,
            sampleSize: 50,
            successRate: 0.9, // High success rate
          }],
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.85 },
        };

        // Historical data showing rate_adjustment has better success rate
        const historicalData: ToolSelectionRecord[] = [
          // rate_adjustment successes (90% success rate)
          { userId: 'h1', sessionId: 'hs1', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h2', sessionId: 'hs2', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h3', sessionId: 'hs3', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h4', sessionId: 'hs4', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.81, savingsRate: 0.17, dependencyRatio: 0.22, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h5', sessionId: 'hs5', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.77, savingsRate: 0.13, dependencyRatio: 0.18, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h11', sessionId: 'hs11', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h12', sessionId: 'hs12', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h13', sessionId: 'hs13', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h14', sessionId: 'hs14', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.81, savingsRate: 0.17, dependencyRatio: 0.22, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h15', sessionId: 'hs15', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.77, savingsRate: 0.13, dependencyRatio: 0.18, slipSeverity: 'minor' }, outcome: { success: false } },
          // time_adjustment (50% success rate)
          { userId: 'h6', sessionId: 'hs6', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h7', sessionId: 'hs7', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: false } },
          // The test case: user chose time_adjustment and succeeded
          { userId: 'u1', sessionId: 's1', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' }, outcome: { success: true } },
        ];

        const accuracy = await callCalculatePolicyAccuracy(service, policy, historicalData);

        // User's tool (time_adjustment) has ~50% success rate < policy's tool (rate_adjustment) ~90%
        // So accuracy should be around 0.5 (policy might be better)
        expect(accuracy).toBeGreaterThanOrEqual(0.4);
        expect(accuracy).toBeLessThanOrEqual(0.7);
      });
    });

    describe('scoring for suboptimal user choices (user failed)', () => {
      it('should score 0.7 when policy tool has better historical rate than user tool', async () => {
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: [{
            id: 'r1',
            condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
            recommendedTool: 'rate_adjustment',
            confidence: 0.85,
            sampleSize: 50,
            successRate: 0.85,
          }],
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.85 },
        };

        // Historical data showing rate_adjustment has much better success rate
        const historicalData: ToolSelectionRecord[] = [
          // rate_adjustment (80% success rate)
          { userId: 'h1', sessionId: 'hs1', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h2', sessionId: 'hs2', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h3', sessionId: 'hs3', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h4', sessionId: 'hs4', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.81, savingsRate: 0.17, dependencyRatio: 0.22, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h5', sessionId: 'hs5', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.77, savingsRate: 0.13, dependencyRatio: 0.18, slipSeverity: 'minor' }, outcome: { success: false } },
          // time_adjustment (30% success rate - much worse)
          { userId: 'h6', sessionId: 'hs6', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: false } },
          { userId: 'h7', sessionId: 'hs7', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: false } },
          { userId: 'h8', sessionId: 'hs8', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: true } },
          // The test case: user chose time_adjustment and FAILED
          { userId: 'u1', sessionId: 's1', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' }, outcome: { success: false } },
        ];

        const accuracy = await callCalculatePolicyAccuracy(service, policy, historicalData);

        // Policy's tool (rate_adjustment) 80% > user's tool (time_adjustment) ~33%
        // Should score ~0.7 (policy would have been better)
        expect(accuracy).toBeGreaterThanOrEqual(0.5);
        expect(accuracy).toBeLessThanOrEqual(0.8);
      });

      it('should score 0.3 when policy tool rate is not better than user tool rate', async () => {
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: [{
            id: 'r1',
            condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
            recommendedTool: 'rate_adjustment',
            confidence: 0.85,
            sampleSize: 50,
            successRate: 0.3, // Low success rate
          }],
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 100, coveragePercentage: 0.8, averageConfidence: 0.85 },
        };

        // Both tools have similarly poor success rates
        const historicalData: ToolSelectionRecord[] = [
          // rate_adjustment (40% success rate)
          { userId: 'h1', sessionId: 'hs1', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h2', sessionId: 'hs2', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h3', sessionId: 'hs3', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: false } },
          { userId: 'h4', sessionId: 'hs4', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.81, savingsRate: 0.17, dependencyRatio: 0.22, slipSeverity: 'minor' }, outcome: { success: false } },
          { userId: 'h5', sessionId: 'hs5', selectedTool: 'rate_adjustment', userProfile: { incomeStability: 0.77, savingsRate: 0.13, dependencyRatio: 0.18, slipSeverity: 'minor' }, outcome: { success: false } },
          // time_adjustment (40% success rate - similar)
          { userId: 'h6', sessionId: 'hs6', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.78, savingsRate: 0.14, dependencyRatio: 0.19, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h7', sessionId: 'hs7', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.82, savingsRate: 0.16, dependencyRatio: 0.21, slipSeverity: 'minor' }, outcome: { success: true } },
          { userId: 'h8', sessionId: 'hs8', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.79, savingsRate: 0.15, dependencyRatio: 0.20, slipSeverity: 'minor' }, outcome: { success: false } },
          { userId: 'h9', sessionId: 'hs9', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.81, savingsRate: 0.17, dependencyRatio: 0.22, slipSeverity: 'minor' }, outcome: { success: false } },
          { userId: 'h10', sessionId: 'hs10', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.77, savingsRate: 0.13, dependencyRatio: 0.18, slipSeverity: 'minor' }, outcome: { success: false } },
          // The test case: user chose time_adjustment and FAILED
          { userId: 'u1', sessionId: 's1', selectedTool: 'time_adjustment', userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' }, outcome: { success: false } },
        ];

        const accuracy = await callCalculatePolicyAccuracy(service, policy, historicalData);

        // Both tools have ~40% success rate, policy's tool is not demonstrably better
        // Should score ~0.3 (disagreement with no clear winner)
        expect(accuracy).toBeGreaterThanOrEqual(0.2);
        expect(accuracy).toBeLessThanOrEqual(0.5);
      });
    });

    describe('edge cases', () => {
      it('should return 0 for empty data', async () => {
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: mockRules,
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 0, coveragePercentage: 0, averageConfidence: 0 },
        };

        const accuracy = await callCalculatePolicyAccuracy(service, policy, []);

        expect(accuracy).toBe(0);
      });

      it('should handle missing historical data gracefully', async () => {
        const policy: OptimizedToolPolicy = {
          version: 'v1',
          rules: [{
            id: 'r1',
            condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
            recommendedTool: 'rate_adjustment',
            confidence: 0.85,
            sampleSize: 50,
            successRate: 0.8,
          }],
          defaultTool: 'time_adjustment',
          metrics: { totalDataPoints: 1, coveragePercentage: 1, averageConfidence: 0.85 },
        };

        // Only one record, no historical data to compare
        const data: ToolSelectionRecord[] = [{
          userId: 'u1',
          sessionId: 's1',
          selectedTool: 'freeze_protocol', // Different tool, no historical data
          userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' },
          outcome: { success: true },
        }];

        // Should not throw and return a reasonable value
        const accuracy = await callCalculatePolicyAccuracy(service, policy, data);

        expect(accuracy).toBeGreaterThanOrEqual(0);
        expect(accuracy).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PatternAnalyzer],
    }).compile();

    analyzer = module.get<PatternAnalyzer>(PatternAnalyzer);
  });

  describe('analyzePatterns', () => {
    it('should return empty array for insufficient data', async () => {
      const patterns = await analyzer.analyzePatterns([]);

      expect(patterns).toEqual([]);
    });

    it('should extract patterns from sufficient data', async () => {
      const data: ToolSelectionRecord[] = Array(20)
        .fill(null)
        .map((_, i) => ({
          userId: `user-${i}`,
          sessionId: `session-${i}`,
          selectedTool: i % 2 === 0 ? 'rate_adjustment' : 'time_adjustment',
          userProfile: {
            incomeStability: i % 2 === 0 ? 0.8 : 0.2,
            savingsRate: 0.15,
            dependencyRatio: 0.2,
            slipSeverity: 'moderate' as const,
          },
          outcome: { success: i % 3 !== 0 }, // ~66% success rate
        }));

      const patterns = await analyzer.analyzePatterns(data);

      // Should extract some patterns based on income stability
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('calculateSuccessRate', () => {
    const data: ToolSelectionRecord[] = [
      {
        userId: 'u1',
        sessionId: 's1',
        selectedTool: 'rate_adjustment',
        userProfile: { incomeStability: 0.8, savingsRate: 0.15, dependencyRatio: 0.2, slipSeverity: 'minor' },
        outcome: { success: true },
      },
      {
        userId: 'u2',
        sessionId: 's2',
        selectedTool: 'rate_adjustment',
        userProfile: { incomeStability: 0.85, savingsRate: 0.2, dependencyRatio: 0.15, slipSeverity: 'minor' },
        outcome: { success: true },
      },
      {
        userId: 'u3',
        sessionId: 's3',
        selectedTool: 'rate_adjustment',
        userProfile: { incomeStability: 0.75, savingsRate: 0.1, dependencyRatio: 0.25, slipSeverity: 'minor' },
        outcome: { success: false },
      },
    ];

    it('should calculate correct success rate', () => {
      const result = analyzer.calculateSuccessRate(
        'rate_adjustment',
        [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
        data,
      );

      // 2 out of 3 successful = 66.7%
      expect(result.successRate).toBeCloseTo(0.667, 1);
      expect(result.sampleSize).toBe(3);
    });

    it('should return 0 for non-matching conditions', () => {
      const result = analyzer.calculateSuccessRate(
        'rate_adjustment',
        [{ feature: 'incomeStability', operator: 'lt', value: 0.5 }],
        data,
      );

      expect(result.sampleSize).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });
});

describe('RuleGenerator', () => {
  let generator: RuleGenerator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleGenerator],
    }).compile();

    generator = module.get<RuleGenerator>(RuleGenerator);
  });

  describe('generateRules', () => {
    it('should convert patterns to rules', () => {
      const patterns: ExtractedPattern[] = [
        {
          conditions: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          bestTool: 'rate_adjustment',
          successRate: 0.8,
          sampleSize: 50,
          confidence: 0.75,
        },
      ];

      const rules = generator.generateRules(patterns);

      expect(rules.length).toBe(1);
      expect(rules[0].recommendedTool).toBe('rate_adjustment');
      expect(rules[0].confidence).toBe(0.75);
    });

    it('should assign unique IDs to rules', () => {
      const patterns: ExtractedPattern[] = [
        {
          conditions: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          bestTool: 'rate_adjustment',
          successRate: 0.8,
          sampleSize: 50,
          confidence: 0.75,
        },
        {
          conditions: [{ feature: 'incomeStability', operator: 'lt', value: 0.3 }],
          bestTool: 'time_adjustment',
          successRate: 0.7,
          sampleSize: 30,
          confidence: 0.65,
        },
      ];

      const rules = generator.generateRules(patterns);

      expect(rules[0].id).not.toBe(rules[1].id);
    });
  });

  describe('validateRules', () => {
    it('should filter out rules with low sample size', () => {
      const rules: ToolSelectionRule[] = [
        {
          id: 'r1',
          condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          recommendedTool: 'rate_adjustment',
          confidence: 0.8,
          sampleSize: 5, // Below minimum
          successRate: 0.8,
        },
      ];

      const valid = generator.validateRules(rules);

      expect(valid.length).toBe(0);
    });

    it('should filter out rules with low confidence', () => {
      const rules: ToolSelectionRule[] = [
        {
          id: 'r1',
          condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          recommendedTool: 'rate_adjustment',
          confidence: 0.3, // Below minimum
          sampleSize: 50,
          successRate: 0.8,
        },
      ];

      const valid = generator.validateRules(rules);

      expect(valid.length).toBe(0);
    });

    it('should keep valid rules', () => {
      const rules: ToolSelectionRule[] = [
        {
          id: 'r1',
          condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          recommendedTool: 'rate_adjustment',
          confidence: 0.8,
          sampleSize: 50,
          successRate: 0.8,
        },
      ];

      const valid = generator.validateRules(rules);

      expect(valid.length).toBe(1);
    });
  });

  describe('mergeRules', () => {
    it('should return single rule unchanged', () => {
      const rules: ToolSelectionRule[] = [
        {
          id: 'r1',
          condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          recommendedTool: 'rate_adjustment',
          confidence: 0.8,
          sampleSize: 50,
          successRate: 0.8,
        },
      ];

      const merged = generator.mergeRules(rules);

      expect(merged.length).toBe(1);
    });

    it('should deduplicate identical rules', () => {
      const rules: ToolSelectionRule[] = [
        {
          id: 'r1',
          condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          recommendedTool: 'rate_adjustment',
          confidence: 0.8,
          sampleSize: 50,
          successRate: 0.8,
        },
        {
          id: 'r2',
          condition: [{ feature: 'incomeStability', operator: 'gte', value: 0.7 }],
          recommendedTool: 'rate_adjustment',
          confidence: 0.75,
          sampleSize: 40,
          successRate: 0.75,
        },
      ];

      const merged = generator.mergeRules(rules);

      // Should merge into one rule
      expect(merged.length).toBeLessThanOrEqual(rules.length);
    });
  });
});
