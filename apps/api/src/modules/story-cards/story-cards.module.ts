/**
 * Story Cards Module
 *
 * Generates beautiful, shareable cards capturing the user's financial journey
 * for social media. Creates viral growth potential by allowing users to share
 * Future Self letters, commitment milestones, and recovery stories.
 *
 * Features:
 * - Generate shareable cards from achievements
 * - Privacy-first design with anonymized amounts by default
 * - Viral coefficient tracking for growth analytics
 * - Redis caching with graceful degradation
 * - Full Opik distributed tracing integration
 *
 * Architecture:
 * - StoryCardsService: Main facade for backward compatibility
 * - StoryCardsGenerationService: Card generation, source fetching, code generation
 * - StoryCardsAnalyticsService: Viral metrics, share tracking, view counting
 *
 * Dependencies:
 * - FutureSelfModule: For letter source data
 * - CommitmentModule: For commitment source data
 * - GpsModule: For recovery session source data
 *
 * @module StoryCardsModule
 */

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis';
import { StoryCardsController } from './story-cards.controller';
import { SharePageController } from './share-page.controller';
import { StoryCardsService } from './story-cards.service';
import { StoryCardsGenerationService } from './services/story-cards-generation.service';
import { StoryCardsAnalyticsService } from './services/story-cards-analytics.service';
import { StoryCardsCronService } from './story-cards.cron';
import { StoryCardsEventListener } from './story-cards.listener';
import { CardContentCalculator } from './calculators';
import { StoryCardsMetrics } from './story-cards.metrics';

/**
 * Module for the Story Cards viral sharing system
 *
 * Dependencies:
 * - PrismaModule: Database access for story cards, share events
 * - RedisModule: Caching for cards and metrics
 * - EventEmitterModule: For card lifecycle events
 * - OpikModule: Global module for distributed tracing (auto-injected)
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [
    StoryCardsController,
    SharePageController,
  ],
  providers: [
    // Core services
    StoryCardsService,
    StoryCardsGenerationService,
    StoryCardsAnalyticsService,

    // Supporting services
    StoryCardsCronService,
    StoryCardsEventListener,

    // Utilities
    CardContentCalculator,
    StoryCardsMetrics,
  ],
  exports: [
    StoryCardsService,
    StoryCardsGenerationService,
    StoryCardsAnalyticsService,
    StoryCardsCronService,
    StoryCardsMetrics,
  ],
})
export class StoryCardsModule {}
