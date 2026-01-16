import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis Module
 *
 * Provides Redis connectivity throughout the application.
 * The @Global() decorator makes RedisService available in all modules
 * without needing explicit imports.
 *
 * Features:
 * - Distributed locking for cron jobs
 * - Cache operations for performance
 * - Graceful degradation when Redis is unavailable
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
