/**
 * SessionService Unit Tests
 *
 * Tests cover:
 * - Session creation with device info
 * - Session listing and filtering
 * - Session revocation
 * - Session limit enforcement
 * - Inactive session cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../session.service';
import { AuthConfig } from '../auth.config';

// Mock dependencies
const mockPrismaService = {
  userSession: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  refreshToken: {
    deleteMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

const mockAuditService = {
  logDeviceAdded: vi.fn(),
  logDeviceRemoved: vi.fn(),
  logEvent: vi.fn(),
};

const mockEmailService = {
  sendSecurityAlertEmail: vi.fn(),
};

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionService = new SessionService(
      mockPrismaService as any,
      mockAuditService as any,
      mockEmailService as any,
    );
  });

  describe('createSession', () => {
    const mockContext = {
      ipAddress: '192.168.1.1',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    it('should create a new session with device info', async () => {
      mockPrismaService.userSession.count.mockResolvedValue(0);
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        refreshTokenId: 'token-123',
      });
      mockPrismaService.userSession.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await sessionService.createSession(
        'user-123',
        'token-123',
        mockContext,
      );

      expect(result).toBe('session-123');
      expect(mockPrismaService.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          refreshTokenId: 'token-123',
          ipAddress: '192.168.1.1',
          deviceType: 'desktop',
        }),
      });
      // Verify browser and OS are parsed (exact strings may vary by ua-parser-js version)
      const createCall = mockPrismaService.userSession.create.mock.calls[0][0];
      expect(createCall.data.browser).toBeDefined();
      expect(createCall.data.os).toBeDefined();
      expect(mockAuditService.logDeviceAdded).toHaveBeenCalled();
    });

    it('should evict oldest session when limit reached', async () => {
      mockPrismaService.userSession.count.mockResolvedValue(
        AuthConfig.session.maxActiveSessions,
      );
      mockPrismaService.userSession.findFirst.mockResolvedValue({
        id: 'old-session-123',
        refreshTokenId: 'old-token-123',
      });
      mockPrismaService.userSession.findUnique.mockResolvedValue({
        id: 'old-session-123',
        refreshTokenId: 'old-token-123',
      });
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.userSession.delete.mockResolvedValue({});
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'new-session-123',
      });
      mockPrismaService.userSession.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await sessionService.createSession('user-123', 'token-123', mockContext);

      expect(mockPrismaService.userSession.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { lastActiveAt: 'asc' },
      });
      expect(mockPrismaService.userSession.delete).toHaveBeenCalled();
    });

    it('should parse mobile user agent correctly', async () => {
      const mobileContext = {
        ipAddress: '192.168.1.1',
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      };

      mockPrismaService.userSession.count.mockResolvedValue(0);
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'session-123',
      });
      mockPrismaService.userSession.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await sessionService.createSession('user-123', 'token-123', mobileContext);

      expect(mockPrismaService.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceType: 'mobile',
          os: expect.stringContaining('iOS'),
        }),
      });
    });

    it('should handle missing user agent gracefully', async () => {
      const noUaContext = {
        ipAddress: '192.168.1.1',
      };

      mockPrismaService.userSession.count.mockResolvedValue(0);
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'session-123',
      });
      mockPrismaService.userSession.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await sessionService.createSession('user-123', 'token-123', noUaContext);

      expect(mockPrismaService.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceName: 'Unknown Device',
        }),
      });
    });

    it('should send security alert for new device type', async () => {
      mockPrismaService.userSession.count.mockResolvedValue(1);
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'session-123',
      });
      mockPrismaService.userSession.findMany.mockResolvedValue([
        { deviceType: 'mobile', os: 'iOS', browser: 'Safari' },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      await sessionService.createSession(
        'user-123',
        'token-123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        },
      );

      expect(mockEmailService.sendSecurityAlertEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test User',
        'NEW_DEVICE',
        expect.any(Object),
      );
    });
  });

  describe('listSessions', () => {
    it('should return all sessions for user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          deviceName: 'Chrome on Mac',
          deviceType: 'desktop',
          browser: 'Chrome 120',
          os: 'Mac OS 10.15',
          ipAddress: '192.168.1.1',
          location: null,
          lastActiveAt: new Date(),
          createdAt: new Date(),
          refreshTokenId: 'token-1',
        },
        {
          id: 'session-2',
          deviceName: 'Safari on iPhone',
          deviceType: 'mobile',
          browser: 'Safari 17',
          os: 'iOS 17',
          ipAddress: '192.168.1.2',
          location: null,
          lastActiveAt: new Date(),
          createdAt: new Date(),
          refreshTokenId: 'token-2',
        },
      ];

      mockPrismaService.userSession.findMany.mockResolvedValue(mockSessions);

      const result = await sessionService.listSessions('user-123', 'token-1');

      expect(result.sessions).toHaveLength(2);
      expect(result.totalSessions).toBe(2);
      expect(result.sessions[0].isCurrent).toBe(true);
      expect(result.sessions[1].isCurrent).toBe(false);
    });

    it('should order sessions by last active date descending', async () => {
      mockPrismaService.userSession.findMany.mockResolvedValue([]);

      await sessionService.listSessions('user-123');

      expect(mockPrismaService.userSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { lastActiveAt: 'desc' },
      });
    });
  });

  describe('revokeSession', () => {
    const mockContext = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should revoke session and delete refresh token', async () => {
      mockPrismaService.userSession.findFirst.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        refreshTokenId: 'token-123',
      });
      mockPrismaService.userSession.findUnique.mockResolvedValue({
        id: 'session-123',
        refreshTokenId: 'token-123',
      });
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.userSession.delete.mockResolvedValue({});

      const result = await sessionService.revokeSession(
        'user-123',
        'session-123',
        mockContext,
      );

      expect(result.revoked).toBe(true);
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: 'token-123' },
      });
      expect(mockPrismaService.userSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      });
      expect(mockAuditService.logDeviceRemoved).toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      mockPrismaService.userSession.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.revokeSession('user-123', 'invalid-session', mockContext),
      ).rejects.toThrow('Session not found');
    });

    it('should not allow revoking other users sessions', async () => {
      mockPrismaService.userSession.findFirst.mockResolvedValue(null);

      await expect(
        sessionService.revokeSession('user-456', 'session-123', mockContext),
      ).rejects.toThrow('Session not found');

      expect(mockPrismaService.userSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-123', userId: 'user-456' },
      });
    });
  });

  describe('revokeAllOtherSessions', () => {
    const mockContext = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should revoke all sessions except current', async () => {
      const otherSessions = [
        { id: 'session-2', refreshTokenId: 'token-2' },
        { id: 'session-3', refreshTokenId: 'token-3' },
      ];

      mockPrismaService.userSession.findMany.mockResolvedValue(otherSessions);
      mockPrismaService.userSession.findUnique.mockImplementation(({ where }) => {
        const session = otherSessions.find((s) => s.id === where.id);
        return Promise.resolve(session);
      });
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.userSession.delete.mockResolvedValue({});

      const result = await sessionService.revokeAllOtherSessions(
        'user-123',
        'token-1',
        mockContext,
      );

      expect(result.revokedCount).toBe(2);
      expect(mockPrismaService.userSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          refreshTokenId: { not: 'token-1' },
        },
      });
    });

    it('should return 0 when no other sessions exist', async () => {
      mockPrismaService.userSession.findMany.mockResolvedValue([]);

      const result = await sessionService.revokeAllOtherSessions(
        'user-123',
        'token-1',
        mockContext,
      );

      expect(result.revokedCount).toBe(0);
      expect(result.message).toContain('No other sessions');
    });
  });

  describe('updateLastActive', () => {
    it('should update last active timestamp', async () => {
      mockPrismaService.userSession.updateMany.mockResolvedValue({ count: 1 });

      await sessionService.updateLastActive('token-123');

      expect(mockPrismaService.userSession.updateMany).toHaveBeenCalledWith({
        where: { refreshTokenId: 'token-123' },
        data: { lastActiveAt: expect.any(Date) },
      });
    });
  });

  describe('cleanupInactiveSessions', () => {
    it('should delete inactive sessions', async () => {
      const inactiveSessions = [
        { id: 'session-1', refreshTokenId: 'token-1' },
        { id: 'session-2', refreshTokenId: 'token-2' },
      ];

      mockPrismaService.userSession.findMany.mockResolvedValue(inactiveSessions);
      mockPrismaService.userSession.findUnique.mockImplementation(({ where }) => {
        const session = inactiveSessions.find((s) => s.id === where.id);
        return Promise.resolve(session);
      });
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.userSession.delete.mockResolvedValue({});

      const result = await sessionService.cleanupInactiveSessions();

      expect(result).toBe(2);
      expect(mockPrismaService.userSession.findMany).toHaveBeenCalledWith({
        where: {
          lastActiveAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('getSessionByRefreshToken', () => {
    it('should return session by refresh token ID', async () => {
      mockPrismaService.userSession.findUnique.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
      });

      const result = await sessionService.getSessionByRefreshToken('token-123');

      expect(result).toEqual({
        id: 'session-123',
        userId: 'user-123',
      });
      expect(mockPrismaService.userSession.findUnique).toHaveBeenCalledWith({
        where: { refreshTokenId: 'token-123' },
        select: { id: true, userId: true },
      });
    });

    it('should return null if session not found', async () => {
      mockPrismaService.userSession.findUnique.mockResolvedValue(null);

      const result = await sessionService.getSessionByRefreshToken('invalid-token');

      expect(result).toBeNull();
    });
  });
});
