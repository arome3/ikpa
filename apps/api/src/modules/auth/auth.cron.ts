/**
 * Authentication Cleanup Cron Service
 *
 * Scheduled tasks for cleaning up expired authentication data.
 * Runs daily at 3 AM to minimize impact on active users.
 *
 * @module AuthCronService
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { LockoutService } from './lockout.service';
import { SessionService } from './session.service';

/**
 * Cron service for auth-related cleanup tasks
 *
 * Handles periodic cleanup of:
 * - Expired refresh tokens
 * - Expired email verification tokens
 * - Old login attempts
 * - Expired account lockouts
 * - Old audit logs
 * - Inactive sessions
 */
@Injectable()
export class AuthCronService {
  private readonly logger = new Logger(AuthCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly lockoutService: LockoutService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Daily cleanup at 3 AM
   *
   * Runs all cleanup tasks sequentially to avoid overwhelming the database.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyCleanup(): Promise<void> {
    this.logger.log('Starting daily auth cleanup...');
    const startTime = Date.now();

    const results = {
      refreshTokens: 0,
      emailVerifications: 0,
      loginAttempts: 0,
      lockouts: 0,
      auditLogs: 0,
      sessions: 0,
    };

    try {
      // Clean up expired refresh tokens
      results.refreshTokens = await this.cleanupExpiredRefreshTokens();

      // Clean up expired email verification tokens
      results.emailVerifications = await this.cleanupExpiredEmailVerifications();

      // Clean up old login attempts
      results.loginAttempts = await this.lockoutService.cleanupOldAttempts();

      // Clean up expired lockouts
      results.lockouts = await this.lockoutService.cleanupExpiredLockouts();

      // Clean up old audit logs
      results.auditLogs = await this.auditService.cleanupOldLogs();

      // Clean up inactive sessions
      results.sessions = await this.sessionService.cleanupInactiveSessions();

      const duration = Date.now() - startTime;
      this.logger.log(
        `Auth cleanup completed in ${duration}ms: ` +
          `${results.refreshTokens} refresh tokens, ` +
          `${results.emailVerifications} email verifications, ` +
          `${results.loginAttempts} login attempts, ` +
          `${results.lockouts} lockouts, ` +
          `${results.auditLogs} audit logs, ` +
          `${results.sessions} sessions`,
      );
    } catch (error) {
      this.logger.error('Auth cleanup failed:', error);
    }
  }

  /**
   * Clean up expired refresh tokens
   *
   * Removes tokens that have passed their expiration date.
   */
  private async cleanupExpiredRefreshTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Deleted ${result.count} expired refresh tokens`);
    }

    return result.count;
  }

  /**
   * Clean up expired email verification tokens
   *
   * Removes verification tokens that have expired.
   */
  private async cleanupExpiredEmailVerifications(): Promise<number> {
    const result = await this.prisma.emailVerification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Deleted ${result.count} expired email verifications`);
    }

    return result.count;
  }

  /**
   * Hourly quick cleanup for urgent items
   *
   * Only cleans up items that could cause immediate issues.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCleanup(): Promise<void> {
    try {
      // Quick cleanup of expired lockouts (users waiting to try again)
      const lockouts = await this.lockoutService.cleanupExpiredLockouts();

      if (lockouts > 0) {
        this.logger.debug(`Hourly cleanup: Released ${lockouts} lockouts`);
      }
    } catch (error) {
      this.logger.error('Hourly cleanup failed:', error);
    }
  }

  /**
   * Weekly deep cleanup
   *
   * More thorough cleanup that can take longer.
   * Runs Sunday at 4 AM.
   */
  @Cron('0 4 * * 0') // Sunday at 4 AM
  async handleWeeklyCleanup(): Promise<void> {
    this.logger.log('Starting weekly deep auth cleanup...');
    const startTime = Date.now();

    try {
      // Note: Orphaned records are automatically cleaned up via onDelete: Cascade
      // This weekly cleanup is reserved for any additional maintenance tasks

      // Clean up very old expired refresh tokens (belt and suspenders)
      const oldTokens = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30+ days old
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Weekly cleanup completed in ${duration}ms: ${oldTokens.count} old tokens removed`,
      );
    } catch (error) {
      this.logger.error('Weekly cleanup failed:', error);
    }
  }

  /**
   * Manually trigger cleanup (for admin use)
   *
   * Can be called via a protected admin endpoint if needed.
   */
  async triggerManualCleanup(): Promise<{
    success: boolean;
    results: Record<string, number>;
  }> {
    this.logger.log('Manual auth cleanup triggered');

    try {
      const results = {
        refreshTokens: await this.cleanupExpiredRefreshTokens(),
        emailVerifications: await this.cleanupExpiredEmailVerifications(),
        loginAttempts: await this.lockoutService.cleanupOldAttempts(),
        lockouts: await this.lockoutService.cleanupExpiredLockouts(),
        auditLogs: await this.auditService.cleanupOldLogs(),
        sessions: await this.sessionService.cleanupInactiveSessions(),
      };

      return { success: true, results };
    } catch (error) {
      this.logger.error('Manual cleanup failed:', error);
      return { success: false, results: {} };
    }
  }
}
