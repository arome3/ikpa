/**
 * Future Self Cron Service Tests
 *
 * Tests for scheduled letter generation including:
 * - Weekly batch job
 * - Distributed locking
 * - Retry queue management
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { FutureSelfCronService } from '../future-self.cron';

describe('FutureSelfCronService', () => {
  let service: FutureSelfCronService;
  let mockPrisma: {
    user: { findMany: Mock };
  };
  let mockFutureSelfService: {
    getLetter: Mock;
    invalidateCache: Mock;
  };
  let mockOpikService: {
    createTrace: Mock;
    endTrace: Mock;
    flush: Mock;
  };
  let mockRedisService: {
    acquireLock: Mock;
    releaseLock: Mock;
    extendLock: Mock;
    get: Mock;
    set: Mock;
    del: Mock;
    keys: Mock;
  };

  beforeEach(() => {
    // Mock Prisma
    mockPrisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    // Mock Future Self Service
    mockFutureSelfService = {
      getLetter: vi.fn().mockResolvedValue({
        id: 'letter-123',
        content: 'Test letter',
        generatedAt: new Date(),
      }),
      invalidateCache: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Opik Service
    mockOpikService = {
      createTrace: vi.fn().mockReturnValue({ traceId: 'trace-123', trace: {} }),
      endTrace: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
    };

    // Mock Redis Service
    mockRedisService = {
      acquireLock: vi.fn().mockResolvedValue(true),
      releaseLock: vi.fn().mockResolvedValue(true),
      extendLock: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      del: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue([]),
    };

    // Manually construct service with mocks
    service = new FutureSelfCronService(
      mockPrisma as any,
      mockFutureSelfService as any,
      mockOpikService as any,
      mockRedisService as any,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // DISTRIBUTED LOCKING
  // ==========================================

  describe('distributed locking', () => {
    it('should skip job if lock cannot be acquired', async () => {
      mockRedisService.acquireLock.mockResolvedValue(false);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.generateWeeklyLetters();

      // Users are fetched before lock acquisition (for dynamic TTL calculation)
      expect(mockPrisma.user.findMany).toHaveBeenCalled();
      // But trace and processing should not happen
      expect(mockOpikService.createTrace).not.toHaveBeenCalled();
    });

    it('should acquire and release lock for successful job', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.generateWeeklyLetters();

      expect(mockRedisService.acquireLock).toHaveBeenCalledWith(
        'future_self:cron:weekly-letter-generation',
        expect.any(Number),
        expect.any(String),
      );
      expect(mockRedisService.releaseLock).toHaveBeenCalled();
    });

    it('should release lock even on error after lock acquired', async () => {
      // First findMany succeeds (for dynamic TTL), then we simulate error in processing
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', name: 'User 1' }]);
      mockFutureSelfService.getLetter.mockRejectedValue(new Error('Generation Error'));

      await service.generateWeeklyLetters();

      expect(mockRedisService.releaseLock).toHaveBeenCalled();
    });
  });

  // ==========================================
  // BATCH PROCESSING
  // ==========================================

  describe('batch processing', () => {
    it('should process all eligible users', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
        { id: 'user-3', name: 'User 3' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      await service.generateWeeklyLetters();

      expect(mockFutureSelfService.getLetter).toHaveBeenCalledTimes(3);
    });

    it('should continue processing on individual user failure', async () => {
      const mockUsers = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
        { id: 'user-3', name: 'User 3' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      // Fail on user-2
      mockFutureSelfService.getLetter
        .mockResolvedValueOnce({ id: 'letter-1' })
        .mockRejectedValueOnce(new Error('User 2 failed'))
        .mockResolvedValueOnce({ id: 'letter-3' });

      await service.generateWeeklyLetters();

      expect(mockFutureSelfService.getLetter).toHaveBeenCalledTimes(3);
      expect(mockRedisService.set).toHaveBeenCalled(); // Failed user added to retry queue
    });

    it('should create Opik trace for batch job', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.generateWeeklyLetters();

      expect(mockOpikService.createTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'weekly_future_self_letter_batch',
          tags: expect.arrayContaining(['future-self', 'cron', 'batch']),
        }),
      );
      expect(mockOpikService.endTrace).toHaveBeenCalled();
      expect(mockOpikService.flush).toHaveBeenCalled();
    });
  });

  // ==========================================
  // RETRY QUEUE
  // ==========================================

  describe('retry queue', () => {
    it('should add failed user to retry queue', async () => {
      const mockUsers = [{ id: 'user-1', name: 'User 1' }];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockFutureSelfService.getLetter.mockRejectedValue(
        new Error('Generation failed'),
      );

      await service.generateWeeklyLetters();

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'future_self:retry_queue:user-1',
        expect.objectContaining({
          userId: 'user-1',
          attemptCount: 1,
          lastError: 'Generation failed',
        }),
        expect.any(Number),
      );
    });

    it('should remove user from retry queue on success', async () => {
      const mockUsers = [{ id: 'user-1', name: 'User 1' }];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      await service.generateWeeklyLetters();

      expect(mockRedisService.del).toHaveBeenCalledWith(
        'future_self:retry_queue:user-1',
      );
    });

    it('should process retry queue entries', async () => {
      const retryEntry = {
        userId: 'user-1',
        attemptCount: 1,
        lastAttempt: Date.now() - 60000,
        nextRetry: Date.now() - 1000, // Ready for retry
        lastError: 'Previous error',
      };

      mockRedisService.keys.mockResolvedValue([
        'future_self:retry_queue:user-1',
      ]);
      mockRedisService.get.mockResolvedValue(retryEntry);

      await service.retryFailedLetters();

      expect(mockFutureSelfService.getLetter).toHaveBeenCalledWith(
        'user-1',
        'WEEKLY_SCHEDULED',
      );
    });

    it('should skip retry entries not ready for retry', async () => {
      const retryEntry = {
        userId: 'user-1',
        attemptCount: 1,
        lastAttempt: Date.now(),
        nextRetry: Date.now() + 60000, // Not ready yet
        lastError: 'Previous error',
      };

      mockRedisService.keys.mockResolvedValue([
        'future_self:retry_queue:user-1',
      ]);
      mockRedisService.get.mockResolvedValue(retryEntry);

      await service.retryFailedLetters();

      expect(mockFutureSelfService.getLetter).not.toHaveBeenCalled();
    });

    it('should skip entries that exceeded max retries', async () => {
      const retryEntry = {
        userId: 'user-1',
        attemptCount: 3, // Max is 3
        lastAttempt: Date.now() - 60000,
        nextRetry: Date.now() - 1000,
        lastError: 'Previous error',
      };

      mockRedisService.keys.mockResolvedValue([
        'future_self:retry_queue:user-1',
      ]);
      mockRedisService.get.mockResolvedValue(retryEntry);

      await service.retryFailedLetters();

      expect(mockFutureSelfService.getLetter).not.toHaveBeenCalled();
    });

    it('should use exponential backoff for retry delays', async () => {
      const mockUsers = [{ id: 'user-1', name: 'User 1' }];
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockFutureSelfService.getLetter.mockRejectedValue(
        new Error('Generation failed'),
      );

      // First failure
      await service.generateWeeklyLetters();

      const firstCall = mockRedisService.set.mock.calls[0];
      expect(firstCall[1].attemptCount).toBe(1);
      // First retry should be scheduled for 5 minutes later
      expect(firstCall[1].nextRetry - firstCall[1].lastAttempt).toBe(5 * 60 * 1000);
    });
  });

  // ==========================================
  // STATUS AND MANUAL TRIGGERS
  // ==========================================

  describe('getJobStatus', () => {
    it('should return job configuration', () => {
      const status = service.getJobStatus();

      expect(status).toEqual({
        jobName: 'weekly-future-self-letter-generation',
        schedule: '0 9 * * 1',
        timezone: 'UTC',
        description: expect.any(String),
        batchConfig: expect.objectContaining({
          concurrency: expect.any(Number),
          lockTtlMs: expect.any(Number),
        }),
      });
    });
  });

  describe('getRetryQueueStatus', () => {
    it('should return retry queue status', async () => {
      const retryEntry = {
        userId: 'user-1',
        attemptCount: 2,
        lastAttempt: Date.now(),
        nextRetry: Date.now() + 60000,
        lastError: 'Error',
      };

      mockRedisService.keys.mockResolvedValue([
        'future_self:retry_queue:user-1',
      ]);
      mockRedisService.get.mockResolvedValue(retryEntry);

      const status = await service.getRetryQueueStatus();

      expect(status.queueSize).toBe(1);
      expect(status.entries[0]).toEqual({
        userId: 'user-1',
        attemptCount: 2,
        nextRetryIn: expect.any(String),
      });
    });

    it('should return empty status when queue is empty', async () => {
      mockRedisService.keys.mockResolvedValue([]);

      const status = await service.getRetryQueueStatus();

      expect(status.queueSize).toBe(0);
      expect(status.entries).toEqual([]);
    });
  });

  describe('triggerManualRun', () => {
    it('should trigger weekly job manually', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.triggerManualRun();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Manual run completed');
    });

    it('should return failure on DB error before lock acquisition', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB Error'));

      const result = await service.triggerManualRun();

      // DB error happens before lock, so triggerManualRun catches it
      expect(result.success).toBe(false);
      expect(result.message).toBe('DB Error');
    });
  });

  describe('triggerRetryRun', () => {
    it('should trigger retry job manually', async () => {
      mockRedisService.keys.mockResolvedValue([]);

      const result = await service.triggerRetryRun();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Retry run completed');
    });

    it('should return failure on lock acquisition error', async () => {
      mockRedisService.acquireLock.mockRejectedValue(new Error('Redis Error'));

      const result = await service.triggerRetryRun();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Redis Error');
    });
  });
});
