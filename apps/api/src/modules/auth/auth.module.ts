import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { EmailService } from './email.service';
import { AuditService } from './audit.service';
import { LockoutService } from './lockout.service';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';
import { AuthCronService } from './auth.cron';
import { AppleAuthService } from './apple-auth.service';

/**
 * Authentication Module
 *
 * Provides authentication services including:
 * - Email/password authentication
 * - JWT token management
 * - Google OAuth integration
 * - Apple Sign-In integration
 * - Password reset flow
 * - Email verification
 * - MFA/2FA (TOTP)
 * - Account lockout protection
 * - Session management
 * - Security audit logging
 *
 * Dependencies:
 * - PassportModule: For JWT strategy integration
 * - JwtModule: For token signing/verification
 * - UserModule: For user lookup operations
 */
@Module({
  imports: [
    // Configure Passport with JWT as default strategy
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Configure JWT module
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) {
          throw new Error('JWT_ACCESS_SECRET is not configured');
        }
        return {
          secret,
          signOptions: { expiresIn: '15m' },
        };
      },
    }),

    // Import UserModule for user lookup
    UserModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    EmailService,
    AuditService,
    LockoutService,
    MfaService,
    SessionService,
    AuthCronService,
    AppleAuthService,
  ],
  exports: [AuthService, AuditService, LockoutService, MfaService, SessionService],
})
export class AuthModule {}
