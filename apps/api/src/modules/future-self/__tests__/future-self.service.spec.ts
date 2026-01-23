/**
 * FutureSelfService Unit Tests
 *
 * Tests cover:
 * - Simulation caching behavior
 * - Letter generation and persistence
 * - Timeline projection
 * - Preferences management
 * - Statistics calculation
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { FutureSelfService } from '../future-self.service';
import { FutureSimulation, TimelineProjection } from '../interfaces';

describe('FutureSelfService', () => {
  let service: FutureSelfService;
  let mockPrisma: {
    futureSelfLetter: {
      create: Mock;
      findMany: Mock;
      findFirst: Mock;
      update: Mock;
      aggregate: Mock;
      count: Mock;
      groupBy: Mock;
    };
    user: {
      findUnique: Mock;
      update: Mock;
    };
  };
  let mockRedis: {
    get: Mock;
    set: Mock;
    setNx: Mock;
    del: Mock;
  };
  let mockAgent: {
    generateSimulation: Mock;
    generateLetter: Mock;
    getTimeline: Mock;
  };

  const mockUserId = 'user-123';

  const mockSimulation: FutureSimulation = {
    currentBehavior: {
      savingsRate: 0.12,
      projectedNetWorth: {
        '6mo': 550000,
        '1yr': 620000,
        '5yr': 2100000,
        '10yr': 4800000,
        '20yr': 12000000,
      },
    },
    withIKPA: {
      savingsRate: 0.18,
      projectedNetWorth: {
        '6mo': 580000,
        '1yr': 700000,
        '5yr': 3200000,
        '10yr': 8500000,
        '20yr': 28000000,
      },
    },
    difference_20yr: 16000000,
  };

  const mockTimeline: TimelineProjection = {
    currentPath: 4800000,
    optimizedPath: 8500000,
    difference: 3700000,
    years: 10,
  };

  const mockLetter = {
    content: 'Dear Aisha...',
    generatedAt: new Date(),
    simulationData: mockSimulation,
    userAge: 28,
    futureAge: 60,
    toneScore: 4,
    tokenUsage: { promptTokens: 100, completionTokens: 200 },
  };

  beforeEach(() => {
    // Create fresh mocks for each test
    mockPrisma = {
      futureSelfLetter: {
        create: vi.fn().mockResolvedValue({ id: 'letter-123' }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 }, _avg: { readDurationMs: null, toneEmpathyScore: null } }),
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ weeklyReportEnabled: true, updatedAt: new Date() }),
        update: vi.fn().mockResolvedValue({ weeklyReportEnabled: false, updatedAt: new Date() }),
      },
    };

    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      setNx: vi.fn().mockResolvedValue(true),
      del: vi.fn().mockResolvedValue(true),
    };

    mockAgent = {
      generateSimulation: vi.fn().mockResolvedValue(mockSimulation),
      generateLetter: vi.fn().mockResolvedValue(mockLetter),
      getTimeline: vi.fn().mockResolvedValue(mockTimeline),
    };

    // Manually construct service with mocks
    service = new FutureSelfService(
      mockPrisma as any,
      mockRedis as any,
      mockAgent as any,
    );
  });

  // ==========================================
  // SIMULATION TESTS
  // ==========================================

  describe('getSimulation', () => {
    it('should return simulation from agent when cache miss', async () => {
      const result = await service.getSimulation(mockUserId);

      expect(result).toEqual(mockSimulation);
      expect(mockAgent.generateSimulation).toHaveBeenCalledWith(mockUserId);
    });

    it('should return cached simulation when cache hit', async () => {
      mockRedis.get.mockResolvedValue(mockSimulation);

      const result = await service.getSimulation(mockUserId);

      expect(result).toEqual(mockSimulation);
      expect(mockAgent.generateSimulation).not.toHaveBeenCalled();
    });

    it('should cache simulation after generation', async () => {
      await service.getSimulation(mockUserId);

      // Wait for non-blocking cache write
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should continue if cache read fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));

      const result = await service.getSimulation(mockUserId);

      expect(result).toEqual(mockSimulation);
      expect(mockAgent.generateSimulation).toHaveBeenCalled();
    });
  });

  // ==========================================
  // LETTER TESTS
  // ==========================================

  describe('getLetter', () => {
    it('should persist letter to database after generating', async () => {
      await service.getLetter(mockUserId);

      expect(mockPrisma.futureSelfLetter.create).toHaveBeenCalled();
    });

    it('should return cached letter when cache hit', async () => {
      const cachedLetter = { ...mockLetter, id: 'cached-123' };
      mockRedis.get.mockResolvedValue(cachedLetter);

      const result = await service.getLetter(mockUserId);

      expect(result).toEqual(cachedLetter);
      expect(mockAgent.generateLetter).not.toHaveBeenCalled();
    });

    it('should include letter ID from database in response', async () => {
      const result = await service.getLetter(mockUserId);

      expect(result.id).toBe('letter-123');
    });

    it('should use idempotency check before generating', async () => {
      await service.getLetter(mockUserId);

      expect(mockRedis.setNx).toHaveBeenCalled();
    });
  });

  // ==========================================
  // TIMELINE TESTS
  // ==========================================

  describe('getTimeline', () => {
    it('should return timeline from agent', async () => {
      const result = await service.getTimeline(mockUserId, 10);

      expect(result).toEqual(mockTimeline);
      expect(mockAgent.getTimeline).toHaveBeenCalledWith(mockUserId, 10);
    });
  });

  // ==========================================
  // CACHE INVALIDATION TESTS
  // ==========================================

  describe('invalidateCache', () => {
    it('should call del for cache invalidation', async () => {
      await service.invalidateCache(mockUserId);

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate both simulation and letter caches', async () => {
      await service.invalidateCache(mockUserId);

      // Should be called twice - once for simulation, once for letter
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('should not throw if cache invalidation fails', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis down'));

      // Should not throw
      await expect(service.invalidateCache(mockUserId)).resolves.toBeUndefined();
    });
  });

  // ==========================================
  // PREFERENCES TESTS
  // ==========================================

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      const result = await service.getPreferences(mockUserId);

      expect(result.weeklyLettersEnabled).toBe(true);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should return default preferences if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getPreferences(mockUserId);

      expect(result.weeklyLettersEnabled).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const result = await service.updatePreferences(mockUserId, false);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: { weeklyReportEnabled: false },
        }),
      );
      expect(result.weeklyLettersEnabled).toBe(false);
    });
  });

  // ==========================================
  // LETTER DETAIL TESTS
  // ==========================================

  describe('getLetterById', () => {
    it('should return null if letter not found', async () => {
      const result = await service.getLetterById(mockUserId, 'non-existent');

      expect(result).toBeNull();
    });

    it('should return letter details when found', async () => {
      const mockDbLetter = {
        id: 'letter-123',
        content: 'Dear Aisha...',
        trigger: 'USER_REQUEST',
        createdAt: new Date(),
        readAt: null,
        userAge: 28,
        futureAge: 60,
        currentSavingsRate: 0.12,
        optimizedSavingsRate: 0.18,
        wealthDifference20yr: 16000000,
        toneEmpathyScore: 4,
      };
      mockPrisma.futureSelfLetter.findFirst.mockResolvedValue(mockDbLetter);

      const result = await service.getLetterById(mockUserId, 'letter-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('letter-123');
      expect(result?.content).toBe('Dear Aisha...');
    });
  });

  // ==========================================
  // STATISTICS TESTS
  // ==========================================

  describe('getStatistics', () => {
    it('should return statistics with zero values for new user', async () => {
      const result = await service.getStatistics(mockUserId);

      expect(result.totalLetters).toBe(0);
      expect(result.lettersRead).toBe(0);
      expect(result.avgReadDurationMs).toBeNull();
      expect(result.avgToneScore).toBeNull();
    });

    it('should aggregate statistics correctly', async () => {
      mockPrisma.futureSelfLetter.aggregate.mockResolvedValue({
        _count: { id: 10 },
        _avg: { readDurationMs: 45000, toneEmpathyScore: 4.2 },
      });
      mockPrisma.futureSelfLetter.count.mockResolvedValue(8);
      mockPrisma.futureSelfLetter.findFirst
        .mockResolvedValueOnce({ createdAt: new Date('2025-01-01') })
        .mockResolvedValueOnce({ createdAt: new Date('2026-01-20') });
      mockPrisma.futureSelfLetter.groupBy.mockResolvedValue([
        { trigger: 'USER_REQUEST', _count: { trigger: 5 } },
        { trigger: 'WEEKLY_SCHEDULED', _count: { trigger: 5 } },
      ]);

      const result = await service.getStatistics(mockUserId);

      expect(result.totalLetters).toBe(10);
      expect(result.lettersRead).toBe(8);
      expect(result.avgReadDurationMs).toBe(45000);
      expect(result.avgToneScore).toBe(4.2);
      expect(result.byTrigger).toEqual({
        USER_REQUEST: 5,
        WEEKLY_SCHEDULED: 5,
      });
    });
  });

  // ==========================================
  // LETTER HISTORY TESTS
  // ==========================================

  describe('getLetterHistory', () => {
    it('should return empty array for user with no letters', async () => {
      const result = await service.getLetterHistory(mockUserId);

      expect(result).toEqual([]);
    });

    it('should return letters with pagination', async () => {
      const mockLetters = [
        { id: 'letter-1', content: 'Letter 1', trigger: 'USER_REQUEST', toneEmpathyScore: 4, createdAt: new Date(), readAt: null },
        { id: 'letter-2', content: 'Letter 2', trigger: 'WEEKLY_SCHEDULED', toneEmpathyScore: 5, createdAt: new Date(), readAt: new Date() },
      ];
      mockPrisma.futureSelfLetter.findMany.mockResolvedValue(mockLetters);

      const result = await service.getLetterHistory(mockUserId, 10, 0);

      expect(result).toHaveLength(2);
      expect(mockPrisma.futureSelfLetter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 0,
        }),
      );
    });
  });
});
