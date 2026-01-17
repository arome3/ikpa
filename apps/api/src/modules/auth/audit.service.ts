/**
 * Authentication Audit Service
 *
 * Logs security-relevant authentication events for compliance,
 * forensics, and anomaly detection. All authentication actions
 * are recorded with contextual metadata.
 *
 * @module AuditService
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfig } from './auth.config';

/**
 * Context information for audit events
 */
export interface AuditContext {
  /** IP address of the request */
  ipAddress: string;
  /** User agent string from request headers */
  userAgent?: string;
  /** Additional metadata specific to the event */
  metadata?: Record<string, unknown>;
}

/**
 * Options for logging an audit event
 */
export interface LogEventOptions {
  /** User ID if authenticated */
  userId?: string;
  /** Email address (for unauthenticated events like failed login) */
  email?: string;
  /** Type of authentication event */
  eventType: AuthEventType;
  /** Whether the action was successful */
  success?: boolean;
  /** Request context */
  context: AuditContext;
}

/**
 * Service for logging authentication audit events
 *
 * Provides methods to log various authentication events with
 * standardized context. Events are stored in AuthAuditLog table
 * for compliance and security monitoring.
 *
 * @example
 * ```typescript
 * await auditService.logEvent({
 *   userId: user.id,
 *   eventType: AuthEventType.LOGIN_SUCCESS,
 *   success: true,
 *   context: { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
 * });
 * ```
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an authentication event
   *
   * @param options - Event details and context
   */
  async logEvent(options: LogEventOptions): Promise<void> {
    const { userId, email, eventType, success = true, context } = options;

    try {
      await this.prisma.authAuditLog.create({
        data: {
          userId,
          email,
          eventType,
          success,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent ?? null,
          metadata: (context.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      this.logger.debug(
        `Audit: ${eventType} for ${userId ?? email ?? 'unknown'} from ${context.ipAddress}`,
      );
    } catch (error) {
      // Don't throw - audit failures shouldn't break auth flow
      this.logger.error(`Failed to log audit event: ${eventType}`, error);
    }
  }

  /**
   * Log a successful login
   */
  async logLoginSuccess(
    userId: string,
    email: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      email,
      eventType: AuthEventType.LOGIN_SUCCESS,
      success: true,
      context,
    });
  }

  /**
   * Log a failed login attempt
   */
  async logLoginFailure(
    email: string,
    reason: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      email,
      eventType: AuthEventType.LOGIN_FAILURE,
      success: false,
      context: {
        ...context,
        metadata: { ...context.metadata, reason },
      },
    });
  }

  /**
   * Log a logout event
   */
  async logLogout(userId: string, context: AuditContext): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.LOGOUT,
      success: true,
      context,
    });
  }

  /**
   * Log password reset request
   */
  async logPasswordResetRequest(
    email: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      email,
      eventType: AuthEventType.PASSWORD_RESET_REQUEST,
      success: true,
      context,
    });
  }

  /**
   * Log password reset completion
   */
  async logPasswordResetComplete(
    userId: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.PASSWORD_RESET_COMPLETE,
      success: true,
      context,
    });
  }

  /**
   * Log password change (authenticated)
   */
  async logPasswordChange(
    userId: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.PASSWORD_CHANGE,
      success: true,
      context,
    });
  }

  /**
   * Log MFA enabled
   */
  async logMfaEnabled(userId: string, context: AuditContext): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.MFA_ENABLED,
      success: true,
      context,
    });
  }

  /**
   * Log MFA disabled
   */
  async logMfaDisabled(userId: string, context: AuditContext): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.MFA_DISABLED,
      success: true,
      context,
    });
  }

  /**
   * Log successful MFA verification
   */
  async logMfaVerified(userId: string, context: AuditContext): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.MFA_VERIFIED,
      success: true,
      context,
    });
  }

  /**
   * Log failed MFA verification
   */
  async logMfaFailed(userId: string, context: AuditContext): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.MFA_FAILED,
      success: false,
      context,
    });
  }

  /**
   * Log account lockout
   */
  async logAccountLocked(
    email: string,
    reason: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      email,
      eventType: AuthEventType.ACCOUNT_LOCKED,
      success: true, // The lockout action succeeded
      context: {
        ...context,
        metadata: { ...context.metadata, reason },
      },
    });
  }

  /**
   * Log account unlock
   */
  async logAccountUnlocked(
    email: string,
    unlockedBy: string | null,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      email,
      eventType: AuthEventType.ACCOUNT_UNLOCKED,
      success: true,
      context: {
        ...context,
        metadata: { ...context.metadata, unlockedBy },
      },
    });
  }

  /**
   * Log email verification sent
   */
  async logEmailVerificationSent(
    userId: string,
    email: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      email,
      eventType: AuthEventType.EMAIL_VERIFICATION_SENT,
      success: true,
      context,
    });
  }

  /**
   * Log successful email verification
   */
  async logEmailVerified(
    userId: string,
    email: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      email,
      eventType: AuthEventType.EMAIL_VERIFIED,
      success: true,
      context,
    });
  }

  /**
   * Log new device/session added
   */
  async logDeviceAdded(
    userId: string,
    deviceInfo: Record<string, unknown>,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.DEVICE_ADDED,
      success: true,
      context: {
        ...context,
        metadata: { ...context.metadata, device: deviceInfo },
      },
    });
  }

  /**
   * Log device/session removed
   */
  async logDeviceRemoved(
    userId: string,
    sessionId: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.DEVICE_REMOVED,
      success: true,
      context: {
        ...context,
        metadata: { ...context.metadata, sessionId },
      },
    });
  }

  /**
   * Log suspicious activity detected
   */
  async logSuspiciousActivity(
    userId: string | undefined,
    email: string | undefined,
    reason: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      email,
      eventType: AuthEventType.SUSPICIOUS_ACTIVITY,
      success: false, // Suspicious activity is a concern
      context: {
        ...context,
        metadata: { ...context.metadata, reason },
      },
    });

    // Also log at warning level for immediate visibility
    this.logger.warn(
      `Suspicious activity detected: ${reason} for ${userId ?? email ?? 'unknown'} from ${context.ipAddress}`,
    );
  }

  /**
   * Log OAuth account linked
   */
  async logOAuthLinked(
    userId: string,
    provider: string,
    context: AuditContext,
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: AuthEventType.OAUTH_LINKED,
      success: true,
      context: {
        ...context,
        metadata: { ...context.metadata, provider },
      },
    });
  }

  /**
   * Get recent audit events for a user
   *
   * @param userId - User ID to query
   * @param limit - Maximum number of events to return
   * @returns Recent audit events
   */
  async getRecentEvents(userId: string, limit: number = 20) {
    return this.prisma.authAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent failed login attempts for an email
   *
   * Used for lockout detection and security monitoring.
   *
   * @param email - Email address to query
   * @param since - Only include attempts after this date
   * @returns Count of failed attempts
   */
  async getRecentFailedLogins(email: string, since: Date): Promise<number> {
    return this.prisma.authAuditLog.count({
      where: {
        email,
        eventType: AuthEventType.LOGIN_FAILURE,
        createdAt: { gte: since },
      },
    });
  }

  /**
   * Clean up old audit logs based on retention policy
   *
   * Called by the auth cleanup cron job.
   *
   * @returns Number of records deleted
   */
  async cleanupOldLogs(): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(
      retentionDate.getDate() - AuthConfig.auditLog.retentionDays,
    );

    const result = await this.prisma.authAuditLog.deleteMany({
      where: {
        createdAt: { lt: retentionDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old audit log entries`);
    return result.count;
  }
}
