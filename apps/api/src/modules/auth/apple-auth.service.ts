/**
 * Apple Authentication Service
 *
 * Handles Sign in with Apple (SIWA) authentication flow.
 *
 * Features:
 * - Apple identity token (JWT) verification
 * - Apple public key fetching and caching
 * - User creation/linking with Apple ID
 * - Graceful handling of Apple's privacy relay emails
 *
 * @see https://developer.apple.com/documentation/sign_in_with_apple
 */

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AppleTokenPayload, AppleSignInDto } from './dto/apple-auth.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditContext } from './audit.service';
import { AuthConfig } from './auth.config';
import { ErrorCodes } from '../../common/constants/error-codes';
import { User, Country, Currency } from '@prisma/client';

interface AppleJWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleJWKSet {
  keys: AppleJWK[];
}

/**
 * Full user response type for API responses
 */
interface FullUserResponse {
  id: string;
  email: string;
  name: string;
  country: Country;
  currency: Currency;
  timezone: string;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  dateOfBirth: Date | null;
  employmentType: string | null;
  notificationsEnabled: boolean;
  weeklyReportEnabled: boolean;
}

@Injectable()
export class AppleAuthService {
  private readonly logger = new Logger(AppleAuthService.name);
  private readonly appleKeysUrl = 'https://appleid.apple.com/auth/keys';
  private cachedKeys: AppleJWKSet | null = null;
  private cacheExpiry = 0;
  private readonly cacheDuration = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authenticate user with Apple Sign-In
   *
   * @param dto - Apple sign-in data including identity token
   * @param context - Audit context for logging
   * @returns User tokens and info
   */
  async authenticate(
    dto: AppleSignInDto,
    context: AuditContext,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: FullUserResponse;
    isNewUser: boolean;
  }> {
    // Verify the Apple identity token
    const payload = await this.verifyIdentityToken(dto.identityToken);

    // Apple's unique user identifier
    const appleUserId = payload.sub;
    const email = dto.email || payload.email;
    const name = dto.name;

    if (!email) {
      throw new UnauthorizedException({
        message: 'Email is required for Apple Sign-In',
        code: ErrorCodes.AUTH_APPLE_ID_TOKEN_INVALID,
      });
    }

    // Check if user exists with this Apple ID
    let user = await this.prisma.user.findUnique({
      where: { appleId: appleUserId },
    });

    let isNewUser = false;

    if (!user) {
      // Check if user exists with this email (link accounts)
      user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (user) {
        // Link Apple ID to existing account
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            appleId: appleUserId,
            emailVerified: true, // Apple verifies email
            emailVerifiedAt: new Date(),
          },
        });

        await this.auditService.logEvent({
          userId: user.id,
          email: user.email,
          eventType: 'OAUTH_LINKED',
          context: {
            ...context,
            metadata: { provider: 'APPLE', appleUserId },
          },
        });
      } else {
        // Create new user
        isNewUser = true;
        user = await this.prisma.user.create({
          data: {
            email: email.toLowerCase(),
            name: name || email.split('@')[0],
            appleId: appleUserId,
            emailVerified: true, // Apple verifies email
            emailVerifiedAt: new Date(),
            country: dto.country,
          },
        });

        await this.auditService.logEvent({
          userId: user.id,
          email: user.email,
          eventType: 'LOGIN_SUCCESS',
          context: {
            ...context,
            metadata: { provider: 'APPLE', isNewUser: true },
          },
        });
      }
    } else {
      // Update last login
      await this.auditService.logLoginSuccess(user.id, user.email, {
        ...context,
        metadata: { provider: 'APPLE' },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.formatUserResponse(user),
      isNewUser,
    };
  }

  /**
   * Format user for API response
   */
  private formatUserResponse(user: User): FullUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      country: user.country,
      currency: user.currency,
      timezone: user.timezone,
      onboardingCompleted: user.onboardingCompleted,
      emailVerified: user.emailVerified,
      dateOfBirth: user.dateOfBirth,
      employmentType: user.employmentType,
      notificationsEnabled: user.notificationsEnabled,
      weeklyReportEnabled: user.weeklyReportEnabled,
    };
  }

  /**
   * Verify Apple identity token (JWT)
   */
  private async verifyIdentityToken(identityToken: string): Promise<AppleTokenPayload> {
    try {
      // Decode header to get key ID
      const [headerB64] = identityToken.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());
      const { kid, alg } = header;

      if (alg !== 'RS256') {
        throw new Error('Invalid algorithm');
      }

      // Get Apple's public key
      const publicKey = await this.getApplePublicKey(kid);

      // Verify and decode the token
      const payload = this.jwtService.verify<AppleTokenPayload>(identityToken, {
        algorithms: ['RS256'],
        publicKey,
        issuer: 'https://appleid.apple.com',
        audience: this.configService.get<string>('APPLE_CLIENT_ID'),
      });

      // Additional validation
      if (!payload.sub) {
        throw new Error('Missing subject claim');
      }

      // Check expiration (JWT verify should handle this, but double-check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      this.logger.error(
        `Apple token verification failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw new UnauthorizedException({
        message: 'Invalid Apple identity token',
        code: ErrorCodes.AUTH_APPLE_ID_TOKEN_INVALID,
      });
    }
  }

  /**
   * Get Apple's public key for JWT verification
   */
  private async getApplePublicKey(kid: string): Promise<string> {
    // Check cache
    if (this.cachedKeys && Date.now() < this.cacheExpiry) {
      const key = this.cachedKeys.keys.find((k) => k.kid === kid);
      if (key) {
        return this.jwkToPem(key);
      }
    }

    // Fetch fresh keys from Apple
    try {
      const response = await fetch(this.appleKeysUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Apple keys: ${response.status}`);
      }

      this.cachedKeys = (await response.json()) as AppleJWKSet;
      this.cacheExpiry = Date.now() + this.cacheDuration;

      const key = this.cachedKeys.keys.find((k) => k.kid === kid);
      if (!key) {
        throw new Error(`Key with kid ${kid} not found`);
      }

      return this.jwkToPem(key);
    } catch (error) {
      this.logger.error(
        `Failed to fetch Apple public keys: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw new Error('Failed to verify Apple token');
    }
  }

  /**
   * Convert JWK to PEM format
   */
  private jwkToPem(jwk: AppleJWK): string {
    // Create a KeyObject from the JWK components
    const keyObject = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
      },
      format: 'jwk',
    });

    // Export as PEM
    return keyObject.export({ type: 'spki', format: 'pem' }) as string;
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Generate JWTs
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        type: 'access',
      },
      {
        expiresIn: AuthConfig.jwt.accessToken.expiresIn,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        type: 'refresh',
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: AuthConfig.jwt.refreshToken.expiresIn,
      },
    );

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
}
