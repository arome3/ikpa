/**
 * Session Management Service
 *
 * Tracks and manages active user sessions with device information.
 * Provides visibility into connected devices and the ability to
 * revoke individual or all sessions.
 *
 * @module SessionService
 */

import { Injectable, Logger } from '@nestjs/common';
import * as UAParser from 'ua-parser-js';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfig } from './auth.config';
import { AuditService, AuditContext } from './audit.service';
import { EmailService } from './email.service';
import {
  SessionInfoDto,
  SessionsListResponseDto,
  SessionRevokedResponseDto,
  AllSessionsRevokedResponseDto,
} from './dto';
import { NotFoundException } from '../../common/exceptions/api.exception';
import { ErrorCodes } from '../../common/constants/error-codes';

/**
 * Device information parsed from user agent
 */
interface DeviceInfo {
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
}

/**
 * Service for managing user sessions
 *
 * Provides session tracking with device fingerprinting,
 * allowing users to see where they're logged in and
 * revoke access to specific devices.
 *
 * @example
 * ```typescript
 * // Create session on login
 * await sessionService.createSession(userId, refreshTokenId, context);
 *
 * // List user's sessions
 * const sessions = await sessionService.listSessions(userId, currentSessionId);
 *
 * // Revoke a specific session
 * await sessionService.revokeSession(userId, sessionId, context);
 * ```
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly uaParser = new UAParser.UAParser();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  // ==========================================
  // SESSION CREATION
  // ==========================================

  /**
   * Create a new session for a user
   *
   * Called when generating new refresh tokens during login or refresh.
   *
   * @param userId - User ID
   * @param refreshTokenId - ID of the associated refresh token
   * @param context - Request context with IP and user agent
   * @returns Created session ID
   */
  async createSession(
    userId: string,
    refreshTokenId: string,
    context: AuditContext,
  ): Promise<string> {
    // Parse device info from user agent
    const deviceInfo = this.parseUserAgent(context.userAgent);

    // Check session limit
    const existingSessions = await this.prisma.userSession.count({
      where: { userId },
    });

    if (existingSessions >= AuthConfig.session.maxActiveSessions) {
      // Remove oldest session to make room
      const oldestSession = await this.prisma.userSession.findFirst({
        where: { userId },
        orderBy: { lastActiveAt: 'asc' },
      });

      if (oldestSession) {
        await this.revokeSessionInternal(oldestSession.id);
        this.logger.debug(
          `Evicted oldest session for user ${userId} due to session limit`,
        );
      }
    }

    // Create new session
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenId,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: context.ipAddress,
        location: null, // Could integrate IP geolocation in the future
      },
    });

    // Log new device
    await this.auditService.logDeviceAdded(
      userId,
      deviceInfo as unknown as Record<string, unknown>,
      context,
    );

    // Check if this is a new device and send alert
    await this.checkAndAlertNewDevice(userId, deviceInfo, context);

    this.logger.debug(`Created session ${session.id} for user ${userId}`);

    return session.id;
  }

  // ==========================================
  // SESSION LISTING
  // ==========================================

  /**
   * List all active sessions for a user (by refresh token ID)
   *
   * @param userId - User ID
   * @param currentRefreshTokenId - Current session's refresh token ID (to mark as current)
   * @returns List of sessions with device info
   */
  async listSessions(
    userId: string,
    currentRefreshTokenId?: string,
  ): Promise<SessionsListResponseDto> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });

    const sessionDtos: SessionInfoDto[] = sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      location: session.location,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: session.refreshTokenId === currentRefreshTokenId,
    }));

    return {
      sessions: sessionDtos,
      totalSessions: sessions.length,
    };
  }

  /**
   * List all active sessions for a user (by session ID)
   *
   * This is the preferred method when sessionId is available from the JWT.
   *
   * @param userId - User ID
   * @param currentSessionId - Current session's ID from JWT (to mark as current)
   * @returns List of sessions with device info
   */
  async listSessionsWithCurrentId(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionsListResponseDto> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });

    const sessionDtos: SessionInfoDto[] = sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      deviceType: session.deviceType,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      location: session.location,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: session.id === currentSessionId,
    }));

    return {
      sessions: sessionDtos,
      totalSessions: sessions.length,
    };
  }

  /**
   * Get session by refresh token ID
   */
  async getSessionByRefreshToken(
    refreshTokenId: string,
  ): Promise<{ id: string; userId: string } | null> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenId },
      select: { id: true, userId: true },
    });

    return session;
  }

  // ==========================================
  // SESSION REVOCATION
  // ==========================================

  /**
   * Revoke a specific session
   *
   * @param userId - User ID (for authorization check)
   * @param sessionId - Session ID to revoke
   * @param context - Audit context
   * @returns Revocation result
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    context?: AuditContext,
  ): Promise<SessionRevokedResponseDto> {
    // Find session and verify ownership
    const session = await this.prisma.userSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException(
        'Session not found',
        ErrorCodes.AUTH_SESSION_NOT_FOUND,
      );
    }

    // Revoke the session and associated refresh token
    await this.revokeSessionInternal(sessionId);

    // Log the revocation
    if (context) {
      await this.auditService.logDeviceRemoved(userId, sessionId, context);
    }

    this.logger.log(`Session ${sessionId} revoked for user ${userId}`);

    return {
      revoked: true,
      message: 'Session revoked successfully',
    };
  }

  /**
   * Revoke all sessions except the current one
   *
   * @param userId - User ID
   * @param currentRefreshTokenId - Current session's refresh token ID (to keep)
   * @param context - Audit context
   * @returns Number of sessions revoked
   */
  async revokeAllOtherSessions(
    userId: string,
    currentRefreshTokenId?: string,
    context?: AuditContext,
  ): Promise<AllSessionsRevokedResponseDto> {
    // Find all other sessions
    const sessionsToRevoke = await this.prisma.userSession.findMany({
      where: {
        userId,
        refreshTokenId: currentRefreshTokenId
          ? { not: currentRefreshTokenId }
          : undefined,
      },
    });

    // Revoke each session
    for (const session of sessionsToRevoke) {
      await this.revokeSessionInternal(session.id);
    }

    // Log bulk revocation
    if (context && sessionsToRevoke.length > 0) {
      await this.auditService.logEvent({
        userId,
        eventType: 'DEVICE_REMOVED',
        success: true,
        context: {
          ...context,
          metadata: {
            action: 'bulk_revocation',
            count: sessionsToRevoke.length,
          },
        },
      });
    }

    this.logger.log(
      `Revoked ${sessionsToRevoke.length} sessions for user ${userId}`,
    );

    return {
      revokedCount: sessionsToRevoke.length,
      message:
        sessionsToRevoke.length > 0
          ? 'All other sessions have been revoked'
          : 'No other sessions to revoke',
    };
  }

  /**
   * Revoke all sessions for a user
   *
   * Called on password change or account compromise.
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
    });

    for (const session of sessions) {
      await this.revokeSessionInternal(session.id);
    }

    return sessions.length;
  }

  // ==========================================
  // SESSION UPDATES
  // ==========================================

  /**
   * Update session's last active timestamp
   *
   * Called on token refresh to track activity.
   */
  async updateLastActive(refreshTokenId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { refreshTokenId },
      data: { lastActiveAt: new Date() },
    });
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  /**
   * Clean up inactive sessions
   *
   * Called by the auth cleanup cron job.
   *
   * @returns Number of sessions cleaned up
   */
  async cleanupInactiveSessions(): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - AuthConfig.session.inactivityTimeoutMs,
    );

    // Find inactive sessions
    const inactiveSessions = await this.prisma.userSession.findMany({
      where: { lastActiveAt: { lt: cutoffDate } },
    });

    // Revoke each (this also cleans up refresh tokens)
    for (const session of inactiveSessions) {
      await this.revokeSessionInternal(session.id);
    }

    this.logger.log(`Cleaned up ${inactiveSessions.length} inactive sessions`);

    return inactiveSessions.length;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Internal session revocation
   *
   * Deletes the session and its associated refresh token.
   */
  private async revokeSessionInternal(sessionId: string): Promise<void> {
    // Get session with refresh token ID
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    // Delete refresh token first (cascade should handle session, but be explicit)
    if (session.refreshTokenId) {
      await this.prisma.refreshToken.deleteMany({
        where: { id: session.refreshTokenId },
      });
    }

    // Delete session
    await this.prisma.userSession.delete({
      where: { id: sessionId },
    });
  }

  /**
   * Parse user agent string for device info
   */
  private parseUserAgent(userAgent?: string): DeviceInfo {
    if (!userAgent) {
      return {
        deviceName: 'Unknown Device',
        deviceType: null,
        browser: null,
        os: null,
      };
    }

    this.uaParser.setUA(userAgent);
    const result = this.uaParser.getResult();

    const deviceType = this.getDeviceType(result);
    const deviceName = this.getDeviceName(result);

    return {
      deviceName,
      deviceType,
      browser: result.browser.name
        ? `${result.browser.name} ${result.browser.version || ''}`
        : null,
      os: result.os.name
        ? `${result.os.name} ${result.os.version || ''}`
        : null,
    };
  }

  /**
   * Determine device type from UA parser result
   */
  private getDeviceType(result: UAParser.IResult): string {
    if (result.device.type) {
      return result.device.type; // 'mobile', 'tablet', etc.
    }

    // Infer from OS
    const os = result.os.name?.toLowerCase() || '';
    if (os.includes('ios') || os.includes('android')) {
      return 'mobile';
    }
    if (os.includes('windows') || os.includes('mac') || os.includes('linux')) {
      return 'desktop';
    }

    return 'unknown';
  }

  /**
   * Generate human-readable device name
   */
  private getDeviceName(result: UAParser.IResult): string {
    const parts: string[] = [];

    // Add device vendor/model if available
    if (result.device.vendor) {
      parts.push(result.device.vendor);
    }
    if (result.device.model) {
      parts.push(result.device.model);
    }

    if (parts.length > 0) {
      return parts.join(' ');
    }

    // Fall back to browser + OS
    const browser = result.browser.name || 'Unknown Browser';
    const os = result.os.name || 'Unknown OS';
    return `${browser} on ${os}`;
  }

  /**
   * Check if this is a new device and send security alert
   */
  private async checkAndAlertNewDevice(
    userId: string,
    deviceInfo: DeviceInfo,
    context: AuditContext,
  ): Promise<void> {
    // Check for similar existing sessions
    const existingSessions = await this.prisma.userSession.findMany({
      where: { userId },
      select: { deviceType: true, os: true, browser: true },
    });

    // Simple check: if there are other sessions with different device types, it might be new
    const isNewDeviceType =
      existingSessions.length > 0 &&
      !existingSessions.some(
        (s) =>
          s.deviceType === deviceInfo.deviceType &&
          s.os === deviceInfo.os &&
          s.browser === deviceInfo.browser,
      );

    if (isNewDeviceType) {
      // Get user for email
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      if (user) {
        await this.emailService.sendSecurityAlertEmail(
          user.email,
          user.name,
          'NEW_DEVICE',
          {
            Device: deviceInfo.deviceName || 'Unknown',
            Browser: deviceInfo.browser || 'Unknown',
            OS: deviceInfo.os || 'Unknown',
            IP: context.ipAddress,
            Time: new Date().toISOString(),
          },
        );
      }
    }
  }
}
