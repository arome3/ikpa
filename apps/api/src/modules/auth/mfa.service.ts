/**
 * Multi-Factor Authentication (MFA) Service
 *
 * Implements TOTP-based MFA using RFC 6238.
 * Provides setup, verification, and backup code management.
 *
 * @module MfaService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { MfaMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthConfig } from './auth.config';
import { AuditService, AuditContext } from './audit.service';
import { EmailService } from './email.service';
import {
  MfaSetupResponseDto,
  MfaStatusResponseDto,
  BackupCodesResponseDto,
  MfaChallengeResponseDto,
} from './dto';
import {
  BadRequestException,
  UnauthorizedException,
} from '../../common/exceptions/api.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import { JwtService } from '@nestjs/jwt';

/**
 * Temporary MFA token payload
 */
interface MfaTokenPayload {
  sub: string; // User ID
  email: string;
  type: 'mfa_challenge';
  exp: number;
}

/**
 * Service for TOTP-based Multi-Factor Authentication
 *
 * Handles the complete MFA lifecycle:
 * - Setup: Generate secret, QR code, and backup codes
 * - Verification: Validate TOTP codes during login
 * - Backup codes: One-time use recovery codes
 * - Management: Enable, disable, and status checks
 *
 * @example
 * ```typescript
 * // Enable MFA
 * const setup = await mfaService.initiateSetup(userId);
 * // User scans QR code...
 * await mfaService.verifyAndEnable(userId, totpCode, context);
 *
 * // During login
 * const challenge = await mfaService.createChallenge(userId);
 * // Client sends TOTP code...
 * await mfaService.verifyChallenge(mfaToken, code, context);
 * ```
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  // ==========================================
  // MFA SETUP
  // ==========================================

  /**
   * Initiate MFA setup for a user
   *
   * Generates a new TOTP secret and QR code.
   * The secret is stored but MFA is not enabled until verified.
   *
   * @param userId - User ID
   * @returns Setup data including QR code and secret
   */
  async initiateSetup(userId: string): Promise<MfaSetupResponseDto> {
    // Check if MFA is already enabled
    const existingConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (existingConfig?.isEnabled) {
      throw new BadRequestException(
        'MFA is already enabled. Disable it first to reconfigure.',
        ErrorCodes.AUTH_MFA_ALREADY_ENABLED,
      );
    }

    // Get user email for the authenticator label
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new BadRequestException('User not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Generate new secret
    const secret = generateSecret();

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

    // Create or update MFA config (not enabled yet)
    await this.prisma.mfaConfig.upsert({
      where: { userId },
      create: {
        userId,
        method: MfaMethod.TOTP,
        secret: this.encryptSecret(secret),
        backupCodes: hashedBackupCodes,
        isEnabled: false,
      },
      update: {
        secret: this.encryptSecret(secret),
        backupCodes: hashedBackupCodes,
        isEnabled: false,
        verifiedAt: null,
      },
    });

    // Generate OTP auth URL
    const otpAuthUrl = generateURI({
      issuer: AuthConfig.mfa.issuer,
      label: user.email,
      secret,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    this.logger.debug(`MFA setup initiated for user ${userId}`);

    return {
      qrCode,
      secret,
      otpAuthUrl,
    };
  }

  /**
   * Verify setup and enable MFA
   *
   * Validates the user's first TOTP code to confirm
   * they have correctly set up their authenticator.
   *
   * @param userId - User ID
   * @param code - TOTP code from authenticator app
   * @param context - Audit context
   * @returns Backup codes for the user to save
   */
  async verifyAndEnable(
    userId: string,
    code: string,
    context?: AuditContext,
  ): Promise<BackupCodesResponseDto> {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig) {
      throw new BadRequestException(
        'MFA setup not initiated. Call setup first.',
        ErrorCodes.AUTH_MFA_NOT_CONFIGURED,
      );
    }

    if (mfaConfig.isEnabled) {
      throw new BadRequestException(
        'MFA is already enabled',
        ErrorCodes.AUTH_MFA_ALREADY_ENABLED,
      );
    }

    // Verify the TOTP code
    const secret = this.decryptSecret(mfaConfig.secret);
    const result = verifySync({ token: code, secret, epochTolerance: AuthConfig.mfa.totpWindow * 30 });
    const isValid = result.valid;

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid verification code. Please try again.',
        ErrorCodes.AUTH_MFA_INVALID,
      );
    }

    // Enable MFA
    await this.prisma.mfaConfig.update({
      where: { userId },
      data: {
        isEnabled: true,
        verifiedAt: new Date(),
        lastUsedAt: new Date(),
      },
    });

    // Log the event
    if (context) {
      await this.auditService.logMfaEnabled(userId, context);
    }

    // Send security alert
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user) {
      await this.emailService.sendSecurityAlertEmail(
        user.email,
        user.name,
        'MFA_ENABLED',
        { Time: new Date().toISOString() },
      );
    }

    // Return unhashed backup codes (only time they're shown)
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

    // Update with new backup codes
    await this.prisma.mfaConfig.update({
      where: { userId },
      data: { backupCodes: hashedBackupCodes },
    });

    this.logger.log(`MFA enabled for user ${userId}`);

    return {
      backupCodes,
      message: 'MFA enabled successfully. Store these backup codes securely.',
    };
  }

  // ==========================================
  // MFA VERIFICATION
  // ==========================================

  /**
   * Create an MFA challenge for login
   *
   * Called when a user with MFA enabled successfully
   * provides their password.
   *
   * @param userId - User ID
   * @param email - User email
   * @returns MFA challenge response with temporary token
   */
  async createChallenge(
    userId: string,
    email: string,
  ): Promise<MfaChallengeResponseDto> {
    // Create temporary MFA token (short-lived)
    // Uses separate secret from access token for security isolation
    const mfaToken = this.jwtService.sign(
      {
        sub: userId,
        email,
        type: 'mfa_challenge',
      } as MfaTokenPayload,
      {
        secret: this.getMfaSecret(),
        expiresIn: '5m', // 5 minutes to complete MFA
      },
    );

    return {
      mfaRequired: true,
      mfaToken,
      methods: ['TOTP'],
    };
  }

  /**
   * Verify MFA challenge with TOTP code
   *
   * @param mfaToken - Temporary MFA token from challenge
   * @param code - TOTP code from authenticator
   * @param context - Audit context
   * @returns User ID if verification succeeds
   */
  async verifyChallenge(
    mfaToken: string,
    code: string,
    context?: AuditContext,
  ): Promise<{ userId: string; email: string }> {
    // Verify MFA token (uses separate secret from access token)
    let payload: MfaTokenPayload;
    try {
      payload = this.jwtService.verify(mfaToken, {
        secret: this.getMfaSecret(),
      });
    } catch {
      throw new UnauthorizedException(
        'MFA session expired. Please log in again.',
        ErrorCodes.AUTH_TOKEN_EXPIRED,
      );
    }

    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException(
        'Invalid MFA token',
        ErrorCodes.AUTH_TOKEN_INVALID,
      );
    }

    // Get MFA config with attempt tracking
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId: payload.sub },
    });

    if (!mfaConfig || !mfaConfig.isEnabled) {
      throw new BadRequestException(
        'MFA is not configured for this account',
        ErrorCodes.AUTH_MFA_NOT_CONFIGURED,
      );
    }

    // Check for MFA attempt rate limiting (max 5 attempts per 5 minutes)
    const recentFailures = await this.getRecentMfaFailures(payload.sub);
    if (recentFailures >= 5) {
      throw new UnauthorizedException(
        'Too many failed MFA attempts. Please wait 5 minutes.',
        ErrorCodes.AUTH_TOO_MANY_ATTEMPTS,
      );
    }

    // Verify TOTP code
    const secret = this.decryptSecret(mfaConfig.secret);
    const isValid = verifySync({ token: code, secret, epochTolerance: AuthConfig.mfa.totpWindow * 30 }).valid;

    if (!isValid) {
      // Track failed MFA attempt
      await this.recordMfaFailure(payload.sub);
      if (context) {
        await this.auditService.logMfaFailed(payload.sub, context);
      }
      throw new UnauthorizedException(
        'Invalid verification code',
        ErrorCodes.AUTH_MFA_INVALID,
      );
    }

    // Update last used
    await this.prisma.mfaConfig.update({
      where: { userId: payload.sub },
      data: { lastUsedAt: new Date() },
    });

    if (context) {
      await this.auditService.logMfaVerified(payload.sub, context);
    }

    return { userId: payload.sub, email: payload.email };
  }

  /**
   * Verify MFA challenge with backup code
   *
   * @param mfaToken - Temporary MFA token from challenge
   * @param backupCode - One-time backup code
   * @param context - Audit context
   * @returns User ID if verification succeeds
   */
  async verifyChallengeWithBackupCode(
    mfaToken: string,
    backupCode: string,
    context?: AuditContext,
  ): Promise<{ userId: string; email: string }> {
    // Verify MFA token (uses separate secret from access token)
    let payload: MfaTokenPayload;
    try {
      payload = this.jwtService.verify(mfaToken, {
        secret: this.getMfaSecret(),
      });
    } catch {
      throw new UnauthorizedException(
        'MFA session expired. Please log in again.',
        ErrorCodes.AUTH_TOKEN_EXPIRED,
      );
    }

    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException(
        'Invalid MFA token',
        ErrorCodes.AUTH_TOKEN_INVALID,
      );
    }

    // Get MFA config
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId: payload.sub },
    });

    if (!mfaConfig || !mfaConfig.isEnabled) {
      throw new BadRequestException(
        'MFA is not configured for this account',
        ErrorCodes.AUTH_MFA_NOT_CONFIGURED,
      );
    }

    // Check for MFA attempt rate limiting
    const recentFailures = await this.getRecentMfaFailures(payload.sub);
    if (recentFailures >= 5) {
      throw new UnauthorizedException(
        'Too many failed MFA attempts. Please wait 5 minutes.',
        ErrorCodes.AUTH_TOO_MANY_ATTEMPTS,
      );
    }

    // Check backup codes - use transaction to prevent race condition
    const normalizedCode = backupCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let matchedIndex = -1;

    for (let i = 0; i < mfaConfig.backupCodes.length; i++) {
      const isMatch = await this.verifyBackupCode(
        normalizedCode,
        mfaConfig.backupCodes[i],
      );
      if (isMatch) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      await this.recordMfaFailure(payload.sub);
      if (context) {
        await this.auditService.logMfaFailed(payload.sub, context);
      }
      throw new UnauthorizedException(
        'Invalid backup code',
        ErrorCodes.AUTH_BACKUP_CODE_INVALID,
      );
    }

    // Remove used backup code atomically to prevent race condition
    const remainingCodes = mfaConfig.backupCodes.filter(
      (_, i) => i !== matchedIndex,
    );

    // Use transaction to ensure atomic update
    await this.prisma.$transaction(async (tx) => {
      // Re-check the backup code hasn't been used (race condition protection)
      const currentConfig = await tx.mfaConfig.findUnique({
        where: { userId: payload.sub },
      });

      if (!currentConfig || currentConfig.backupCodes.length !== mfaConfig.backupCodes.length) {
        throw new UnauthorizedException(
          'Backup code already used',
          ErrorCodes.AUTH_BACKUP_CODE_INVALID,
        );
      }

      await tx.mfaConfig.update({
        where: { userId: payload.sub },
        data: {
          backupCodes: remainingCodes,
          lastUsedAt: new Date(),
        },
      });
    });

    // Warn if running low on backup codes
    if (remainingCodes.length <= 2) {
      this.logger.warn(
        `User ${payload.sub} is running low on MFA backup codes (${remainingCodes.length} remaining)`,
      );
    }

    if (context) {
      await this.auditService.logMfaVerified(payload.sub, {
        ...context,
        metadata: { method: 'backup_code' },
      });
    }

    return { userId: payload.sub, email: payload.email };
  }

  // ==========================================
  // MFA MANAGEMENT
  // ==========================================

  /**
   * Disable MFA for a user
   *
   * @param userId - User ID
   * @param code - TOTP code OR password for verification
   * @param password - Password (if code not provided)
   * @param context - Audit context
   */
  async disable(
    userId: string,
    code?: string,
    password?: string,
    context?: AuditContext,
  ): Promise<void> {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.isEnabled) {
      throw new BadRequestException(
        'MFA is not enabled',
        ErrorCodes.AUTH_MFA_NOT_CONFIGURED,
      );
    }

    // Require either TOTP code or password
    if (code) {
      const secret = this.decryptSecret(mfaConfig.secret);
      const isValid = verifySync({ token: code, secret, epochTolerance: AuthConfig.mfa.totpWindow * 30 }).valid;

      if (!isValid) {
        throw new UnauthorizedException(
          'Invalid verification code',
          ErrorCodes.AUTH_MFA_INVALID,
        );
      }
    } else if (password) {
      // Verify password
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user?.passwordHash) {
        throw new BadRequestException(
          'Password verification not available for this account',
          ErrorCodes.AUTH_INVALID_CREDENTIALS,
        );
      }

      const bcrypt = await import('bcrypt');
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        throw new UnauthorizedException(
          'Invalid password',
          ErrorCodes.AUTH_INVALID_CREDENTIALS,
        );
      }
    } else {
      throw new BadRequestException(
        'Either TOTP code or password is required to disable MFA',
        ErrorCodes.VALIDATION_REQUIRED_FIELD,
      );
    }

    // Disable MFA
    await this.prisma.mfaConfig.delete({
      where: { userId },
    });

    // Log the event
    if (context) {
      await this.auditService.logMfaDisabled(userId, context);
    }

    // Send security alert
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user) {
      await this.emailService.sendSecurityAlertEmail(
        user.email,
        user.name,
        'MFA_DISABLED',
        { Time: new Date().toISOString() },
      );
    }

    this.logger.log(`MFA disabled for user ${userId}`);
  }

  /**
   * Get MFA status for a user
   */
  async getStatus(userId: string): Promise<MfaStatusResponseDto> {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.isEnabled) {
      return {
        enabled: false,
        method: 'NONE',
        lastUsedAt: null,
        backupCodesRemaining: 0,
      };
    }

    return {
      enabled: true,
      method: mfaConfig.method,
      lastUsedAt: mfaConfig.lastUsedAt,
      backupCodesRemaining: mfaConfig.backupCodes.length,
    };
  }

  /**
   * Check if MFA is enabled for a user
   */
  async isEnabled(userId: string): Promise<boolean> {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
      select: { isEnabled: true },
    });

    return mfaConfig?.isEnabled ?? false;
  }

  /**
   * Regenerate backup codes
   *
   * @param userId - User ID
   * @param code - TOTP code for verification
   * @param context - Audit context
   * @returns New backup codes
   */
  async regenerateBackupCodes(
    userId: string,
    code: string,
    context?: AuditContext,
  ): Promise<BackupCodesResponseDto> {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.isEnabled) {
      throw new BadRequestException(
        'MFA is not enabled',
        ErrorCodes.AUTH_MFA_NOT_CONFIGURED,
      );
    }

    // Verify TOTP code
    const secret = this.decryptSecret(mfaConfig.secret);
    const isValid = verifySync({ token: code, secret, epochTolerance: AuthConfig.mfa.totpWindow * 30 }).valid;

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid verification code',
        ErrorCodes.AUTH_MFA_INVALID,
      );
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

    await this.prisma.mfaConfig.update({
      where: { userId },
      data: { backupCodes: hashedBackupCodes },
    });

    if (context) {
      await this.auditService.logEvent({
        userId,
        eventType: 'MFA_ENABLED', // Reusing for backup code regen
        success: true,
        context: {
          ...context,
          metadata: { action: 'backup_codes_regenerated' },
        },
      });
    }

    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return {
      backupCodes,
      message:
        'New backup codes generated. Previous codes are no longer valid.',
    };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const { backupCodeCount, backupCodeLength } = AuthConfig.mfa;

    for (let i = 0; i < backupCodeCount; i++) {
      const code = crypto
        .randomBytes(Math.ceil(backupCodeLength / 2))
        .toString('hex')
        .toUpperCase()
        .slice(0, backupCodeLength);
      codes.push(code);
    }

    return codes;
  }

  /**
   * Hash backup codes for storage
   */
  private async hashBackupCodes(codes: string[]): Promise<string[]> {
    const bcrypt = await import('bcrypt');
    return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
  }

  /**
   * Verify a backup code against hashed value
   */
  private async verifyBackupCode(
    code: string,
    hashedCode: string,
  ): Promise<boolean> {
    const bcrypt = await import('bcrypt');
    return bcrypt.compare(code, hashedCode);
  }

  /**
   * Encrypt TOTP secret for storage
   *
   * Uses AES-256-GCM for authenticated encryption.
   */
  private encryptSecret(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt TOTP secret
   */
  private decryptSecret(encryptedSecret: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get encryption key from environment
   */
  private getEncryptionKey(): Buffer {
    const keyHex = this.configService.get<string>('MFA_ENCRYPTION_KEY');

    if (!keyHex) {
      // Fallback to JWT secret if MFA key not set (for development)
      const jwtSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
      if (!jwtSecret) {
        throw new Error('MFA_ENCRYPTION_KEY or JWT_ACCESS_SECRET is required');
      }
      return crypto.createHash('sha256').update(jwtSecret).digest();
    }

    return Buffer.from(keyHex, 'hex');
  }

  /**
   * Get MFA-specific JWT secret
   *
   * Uses a separate secret from access tokens for security isolation.
   * Falls back to derived key from access secret for backwards compatibility.
   */
  private getMfaSecret(): string {
    const mfaSecret = this.configService.get<string>('JWT_MFA_SECRET');
    if (mfaSecret) {
      return mfaSecret;
    }

    // Fallback: derive from access secret (for development/migration)
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    if (!accessSecret) {
      throw new Error('JWT_MFA_SECRET or JWT_ACCESS_SECRET is required');
    }

    // Derive a separate key using HMAC
    return crypto
      .createHmac('sha256', accessSecret)
      .update('mfa-token-secret')
      .digest('hex');
  }

  // ==========================================
  // MFA RATE LIMITING
  // ==========================================

  /**
   * MFA attempt tracking cache (in-memory for simplicity)
   * In production, use Redis for distributed tracking
   */
  private mfaAttempts = new Map<string, { count: number; resetAt: number }>();

  /**
   * Get count of recent MFA failures for a user
   */
  private async getRecentMfaFailures(userId: string): Promise<number> {
    const record = this.mfaAttempts.get(userId);
    if (!record || record.resetAt < Date.now()) {
      return 0;
    }
    return record.count;
  }

  /**
   * Record a failed MFA attempt
   */
  private async recordMfaFailure(userId: string): Promise<void> {
    const fiveMinutes = 5 * 60 * 1000;
    const now = Date.now();

    const existing = this.mfaAttempts.get(userId);
    if (existing && existing.resetAt > now) {
      existing.count += 1;
    } else {
      this.mfaAttempts.set(userId, {
        count: 1,
        resetAt: now + fiveMinutes,
      });
    }

    // Cleanup old entries periodically
    if (this.mfaAttempts.size > 1000) {
      for (const [key, value] of this.mfaAttempts.entries()) {
        if (value.resetAt < now) {
          this.mfaAttempts.delete(key);
        }
      }
    }
  }
}
