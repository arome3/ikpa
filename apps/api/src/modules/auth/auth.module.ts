import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';

/**
 * Authentication Module
 *
 * Provides authentication services including:
 * - Email/password authentication
 * - JWT token management
 * - Google OAuth integration
 * - Password reset flow
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
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
