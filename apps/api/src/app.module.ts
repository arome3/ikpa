import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
// import { RedisThrottlerStorage } from './common/throttler'; // Disabled for development
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { FinanceModule } from './modules/finance/finance.module';
import { SharkModule } from './modules/shark/shark.module';
import { GpsModule } from './modules/gps/gps.module';
import { CommitmentModule } from './modules/commitment/commitment.module';
import { FutureSelfModule } from './modules/future-self/future-self.module';
import { UbuntuModule } from './modules/ubuntu/ubuntu.module';
import { StoryCardsModule } from './modules/story-cards/story-cards.module';
import { ImportModule } from './modules/import/import.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OpikModule } from './modules/ai/opik';
import { OpikEvalModule } from './modules/ai/opik/opik-eval.module';
import { AnthropicModule } from './modules/ai/anthropic';

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

    // Rate limiting with tiered configuration (in-memory for development)
    // - Short: Prevents rapid-fire requests (10 requests per second)
    // - Medium: Prevents sustained abuse (50 requests per 10 seconds)
    // - Long: Prevents heavy abuse (200 requests per minute)
    ThrottlerModule.forRoot({
      throttlers: [
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
      ],
    }),

    // Task scheduling (for cron jobs)
    ScheduleModule.forRoot(),

    // Database
    PrismaModule,

    // Redis (caching, distributed locks)
    RedisModule,

    // AI Services
    AnthropicModule, // Claude API (Global)
    OpikModule,      // Distributed tracing + G-Eval metrics (Global)

    // Feature modules
    AuthModule,
    UserModule,
    FinanceModule,
    SharkModule,
    GpsModule,
    CommitmentModule,
    FutureSelfModule,
    UbuntuModule,
    StoryCardsModule,
    ImportModule,
    OnboardingModule,
    OpikEvalModule,
    // AIModule,
  ],
  controllers: [],
  providers: [
    // Redis-backed throttler storage (disabled for development - using in-memory)
    // RedisThrottlerStorage,
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
