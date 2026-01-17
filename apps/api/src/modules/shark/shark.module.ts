/**
 * Shark Auditor Module
 *
 * Detects and eliminates "zombie subscriptions" - subscriptions
 * that users are paying for but no longer using.
 *
 * Features:
 * - Regex pattern matching for subscription detection
 * - Anomaly detection for zombie subscriptions (unused > 90 days)
 * - Annualized cost framing for impact awareness
 * - Tinder-style swipe UI support (KEEP, CANCEL, REVIEW_LATER)
 * - Full Opik distributed tracing integration
 * - Weekly scheduled zombie detection cron job
 *
 * @module SharkModule
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis';
import { SharkService } from './shark.service';
import { SharkController } from './shark.controller';
import { SharkCronService } from './shark.cron';
import {
  SubscriptionDetectorCalculator,
  ZombieDetectorCalculator,
  AnnualizedFramingCalculator,
} from './calculators';

/**
 * Module for the Shark Auditor subscription management system
 *
 * Dependencies:
 * - PrismaModule: Database access
 * - RedisModule: Distributed locking for cron jobs
 * - OpikModule: Global module for distributed tracing (auto-injected)
 */
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [SharkController],
  providers: [
    SharkService,
    SharkCronService,
    SubscriptionDetectorCalculator,
    ZombieDetectorCalculator,
    AnnualizedFramingCalculator,
  ],
  exports: [SharkService, SharkCronService],
})
export class SharkModule {}
