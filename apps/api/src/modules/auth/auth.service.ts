import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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
} from './dto';
import { AuthConfig } from './auth.config';
import {
  ConflictException,
  UnauthorizedException,
} from '../../common/exceptions';

/**
 * Authentication Service
 *
 * Handles all authentication operations:
 * - Email/password registration and login
 * - JWT token generation and refresh
 * - Google OAuth verification
 * - Password reset flow
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
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if email already exists
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      dto.password,
      AuthConfig.bcrypt.saltRounds,
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        country: dto.country || Country.NIGERIA,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Login with email and password
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userService.findByEmail(dto.email);

    // Validate credentials (generic error to prevent user enumeration)
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
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
   */
  async refreshTokens(refreshToken: string): Promise<TokenPairDto> {
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

    // Token rotation: delete old token
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new token pair
    return this.generateTokens(user);
  }

  /**
   * Logout - revoke refresh tokens
   *
   * @param userId User's ID
   * @param refreshToken Optional specific token to revoke. If not provided, all tokens are revoked.
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
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
  async validateGoogleToken(idToken: string): Promise<AuthResponseDto> {
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
            country: Country.NIGERIA, // Default, can be updated later
          },
        });
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

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
   * The actual token is sent via email (stubbed for now).
   *
   * Note: Always returns success to prevent user enumeration
   */
  async forgotPassword(email: string): Promise<void> {
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

    // TODO: Send email with reset link
    // For now, log the token in development
    if (this.config.get('NODE_ENV') === 'development') {
      this.logger.debug(`Password reset token for ${email}: ${resetToken}`);
    }

    // In production, this would call an email service:
    // await this.emailService.sendPasswordReset(user.email, resetToken);
  }

  /**
   * Reset password using token
   *
   * Validates the reset token and updates the password.
   * Revokes all refresh tokens to force re-login on all devices.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
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
      throw new UnauthorizedException('Invalid or expired reset token');
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
      },
    });

    // Revoke all refresh tokens (security measure)
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    this.logger.log(`Password reset completed for user: ${user.id}`);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Generate access and refresh token pair
   *
   * Access token: Short-lived (15min), used for API requests
   * Refresh token: Long-lived (7 days), used to get new access tokens
   */
  private async generateTokens(user: User): Promise<TokenPairDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    // Generate access token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: AuthConfig.jwt.accessToken.expiresIn,
    });

    // Generate refresh token
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: AuthConfig.jwt.refreshToken.expiresIn,
    });

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + AuthConfig.jwt.refreshToken.expiresInMs),
      },
    });

    return { accessToken, refreshToken };
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
