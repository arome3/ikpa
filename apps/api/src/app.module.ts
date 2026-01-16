import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OpikModule } from './modules/ai/opik';

/**
 * Root Application Module
 *
 * Configures:
 * - Environment configuration (global)
 * - Rate limiting (tiered: short/medium/long windows)
 * - Global guards (throttling and authentication)
 * - Database connection (Prisma)
 * - Feature modules
 */
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting with tiered configuration
    // - Short: Prevents rapid-fire requests (10 requests per second)
    // - Medium: Prevents sustained abuse (50 requests per 10 seconds)
    // - Long: Prevents heavy abuse (200 requests per minute)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 50, // 50 requests
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 200, // 200 requests
      },
    ]),

    // Database
    PrismaModule,

    // AI Observability
    OpikModule,

    // Feature modules
    AuthModule,
    UserModule,
    // FinanceModule,
    // AIModule,
  ],
  controllers: [],
  providers: [
    // Global rate limiter guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global authentication guard
    // Routes marked with @Public() decorator bypass authentication
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
