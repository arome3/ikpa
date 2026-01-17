import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload, SanitizedUser } from '../dto/auth-response.dto';
import { UnauthorizedException } from '../../../common/exceptions';

/**
 * JWT Strategy
 *
 * Passport strategy for validating JWT access tokens.
 * This is used by JwtAuthGuard to authenticate protected routes.
 *
 * The strategy:
 * 1. Extracts JWT from Authorization header (Bearer token)
 * 2. Verifies token signature and expiration
 * 3. Looks up user in database
 * 4. Returns sanitized user (attached to request.user)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');

    if (!secret) {
      throw new Error(
        'JWT_ACCESS_SECRET environment variable is not configured',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Validate JWT payload and return user
   *
   * Called by Passport after token verification succeeds.
   * The returned value is attached to request.user.
   */
  async validate(payload: JwtPayload): Promise<SanitizedUser & { sessionId?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return user without sensitive fields, plus sessionId for tracking
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, passwordResetToken, passwordResetExpires, ...safeUser } = user;
    return {
      ...safeUser,
      sessionId: payload.sessionId,
    };
  }
}
