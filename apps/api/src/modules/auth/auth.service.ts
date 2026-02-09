import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User, Country } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import {
  RegisterDto,
  LoginDto,
  JwtPayload,
  SanitizedUser,
  AuthResponseDto,
  TokenPairDto,
  ChangePasswordDto,
  PasswordChangedResponseDto,
  EmailVerificationResponseDto,
  PasswordExpiryWarningDto,
  validatePasswordComplexity,
} from './dto';
import { AuthConfig } from './auth.config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '../../common/exceptions';
import { ErrorCodes } from '../../common/constants/error-codes';
import { EmailService } from './email.service';
import { AuditService, AuditContext } from './audit.service';
import { LockoutService } from './lockout.service';
import { MfaService } from './mfa.service';
import { MfaChallengeResponseDto } from './dto';

/**
 * Authentication Service
 *
 * Handles all authentication operations:
 * - Email/password registration and login
 * - JWT token generation and refresh
 * - Google OAuth verification
 * - Password reset flow
 * - Email verification
 * - Account lockout protection
 * - Security audit logging
 * - Session management (logout)
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly lockoutService: LockoutService,
    // MfaService injected via forwardRef to avoid circular dependency
    @Inject(forwardRef(() => MfaService))
    private readonly mfaService: MfaService,
  ) {
    // Initialize Google OAuth client if credentials are configured
    const googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (googleClientId) {
      this.googleClient = new OAuth2Client(googleClientId);
    }
  }

  // ==========================================
  // REGISTRATION & LOGIN
  // ==========================================

  /**
   * Register a new user with email and password
   *
   * Creates the user account and sends a verification email.
   * User can log in but some features may require verified email.
   */
  async register(
    dto: RegisterDto,
    context?: AuditContext,
  ): Promise<AuthResponseDto> {
    // Check if email already exists
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(
        'Email already registered',
        ErrorCodes.AUTH_EMAIL_EXISTS,
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      dto.password,
      AuthConfig.bcrypt.saltRounds,
    );

    // Create user with email unverified
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        country: dto.country || Country.OTHER,
        emailVerified: false,
      },
    });

    // Send verification email
    await this.sendVerificationEmail(user, context);

    // Generate tokens with session tracking
    const tokens = await this.generateTokens(user, context);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Login with email and password
   *
   * Includes lockout protection and audit logging.
   * Returns MFA challenge if MFA is enabled.
   */
  async login(
    dto: LoginDto,
    context?: AuditContext,
  ): Promise<AuthResponseDto | MfaChallengeResponseDto> {
    const auditContext = context || { ipAddress: 'unknown' };

    // Check for account lockout
    const lockoutStatus = await this.lockoutService.checkLockout(dto.email);
    if (lockoutStatus.isLocked) {
      await this.auditService.logLoginFailure(
        dto.email,
        'ACCOUNT_LOCKED',
        auditContext,
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${Math.ceil(lockoutStatus.remainingSeconds / 60)} minutes`,
        ErrorCodes.AUTH_ACCOUNT_LOCKED,
      );
    }

    // Find user by email
    const user = await this.userService.findByEmail(dto.email);

    // Validate credentials (generic error to prevent user enumeration)
    if (!user || !user.passwordHash) {
      await this.lockoutService.recordFailedAttempt(dto.email, auditContext);
      await this.auditService.logLoginFailure(
        dto.email,
        'USER_NOT_FOUND',
        auditContext,
      );
      throw new UnauthorizedException(
        'Invalid credentials',
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      const newLockoutStatus = await this.lockoutService.recordFailedAttempt(
        dto.email,
        auditContext,
      );
      await this.auditService.logLoginFailure(
        dto.email,
        'INVALID_PASSWORD',
        auditContext,
      );

      // If account just got locked, return lockout error
      if (newLockoutStatus.isLocked) {
        throw new UnauthorizedException(
          `Account locked after too many failed attempts. Try again in ${Math.ceil(newLockoutStatus.remainingSeconds / 60)} minutes`,
          ErrorCodes.AUTH_ACCOUNT_LOCKED,
        );
      }

      throw new UnauthorizedException(
        'Invalid credentials',
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
      );
    }

    // Successful login - clear lockout
    await this.lockoutService.recordSuccessfulLogin(dto.email, auditContext);

    // Check if MFA is enabled
    const mfaEnabled = await this.mfaService.isEnabled(user.id);
    if (mfaEnabled) {
      // Return MFA challenge instead of tokens
      return this.mfaService.createChallenge(user.id, user.email);
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log successful login
    await this.auditService.logLoginSuccess(user.id, user.email, auditContext);

    // Generate tokens with session tracking
    const tokens = await this.generateTokens(user, auditContext);

    // Check password expiry
    const passwordExpiryWarning = this.checkPasswordExpiry(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
      ...(passwordExpiryWarning && { passwordExpiryWarning }),
    };
  }

  // ==========================================
  // TOKEN MANAGEMENT
  // ==========================================

  /**
   * Refresh access and refresh tokens
   *
   * Implements token rotation: the old refresh token is invalidated
   * and a new one is issued. This limits the damage if a refresh
   * token is compromised.
   *
   * Also performs IP-based token compromise detection.
   */
  async refreshTokens(
    refreshToken: string,
    context?: AuditContext,
  ): Promise<TokenPairDto> {
    // Verify refresh token signature and expiration
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token exists in database (not revoked)
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Check if token is expired (double-check DB expiry)
    if (storedToken.expiresAt < new Date()) {
      // Clean up expired token
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Verify user still exists
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Token compromise detection: Check if IP has changed significantly
    if (context?.ipAddress && storedToken.ipAddress) {
      const ipChanged = storedToken.ipAddress !== context.ipAddress;
      if (ipChanged) {
        // Log suspicious activity - IP address changed since token was issued
        await this.auditService.logEvent({
          userId: user.id,
          email: user.email,
          eventType: 'SUSPICIOUS_ACTIVITY',
          success: true,
          context: {
            ...context,
            metadata: {
              type: 'IP_CHANGE_ON_TOKEN_REFRESH',
              originalIp: storedToken.ipAddress,
              newIp: context.ipAddress,
            },
          },
        });

        this.logger.warn(
          `Token refresh IP mismatch for user ${user.id}: ${storedToken.ipAddress} -> ${context.ipAddress}`,
        );

        // For now, we log but don't block. In a stricter implementation,
        // we could require re-authentication or send a security alert.
      }
    }

    // Atomic token rotation: delete old and create new in a transaction
    // This prevents race conditions and ensures consistency
    return this.prisma.$transaction(async (tx) => {
      // Delete old refresh token
      await tx.refreshToken.delete({ where: { id: storedToken.id } });

      // Delete associated session (will be recreated with new token)
      await tx.userSession.deleteMany({
        where: { refreshTokenId: storedToken.id },
      });

      // Generate new refresh token
      const refreshTokenPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
      };

      const newRefreshToken = this.jwtService.sign(refreshTokenPayload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: AuthConfig.jwt.refreshToken.expiresIn,
      });

      // Store new refresh token with current IP (for future compromise detection)
      const newStoredToken = await tx.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + AuthConfig.jwt.refreshToken.expiresInMs),
          ipAddress: context?.ipAddress,
          userAgent: context?.userAgent,
        },
      });

      // Create session if context is provided
      let sessionId: string | undefined;
      if (context) {
        const session = await tx.userSession.create({
          data: {
            userId: user.id,
            refreshTokenId: newStoredToken.id,
            ipAddress: context.ipAddress,
            deviceName: this.extractDeviceName(context.userAgent),
            deviceType: this.extractDeviceType(context.userAgent),
            browser: this.extractBrowser(context.userAgent),
            os: this.extractOS(context.userAgent),
          },
        });
        sessionId = session.id;
      }

      // Generate access token with session ID
      const accessTokenPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        sessionId,
      };

      const accessToken = this.jwtService.sign(accessTokenPayload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: AuthConfig.jwt.accessToken.expiresIn,
      });

      return { accessToken, refreshToken: newRefreshToken };
    });
  }

  /**
   * Logout - revoke refresh tokens
   *
   * @param userId User's ID
   * @param refreshToken Optional specific token to revoke. If not provided, all tokens are revoked.
   * @param context Optional audit context
   */
  async logout(
    userId: string,
    refreshToken?: string,
    context?: AuditContext,
  ): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    } else {
      // Revoke all tokens for user (logout from all devices)
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    // Log logout
    if (context) {
      await this.auditService.logLogout(userId, context);
    }
  }

  // ==========================================
  // GOOGLE OAUTH
  // ==========================================

  /**
   * Authenticate with Google ID token
   *
   * Verifies the token with Google and either:
   * - Returns existing user if Google ID matches
   * - Links Google account to existing email user
   * - Creates new user if no match found
   */
  async validateGoogleToken(
    idToken: string,
    context?: AuditContext,
  ): Promise<AuthResponseDto> {
    if (!this.googleClient) {
      throw new UnauthorizedException(
        'Google authentication is not configured',
      );
    }

    // Verify Google ID token
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });

    const googlePayload = ticket.getPayload();
    if (!googlePayload || !googlePayload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    // Verify email is verified by Google
    // This prevents attackers from using unverified Gmail accounts
    if (!googlePayload.email_verified) {
      throw new UnauthorizedException(
        'Email not verified by Google',
        ErrorCodes.AUTH_GOOGLE_EMAIL_NOT_VERIFIED,
      );
    }

    // Try to find user by Google ID first
    let user = await this.userService.findByGoogleId(googlePayload.sub);

    if (!user) {
      // Check if email already exists (link accounts)
      const existingUser = await this.userService.findByEmail(googlePayload.email);

      if (existingUser) {
        // Link Google account to existing user
        user = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { googleId: googlePayload.sub },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            email: googlePayload.email.toLowerCase(),
            name: googlePayload.name || googlePayload.email.split('@')[0],
            googleId: googlePayload.sub,
            country: Country.OTHER, // Default, can be updated later
          },
        });
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens with session tracking
    const tokens = await this.generateTokens(user, context);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ==========================================
  // PASSWORD RESET
  // ==========================================

  /**
   * Initiate password reset flow
   *
   * Generates a reset token and stores its hash in the database.
   * Sends reset email via EmailService.
   *
   * Note: Always returns success to prevent user enumeration
   */
  async forgotPassword(email: string, context?: AuditContext): Promise<void> {
    const user = await this.userService.findByEmail(email);

    // Silent return if user doesn't exist (prevent enumeration)
    if (!user) {
      this.logger.debug(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Store hashed token with expiry
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpires: new Date(
          Date.now() + AuthConfig.passwordReset.expiresInMs,
        ),
      },
    });

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.name,
      resetToken,
    );

    // Log the request
    if (context) {
      await this.auditService.logPasswordResetRequest(email, context);
    }

    this.logger.debug(`Password reset email sent to ${email}`);
  }

  /**
   * Reset password using token
   *
   * Validates the reset token and updates the password.
   * Revokes all refresh tokens to force re-login on all devices.
   */
  async resetPassword(
    token: string,
    newPassword: string,
    context?: AuditContext,
  ): Promise<void> {
    // Hash the provided token for comparison
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid or expired reset token',
        ErrorCodes.AUTH_TOKEN_INVALID,
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(
      newPassword,
      AuthConfig.bcrypt.saltRounds,
    );

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all refresh tokens (security measure)
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // Check if MFA was enabled and disable it for security
    // (Password reset via email bypasses MFA, so we disable it to prevent
    // an attacker with email access from having persistent access)
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId: user.id },
    });

    const mfaWasEnabled = mfaConfig?.isEnabled ?? false;

    if (mfaConfig) {
      await this.prisma.mfaConfig.delete({
        where: { userId: user.id },
      });

      if (mfaWasEnabled && context) {
        await this.auditService.logMfaDisabled(user.id, {
          ...context,
          metadata: { reason: 'PASSWORD_RESET' },
        });
      }

      this.logger.log(`MFA disabled for user ${user.id} due to password reset`);
    }

    // Log the password reset
    if (context) {
      await this.auditService.logPasswordResetComplete(user.id, context);
    }

    // Send password change security alert
    await this.emailService.sendSecurityAlertEmail(
      user.email,
      user.name,
      'PASSWORD_CHANGED',
      {
        Time: new Date().toISOString(),
        'IP Address': context?.ipAddress || 'Unknown',
      },
    );

    // Send SEPARATE dedicated MFA disabled alert if MFA was enabled
    // This ensures the user is clearly notified about this critical security change
    if (mfaWasEnabled) {
      await this.emailService.sendSecurityAlertEmail(
        user.email,
        user.name,
        'MFA_DISABLED',
        {
          Reason: 'Password reset (MFA bypass)',
          Time: new Date().toISOString(),
          'IP Address': context?.ipAddress || 'Unknown',
          Action:
            'If you did not request this, your email account may be compromised. Change your email password immediately.',
        },
      );
    }

    this.logger.log(`Password reset completed for user: ${user.id}`);
  }

  // ==========================================
  // EMAIL VERIFICATION
  // ==========================================

  /**
   * Send verification email to user
   *
   * Generates a verification token, stores its hash, and sends email.
   */
  private async sendVerificationEmail(
    user: User,
    context?: AuditContext,
  ): Promise<void> {
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Store hashed token with expiry
    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt: new Date(
          Date.now() + AuthConfig.emailVerification.expiresInMs,
        ),
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      user.name,
      verificationToken,
    );

    // Log the event
    if (context) {
      await this.auditService.logEmailVerificationSent(
        user.id,
        user.email,
        context,
      );
    }

    this.logger.debug(`Verification email sent to ${user.email}`);
  }

  /**
   * Verify email with token
   *
   * Validates the verification token and marks email as verified.
   */
  async verifyEmail(
    token: string,
    context?: AuditContext,
  ): Promise<EmailVerificationResponseDto> {
    // Hash the provided token for comparison
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find valid verification record
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!verification) {
      throw new BadRequestException(
        'Invalid or expired verification token',
        ErrorCodes.AUTH_EMAIL_VERIFICATION_INVALID,
      );
    }

    // Check if already verified
    if (verification.user.emailVerified) {
      throw new BadRequestException(
        'Email already verified',
        ErrorCodes.AUTH_EMAIL_ALREADY_VERIFIED,
      );
    }

    // Mark email as verified
    await this.prisma.user.update({
      where: { id: verification.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Delete all verification tokens for this user
    await this.prisma.emailVerification.deleteMany({
      where: { userId: verification.userId },
    });

    // Log the verification
    if (context) {
      await this.auditService.logEmailVerified(
        verification.userId,
        verification.user.email,
        context,
      );
    }

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      verification.user.email,
      verification.user.name,
    );

    this.logger.log(`Email verified for user: ${verification.userId}`);

    return {
      verified: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * Resend verification email
   *
   * Sends a new verification email if account is not yet verified.
   */
  async resendVerificationEmail(
    email: string,
    context?: AuditContext,
  ): Promise<void> {
    const user = await this.userService.findByEmail(email);

    // Silent return if user doesn't exist (prevent enumeration)
    if (!user) {
      this.logger.debug(
        `Verification resend requested for non-existent email: ${email}`,
      );
      return;
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new BadRequestException(
        'Email already verified',
        ErrorCodes.AUTH_EMAIL_ALREADY_VERIFIED,
      );
    }

    // Check for recent verification email (cooldown)
    const recentVerification = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gt: new Date(Date.now() - AuthConfig.emailVerification.resendCooldownMs),
        },
      },
    });

    if (recentVerification) {
      throw new BadRequestException(
        'Please wait before requesting another verification email',
        ErrorCodes.RATE_LIMIT_EXCEEDED,
      );
    }

    // Delete old verification tokens
    await this.prisma.emailVerification.deleteMany({
      where: { userId: user.id },
    });

    // Send new verification email
    await this.sendVerificationEmail(user, context);
  }

  // ==========================================
  // PASSWORD CHANGE
  // ==========================================

  /**
   * Change password (authenticated)
   *
   * Requires current password verification.
   * Revokes all other sessions for security.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    context?: AuditContext,
  ): Promise<PasswordChangedResponseDto> {
    // Find user
    const user = await this.userService.findById(userId);
    if (!user || !user.passwordHash) {
      throw new NotFoundException(
        'User not found',
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException(
        'Current password is incorrect',
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
      );
    }

    // Check new password is different from current
    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
        ErrorCodes.AUTH_PASSWORD_SAME_AS_OLD,
      );
    }

    // Validate new password complexity
    const validationResult = validatePasswordComplexity(dto.newPassword);
    if (!validationResult.isValid) {
      throw new BadRequestException(
        validationResult.errors[0] || 'Password does not meet requirements',
        ErrorCodes.AUTH_PASSWORD_TOO_WEAK,
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      dto.newPassword,
      AuthConfig.bcrypt.saltRounds,
    );

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all refresh tokens except current (if we had token tracking)
    // For now, revoke all tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    // Log the change
    if (context) {
      await this.auditService.logPasswordChange(userId, context);
    }

    // Send security alert
    await this.emailService.sendSecurityAlertEmail(
      user.email,
      user.name,
      'PASSWORD_CHANGED',
      { Time: new Date().toISOString() },
    );

    this.logger.log(`Password changed for user: ${userId}`);

    return {
      changed: true,
      message: 'Password changed successfully',
      sessionsRevoked: true,
    };
  }

  // ==========================================
  // MFA COMPLETION
  // ==========================================

  /**
   * Complete login after MFA verification
   *
   * Called by the controller after MFA is successfully verified.
   *
   * @param userId - User ID from MFA verification
   * @param context - Audit context
   * @returns Full auth response with tokens
   */
  async completeMfaLogin(
    userId: string,
    context?: AuditContext,
  ): Promise<AuthResponseDto> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(
        'User not found',
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log successful login (after MFA)
    if (context) {
      await this.auditService.logLoginSuccess(user.id, user.email, context);
    }

    // Generate tokens with session tracking
    const tokens = await this.generateTokens(user, context);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Generate access and refresh token pair with optional session tracking
   *
   * Access token: Short-lived (15min), used for API requests
   * Refresh token: Long-lived (7 days), used to get new access tokens
   *
   * @param user - User to generate tokens for
   * @param context - Optional audit context for session creation
   */
  private async generateTokens(
    user: User,
    context?: AuditContext,
  ): Promise<TokenPairDto> {
    // First, generate and store refresh token to get its ID
    const refreshTokenPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: AuthConfig.jwt.refreshToken.expiresIn,
    });

    // Store refresh token in database
    const storedRefreshToken = await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + AuthConfig.jwt.refreshToken.expiresInMs),
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      },
    });

    // Create session if context is provided
    let sessionId: string | undefined;
    if (context) {
      const session = await this.prisma.userSession.create({
        data: {
          userId: user.id,
          refreshTokenId: storedRefreshToken.id,
          ipAddress: context.ipAddress,
          deviceName: this.extractDeviceName(context.userAgent),
          deviceType: this.extractDeviceType(context.userAgent),
          browser: this.extractBrowser(context.userAgent),
          os: this.extractOS(context.userAgent),
        },
      });
      sessionId = session.id;
    }

    // Generate access token with session ID for tracking
    const accessTokenPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: AuthConfig.jwt.accessToken.expiresIn,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Extract device name from user agent
   */
  private extractDeviceName(userAgent?: string): string | null {
    if (!userAgent) return null;
    // Simple extraction - matches common patterns
    const match = userAgent.match(/\(([^)]+)\)/);
    return match ? match[1].split(';')[0].trim() : null;
  }

  /**
   * Extract device type from user agent
   */
  private extractDeviceType(userAgent?: string): string | null {
    if (!userAgent) return null;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    return 'desktop';
  }

  /**
   * Extract browser from user agent
   */
  private extractBrowser(userAgent?: string): string | null {
    if (!userAgent) return null;
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edg')) return 'Edge';
    return null;
  }

  /**
   * Extract OS from user agent
   */
  private extractOS(userAgent?: string): string | null {
    if (!userAgent) return null;
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone')) return 'iOS';
    return null;
  }

  /**
   * Check if user's password is expiring soon or has expired
   *
   * Returns a warning object if the password is within the warning period,
   * or null if the password is not expiring soon.
   *
   * @param user - User to check
   * @returns Password expiry warning or null
   */
  private checkPasswordExpiry(user: User): PasswordExpiryWarningDto | null {
    const { password: passwordConfig } = AuthConfig;

    // Skip if password expiration is disabled
    if (!passwordConfig.maxAgeMs) {
      return null;
    }

    // Skip if user has no password (OAuth-only user)
    if (!user.passwordHash) {
      return null;
    }

    // Use passwordChangedAt or createdAt as the password age baseline
    const passwordSetAt = user.passwordChangedAt || user.createdAt;
    const passwordExpiresAt = new Date(passwordSetAt.getTime() + passwordConfig.maxAgeMs);
    const now = new Date();

    // Calculate days remaining
    const msRemaining = passwordExpiresAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    // Check if we're in the warning period
    const warningStartMs = passwordConfig.maxAgeMs - passwordConfig.expiryWarningMs;
    const warningStartDate = new Date(passwordSetAt.getTime() + warningStartMs);

    if (now < warningStartDate) {
      // Not in warning period yet
      return null;
    }

    // Password is expiring soon (or already expired)
    if (daysRemaining <= 0) {
      return {
        isExpiring: true,
        daysRemaining: 0,
        expiresAt: passwordExpiresAt,
        message: 'Your password has expired. Please change it immediately.',
      };
    }

    return {
      isExpiring: true,
      daysRemaining,
      expiresAt: passwordExpiresAt,
      message: `Your password will expire in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Please update it soon.`,
    };
  }

  /**
   * Remove sensitive fields from user object
   */
  private sanitizeUser(user: User): SanitizedUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, passwordResetToken, passwordResetExpires, ...sanitized } = user;
    return sanitized;
  }
}
