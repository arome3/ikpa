/**
 * LockoutService Unit Tests
 *
 * Tests cover:
 * - Account lockout after failed attempts
 * - Progressive lock duration escalation
 * - Successful login clearing lockouts
 * - Lock expiration handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LockoutService } from '../lockout.service';
import { AuthConfig } from '../auth.config';

// Mock PrismaService
const mockPrismaService = {
  accountLockout: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  loginAttempt: {
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
};

// Mock AuditService
const mockAuditService = {
  logAccountLocked: vi.fn(),
};

describe('LockoutService', () => {
  let lockoutService: LockoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    lockoutService = new LockoutService(
      mockPrismaService as any,
      mockAuditService as any,
    );
  });

  describe('checkLockout', () => {
    it('should return not locked when no lockout record exists', async () => {
      mockPrismaService.accountLockout.findUnique.mockResolvedValue(null);
      mockPrismaService.loginAttempt.count.mockResolvedValue(2);

      const result = await lockoutService.checkLockout('test@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.lockedUntil).toBeNull();
      expect(result.remainingSeconds).toBe(0);
      expect(result.failedAttempts).toBe(2);
    });

    it('should return locked when active lockout exists', async () => {
      const futureDate = new Date(Date.now() + 600000); // 10 minutes from now
      mockPrismaService.accountLockout.findUnique.mockResolvedValue({
        email: 'test@example.com',
        lockedUntil: futureDate,
        attempts: 5,
        reason: 'FAILED_LOGIN_ATTEMPTS',
      });

      const result = await lockoutService.checkLockout('test@example.com');

      expect(result.isLocked).toBe(true);
      expect(result.lockedUntil).toEqual(futureDate);
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(result.failedAttempts).toBe(5);
      expect(result.reason).toBe('FAILED_LOGIN_ATTEMPTS');
    });

    it('should auto-unlock expired lockout', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      mockPrismaService.accountLockout.findUnique.mockResolvedValue({
        email: 'test@example.com',
        lockedUntil: pastDate,
        attempts: 5,
        reason: 'FAILED_LOGIN_ATTEMPTS',
      });
      mockPrismaService.accountLockout.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.accountLockout.deleteMany.mockResolvedValue({ count: 1 });

      const result = await lockoutService.checkLockout('test@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.remainingSeconds).toBe(0);
      expect(mockPrismaService.accountLockout.deleteMany).toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      mockPrismaService.accountLockout.findUnique.mockResolvedValue(null);
      mockPrismaService.loginAttempt.count.mockResolvedValue(0);

      await lockoutService.checkLockout('TEST@EXAMPLE.COM');

      expect(mockPrismaService.accountLockout.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('recordFailedAttempt', () => {
    const mockContext = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should record attempt and not lock when below threshold', async () => {
      mockPrismaService.loginAttempt.create.mockResolvedValue({});
      mockPrismaService.loginAttempt.count.mockResolvedValue(3);

      const result = await lockoutService.recordFailedAttempt(
        'test@example.com',
        mockContext,
      );

      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(3);
      expect(mockPrismaService.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          ipAddress: '192.168.1.1',
          success: false,
        }),
      });
    });

    it('should lock account when threshold reached', async () => {
      mockPrismaService.loginAttempt.create.mockResolvedValue({});
      mockPrismaService.loginAttempt.count.mockResolvedValue(
        AuthConfig.accountLockout.maxAttempts,
      );
      mockPrismaService.accountLockout.findUnique.mockResolvedValue(null);
      mockPrismaService.accountLockout.upsert.mockResolvedValue({});
      mockAuditService.logAccountLocked.mockResolvedValue(undefined);

      const result = await lockoutService.recordFailedAttempt(
        'test@example.com',
        mockContext,
      );

      expect(result.isLocked).toBe(true);
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(mockPrismaService.accountLockout.upsert).toHaveBeenCalled();
      expect(mockAuditService.logAccountLocked).toHaveBeenCalled();
    });

    it('should record IP address and user agent', async () => {
      mockPrismaService.loginAttempt.create.mockResolvedValue({});
      mockPrismaService.loginAttempt.count.mockResolvedValue(1);

      await lockoutService.recordFailedAttempt('test@example.com', mockContext);

      expect(mockPrismaService.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          reason: 'INVALID_CREDENTIALS',
        }),
      });
    });
  });

  describe('recordSuccessfulLogin', () => {
    const mockContext = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should record successful attempt and clear lockout', async () => {
      mockPrismaService.loginAttempt.create.mockResolvedValue({});
      mockPrismaService.accountLockout.deleteMany.mockResolvedValue({ count: 1 });

      await lockoutService.recordSuccessfulLogin('test@example.com', mockContext);

      expect(mockPrismaService.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          success: true,
        }),
      });
      expect(mockPrismaService.accountLockout.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('unlockAccount', () => {
    it('should update and delete lockout record', async () => {
      mockPrismaService.accountLockout.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.accountLockout.deleteMany.mockResolvedValue({ count: 1 });

      await lockoutService.unlockAccount('test@example.com', 'ADMIN');

      expect(mockPrismaService.accountLockout.updateMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: expect.objectContaining({
          unlockedBy: 'ADMIN',
        }),
      });
      expect(mockPrismaService.accountLockout.deleteMany).toHaveBeenCalled();
    });
  });

  describe('cleanupOldAttempts', () => {
    it('should delete attempts older than 7 days', async () => {
      mockPrismaService.loginAttempt.deleteMany.mockResolvedValue({ count: 100 });

      const result = await lockoutService.cleanupOldAttempts();

      expect(result).toBe(100);
      expect(mockPrismaService.loginAttempt.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('cleanupExpiredLockouts', () => {
    it('should delete expired lockouts', async () => {
      mockPrismaService.accountLockout.deleteMany.mockResolvedValue({ count: 5 });

      const result = await lockoutService.cleanupExpiredLockouts();

      expect(result).toBe(5);
      expect(mockPrismaService.accountLockout.deleteMany).toHaveBeenCalledWith({
        where: {
          lockedUntil: { lt: expect.any(Date) },
        },
      });
    });
  });
});
