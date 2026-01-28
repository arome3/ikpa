/**
 * Story Cards Generation Service
 *
 * Handles card generation, source data fetching, and unique code generation.
 * Extracted from StoryCardsService for single responsibility.
 *
 * Responsibilities:
 * - Generate story cards from various source types
 * - Preview cards before generation
 * - Fetch source data (Future Self, Commitment, Milestone, Recovery)
 * - Generate unique referral and share URL codes
 * - Convert database models to response DTOs
 * - Check generation limits
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { OpikService } from '../../ai/opik/opik.service';
import { StoryCardType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { StoryCardsMetrics } from '../story-cards.metrics';
import {
  STORY_CARD_EVENTS,
  StoryCardCreatedEvent,
} from '../story-cards.events';
import {
  GenerateCardInput,
  SourceData,
  PrivacySettings,
  FutureSelfSource,
  CommitmentSource,
  MilestoneSource,
  RecoverySource,
  StoryCardResponse,
  PreviewCardInput,
  PreviewCardResponse,
} from '../interfaces';
import {
  STORY_CARD_LIMITS,
  STORY_CARD_CACHE,
  STORY_CARD_CACHE_KEYS,
  STORY_CARD_TRACE_NAMES,
  PLATFORMS_BY_TYPE,
  DEFAULT_PRIVACY_SETTINGS,
  SHARE_BASE_URL,
} from '../constants';
import {
  StoryCardGenerationFailedException,
  StoryCardSourceNotFoundException,
  StoryCardLimitExceededException,
} from '../exceptions';
import { CardContentCalculator } from '../calculators';

@Injectable()
export class StoryCardsGenerationService {
  private readonly logger = new Logger(StoryCardsGenerationService.name);

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
    const { message, operation, ...context } = data;
    const prefix = `[${operation}]`;

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
   * 4. Create card in database (atomic transaction)
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

      // Privacy settings validation logic
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
      const card = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          this.logger.debug(`[generateCard] Starting transaction for user ${userId}`);

          const referralCode = await this.generateUniqueCodeInTransaction(tx, 'referral');
          const shareUrlCode = await this.generateUniqueCodeInTransaction(tx, 'shareUrl');
          const shareUrl = `${SHARE_BASE_URL}/${shareUrlCode}`;

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
          maxWait: 5000,
          timeout: 10000,
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );

      // Increment metrics for successful generation
      this.metrics.incCardsGenerated({ type: input.type, success: true });

      this.logger.log(`[generateCard] Created story card ${card.id} for user ${userId}`);

      // Phase 7: Emit CREATED event (outside transaction)
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

  /**
   * Preview a story card without saving to database
   */
  async previewCard(
    userId: string,
    input: PreviewCardInput,
  ): Promise<PreviewCardResponse> {
    const trace = this.opikService.createTrace({
      name: STORY_CARD_TRACE_NAMES.GENERATE,
      input: { userId, type: input.type, sourceId: input.sourceId, preview: true },
      metadata: { operation: 'previewCard' },
      tags: ['story_cards', 'preview', input.type],
    });

    try {
      // Fetch source data
      const sourceData = await this.fetchSourceData(
        userId,
        input.type,
        input.sourceId,
      );

      // Build privacy settings
      const privacy: PrivacySettings = {
        anonymizeAmounts: input.anonymizeAmounts ?? DEFAULT_PRIVACY_SETTINGS.anonymizeAmounts,
        revealActualNumbers: input.revealActualNumbers ?? DEFAULT_PRIVACY_SETTINGS.revealActualNumbers,
        includePersonalData: input.includePersonalData ?? DEFAULT_PRIVACY_SETTINGS.includePersonalData,
        requirePreview: true,
      };

      // Generate card content
      const content = this.cardContentCalculator.generateContent(
        input.type,
        sourceData,
        privacy,
      );

      const response: PreviewCardResponse = {
        preview: true,
        type: input.type,
        headline: content.headline,
        subheadline: content.subheadline,
        keyMetric: content.keyMetric,
        quote: content.quote,
        platforms: [...PLATFORMS_BY_TYPE[input.type]],
        hashtags: content.hashtags,
        gradient: content.gradient,
        anonymizeAmounts: privacy.anonymizeAmounts,
        sourceId: input.sourceId,
        generatedAt: new Date(),
      };

      this.opikService.endTrace(trace, {
        success: true,
        result: { type: input.type, preview: true },
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.opikService.endTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  // ==========================================
  // SOURCE DATA FETCHING
  // ==========================================

  /**
   * Fetch source data for card generation
   */
  async fetchSourceData(
    userId: string,
    type: StoryCardType,
    sourceId: string,
  ): Promise<SourceData> {
    switch (type) {
      case 'FUTURE_SELF':
        return this.fetchFutureSelfSource(userId, sourceId);
      case 'COMMITMENT':
        return this.fetchCommitmentSource(userId, sourceId);
      case 'MILESTONE':
        return this.fetchMilestoneSource(userId, sourceId);
      case 'RECOVERY':
        return this.fetchRecoverySource(userId, sourceId);
      default:
        throw new StoryCardGenerationFailedException(`Unknown card type: ${type}`);
    }
  }

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

    const successProbabilityMultipliers: Record<string, number> = {
      SOCIAL: 2.0,
      ANTI_CHARITY: 3.0,
      LOSS_POOL: 2.5,
    };
    const baseSuccessRate = 0.26;
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

  // ==========================================
  // CODE GENERATION
  // ==========================================

  /**
   * Generate a unique referral code
   */
  generateReferralCode(): string {
    return randomBytes(Math.ceil(STORY_CARD_LIMITS.REFERRAL_CODE_LENGTH / 2))
      .toString('hex')
      .slice(0, STORY_CARD_LIMITS.REFERRAL_CODE_LENGTH);
  }

  /**
   * Generate a unique share URL code
   */
  generateShareUrlCode(): string {
    return randomBytes(Math.ceil(STORY_CARD_LIMITS.SHARE_URL_CODE_LENGTH / 2))
      .toString('hex')
      .slice(0, STORY_CARD_LIMITS.SHARE_URL_CODE_LENGTH);
  }

  /**
   * Generate a unique code with retry logic for collision handling
   */
  async generateUniqueCode(
    type: 'referral' | 'shareUrl',
    maxRetries: number = 3,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = type === 'referral'
        ? this.generateReferralCode()
        : this.generateShareUrlCode();

      const exists = await this.prisma.storyCard.findFirst({
        where: type === 'referral'
          ? { referralCode: code }
          : { shareUrl: `${SHARE_BASE_URL}/${code}` },
        select: { id: true },
      });

      if (!exists) {
        return code;
      }

      this.logger.warn(
        `[generateUniqueCode] Collision detected for ${type} code on attempt ${attempt + 1}`,
      );
    }

    throw new StoryCardGenerationFailedException(
      `Failed to generate unique ${type} code after ${maxRetries} retries`,
    );
  }

  /**
   * Generate a unique code within a Prisma transaction
   */
  async generateUniqueCodeInTransaction(
    tx: Prisma.TransactionClient,
    type: 'referral' | 'shareUrl',
    maxRetries: number = 3,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = type === 'referral'
        ? this.generateReferralCode()
        : this.generateShareUrlCode();

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

    throw new StoryCardGenerationFailedException(
      `Failed to generate unique ${type} code after ${maxRetries} retries (transaction will rollback)`,
    );
  }

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Check if user has exceeded card generation limits
   */
  async checkLimits(userId: string): Promise<void> {
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
   * Cache a card response (non-blocking)
   */
  cacheCard(cardId: string, response: StoryCardResponse): void {
    const cacheKey = STORY_CARD_CACHE_KEYS.CARD(cardId);
    this.redisService
      .set(cacheKey, response, STORY_CARD_CACHE.CARD_TTL_SEC)
      .catch((err) => this.logger.warn(`Card cache write failed: ${err}`));
  }

  /**
   * Convert database model to response DTO
   */
  toStoryCardResponse(card: {
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
}
