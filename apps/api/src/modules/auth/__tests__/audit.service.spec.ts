/**
 * AuditService Unit Tests
 *
 * Tests cover:
 * - Event logging for various auth events
 * - Context preservation (IP, user agent, metadata)
 * - Error handling (audit failures shouldn't break auth flow)
 * - Log cleanup based on retention policy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from '../audit.service';
import { AuthEventType } from '@prisma/client';

// Mock PrismaService
const mockPrismaService = {
  authAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
};

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = new AuditService(mockPrismaService as any);
  });

  describe('logEvent', () => {
    it('should log event with all context data', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logEvent({
        userId: 'user-123',
        email: 'test@example.com',
        eventType: AuthEventType.LOGIN_SUCCESS,
        success: true,
        context: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: { sessionId: 'session-123' },
        },
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          email: 'test@example.com',
          eventType: AuthEventType.LOGIN_SUCCESS,
          success: true,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: { sessionId: 'session-123' },
        },
      });
    });

    it('should not throw when database error occurs', async () => {
      mockPrismaService.authAuditLog.create.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(
        auditService.logEvent({
          userId: 'user-123',
          eventType: AuthEventType.LOGIN_SUCCESS,
          context: {
            ipAddress: '192.168.1.1',
          },
        }),
      ).resolves.toBeUndefined();
    });

    it('should default success to true', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logEvent({
        eventType: AuthEventType.LOGOUT,
        context: {
          ipAddress: '192.168.1.1',
        },
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: true,
        }),
      });
    });

    it('should handle null user agent', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logEvent({
        eventType: AuthEventType.LOGIN_SUCCESS,
        context: {
          ipAddress: '192.168.1.1',
        },
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userAgent: null,
        }),
      });
    });
  });

  describe('logLoginSuccess', () => {
    it('should log successful login event', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logLoginSuccess('user-123', 'test@example.com', {
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
          eventType: AuthEventType.LOGIN_SUCCESS,
          success: true,
        }),
      });
    });
  });

  describe('logLoginFailure', () => {
    it('should log failed login with reason', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logLoginFailure('test@example.com', 'INVALID_PASSWORD', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          eventType: AuthEventType.LOGIN_FAILURE,
          success: false,
          metadata: expect.objectContaining({
            reason: 'INVALID_PASSWORD',
          }),
        }),
      });
    });
  });

  describe('logLogout', () => {
    it('should log logout event', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logLogout('user-123', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          eventType: AuthEventType.LOGOUT,
        }),
      });
    });
  });

  describe('logPasswordResetRequest', () => {
    it('should log password reset request', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logPasswordResetRequest('test@example.com', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          eventType: AuthEventType.PASSWORD_RESET_REQUEST,
        }),
      });
    });
  });

  describe('logPasswordResetComplete', () => {
    it('should log password reset completion', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logPasswordResetComplete('user-123', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          eventType: AuthEventType.PASSWORD_RESET_COMPLETE,
        }),
      });
    });
  });

  describe('logMfaEnabled', () => {
    it('should log MFA enabled event', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logMfaEnabled('user-123', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          eventType: AuthEventType.MFA_ENABLED,
        }),
      });
    });
  });

  describe('logMfaDisabled', () => {
    it('should log MFA disabled event', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logMfaDisabled('user-123', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          eventType: AuthEventType.MFA_DISABLED,
        }),
      });
    });
  });

  describe('logMfaVerified', () => {
    it('should log MFA verification success', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logMfaVerified('user-123', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          eventType: AuthEventType.MFA_VERIFIED,
          success: true,
        }),
      });
    });
  });

  describe('logMfaFailed', () => {
    it('should log MFA verification failure', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logMfaFailed('user-123', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          eventType: AuthEventType.MFA_FAILED,
          success: false,
        }),
      });
    });
  });

  describe('logAccountLocked', () => {
    it('should log account locked event with reason', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logAccountLocked('test@example.com', 'TOO_MANY_ATTEMPTS', {
        ipAddress: '192.168.1.1',
      });

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          eventType: AuthEventType.ACCOUNT_LOCKED,
          metadata: expect.objectContaining({
            reason: 'TOO_MANY_ATTEMPTS',
          }),
        }),
      });
    });
  });

  describe('logSuspiciousActivity', () => {
    it('should log suspicious activity with warning', async () => {
      mockPrismaService.authAuditLog.create.mockResolvedValue({});

      await auditService.logSuspiciousActivity(
        'user-123',
        'test@example.com',
        'Multiple failed logins from different IPs',
        {
          ipAddress: '192.168.1.1',
        },
      );

      expect(mockPrismaService.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
          eventType: AuthEventType.SUSPICIOUS_ACTIVITY,
          success: false,
          metadata: expect.objectContaining({
            reason: 'Multiple failed logins from different IPs',
          }),
        }),
      });
    });
  });

  describe('getRecentEvents', () => {
    it('should return recent events for user', async () => {
      const mockEvents = [
        { id: '1', eventType: AuthEventType.LOGIN_SUCCESS },
        { id: '2', eventType: AuthEventType.LOGOUT },
      ];
      mockPrismaService.authAuditLog.findMany.mockResolvedValue(mockEvents);

      const result = await auditService.getRecentEvents('user-123', 10);

      expect(result).toEqual(mockEvents);
      expect(mockPrismaService.authAuditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should use default limit of 20', async () => {
      mockPrismaService.authAuditLog.findMany.mockResolvedValue([]);

      await auditService.getRecentEvents('user-123');

      expect(mockPrismaService.authAuditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });
  });

  describe('getRecentFailedLogins', () => {
    it('should count failed logins since date', async () => {
      mockPrismaService.authAuditLog.count.mockResolvedValue(5);

      const since = new Date('2024-01-01');
      const result = await auditService.getRecentFailedLogins(
        'test@example.com',
        since,
      );

      expect(result).toBe(5);
      expect(mockPrismaService.authAuditLog.count).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          eventType: AuthEventType.LOGIN_FAILURE,
          createdAt: { gte: since },
        },
      });
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete logs older than retention period', async () => {
      mockPrismaService.authAuditLog.deleteMany.mockResolvedValue({ count: 100 });

      const result = await auditService.cleanupOldLogs();

      expect(result).toBe(100);
      expect(mockPrismaService.authAuditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
