/**
 * Account Lockout Service
 *
 * Implements progressive account lockout to protect against
 * brute force attacks. Tracks failed login attempts and
 * applies escalating lock durations for repeat offenders.
 *
 * @module LockoutService
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfig } from './auth.config';
import { AuditService, AuditContext } from './audit.service';

/**
 * Result of checking account lockout status
 */
export interface LockoutStatus {
  /** Whether the account is currently locked */
  isLocked: boolean;
  /** When the lock expires (null if not locked) */
  lockedUntil: Date | null;
  /** Remaining lock duration in seconds (0 if not locked) */
  remainingSeconds: number;
  /** Number of failed attempts in current window */
  failedAttempts: number;
  /** Reason for the lockout */
  reason: string | null;
}

/**
 * Service for managing account lockouts
 *
 * Provides brute force protection through progressive lockouts.
 * Lock duration escalates on repeated lockouts to deter persistent attacks.
 *
 * @example
 * ```typescript
 * // Check if account is locked before login
 * const status = await lockoutService.checkLockout(email);
 * if (status.isLocked) {
 *   throw new UnauthorizedException('Account locked');
 * }
 *
 * // Record failed attempt after wrong password
 * await lockoutService.recordFailedAttempt(email, context);
 * ```
 */
@Injectable()
export class LockoutService {
  private readonly logger = new Logger(LockoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check if an account is currently locked
   *
   * @param email - Email address to check
   * @returns Lockout status including remaining duration
   */
  async checkLockout(email: string): Promise<LockoutStatus> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check for active lockout
    const lockout = await this.prisma.accountLockout.findUnique({
      where: { email: normalizedEmail },
    });

    // No lockout record exists
    if (!lockout) {
      const failedAttempts = await this.getRecentFailedAttempts(normalizedEmail);
      return {
        isLocked: false,
        lockedUntil: null,
        remainingSeconds: 0,
        failedAttempts,
        reason: null,
      };
    }

    // Check if lockout has expired
    const now = new Date();
    if (lockout.lockedUntil <= now) {
      // Auto-unlock expired lockout
      await this.unlockAccount(normalizedEmail, 'SYSTEM_AUTO_UNLOCK');
      return {
        isLocked: false,
        lockedUntil: null,
        remainingSeconds: 0,
        failedAttempts: 0,
        reason: null,
      };
    }

    // Account is still locked
    const remainingSeconds = Math.ceil(
      (lockout.lockedUntil.getTime() - now.getTime()) / 1000,
    );

    return {
      isLocked: true,
      lockedUntil: lockout.lockedUntil,
      remainingSeconds,
      failedAttempts: lockout.attempts,
      reason: lockout.reason,
    };
  }

  /**
   * Record a failed login attempt
   *
   * Increments the failure counter and may trigger a lockout
   * if the threshold is exceeded.
   *
   * @param email - Email address that failed login
   * @param context - Request context for audit logging
   * @returns Updated lockout status
   */
  async recordFailedAttempt(
    email: string,
    context: AuditContext,
  ): Promise<LockoutStatus> {
    const normalizedEmail = email.toLowerCase().trim();
    const { accountLockout: config } = AuthConfig;

    // Record the attempt
    await this.prisma.loginAttempt.create({
      data: {
        email: normalizedEmail,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent ?? null,
        success: false,
        reason: 'INVALID_CREDENTIALS',
      },
    });

    // Count recent failed attempts
    const windowStart = new Date(Date.now() - config.attemptWindowMs);
    const recentAttempts = await this.prisma.loginAttempt.count({
      where: {
        email: normalizedEmail,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    this.logger.debug(
      `Failed attempt ${recentAttempts}/${config.maxAttempts} for ${normalizedEmail}`,
    );

    // Check if we should lock the account
    if (recentAttempts >= config.maxAttempts) {
      return this.lockAccount(normalizedEmail, recentAttempts, context);
    }

    return {
      isLocked: false,
      lockedUntil: null,
      remainingSeconds: 0,
      failedAttempts: recentAttempts,
      reason: null,
    };
  }

  /**
   * Record a successful login
   *
   * Clears the failed attempt counter after successful authentication.
   *
   * @param email - Email address that logged in successfully
   * @param context - Request context for audit logging
   */
  async recordSuccessfulLogin(
    email: string,
    context: AuditContext,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    // Record successful attempt
    await this.prisma.loginAttempt.create({
      data: {
        email: normalizedEmail,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent ?? null,
        success: true,
      },
    });

    // Clear any existing lockout
    await this.prisma.accountLockout.deleteMany({
      where: { email: normalizedEmail },
    });
  }

  /**
   * Lock an account after too many failed attempts
   *
   * Calculates lock duration with escalation for repeat offenders.
   *
   * @param email - Email address to lock
   * @param attempts - Number of failed attempts
   * @param context - Request context for audit logging
   * @returns New lockout status
   */
  private async lockAccount(
    email: string,
    attempts: number,
    context: AuditContext,
  ): Promise<LockoutStatus> {
    const { accountLockout: config } = AuthConfig;

    // Check for previous lockouts to calculate escalation
    const previousLockout = await this.prisma.accountLockout.findUnique({
      where: { email },
    });

    // Calculate lock duration with escalation
    let lockDurationMs = config.lockDurationMs;
    if (previousLockout) {
      // Calculate how many times the account has been locked
      // Each lockout happens after maxAttempts failures
      // Total attempts / maxAttempts = number of lockouts
      const previousLockoutCount = Math.floor(
        previousLockout.attempts / config.maxAttempts,
      );

      // Each subsequent lockout doubles the duration (exponential backoff)
      // For 2nd lockout: 2^1 = 2x, 3rd lockout: 2^2 = 4x, etc.
      const escalationFactor = Math.pow(
        config.escalationMultiplier,
        previousLockoutCount,
      );

      lockDurationMs = Math.min(
        lockDurationMs * escalationFactor,
        config.maxLockDurationMs,
      );

      this.logger.debug(
        `Account ${email} lockout #${previousLockoutCount + 1}: ${Math.ceil(lockDurationMs / 60000)} minutes`,
      );
    }

    const lockedUntil = new Date(Date.now() + lockDurationMs);
    const reason = 'FAILED_LOGIN_ATTEMPTS';

    // Create or update lockout record
    await this.prisma.accountLockout.upsert({
      where: { email },
      create: {
        email,
        lockedUntil,
        attempts,
        reason,
      },
      update: {
        lockedAt: new Date(),
        lockedUntil,
        attempts: { increment: attempts },
        reason,
        unlockedAt: null,
        unlockedBy: null,
      },
    });

    // Log the lockout
    await this.auditService.logAccountLocked(email, reason, context);

    const lockDurationMinutes = Math.ceil(lockDurationMs / 60000);
    this.logger.warn(
      `Account locked: ${email} for ${lockDurationMinutes} minutes after ${attempts} failed attempts`,
    );

    return {
      isLocked: true,
      lockedUntil,
      remainingSeconds: Math.ceil(lockDurationMs / 1000),
      failedAttempts: attempts,
      reason,
    };
  }

  /**
   * Manually unlock an account
   *
   * Used for admin unlock or auto-unlock after expiration.
   *
   * @param email - Email address to unlock
   * @param unlockedBy - Who unlocked (user ID, 'SYSTEM_AUTO_UNLOCK', or 'ADMIN')
   */
  async unlockAccount(email: string, unlockedBy: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.prisma.accountLockout.updateMany({
      where: { email: normalizedEmail },
      data: {
        unlockedAt: new Date(),
        unlockedBy,
      },
    });

    // Delete the lockout record after marking as unlocked
    await this.prisma.accountLockout.deleteMany({
      where: { email: normalizedEmail },
    });

    this.logger.log(`Account unlocked: ${normalizedEmail} by ${unlockedBy}`);
  }

  /**
   * Get count of recent failed attempts
   *
   * @param email - Email address to check
   * @returns Number of failed attempts in the current window
   */
  private async getRecentFailedAttempts(email: string): Promise<number> {
    const { accountLockout: config } = AuthConfig;
    const windowStart = new Date(Date.now() - config.attemptWindowMs);

    return this.prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        createdAt: { gte: windowStart },
      },
    });
  }

  /**
   * Clean up old login attempts
   *
   * Called by the auth cleanup cron job to prevent table bloat.
   * Keeps attempts for the configured window plus a buffer.
   *
   * @returns Number of records deleted
   */
  async cleanupOldAttempts(): Promise<number> {
    // Keep attempts for 7 days for security analysis
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const result = await this.prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old login attempts`);
    return result.count;
  }

  /**
   * Clean up expired lockouts
   *
   * Called by the auth cleanup cron job to remove stale lockout records.
   *
   * @returns Number of records deleted
   */
  async cleanupExpiredLockouts(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.accountLockout.deleteMany({
      where: {
        lockedUntil: { lt: now },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired lockouts`);
    return result.count;
  }
}
