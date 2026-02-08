/**
 * Future Self Module
 *
 * Provides the Future Self Simulator feature for IKPA.
 * Bridges temporal disconnect through personalized "Letters from 2045"
 * and dual-path financial visualizations.
 *
 * Based on MIT Media Lab research showing 16% increase in savings
 * after future self interaction.
 *
 * Dependencies:
 * - PrismaModule: Database access for user data (Global - auto-injected)
 * - FinanceModule: SimulationEngineCalculator for Monte Carlo simulations
 * - OpikModule: Distributed tracing (Global - auto-injected)
 * - AnthropicModule: Claude API access (Global - auto-injected)
 *
 * Exports:
 * - FutureSelfService: For use in other modules (e.g., scheduled letters)
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FinanceModule } from '../finance/finance.module';
import { RedisModule } from '../../redis';
import { FutureSelfController } from './future-self.controller';
import { FutureSelfService } from './future-self.service';
import { FutureSelfAgent } from './agents/future-self.agent';
import { ContentModerationService } from './services/content-moderation.service';
import { FutureSelfCronService } from './future-self.cron';
import { FutureSelfCacheListener } from './future-self-cache.listener';

@Module({
  imports: [
    PrismaModule,
    FinanceModule,
    RedisModule,
  ],
  controllers: [FutureSelfController],
  providers: [
    FutureSelfService,
    FutureSelfAgent,
    // AnthropicService is now provided by global AnthropicModule
    ContentModerationService,
    FutureSelfCronService,
    FutureSelfCacheListener,
  ],
  exports: [FutureSelfService],
})
export class FutureSelfModule {}
