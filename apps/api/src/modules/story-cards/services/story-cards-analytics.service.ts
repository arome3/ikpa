/**
 * Story Cards Analytics Service
 *
 * Handles viral metrics, gradient performance analytics, share tracking,
 * and view count management.
 * Extracted from StoryCardsService for single responsibility.
 *
 * Responsibilities:
 * - Calculate viral metrics (shares, signups, viral coefficient)
 * - Track gradient performance for A/B testing
 * - Record share events and link signups to referrals
 * - Manage view count tracking with abuse detection
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { OpikService } from '../../ai/opik/opik.service';
import { StoryCardType, SharePlatform } from '@prisma/client';
import { StoryCardsMetrics } from '../story-cards.metrics';
import {
  STORY_CARD_EVENTS,
  VIEW_MILESTONES,
  StoryCardSharedEvent,
  StoryCardViewMilestoneEvent,
} from '../story-cards.events';
import {
  TrackShareInput,
  ShareEventData,
  ViralMetrics,
  GradientPerformance,
} from '../interfaces';
import {
  STORY_CARD_CACHE,
  STORY_CARD_CACHE_KEYS,
  STORY_CARD_TRACE_NAMES,
  VIEW_TRACKING,
} from '../constants';
import { StoryCardNotFoundException } from '../exceptions';

@Injectable()
export class StoryCardsAnalyticsService {
  private readonly logger = new Logger(StoryCardsAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly opikService: OpikService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metrics: StoryCardsMetrics,
  ) {}

  // ==========================================
  // SHARE TRACKING
  // ==========================================

  /**
   * Track a share event
   */
  async trackShare(
    userId: string,
    cardId: string,
    input: TrackShareInput,
  ): Promise<ShareEventData> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.TRACK_SHARE,
      input: { userId, cardId, platform: input.platform },
      metadata: { operation: 'trackShare' },
      tags: ['story_cards', 'share', input.platform],
    });

    try {
      // Verify card ownership
      const card = await this.prisma.storyCard.findFirst({
        where: { id: cardId, userId },
        select: { id: true, referralCode: true },
      });

      if (!card) {
        throw new StoryCardNotFoundException(cardId);
      }

      // Create share event
      const event = await this.prisma.shareEvent.create({
        data: {
          cardId,
          platform: input.platform,
          referralCode: card.referralCode,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });

      // Increment metrics
      this.metrics.incShares({ platform: input.platform });

      this.logger.log(`[trackShare] Recorded share event ${event.id} for card ${cardId}`);

      // Emit SHARED event
      const sharedEvent: StoryCardSharedEvent = {
        cardId,
        userId,
        platform: input.platform,
        referralCode: card.referralCode,
      };
      this.eventEmitter.emit(STORY_CARD_EVENTS.SHARED, sharedEvent);

      const response: ShareEventData = {
        id: event.id,
        cardId: event.cardId,
        platform: event.platform,
        sharedAt: event.sharedAt,
        referralCode: card.referralCode,
      };

      this.opikService.endTrace(trace, {
        success: true,
        result: { eventId: event.id, platform: input.platform },
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Link a signup to a share referral code
   */
  async linkSignupToShare(signupUserId: string, referralCode: string): Promise<void> {
    try {
      // Find the most recent share event with this referral code
      const shareEvent = await this.prisma.shareEvent.findFirst({
        where: { referralCode },
        orderBy: { sharedAt: 'desc' },
      });

      if (shareEvent) {
        await this.prisma.shareEvent.update({
          where: { id: shareEvent.id },
          data: { signupUserId },
        });

        this.logger.log(
          `[linkSignupToShare] Linked signup ${signupUserId} to referral ${referralCode}`,
        );
      }
    } catch (error) {
      this.logger.warn(`[linkSignupToShare] Failed to link signup: ${error}`);
      // Don't throw - this is not critical
    }
  }

  // ==========================================
  // VIEW TRACKING
  // ==========================================

  /**
   * Check if a view should be counted based on IP tracking
   *
   * Uses Redis to track IP+cardId combinations to prevent view count inflation.
   * Same IP viewing the same card within VIEW_TRACKING.IP_TTL_SEC will not
   * increment the view count.
   *
   * Graceful degradation:
   * - If no IP is provided, the view is counted
   * - If Redis fails, the view is counted (availability over accuracy)
   *
   * @param cardId - The card being viewed
   * @param ipAddress - The viewer's IP address
   * @returns true if the view should be counted, false otherwise
   */
  async shouldCountView(cardId: string, ipAddress?: string): Promise<boolean> {
    // Count if no IP provided (graceful degradation)
    if (!ipAddress) {
      return true;
    }

    const key = `${VIEW_TRACKING.IP_KEY_PREFIX}${cardId}:${ipAddress}`;

    try {
      const exists = await this.redisService.get(key);
      if (exists) {
        this.logger.debug(`[shouldCountView] Duplicate view blocked: ${cardId} from ${ipAddress}`);
        return false;
      }

      // Mark as viewed with TTL
      await this.redisService.set(key, { viewedAt: Date.now() }, VIEW_TRACKING.IP_TTL_SEC);
      return true;
    } catch (error) {
      // Count on Redis failure (graceful degradation - availability over accuracy)
      this.logger.warn(`[shouldCountView] Redis error, counting view: ${error}`);
      return true;
    }
  }

  /**
   * Increment view count for a card (non-blocking)
   *
   * Includes abuse detection to prevent view count inflation.
   * Same IP viewing the same card within VIEW_TRACKING.IP_TTL_SEC (1 hour)
   * will not increment the view count.
   *
   * Emits VIEW_MILESTONE event when significant thresholds are crossed.
   *
   * @param cardId - The card being viewed
   * @param ipAddress - Optional IP address for abuse detection
   */
  incrementViewCount(cardId: string, ipAddress?: string): void {
    this.shouldCountView(cardId, ipAddress).then((shouldCount) => {
      if (!shouldCount) {
        return;
      }

      // Increment metrics
      this.metrics.incViews();

      this.prisma.storyCard
        .update({
          where: { id: cardId },
          data: { viewCount: { increment: 1 } },
          select: { viewCount: true, userId: true },
        })
        .then((updatedCard) => {
          // Check if a milestone was crossed
          const viewCount = updatedCard.viewCount;
          for (const milestone of VIEW_MILESTONES) {
            // Emit event if we just crossed this milestone (viewCount equals milestone)
            if (viewCount === milestone) {
              const milestoneEvent: StoryCardViewMilestoneEvent = {
                cardId,
                userId: updatedCard.userId,
                milestone,
                viewCount,
              };
              this.eventEmitter.emit(STORY_CARD_EVENTS.VIEW_MILESTONE, milestoneEvent);
              this.logger.log(
                `[incrementViewCount] Card ${cardId} reached ${milestone} views milestone`,
              );
              break; // Only one milestone can be crossed at a time
            }
          }
        })
        .catch((err) => this.logger.warn(`View count increment failed: ${err}`));
    });
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  /**
   * Get viral metrics for a user
   */
  async getViralMetrics(userId: string): Promise<ViralMetrics> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.GET_METRICS,
      input: { userId },
      metadata: { operation: 'getViralMetrics' },
      tags: ['story_cards', 'analytics'],
    });

    try {
      // Try cache first
      const cacheKey = STORY_CARD_CACHE_KEYS.VIRAL_METRICS(userId);
      try {
        const cached = await this.redisService.get<ViralMetrics>(cacheKey);
        if (cached) {
          this.opikService.endTrace(trace, { success: true, result: { cached: true } });
          return cached;
        }
      } catch {
        // Continue without cache
      }

      // Aggregate metrics from database
      const [
        totalCards,
        cardsByTypeResult,
        totalViews,
        shareEventsWithCard,
        signups,
      ] = await Promise.all([
        this.prisma.storyCard.count({ where: { userId } }),
        this.prisma.storyCard.groupBy({
          by: ['type'],
          where: { userId },
          _count: { id: true },
        }),
        this.prisma.storyCard.aggregate({
          where: { userId },
          _sum: { viewCount: true },
        }),
        // Fetch share events with card type for accurate sharesByType calculation
        this.prisma.shareEvent.findMany({
          where: { card: { userId } },
          select: {
            platform: true,
            signupUserId: true,
            card: { select: { type: true } },
          },
        }),
        this.prisma.shareEvent.count({
          where: {
            card: { userId },
            signupUserId: { not: null },
          },
        }),
      ]);

      // Calculate shares by platform
      const sharesByPlatform: Record<SharePlatform, number> = {
        TWITTER: 0,
        LINKEDIN: 0,
        WHATSAPP: 0,
        INSTAGRAM: 0,
      };

      for (const event of shareEventsWithCard) {
        sharesByPlatform[event.platform]++;
      }

      const totalShares = shareEventsWithCard.length;

      // Calculate cardsByType (count of cards per type)
      const cardsByType: Record<StoryCardType, number> = {
        FUTURE_SELF: 0,
        COMMITMENT: 0,
        MILESTONE: 0,
        RECOVERY: 0,
      };

      for (const item of cardsByTypeResult) {
        cardsByType[item.type] = item._count.id;
      }

      // Calculate sharesByType (actual shares per card type - FIX for Task #20)
      const sharesByType: Record<StoryCardType, number> = {
        FUTURE_SELF: 0,
        COMMITMENT: 0,
        MILESTONE: 0,
        RECOVERY: 0,
      };

      for (const event of shareEventsWithCard) {
        sharesByType[event.card.type]++;
      }

      // Find top performing type based on actual shares
      let topPerformingType: StoryCardType | null = null;
      let maxShares = 0;
      for (const [type, count] of Object.entries(sharesByType)) {
        if (count > maxShares) {
          maxShares = count;
          topPerformingType = type as StoryCardType;
        }
      }

      const views = totalViews._sum.viewCount || 0;

      const metrics: ViralMetrics = {
        totalCards,
        totalShares,
        sharesByPlatform,
        totalViews: views,
        signupsFromShares: signups,
        viralCoefficient: totalShares > 0 ? signups / totalShares : 0,
        topPerformingType,
        sharesByType,
        cardsByType,
        averageViewsPerCard: totalCards > 0 ? Math.round(views / totalCards) : 0,
        conversionRate: views > 0 ? totalShares / views : 0,
      };

      // Cache metrics
      this.redisService
        .set(cacheKey, metrics, STORY_CARD_CACHE.METRICS_TTL_SEC)
        .catch((err) => this.logger.warn(`Metrics cache write failed: ${err}`));

      this.opikService.endTrace(trace, { success: true, result: { cached: false } });
      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get gradient performance data for A/B testing analytics
   *
   * Analyzes which gradients perform best based on view counts.
   * Useful for optimizing card visual appeal.
   *
   * @param type - The story card type to analyze
   * @returns Array of gradient performance metrics sorted by average views
   */
  async getGradientPerformance(type: StoryCardType): Promise<GradientPerformance[]> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.GET_METRICS,
      input: { type },
      metadata: { operation: 'getGradientPerformance' },
      tags: ['story_cards', 'analytics', 'gradient_ab_test'],
    });

    try {
      const results = await this.prisma.storyCard.groupBy({
        by: ['gradientIndex'],
        where: {
          type,
          gradientIndex: { not: null },
        },
        _count: { id: true },
        _sum: { viewCount: true },
      });

      const performance: GradientPerformance[] = results.map((r) => ({
        gradientIndex: r.gradientIndex!,
        cardCount: r._count.id,
        totalViews: r._sum.viewCount || 0,
        avgViews:
          r._count.id > 0 ? (r._sum.viewCount || 0) / r._count.id : 0,
      }));

      // Sort by average views descending for easy identification of top performers
      performance.sort((a, b) => b.avgViews - a.avgViews);

      this.opikService.endTrace(trace, {
        success: true,
        result: { type, gradientCount: performance.length },
      });

      return performance;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }
}
