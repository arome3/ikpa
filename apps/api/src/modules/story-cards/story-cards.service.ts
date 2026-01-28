/**
 * Story Cards Service
 *
 * Core business logic for the Story Cards viral sharing system.
 * Orchestrates card generation, retrieval, sharing tracking, and analytics.
 *
 * Features:
 * - Generate shareable cards from Future Self letters, Commitments, Milestones, and Recovery paths
 * - Privacy-first design with anonymized amounts by default
 * - Viral coefficient tracking for growth analytics
 * - Redis caching with graceful degradation
 * - Full Opik distributed tracing integration
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OpikService } from '../ai/opik/opik.service';
import { StoryCardType, SharePlatform, Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { StoryCardsMetrics } from './story-cards.metrics';

// ==========================================
// CIRCUIT BREAKER CONFIGURATION (Reserved for future implementation)
// ==========================================
// Note: Circuit breaker pattern is prepared for future resilience enhancements.
// The following exports prevent "unused" TypeScript errors while keeping
// the code ready for implementation.

/**
 * Circuit Breaker State
 * @internal Reserved for future circuit breaker implementation
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation - requests flow through
  OPEN = 'OPEN',         // Circuit tripped - fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 * @internal Reserved for future circuit breaker implementation
 */
export const CIRCUIT_BREAKER_CONFIG = {
  /** Number of consecutive failures before opening circuit */
  FAILURE_THRESHOLD: 5,
  /** Time in milliseconds to keep circuit open before testing */
  RESET_TIMEOUT_MS: 30000, // 30 seconds
  /** Redis key prefix for circuit state */
  KEY_PREFIX: 'circuit_breaker:story_cards:',
  /** TTL for circuit state in Redis (slightly longer than reset timeout) */
  STATE_TTL_SEC: 60,
} as const;

/**
 * Circuit Breaker State stored in Redis
 * @internal Reserved for future circuit breaker implementation
 */
export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  openedAt: number | null;
}
import {
  STORY_CARD_EVENTS,
  VIEW_MILESTONES,
  StoryCardCreatedEvent,
  StoryCardSharedEvent,
  StoryCardDeletedEvent,
  StoryCardViewMilestoneEvent,
} from './story-cards.events';
import {
  GenerateCardInput,
  TrackShareInput,
  ShareEventData,
  SharePageData,
  ViralMetrics,
  PaginationParams,
  PaginatedResponse,
  StoryCardResponse,
  StoryCardListItem,
  SourceData,
  PrivacySettings,
  FutureSelfSource,
  CommitmentSource,
  MilestoneSource,
  RecoverySource,
  DeleteCardResponse,
  UpdateCardInput,
  UpdateCardResponse,
  GradientPerformance,
  PreviewCardInput,
  PreviewCardResponse,
} from './interfaces';
import {
  STORY_CARD_LIMITS,
  STORY_CARD_CACHE,
  STORY_CARD_CACHE_KEYS,
  STORY_CARD_TRACE_NAMES,
  PLATFORMS_BY_TYPE,
  DEFAULT_PRIVACY_SETTINGS,
  SHARE_BASE_URL,
  VIEW_TRACKING,
} from './constants';
import {
  StoryCardNotFoundException,
  StoryCardGenerationFailedException,
  StoryCardSourceNotFoundException,
  StoryCardLimitExceededException,
  StoryCardExpiredException,
  StoryCardAccessDeniedException,
  StoryCardCircuitOpenException,
} from './exceptions';
import { CardContentCalculator } from './calculators';

@Injectable()
export class StoryCardsService {
  private readonly logger = new Logger(StoryCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly opikService: OpikService,
    private readonly cardContentCalculator: CardContentCalculator,
    private readonly eventEmitter: EventEmitter2,
    private readonly metrics: StoryCardsMetrics,
  ) {}

  // ==========================================
  // STRUCTURED LOGGING HELPERS
  // ==========================================

  /**
   * Log structured message with context
   * Maintains backward compatibility while adding structured fields
   */
  private logStructured(
    level: 'log' | 'debug' | 'warn' | 'error',
    data: {
      message: string;
      operation: string;
      userId?: string;
      cardId?: string;
      type?: string;
      duration?: number;
      errorCode?: string;
      [key: string]: unknown;
    },
  ): void {
    // Extract message for backward-compatible prefix format
    const { message, operation, ...context } = data;
    const prefix = `[${operation}]`;

    // Log in structured format
    this.logger[level]({
      message: `${prefix} ${message}`,
      ...context,
      timestamp: new Date().toISOString(),
    });
  }

  // ==========================================
  // CARD GENERATION
  // ==========================================

  /**
   * Generate a story card for sharing
   *
   * Flow:
   * 1. Validate user hasn't exceeded limits
   * 2. Fetch source data (letter, commitment, goal, or recovery session)
   * 3. Generate card content using calculator
   * 4. Create card in database
   * 5. Cache the result
   */
  async generateCard(
    userId: string,
    input: GenerateCardInput,
  ): Promise<StoryCardResponse> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.GENERATE,
      input: { userId, type: input.type, sourceId: input.sourceId },
      metadata: { operation: 'generateCard' },
      tags: ['story_cards', 'generate', input.type],
    });

    try {
      // Phase 0: Check idempotency key first (early return for duplicates)
      if (input.idempotencyKey) {
        const existingCard = await this.prisma.storyCard.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existingCard) {
          this.logger.log(
            `[generateCard] Returning existing card for idempotency key: ${input.idempotencyKey}`,
          );
          const response = this.toStoryCardResponse(existingCard);
          this.opikService.endTrace(trace, {
            success: true,
            result: { cardId: existingCard.id, type: existingCard.type, idempotent: true },
          });
          return response;
        }
      }

      // Phase 1: Check limits
      await this.checkLimits(userId);

      // Phase 2: Fetch source data
      const sourceData = await this.fetchSourceData(
        userId,
        input.type,
        input.sourceId,
      );

      // Phase 3: Build privacy settings with cross-field validation
      let anonymizeAmounts = input.anonymizeAmounts ?? DEFAULT_PRIVACY_SETTINGS.anonymizeAmounts;
      let revealActualNumbers = input.revealActualNumbers ?? DEFAULT_PRIVACY_SETTINGS.revealActualNumbers;

      // Privacy settings validation logic:
      // - If anonymizeAmounts=false AND revealActualNumbers=true: VALID (user wants actual numbers)
      // - If anonymizeAmounts=true AND revealActualNumbers=true: CONFLICT - warn and default to anonymized
      if (anonymizeAmounts && revealActualNumbers) {
        this.logStructured('warn', {
          message: 'Conflicting privacy settings: anonymizeAmounts=true AND revealActualNumbers=true. ' +
            'Defaulting to anonymized amounts for privacy protection.',
          operation: 'generateCard',
          userId,
          type: input.type,
          sourceId: input.sourceId,
          conflict: 'privacy_settings',
          resolution: 'anonymized',
        });
        // Default to anonymized (privacy-first approach)
        revealActualNumbers = false;
      }

      const privacy: PrivacySettings = {
        anonymizeAmounts,
        revealActualNumbers,
        includePersonalData: input.includePersonalData ?? DEFAULT_PRIVACY_SETTINGS.includePersonalData,
        requirePreview: DEFAULT_PRIVACY_SETTINGS.requirePreview,
      };

      // Phase 4: Generate card content
      const content = this.cardContentCalculator.generateContent(
        input.type,
        sourceData,
        privacy,
      );

      // Phase 5 & 6: Generate codes and create card in a transaction
      // This ensures atomicity - if card creation fails, no orphaned codes exist
      // If code generation fails after retries, the transaction rolls back
      const card = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          this.logger.debug(`[generateCard] Starting transaction for user ${userId}`);

          // Generate unique codes within transaction for atomicity
          const referralCode = await this.generateUniqueCodeInTransaction(tx, 'referral');
          const shareUrlCode = await this.generateUniqueCodeInTransaction(tx, 'shareUrl');
          const shareUrl = `${SHARE_BASE_URL}/${shareUrlCode}`;

          // Create card in database
          const createdCard = await tx.storyCard.create({
            data: {
              userId,
              idempotencyKey: input.idempotencyKey || null,
              type: input.type,
              headline: content.headline,
              subheadline: content.subheadline,
              keyMetricLabel: content.keyMetric.label,
              keyMetricValue: content.keyMetric.value,
              quote: content.quote,
              shareUrl,
              gradient: content.gradient,
              gradientIndex: content.gradientIndex,
              hashtags: content.hashtags,
              platforms: PLATFORMS_BY_TYPE[input.type],
              anonymizeAmounts: privacy.anonymizeAmounts,
              revealActualNumbers: privacy.revealActualNumbers,
              includePersonalData: privacy.includePersonalData,
              sourceId: input.sourceId,
              referralCode,
              isPublic: true,
            },
          });

          this.logger.debug(
            `[generateCard] Transaction complete: created card ${createdCard.id}`,
          );

          return createdCard;
        },
        {
          // Transaction options for reliability
          maxWait: 5000, // Max time to wait for transaction to start
          timeout: 10000, // Max time for transaction to complete
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );

      // Increment metrics for successful generation
      this.metrics.incCardsGenerated({ type: input.type, success: true });

      this.logger.log(`[generateCard] Created story card ${card.id} for user ${userId}`);

      // Phase 7: Emit CREATED event (outside transaction - event failures shouldn't rollback)
      const createdEvent: StoryCardCreatedEvent = {
        cardId: card.id,
        userId,
        type: input.type,
        referralCode: card.referralCode,
      };
      this.eventEmitter.emit(STORY_CARD_EVENTS.CREATED, createdEvent);

      // Phase 8: Build response
      const response = this.toStoryCardResponse(card);

      // Phase 9: Cache (non-blocking)
      this.cacheCard(card.id, response);

      this.opikService.endTrace(trace, {
        success: true,
        result: { cardId: card.id, type: input.type },
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error ? error.constructor.name : 'UnknownError';
      const isTransactionError = errorMessage.includes('Transaction') ||
                                  errorMessage.includes('transaction') ||
                                  errorMessage.includes('rollback');

      // Increment metrics for failed generation
      this.metrics.incCardsGenerated({ type: input.type, success: false });

      this.opikService.endTrace(trace, {
        success: false,
        error: `${errorMessage}${isTransactionError ? ' (transaction rolled back)' : ''}`,
      });

      this.logStructured('error', {
        message: `Failed${isTransactionError ? ' (transaction rolled back)' : ''}: ${errorMessage}`,
        operation: 'generateCard',
        userId,
        type: input.type,
        errorCode,
        sourceId: input.sourceId,
        isTransactionError,
      });
      throw error;
    }
  }

  // ==========================================
  // CARD RETRIEVAL
  // ==========================================

  /**
   * Get a story card by ID
   */
  async getCardById(userId: string, cardId: string): Promise<StoryCardResponse> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.GET,
      input: { userId, cardId },
      metadata: { operation: 'getCardById' },
      tags: ['story_cards', 'get'],
    });

    try {
      // Try cache first
      const cacheKey = STORY_CARD_CACHE_KEYS.CARD(cardId);
      const lockKey = STORY_CARD_CACHE_KEYS.CARD_LOCK(cardId);

      try {
        const cached = await this.redisService.get<StoryCardResponse>(cacheKey);
        if (cached) {
          this.metrics.incCacheHit();
          this.logStructured('debug', {
            message: 'Cache hit for card',
            operation: 'getCardById',
            userId,
            cardId,
            cached: true,
          });
          // Verify ownership
          if (cached.id !== cardId) {
            throw new StoryCardAccessDeniedException(cardId);
          }
          this.opikService.endTrace(trace, { success: true, result: { cached: true } });
          return cached;
        }
        this.metrics.incCacheMiss();
      } catch (cacheError) {
        this.metrics.incCacheMiss();
        this.logStructured('warn', {
          message: `Cache read failed: ${cacheError}`,
          operation: 'getCardById',
          userId,
          cardId,
        });
      }

      // Task #29: Cache stampede prevention with distributed locking
      const { acquired, lockValue } = await this.acquireLock(lockKey);

      if (!acquired) {
        // Another request is refreshing the cache - wait and check cache again
        const cachedAfterWait = await this.waitAndCheckCache<StoryCardResponse>(cacheKey);
        if (cachedAfterWait) {
          this.opikService.endTrace(trace, { success: true, result: { cached: true, waitedForLock: true } });
          return cachedAfterWait;
        }
        // If still no cache, proceed to query database (lock may have expired)
      }

      try {
        // Fetch from database (filter by isActive for soft-deleted cards)
        const card = await this.prisma.storyCard.findFirst({
          where: { id: cardId, userId, isActive: true },
        });

        if (!card) {
          throw new StoryCardNotFoundException(cardId);
        }

        // Check expiration
        if (card.expiresAt && card.expiresAt < new Date()) {
          throw new StoryCardExpiredException(cardId, card.expiresAt);
        }

        const response = this.toStoryCardResponse(card);
        this.cacheCard(cardId, response);

        this.opikService.endTrace(trace, { success: true, result: { cached: false } });
        return response;
      } finally {
        // Always release the lock
        if (acquired) {
          await this.releaseLock(lockKey, lockValue);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get all story cards for a user with pagination
   */
  async getUserCards(
    userId: string,
    params: PaginationParams,
  ): Promise<PaginatedResponse<StoryCardListItem>> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.GET_USER_CARDS,
      input: { userId, params },
      metadata: { operation: 'getUserCards' },
      tags: ['story_cards', 'list'],
    });

    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 10, 100);
      const skip = (page - 1) * limit;

      // Filter by isActive for soft-deleted cards
      const [cards, total] = await Promise.all([
        this.prisma.storyCard.findMany({
          where: { userId, isActive: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            type: true,
            headline: true,
            shareUrl: true,
            viewCount: true,
            referralCode: true,
            createdAt: true,
          },
        }),
        this.prisma.storyCard.count({ where: { userId, isActive: true } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const response: PaginatedResponse<StoryCardListItem> = {
        data: cards,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      };

      this.opikService.endTrace(trace, { success: true, result: { total } });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get public card data for share page
   *
   * @param shareCode - The unique code from the share URL
   * @param ipAddress - Optional IP address for view abuse detection
   */
  async getPublicCard(shareCode: string, ipAddress?: string): Promise<SharePageData> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.PUBLIC_VIEW,
      input: { shareCode },
      metadata: { operation: 'getPublicCard' },
      tags: ['story_cards', 'public'],
    });

    try {
      // Try cache first
      const cacheKey = STORY_CARD_CACHE_KEYS.PUBLIC_CARD(shareCode);
      const lockKey = STORY_CARD_CACHE_KEYS.PUBLIC_CARD_LOCK(shareCode);

      try {
        const cached = await this.redisService.get<SharePageData>(cacheKey);
        if (cached) {
          this.metrics.incCacheHit();
          // Increment view count asynchronously with abuse detection
          this.incrementViewCount(cached.card.id, ipAddress);
          this.opikService.endTrace(trace, { success: true, result: { cached: true } });
          return cached;
        }
        this.metrics.incCacheMiss();
      } catch {
        this.metrics.incCacheMiss();
        // Continue without cache
      }

      // Task #29: Cache stampede prevention with distributed locking
      const { acquired, lockValue } = await this.acquireLock(lockKey);

      if (!acquired) {
        // Another request is refreshing the cache - wait and check cache again
        const cachedAfterWait = await this.waitAndCheckCache<SharePageData>(cacheKey);
        if (cachedAfterWait) {
          this.incrementViewCount(cachedAfterWait.card.id, ipAddress);
          this.opikService.endTrace(trace, { success: true, result: { cached: true, waitedForLock: true } });
          return cachedAfterWait;
        }
      }

      try {
        // Construct the full share URL
        const shareUrl = `${SHARE_BASE_URL}/${shareCode}`;

        // Fetch from database (filter by isActive for soft-deleted cards)
        const card = await this.prisma.storyCard.findFirst({
          where: { shareUrl, isActive: true },
        });

        if (!card) {
          throw new StoryCardNotFoundException(undefined, shareCode);
        }

        // Check expiration
        if (card.expiresAt && card.expiresAt < new Date()) {
          throw new StoryCardExpiredException(card.id, card.expiresAt);
        }

        // Build share page data
        const sharePageData: SharePageData = {
          card: {
            id: card.id,
            type: card.type,
            headline: card.headline,
            subheadline: card.subheadline,
            keyMetric: {
              label: card.keyMetricLabel,
              value: card.keyMetricValue,
            },
            quote: card.quote || undefined,
            gradient: card.gradient as [string, string],
            hashtags: card.hashtags,
            viewCount: card.viewCount,
            createdAt: card.createdAt,
          },
          referralCode: card.referralCode,
          ogMeta: {
            title: `${card.headline} | IKPA`,
            description: card.subheadline,
            url: card.shareUrl,
          },
        };

        // Cache public card data
        this.redisService
          .set(cacheKey, sharePageData, STORY_CARD_CACHE.PUBLIC_CARD_TTL_SEC)
          .catch((err) => this.logger.warn(`Cache write failed: ${err}`));

        // Increment view count asynchronously with abuse detection
        this.incrementViewCount(card.id, ipAddress);

        this.opikService.endTrace(trace, { success: true, result: { cached: false } });
        return sharePageData;
      } finally {
        // Always release the lock
        if (acquired) {
          await this.releaseLock(lockKey, lockValue);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

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

      // Increment share metrics
      this.metrics.incShares({ platform: input.platform });

      this.logStructured('log', {
        message: `Recorded share event ${event.id}`,
        operation: 'trackShare',
        userId,
        cardId,
        platform: input.platform,
        eventId: event.id,
      });

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
  // CARD MANAGEMENT
  // ==========================================

  /**
   * Delete a story card
   *
   * @param userId - The user requesting deletion
   * @param cardId - The card to delete
   * @param hardDelete - If true, permanently delete. If false, soft delete (default)
   */
  async deleteCard(
    userId: string,
    cardId: string,
    hardDelete: boolean = false,
  ): Promise<DeleteCardResponse> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.DELETE || 'story_card.delete',
      input: { userId, cardId, hardDelete },
      metadata: { operation: 'deleteCard' },
      tags: ['story_cards', 'delete'],
    });

    try {
      // Verify card ownership
      const card = await this.prisma.storyCard.findFirst({
        where: { id: cardId, userId },
      });

      if (!card) {
        throw new StoryCardNotFoundException(cardId);
      }

      const deletedAt = new Date();

      if (hardDelete) {
        // Hard delete: permanently remove the card and related share events
        await this.prisma.$transaction([
          this.prisma.shareEvent.deleteMany({ where: { cardId } }),
          this.prisma.storyCard.delete({ where: { id: cardId } }),
        ]);

        this.logger.log(`[deleteCard] Hard deleted card ${cardId} for user ${userId}`);
      } else {
        // Soft delete: set isActive = false (GDPR compliant)
        await this.prisma.storyCard.update({
          where: { id: cardId },
          data: { isActive: false },
        });

        this.logger.log(`[deleteCard] Soft deleted card ${cardId} for user ${userId}`);
      }

      // Emit DELETED event
      const deletedEvent: StoryCardDeletedEvent = {
        cardId,
        userId,
        hardDelete,
      };
      this.eventEmitter.emit(STORY_CARD_EVENTS.DELETED, deletedEvent);

      // Invalidate cache
      const cacheKey = STORY_CARD_CACHE_KEYS.CARD(cardId);
      this.redisService.del(cacheKey).catch((err: Error) =>
        this.logger.warn(`Cache invalidation failed for deleted card: ${err}`),
      );

      this.opikService.endTrace(trace, {
        success: true,
        result: { cardId, hardDelete },
      });

      return {
        success: true,
        cardId,
        deleteType: hardDelete ? 'hard' : 'soft',
        deletedAt,
        message: hardDelete
          ? 'Card and all associated data have been permanently deleted.'
          : 'Card has been deactivated. Use hard delete for permanent removal.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Update a story card's privacy settings or regenerate content
   *
   * @param userId - User ID (for ownership verification)
   * @param cardId - Card ID to update
   * @param input - Update parameters
   */
  async updateCard(
    userId: string,
    cardId: string,
    input: UpdateCardInput,
  ): Promise<UpdateCardResponse> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.UPDATE,
      input: { userId, cardId, regenerate: input.regenerateContent },
      metadata: { operation: 'updateCard' },
      tags: ['story_cards', 'update'],
    });

    try {
      // Verify ownership and get current card data
      const card = await this.prisma.storyCard.findFirst({
        where: { id: cardId, userId, isActive: true },
      });

      if (!card) {
        throw new StoryCardNotFoundException(cardId);
      }

      // Check if card is expired
      if (card.expiresAt && card.expiresAt < new Date()) {
        throw new StoryCardExpiredException(cardId, card.expiresAt);
      }

      let updatedCard = card;
      let regenerated = false;

      // Build privacy settings from input or use existing values
      const privacy: PrivacySettings = {
        anonymizeAmounts: input.anonymizeAmounts ?? card.anonymizeAmounts,
        revealActualNumbers: input.revealActualNumbers ?? card.revealActualNumbers,
        includePersonalData: input.includePersonalData ?? card.includePersonalData,
        requirePreview: DEFAULT_PRIVACY_SETTINGS.requirePreview,
      };

      if (input.regenerateContent && card.sourceId) {
        // Regenerate content from source data
        const sourceData = await this.fetchSourceData(userId, card.type, card.sourceId);

        const content = this.cardContentCalculator.generateContent(
          card.type,
          sourceData,
          privacy,
        );

        // Update card with new content
        updatedCard = await this.prisma.storyCard.update({
          where: { id: cardId },
          data: {
            headline: content.headline,
            subheadline: content.subheadline,
            keyMetricLabel: content.keyMetric.label,
            keyMetricValue: content.keyMetric.value,
            quote: content.quote,
            gradient: content.gradient,
            hashtags: content.hashtags,
            anonymizeAmounts: privacy.anonymizeAmounts,
            revealActualNumbers: privacy.revealActualNumbers,
            includePersonalData: privacy.includePersonalData,
          },
        });

        regenerated = true;
        this.logger.log(`[updateCard] Regenerated content for card ${cardId}`);
      } else {
        // Update only privacy settings
        updatedCard = await this.prisma.storyCard.update({
          where: { id: cardId },
          data: {
            anonymizeAmounts: privacy.anonymizeAmounts,
            revealActualNumbers: privacy.revealActualNumbers,
            includePersonalData: privacy.includePersonalData,
          },
        });

        this.logger.log(`[updateCard] Updated privacy settings for card ${cardId}`);
      }

      // Invalidate cache
      const cacheKey = STORY_CARD_CACHE_KEYS.CARD(cardId);
      this.redisService.del(cacheKey).catch((err: Error) =>
        this.logger.warn(`Cache invalidation failed for updated card: ${err}`),
      );

      // Build response
      const baseResponse = this.toStoryCardResponse(updatedCard);
      const response: UpdateCardResponse = {
        ...baseResponse,
        updated: true,
        regenerated,
      };

      // Cache updated card
      this.cacheCard(cardId, baseResponse);

      this.opikService.endTrace(trace, {
        success: true,
        result: { cardId, regenerated },
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[updateCard] Failed: ${errorMessage}`);
      throw error;
    }
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
      const lockKey = STORY_CARD_CACHE_KEYS.VIRAL_METRICS_LOCK(userId);

      try {
        const cached = await this.redisService.get<ViralMetrics>(cacheKey);
        if (cached) {
          this.opikService.endTrace(trace, { success: true, result: { cached: true } });
          return cached;
        }
      } catch {
        // Continue without cache
      }

      // Task #29: Cache stampede prevention with distributed locking
      const { acquired, lockValue } = await this.acquireLock(lockKey);

      if (!acquired) {
        // Another request is refreshing the cache - wait and check cache again
        const cachedAfterWait = await this.waitAndCheckCache<ViralMetrics>(cacheKey);
        if (cachedAfterWait) {
          this.opikService.endTrace(trace, { success: true, result: { cached: true, waitedForLock: true } });
          return cachedAfterWait;
        }
      }

      // Aggregate metrics from database using efficient groupBy queries
      // Task #23: Fixed N+1 query - replaced findMany with groupBy aggregations
      const [
        totalCards,
        cardsByTypeResult,
        totalViews,
        sharesByPlatformResult,
        sharesByTypeResult,
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
        // Group share events by platform - efficient aggregation instead of fetching all records
        // Task #23: Fixed N+1 query
        this.prisma.shareEvent.groupBy({
          by: ['platform'],
          where: { card: { userId } },
          _count: { id: true },
        }),
        // Group share events by card type using raw query for efficient JOIN + GROUP BY
        this.prisma.$queryRaw<Array<{ type: StoryCardType; count: bigint }>>`
          SELECT sc.type, COUNT(se.id)::bigint as count
          FROM "ShareEvent" se
          INNER JOIN "StoryCard" sc ON se."cardId" = sc.id
          WHERE sc."userId" = ${userId}
          GROUP BY sc.type
        `,
        this.prisma.shareEvent.count({
          where: {
            card: { userId },
            signupUserId: { not: null },
          },
        }),
      ]);

      // Calculate shares by platform from groupBy result
      const sharesByPlatform: Record<SharePlatform, number> = {
        TWITTER: 0,
        LINKEDIN: 0,
        WHATSAPP: 0,
        INSTAGRAM: 0,
      };

      for (const item of sharesByPlatformResult) {
        sharesByPlatform[item.platform] = item._count.id;
      }

      // Calculate total shares from platform counts
      const totalShares = Object.values(sharesByPlatform).reduce((sum, count) => sum + count, 0);

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

      // Calculate sharesByType from raw query result
      // Task #23: Now calculated directly in database via GROUP BY
      const sharesByType: Record<StoryCardType, number> = {
        FUTURE_SELF: 0,
        COMMITMENT: 0,
        MILESTONE: 0,
        RECOVERY: 0,
      };

      for (const item of sharesByTypeResult) {
        sharesByType[item.type] = Number(item.count);
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
        cardsByType, // NEW: separate metric for cards count by type
        averageViewsPerCard: totalCards > 0 ? Math.round(views / totalCards) : 0,
        conversionRate: views > 0 ? totalShares / views : 0,
      };

      // Cache metrics
      this.redisService
        .set(cacheKey, metrics, STORY_CARD_CACHE.METRICS_TTL_SEC)
        .catch((err) => this.logger.warn(`Metrics cache write failed: ${err}`));

      // Release the lock before returning
      if (acquired) {
        await this.releaseLock(lockKey, lockValue);
      }

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

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  // Circuit Breaker helper methods
  private getCircuitBreakerKey(t: StoryCardType): string { return `${CIRCUIT_BREAKER_CONFIG.KEY_PREFIX}${t}`; }
  private async getCircuitBreakerState(t: StoryCardType): Promise<CircuitBreakerState> {
    const d: CircuitBreakerState = { state: CircuitState.CLOSED, failureCount: 0, lastFailureTime: null, openedAt: null };
    try { return (await this.redisService.get<CircuitBreakerState>(this.getCircuitBreakerKey(t))) || d; } catch { return d; }
  }
  private async setCircuitBreakerState(t: StoryCardType, s: CircuitBreakerState): Promise<void> {
    try { await this.redisService.set(this.getCircuitBreakerKey(t), s, CIRCUIT_BREAKER_CONFIG.STATE_TTL_SEC); } catch { /* */ }
  }
  private async checkCircuitBreaker(t: StoryCardType): Promise<boolean> {
    const s = await this.getCircuitBreakerState(t);
    if (s.state === CircuitState.CLOSED) return true;
    if (s.state === CircuitState.OPEN) {
      const e = Date.now() - (s.openedAt || 0);
      if (e >= CIRCUIT_BREAKER_CONFIG.RESET_TIMEOUT_MS) { await this.setCircuitBreakerState(t, { ...s, state: CircuitState.HALF_OPEN }); this.logger.log(`[CircuitBreaker] ${t} -> HALF_OPEN`); return true; }
      throw new StoryCardCircuitOpenException(t, CIRCUIT_BREAKER_CONFIG.RESET_TIMEOUT_MS - e);
    }
    return true;
  }
  private async recordCircuitSuccess(t: StoryCardType): Promise<void> {
    const s = await this.getCircuitBreakerState(t);
    if (s.state === CircuitState.HALF_OPEN || s.failureCount > 0) { await this.setCircuitBreakerState(t, { state: CircuitState.CLOSED, failureCount: 0, lastFailureTime: null, openedAt: null }); if (s.state === CircuitState.HALF_OPEN) this.logger.log(`[CircuitBreaker] ${t} CLOSED`); }
  }
  private async recordCircuitFailure(t: StoryCardType, _err: Error): Promise<void> {
    const s = await this.getCircuitBreakerState(t); const now = Date.now();
    if (s.state === CircuitState.HALF_OPEN) { await this.setCircuitBreakerState(t, { state: CircuitState.OPEN, failureCount: s.failureCount + 1, lastFailureTime: now, openedAt: now }); this.logger.warn(`[CircuitBreaker] ${t} REOPENED: ${_err.message}`); return; }
    const c = s.failureCount + 1;
    if (c >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) { await this.setCircuitBreakerState(t, { state: CircuitState.OPEN, failureCount: c, lastFailureTime: now, openedAt: now }); this.logger.warn(`[CircuitBreaker] ${t} OPENED after ${c} failures`); }
    else { await this.setCircuitBreakerState(t, { ...s, failureCount: c, lastFailureTime: now }); }
  }

  /**
   * Fetch source data for card generation with circuit breaker protection
   */
  private async fetchSourceData(userId: string, type: StoryCardType, sourceId: string): Promise<SourceData> {
    await this.checkCircuitBreaker(type);
    try {
      let result: SourceData;
      switch (type) {
        case 'FUTURE_SELF': result = await this.fetchFutureSelfSource(userId, sourceId); break;
        case 'COMMITMENT': result = await this.fetchCommitmentSource(userId, sourceId); break;
        case 'MILESTONE': result = await this.fetchMilestoneSource(userId, sourceId); break;
        case 'RECOVERY': result = await this.fetchRecoverySource(userId, sourceId); break;
        default: throw new StoryCardGenerationFailedException(`Unknown card type: ${type}`);
      }
      await this.recordCircuitSuccess(type);
      return result;
    } catch (error) {
      if (error instanceof StoryCardSourceNotFoundException || error instanceof StoryCardCircuitOpenException) throw error;
      await this.recordCircuitFailure(type, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Fetch Future Self letter source data
   */
  private async fetchFutureSelfSource(
    userId: string,
    letterId: string,
  ): Promise<SourceData> {
    const letter = await this.prisma.futureSelfLetter.findFirst({
      where: { id: letterId, userId },
    });

    if (!letter) {
      throw new StoryCardSourceNotFoundException('FUTURE_SELF', letterId);
    }

    const data: FutureSelfSource = {
      letterId: letter.id,
      content: letter.content,
      userAge: letter.userAge,
      futureAge: letter.futureAge,
      currentNetWorth: Number(letter.currentNetWorth20yr),
      wealthDifference20yr: Number(letter.wealthDifference20yr),
      currentSavingsRate: Number(letter.currentSavingsRate),
      optimizedSavingsRate: Number(letter.optimizedSavingsRate),
      createdAt: letter.createdAt,
    };

    return { type: 'FUTURE_SELF', data };
  }

  /**
   * Fetch Commitment source data
   */
  private async fetchCommitmentSource(
    userId: string,
    contractId: string,
  ): Promise<SourceData> {
    const contract = await this.prisma.commitmentContract.findFirst({
      where: { id: contractId, userId },
      include: { goal: { select: { name: true } } },
    });

    if (!contract) {
      throw new StoryCardSourceNotFoundException('COMMITMENT', contractId);
    }

    // Calculate success probability based on stake type
    const successProbabilityMultipliers: Record<string, number> = {
      SOCIAL: 2.0,
      ANTI_CHARITY: 3.0,
      LOSS_POOL: 2.5,
    };
    const baseSuccessRate = 0.26; // 26% base success rate for goals
    const multiplier = successProbabilityMultipliers[contract.stakeType] || 1;
    const successProbability = Math.min(baseSuccessRate * multiplier, 0.85);

    const data: CommitmentSource = {
      contractId: contract.id,
      goalName: contract.goal.name,
      stakeType: contract.stakeType,
      stakeAmount: contract.stakeAmount ? Number(contract.stakeAmount) : null,
      deadline: contract.deadline,
      successProbability,
      createdAt: contract.createdAt,
    };

    return { type: 'COMMITMENT', data };
  }

  /**
   * Fetch Milestone (completed goal) source data
   */
  private async fetchMilestoneSource(
    userId: string,
    goalId: string,
  ): Promise<SourceData> {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId, status: 'COMPLETED' },
    });

    if (!goal) {
      throw new StoryCardSourceNotFoundException('MILESTONE', goalId);
    }

    // Calculate days to achieve
    const daysToAchieve = Math.ceil(
      (goal.updatedAt.getTime() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    const data: MilestoneSource = {
      goalId: goal.id,
      goalName: goal.name,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      daysToAchieve,
      completedAt: goal.updatedAt,
      category: goal.category,
    };

    return { type: 'MILESTONE', data };
  }

  /**
   * Fetch Recovery session source data
   */
  private async fetchRecoverySource(
    userId: string,
    sessionId: string,
  ): Promise<SourceData> {
    const session = await this.prisma.recoverySession.findFirst({
      where: { id: sessionId, userId, status: 'COMPLETED' },
    });

    if (!session) {
      throw new StoryCardSourceNotFoundException('RECOVERY', sessionId);
    }

    const probabilityRestored =
      Number(session.newProbability) - Number(session.previousProbability);

    const data: RecoverySource = {
      sessionId: session.id,
      category: session.category,
      overspendAmount: Number(session.overspendAmount),
      previousProbability: Number(session.previousProbability),
      newProbability: Number(session.newProbability),
      probabilityRestored,
      selectedPath: session.selectedPathId || 'Recovery Path',
      completedAt: session.updatedAt,
    };

    return { type: 'RECOVERY', data };
  }

  /**
   * Check if user has exceeded card generation limits
   */
  private async checkLimits(userId: string): Promise<void> {
    const [totalCards, todayCards] = await Promise.all([
      this.prisma.storyCard.count({ where: { userId } }),
      this.prisma.storyCard.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    if (totalCards >= STORY_CARD_LIMITS.MAX_CARDS_PER_USER) {
      throw new StoryCardLimitExceededException(
        totalCards,
        STORY_CARD_LIMITS.MAX_CARDS_PER_USER,
        'total',
      );
    }

    if (todayCards >= STORY_CARD_LIMITS.MAX_CARDS_PER_DAY) {
      throw new StoryCardLimitExceededException(
        todayCards,
        STORY_CARD_LIMITS.MAX_CARDS_PER_DAY,
        'daily',
      );
    }
  }

  /**
   * Generate a unique referral code
   */
  private generateReferralCode(): string {
    return randomBytes(Math.ceil(STORY_CARD_LIMITS.REFERRAL_CODE_LENGTH / 2))
      .toString('hex')
      .slice(0, STORY_CARD_LIMITS.REFERRAL_CODE_LENGTH);
  }

  /**
   * Generate a unique share URL code
   */
  private generateShareUrlCode(): string {
    return randomBytes(Math.ceil(STORY_CARD_LIMITS.SHARE_URL_CODE_LENGTH / 2))
      .toString('hex')
      .slice(0, STORY_CARD_LIMITS.SHARE_URL_CODE_LENGTH);
  }

  // Note: Non-transactional generateUniqueCode has been replaced by
  // generateUniqueCodeInTransaction which provides better atomicity.

  /**
   * Generate a unique code within a Prisma transaction
   *
   * Same as generateUniqueCode but uses the transaction client to ensure
   * atomicity. If code generation fails, the entire transaction rolls back.
   *
   * @param tx - Prisma transaction client
   * @param type - 'referral' for referral codes, 'shareUrl' for share URL codes
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @returns A unique code that doesn't exist in the database
   * @throws StoryCardGenerationFailedException if unable to generate unique code (causes rollback)
   */
  private async generateUniqueCodeInTransaction(
    tx: Prisma.TransactionClient,
    type: 'referral' | 'shareUrl',
    maxRetries: number = 3,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = type === 'referral'
        ? this.generateReferralCode()
        : this.generateShareUrlCode();

      // Check if code already exists using transaction client
      const exists = await tx.storyCard.findFirst({
        where: type === 'referral'
          ? { referralCode: code }
          : { shareUrl: `${SHARE_BASE_URL}/${code}` },
        select: { id: true },
      });

      if (!exists) {
        return code;
      }

      this.logger.warn(
        `[generateUniqueCodeInTransaction] Collision detected for ${type} code on attempt ${attempt + 1}`,
      );
    }

    // This exception will cause the transaction to rollback
    throw new StoryCardGenerationFailedException(
      `Failed to generate unique ${type} code after ${maxRetries} retries (transaction will rollback)`,
    );
  }

  // ==========================================
  // CACHE STAMPEDE PREVENTION (Task #29)
  // ==========================================

  /**
   * Acquire a distributed lock for cache refresh
   *
   * Uses Redis SETNX to atomically acquire a lock. When multiple requests
   * hit a cache miss simultaneously, only one will acquire the lock and
   * query the database. Others will wait briefly and check cache again.
   *
   * @param lockKey - Unique key for the lock
   * @param ttlMs - Lock TTL in milliseconds (default: 5000ms)
   * @returns Object with acquired status and lockValue for release
   */
  private async acquireLock(
    lockKey: string,
    ttlMs: number = STORY_CARD_CACHE.LOCK_TTL_MS,
  ): Promise<{ acquired: boolean; lockValue: string }> {
    const lockValue = randomUUID();
    try {
      const acquired = await this.redisService.acquireLock(lockKey, ttlMs, lockValue);
      if (acquired) {
        this.logger.debug(`[acquireLock] Acquired lock: ${lockKey}`);
      }
      return { acquired, lockValue };
    } catch (error) {
      // On Redis failure, allow the request to proceed (graceful degradation)
      this.logger.warn(`[acquireLock] Redis error, allowing request: ${error}`);
      return { acquired: true, lockValue };
    }
  }

  /**
   * Release a distributed lock
   *
   * Only releases if the lock value matches (prevents releasing another process's lock).
   *
   * @param lockKey - The lock key to release
   * @param lockValue - The value used when acquiring (must match)
   */
  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    try {
      await this.redisService.releaseLock(lockKey, lockValue);
      this.logger.debug(`[releaseLock] Released lock: ${lockKey}`);
    } catch (error) {
      this.logger.warn(`[releaseLock] Failed to release lock: ${error}`);
    }
  }

  /**
   * Wait for lock to be released and check cache again
   *
   * When a request fails to acquire a lock, it means another request is
   * populating the cache. This method waits briefly and rechecks the cache.
   *
   * @param cacheKey - The cache key to check
   * @param maxRetries - Maximum number of retry attempts
   * @returns Cached value if found, null otherwise
   */
  private async waitAndCheckCache<T>(
    cacheKey: string,
    maxRetries: number = STORY_CARD_CACHE.LOCK_MAX_RETRIES,
  ): Promise<T | null> {
    for (let i = 0; i < maxRetries; i++) {
      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, STORY_CARD_CACHE.LOCK_WAIT_MS));

      // Check cache again
      try {
        const cached = await this.redisService.get<T>(cacheKey);
        if (cached) {
          this.logger.debug(`[waitAndCheckCache] Cache hit after waiting (attempt ${i + 1})`);
          return cached;
        }
      } catch (error) {
        this.logger.warn(`[waitAndCheckCache] Cache read failed: ${error}`);
      }
    }
    return null;
  }

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
  private async shouldCountView(cardId: string, ipAddress?: string): Promise<boolean> {
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
  private incrementViewCount(cardId: string, ipAddress?: string): void {
    this.shouldCountView(cardId, ipAddress).then((shouldCount) => {
      if (!shouldCount) {
        return;
      }

      // Increment view metrics
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
              this.logStructured('log', {
                message: `Card reached ${milestone} views milestone`,
                operation: 'incrementViewCount',
                cardId,
                userId: updatedCard.userId,
                milestone,
                viewCount,
              });
              break; // Only one milestone can be crossed at a time
            }
          }
        })
        .catch((err) => this.logStructured('warn', {
          message: `View count increment failed: ${err}`,
          operation: 'incrementViewCount',
          cardId,
        }));
    });
  }

  /**
   * Cache a card response (non-blocking)
   */
  private cacheCard(cardId: string, response: StoryCardResponse): void {
    const cacheKey = STORY_CARD_CACHE_KEYS.CARD(cardId);
    this.redisService
      .set(cacheKey, response, STORY_CARD_CACHE.CARD_TTL_SEC)
      .catch((err) => this.logger.warn(`Card cache write failed: ${err}`));
  }

  /**
   * Convert database model to response DTO
   */
  private toStoryCardResponse(card: {
    id: string;
    type: StoryCardType;
    headline: string;
    subheadline: string;
    keyMetricLabel: string;
    keyMetricValue: string;
    quote: string | null;
    shareUrl: string;
    platforms: string[];
    hashtags: string[];
    gradient: string[];
    anonymizeAmounts: boolean;
    viewCount: number;
    referralCode: string;
    sourceId: string | null;
    expiresAt: Date | null;
    createdAt: Date;
  }): StoryCardResponse {
    return {
      id: card.id,
      type: card.type,
      headline: card.headline,
      subheadline: card.subheadline,
      keyMetric: {
        label: card.keyMetricLabel,
        value: card.keyMetricValue,
      },
      quote: card.quote || undefined,
      shareUrl: card.shareUrl,
      platforms: card.platforms,
      hashtags: card.hashtags,
      gradient: card.gradient as [string, string],
      anonymizeAmounts: card.anonymizeAmounts,
      viewCount: card.viewCount,
      referralCode: card.referralCode,
      sourceId: card.sourceId || undefined,
      expiresAt: card.expiresAt || undefined,
      createdAt: card.createdAt,
    };
  }

  // ==========================================
  // DELEGATED METHODS (to specialized services)
  // ==========================================

  /**
   * Preview a story card without saving to database
   */
  async previewCard(userId: string, input: PreviewCardInput): Promise<PreviewCardResponse> {
    const sourceData = await this.fetchSourceData(userId, input.type, input.sourceId);
    const privacy: PrivacySettings = {
      anonymizeAmounts: input.anonymizeAmounts ?? DEFAULT_PRIVACY_SETTINGS.anonymizeAmounts,
      revealActualNumbers: input.revealActualNumbers ?? DEFAULT_PRIVACY_SETTINGS.revealActualNumbers,
      includePersonalData: input.includePersonalData ?? DEFAULT_PRIVACY_SETTINGS.includePersonalData,
      requirePreview: DEFAULT_PRIVACY_SETTINGS.requirePreview,
    };
    const content = this.cardContentCalculator.generateContent(input.type, sourceData, privacy);
    return {
      preview: true,
      type: input.type,
      headline: content.headline,
      subheadline: content.subheadline,
      keyMetric: content.keyMetric,
      quote: content.quote,
      platforms: PLATFORMS_BY_TYPE[input.type],
      hashtags: content.hashtags,
      gradient: content.gradient,
      anonymizeAmounts: privacy.anonymizeAmounts,
      sourceId: input.sourceId,
      generatedAt: new Date(),
    };
  }

  /**
   * Bulk delete story cards (GDPR compliance)
   *
   * @param userId - User ID for ownership verification
   * @param cardIds - Array of card IDs to delete
   * @param hardDelete - If true, permanently delete. If false, soft delete (default)
   */
  async bulkDelete(
    userId: string,
    cardIds: string[],
    hardDelete: boolean = false,
  ) {
    const deleted: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const cardId of cardIds) {
      try {
        await this.deleteCard(userId, cardId, hardDelete);
        deleted.push(cardId);
      } catch (error) {
        failed.push({
          id: cardId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      deleted,
      failed,
      deleteType: hardDelete ? 'hard' as const : 'soft' as const,
      processedAt: new Date(),
      summary: {
        requested: cardIds.length,
        deleted: deleted.length,
        failed: failed.length,
      },
    };
  }

  /**
   * Bulk generate story cards
   *
   * @param userId - User ID
   * @param items - Array of items to generate cards for
   */
  async bulkGenerate(
    userId: string,
    items: Array<{
      type: StoryCardType;
      sourceId: string;
      anonymizeAmounts?: boolean;
    }>,
  ) {
    const generated: string[] = [];
    const failed: { sourceId: string; type: StoryCardType; reason: string }[] = [];

    for (const item of items) {
      try {
        const card = await this.generateCard(userId, {
          type: item.type,
          sourceId: item.sourceId,
          anonymizeAmounts: item.anonymizeAmounts,
        });
        generated.push(card.id);
      } catch (error) {
        failed.push({
          sourceId: item.sourceId,
          type: item.type,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      generated,
      failed,
      processedAt: new Date(),
      summary: {
        requested: items.length,
        generated: generated.length,
        failed: failed.length,
      },
    };
  }
}
