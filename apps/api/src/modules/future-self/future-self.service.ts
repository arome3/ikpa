/**
 * Future Self Service
 *
 * Orchestration layer for the Future Self Simulator feature.
 * Features:
 * - Redis caching for simulations (5 min TTL)
 * - Database persistence for letters (with history)
 * - Cache invalidation when user data changes
 */

import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FutureSelfAgent } from './agents/future-self.agent';
import {
  FutureSimulation,
  LetterFromFuture,
  TimelineProjection,
} from './interfaces';
import {
  SIMULATION_CACHE_TTL_MS,
  LETTER_CACHE_TTL_MS,
  LETTER_IDEMPOTENCY_TTL_SEC,
  LETTER_IDEMPOTENCY_KEY_PREFIX,
  FEEDBACK_COMMITMENT_CONVERSION,
  TRACE_FUTURE_SELF_TRIGGERED,
  AB_TEST_LETTER_MODE,
} from './constants';
import { TrackedTrace } from '../ai/opik/interfaces';
import { LetterTrigger } from '@prisma/client';
import { OpikService } from '../ai/opik/opik.service';
import {
  buildPostDecisionPrompt,
  buildMilestonePrompt,
  LETTER_SYSTEM_PROMPT,
  LetterMode,
} from './prompts/future-self.prompt';
import { AnthropicService } from '../ai/anthropic';
import { ContentModerationService } from './services/content-moderation.service';
import { MetricsService } from '../ai/opik/metrics';
import { LETTER_MAX_TOKENS } from './constants';

// ==========================================
// CACHE KEYS
// ==========================================

const CACHE_PREFIX = 'future_self';
const SIMULATION_CACHE_KEY = (userId: string) => `${CACHE_PREFIX}:sim:${userId}`;
const LETTER_CACHE_KEY = (userId: string) => `${CACHE_PREFIX}:letter:${userId}`;

// Convert TTL from ms to seconds for Redis
const SIMULATION_CACHE_TTL_SEC = Math.floor(SIMULATION_CACHE_TTL_MS / 1000);
const LETTER_CACHE_TTL_SEC = Math.floor(LETTER_CACHE_TTL_MS / 1000);

@Injectable()
export class FutureSelfService {
  private readonly logger = new Logger(FutureSelfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly futureSelfAgent: FutureSelfAgent,
    private readonly opikService: OpikService,
    private readonly anthropicService: AnthropicService,
    private readonly contentModeration: ContentModerationService,
    private readonly metricsService: MetricsService,
  ) {
    // Register A/B test for letter mode framing (gratitude vs regret)
    try {
      const abTestManager = this.metricsService.getABTestManager();
      abTestManager.registerTest({
        name: AB_TEST_LETTER_MODE,
        variants: [
          { id: 'gratitude', weight: 50, criteria: { mode: 'gratitude', framing: 'gain' } },
          { id: 'regret', weight: 50, criteria: { mode: 'regret', framing: 'loss' } },
        ],
        enabled: true,
        description: 'A/B test: gratitude (gain framing) vs regret (loss framing) letter mode',
      });
    } catch {
      // A/B test registration is best-effort
    }
  }

  // ==========================================
  // PUBLIC METHODS
  // ==========================================

  /**
   * Get dual-path simulation for user
   *
   * Caches results in Redis for 5 minutes to avoid expensive recalculation.
   *
   * @param userId - The user's ID
   * @returns Dual-path simulation
   */
  async getSimulation(userId: string): Promise<FutureSimulation> {
    const cacheKey = SIMULATION_CACHE_KEY(userId);

    // Try Redis cache first (with graceful degradation)
    try {
      const cached = await this.redisService.get<FutureSimulation>(cacheKey);
      if (cached) {
        this.logger.debug(`Redis cache hit for simulation: ${userId}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(
        `Redis cache read failed for simulation (${userId}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Continue without cache - service remains functional
    }

    // Generate fresh simulation
    const simulation = await this.futureSelfAgent.generateSimulation(userId);

    // Cache in Redis (non-blocking, failures logged but don't break flow)
    this.cacheSimulation(cacheKey, simulation);

    return simulation;
  }

  /**
   * Cache simulation in Redis (non-blocking)
   */
  private cacheSimulation(cacheKey: string, simulation: FutureSimulation): void {
    this.redisService
      .set(cacheKey, simulation, SIMULATION_CACHE_TTL_SEC)
      .catch((error) => {
        this.logger.warn(
          `Redis cache write failed for simulation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
  }

  /**
   * Get personalized letter from future self
   *
   * Checks cache first, then generates new letter if needed.
   * Persists all letters to database for history and analytics.
   *
   * @param userId - The user's ID
   * @param trigger - What triggered the letter request
   * @returns Letter with simulation data and database ID
   */
  async getLetter(
    userId: string,
    trigger: LetterTrigger = LetterTrigger.USER_REQUEST,
    mode?: LetterMode,
  ): Promise<LetterFromFuture & { id: string }> {
    // When user doesn't specify a mode, use A/B test to determine default
    let letterMode: LetterMode = mode || 'gratitude';
    if (!mode) {
      try {
        const variant = this.metricsService.selectABTestVariant(AB_TEST_LETTER_MODE, userId);
        if (variant) {
          letterMode = variant.id as LetterMode;
          this.logger.debug(`A/B test assigned mode '${letterMode}' for user ${userId}`);
        }
      } catch {
        // A/B test selection failed, use default
      }
    }

    const cacheKey = `${LETTER_CACHE_KEY(userId)}:${letterMode}`;
    const idempotencyKey = `${LETTER_IDEMPOTENCY_KEY_PREFIX}:${userId}:${letterMode}`;

    // Try Redis cache first (with graceful degradation)
    try {
      const cached = await this.redisService.get<LetterFromFuture & { id: string }>(cacheKey);
      if (cached) {
        this.logger.debug(`Redis cache hit for letter: ${userId}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn(
        `Redis cache read failed for letter (${userId}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Continue without cache - service remains functional
    }

    // Idempotency check: prevent duplicate generation from rapid requests
    // Uses SETNX pattern - only first request proceeds, others wait for cache
    let acquiredLock = false;
    try {
      acquiredLock = await this.redisService.setNx(
        idempotencyKey,
        { startedAt: Date.now() },
        LETTER_IDEMPOTENCY_TTL_SEC,
      );
    } catch (error) {
      this.logger.warn(
        `Idempotency check failed (${userId}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Continue anyway - idempotency is a nice-to-have, not critical
      acquiredLock = true;
    }

    if (!acquiredLock) {
      // Another request is generating a letter, wait briefly and check cache again
      this.logger.debug(`Letter generation already in progress for user ${userId}, waiting...`);
      await this.waitForLetterGeneration(userId, cacheKey);

      // Check cache again after waiting
      try {
        const cached = await this.redisService.get<LetterFromFuture & { id: string }>(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit after idempotency wait for user ${userId}`);
          return cached;
        }
      } catch {
        // Cache read failed, fall through to generate
      }

      // If still no cache, proceed with generation (original request may have failed)
      this.logger.debug(`No cache after wait, proceeding with generation for user ${userId}`);
    }

    // Generate fresh letter
    const letter = await this.futureSelfAgent.generateLetter(userId, letterMode);

    // Get token usage from the response (stored in agent context)
    const tokenUsage = letter.tokenUsage || { promptTokens: 0, completionTokens: 0 };

    // Persist to database
    const savedLetter = await this.prisma.futureSelfLetter.create({
      data: {
        userId,
        content: letter.content,
        trigger,
        currentSavingsRate: letter.simulationData.currentBehavior.savingsRate,
        optimizedSavingsRate: letter.simulationData.withIKPA.savingsRate,
        currentNetWorth20yr: letter.simulationData.currentBehavior.projectedNetWorth['20yr'],
        optimizedNetWorth20yr: letter.simulationData.withIKPA.projectedNetWorth['20yr'],
        wealthDifference20yr: letter.simulationData.difference_20yr,
        userAge: letter.userAge,
        futureAge: letter.futureAge,
        toneEmpathyScore: letter.toneScore,
        promptTokens: tokenUsage.promptTokens,
        completionTokens: tokenUsage.completionTokens,
      },
    });

    this.logger.log(`Letter persisted to database: ${savedLetter.id} for user ${userId}`);

    // Build response with database ID
    const result = {
      ...letter,
      id: savedLetter.id,
    };

    // Cache in Redis (non-blocking, failures logged but don't break flow)
    this.cacheLetter(cacheKey, result);

    // Release idempotency key (non-blocking, will also expire via TTL)
    this.redisService.del(idempotencyKey).catch(() => {
      // Ignore deletion failures - key will expire via TTL
    });

    return result;
  }

  /**
   * Wait for in-progress letter generation to complete
   * Polls cache with exponential backoff until letter appears or timeout
   */
  private async waitForLetterGeneration(
    userId: string,
    cacheKey: string,
    maxWaitMs: number = 15000,
  ): Promise<void> {
    const startTime = Date.now();
    let waitMs = 500; // Start with 500ms

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      try {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.debug(`Letter appeared in cache for user ${userId}`);
          return;
        }
      } catch {
        // Cache check failed, continue waiting
      }

      // Exponential backoff with cap at 2 seconds
      waitMs = Math.min(waitMs * 1.5, 2000);
    }

    this.logger.debug(`Wait timeout for letter generation: ${userId}`);
  }

  /**
   * Cache letter in Redis (non-blocking)
   */
  private cacheLetter(cacheKey: string, letter: LetterFromFuture & { id: string }): void {
    this.redisService
      .set(cacheKey, letter, LETTER_CACHE_TTL_SEC)
      .catch((error) => {
        this.logger.warn(
          `Redis cache write failed for letter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
  }

  /**
   * Get timeline projection at specific year
   *
   * Does not cache since it's derived from simulation (which is cached).
   *
   * @param userId - The user's ID
   * @param years - Number of years to project
   * @returns Timeline projection
   */
  async getTimeline(userId: string, years: number): Promise<TimelineProjection> {
    return this.futureSelfAgent.getTimeline(userId, years);
  }

  /**
   * Get letter history for a user
   *
   * @param userId - The user's ID
   * @param limit - Maximum number of letters to return
   * @returns Array of historical letters
   */
  async getLetterHistory(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<Array<{
    id: string;
    content: string;
    trigger: LetterTrigger;
    toneEmpathyScore: number | null;
    createdAt: Date;
    readAt: Date | null;
  }>> {
    const letters = await this.prisma.futureSelfLetter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        content: true,
        trigger: true,
        toneEmpathyScore: true,
        createdAt: true,
        readAt: true,
      },
    });

    return letters;
  }

  /**
   * Mark a letter as read (for engagement tracking)
   *
   * @param letterId - The letter's ID
   * @param readDurationMs - How long the user spent reading
   */
  async markLetterRead(letterId: string, readDurationMs?: number): Promise<void> {
    await this.prisma.futureSelfLetter.update({
      where: { id: letterId },
      data: {
        readAt: new Date(),
        readDurationMs: readDurationMs || null,
      },
    });

    this.logger.debug(`Letter marked as read: ${letterId}`);
  }

  // ==========================================
  // PREFERENCES METHODS
  // ==========================================

  /**
   * Get user's Future Self preferences
   *
   * @param userId - The user's ID
   * @returns Current preference settings
   */
  async getPreferences(userId: string): Promise<{
    weeklyLettersEnabled: boolean;
    updatedAt: Date;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        weeklyReportEnabled: true,
        updatedAt: true,
      },
    });

    if (!user) {
      // Return default preferences if user not found (shouldn't happen with auth)
      return {
        weeklyLettersEnabled: true,
        updatedAt: new Date(),
      };
    }

    return {
      weeklyLettersEnabled: user.weeklyReportEnabled,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user's Future Self preferences
   *
   * @param userId - The user's ID
   * @param weeklyLettersEnabled - Whether to enable weekly letters
   * @returns Updated preference settings
   */
  async updatePreferences(
    userId: string,
    weeklyLettersEnabled?: boolean,
  ): Promise<{
    weeklyLettersEnabled: boolean;
    updatedAt: Date;
  }> {
    const updateData: { weeklyReportEnabled?: boolean } = {};

    if (weeklyLettersEnabled !== undefined) {
      updateData.weeklyReportEnabled = weeklyLettersEnabled;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        weeklyReportEnabled: true,
        updatedAt: true,
      },
    });

    this.logger.log(
      `Updated Future Self preferences for user ${userId}: weeklyLettersEnabled=${user.weeklyReportEnabled}`,
    );

    return {
      weeklyLettersEnabled: user.weeklyReportEnabled,
      updatedAt: user.updatedAt,
    };
  }

  // ==========================================
  // LETTER DETAIL METHODS
  // ==========================================

  /**
   * Get a specific letter by ID
   *
   * @param userId - The user's ID (for ownership verification)
   * @param letterId - The letter's ID
   * @returns Letter details or null if not found
   */
  async getLetterById(
    userId: string,
    letterId: string,
  ): Promise<{
    id: string;
    content: string;
    trigger: LetterTrigger;
    generatedAt: Date;
    readAt: Date | null;
    userAge: number;
    futureAge: number;
    currentSavingsRate: number;
    optimizedSavingsRate: number;
    wealthDifference20yr: number;
    toneScore: number | null;
  } | null> {
    const letter = await this.prisma.futureSelfLetter.findFirst({
      where: {
        id: letterId,
        userId, // Ensure user owns the letter
      },
    });

    if (!letter) {
      return null;
    }

    return {
      id: letter.id,
      content: letter.content,
      trigger: letter.trigger,
      generatedAt: letter.createdAt,
      readAt: letter.readAt,
      userAge: letter.userAge,
      futureAge: letter.futureAge,
      currentSavingsRate: Number(letter.currentSavingsRate),
      optimizedSavingsRate: Number(letter.optimizedSavingsRate),
      wealthDifference20yr: Number(letter.wealthDifference20yr),
      toneScore: letter.toneEmpathyScore,
    };
  }

  /**
   * Update engagement metrics for a letter
   *
   * @param userId - The user's ID (for ownership verification)
   * @param letterId - The letter's ID
   * @param readDurationMs - Time spent reading
   * @returns Updated engagement data or null if letter not found
   */
  async updateEngagement(
    userId: string,
    letterId: string,
    readDurationMs?: number,
  ): Promise<{
    letterId: string;
    readAt: Date;
    readDurationMs: number | null;
  } | null> {
    // Verify ownership
    const existing = await this.prisma.futureSelfLetter.findFirst({
      where: { id: letterId, userId },
    });

    if (!existing) {
      return null;
    }

    const letter = await this.prisma.futureSelfLetter.update({
      where: { id: letterId },
      data: {
        readAt: existing.readAt ?? new Date(), // Only set if not already read
        readDurationMs: readDurationMs ?? existing.readDurationMs,
      },
    });

    this.logger.debug(`Updated engagement for letter ${letterId}: readDurationMs=${readDurationMs}`);

    return {
      letterId: letter.id,
      readAt: letter.readAt!,
      readDurationMs: letter.readDurationMs,
    };
  }

  // ==========================================
  // STATISTICS METHODS
  // ==========================================

  /**
   * Get comprehensive letter statistics for a user
   *
   * @param userId - The user's ID
   * @returns Detailed engagement statistics
   */
  async getStatistics(userId: string): Promise<{
    totalLetters: number;
    lettersRead: number;
    avgReadDurationMs: number | null;
    avgToneScore: number | null;
    firstLetterDate: Date | null;
    lastLetterDate: Date | null;
    byTrigger: Record<string, number>;
    thisMonth: number;
  }> {
    // Get aggregate stats
    const [stats, readCount, firstLetter, lastLetter, byTrigger, thisMonth] =
      await Promise.all([
        // Aggregates
        this.prisma.futureSelfLetter.aggregate({
          where: { userId },
          _count: { id: true },
          _avg: {
            readDurationMs: true,
            toneEmpathyScore: true,
          },
        }),
        // Read count
        this.prisma.futureSelfLetter.count({
          where: { userId, readAt: { not: null } },
        }),
        // First letter
        this.prisma.futureSelfLetter.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        // Last letter
        this.prisma.futureSelfLetter.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        // Group by trigger
        this.prisma.futureSelfLetter.groupBy({
          by: ['trigger'],
          where: { userId },
          _count: { trigger: true },
        }),
        // This month count
        this.prisma.futureSelfLetter.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ]);

    // Build trigger breakdown
    const triggerBreakdown: Record<string, number> = {};
    for (const item of byTrigger) {
      triggerBreakdown[item.trigger] = item._count.trigger;
    }

    return {
      totalLetters: stats._count.id,
      lettersRead: readCount,
      avgReadDurationMs: stats._avg.readDurationMs,
      avgToneScore: stats._avg.toneEmpathyScore,
      firstLetterDate: firstLetter?.createdAt ?? null,
      lastLetterDate: lastLetter?.createdAt ?? null,
      byTrigger: triggerBreakdown,
      thisMonth,
    };
  }

  // ==========================================
  // CONVERSATION METHODS
  // ==========================================

  /**
   * Handle a conversation message - creates or continues a conversation
   */
  async handleConversation(
    userId: string,
    letterId: string,
    message: string,
  ): Promise<{
    conversationId: string;
    response: { role: 'future_self'; content: string; createdAt: string };
    messages: Array<{ role: string; content: string; createdAt: string }>;
  } | null> {
    // Verify letter ownership
    const letter = await this.prisma.futureSelfLetter.findFirst({
      where: { id: letterId, userId },
    });
    if (!letter) return null;

    // Find or create conversation
    let conversation = await this.prisma.futureSelfConversation.findFirst({
      where: { userId, letterId },
    });

    const existingMessages: Array<{ role: string; content: string; createdAt: string }> =
      conversation ? (conversation.messages as Array<{ role: string; content: string; createdAt: string }>) : [];

    // Max 20 messages per conversation
    if (existingMessages.length >= 20) {
      return {
        conversationId: conversation!.id,
        response: {
          role: 'future_self',
          content: "We've had a wonderful conversation. Generate a new letter to start a fresh dialogue with me.",
          createdAt: new Date().toISOString(),
        },
        messages: [...existingMessages, {
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
        }],
      };
    }

    // Generate response
    const result = await this.futureSelfAgent.generateConversationResponse(
      userId,
      letter.content,
      message,
      existingMessages,
    );

    // Build new messages array
    const now = new Date().toISOString();
    const userMsg = { role: 'user', content: message, createdAt: now };
    const futureMsg = { role: 'future_self', content: result.content, createdAt: now };
    const allMessages = [...existingMessages, userMsg, futureMsg];

    // Persist
    if (conversation) {
      await this.prisma.futureSelfConversation.update({
        where: { id: conversation.id },
        data: { messages: allMessages },
      });
    } else {
      conversation = await this.prisma.futureSelfConversation.create({
        data: {
          userId,
          letterId,
          messages: allMessages,
        },
      });
    }

    return {
      conversationId: conversation.id,
      response: { role: 'future_self', content: result.content, createdAt: now },
      messages: allMessages as Array<{ role: string; content: string; createdAt: string }>,
    };
  }

  /**
   * Get conversation history for a letter
   */
  async getConversation(
    userId: string,
    letterId: string,
  ): Promise<{ messages: Array<{ role: string; content: string; createdAt: string }> } | null> {
    const conversation = await this.prisma.futureSelfConversation.findFirst({
      where: { userId, letterId },
    });
    if (!conversation) return null;
    return {
      messages: conversation.messages as Array<{ role: string; content: string; createdAt: string }>,
    };
  }

  // ==========================================
  // COMMITMENT METHODS
  // ==========================================

  /**
   * Create a micro-commitment
   */
  async createCommitment(
    userId: string,
    letterId: string,
    dailyAmount: number,
  ): Promise<{
    id: string;
    letterId: string;
    dailyAmount: number;
    currency: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    streakDays: number;
    longestStreak: number;
    lastCheckinDate: Date | null;
    createdAt: Date;
  }> {
    // Get user currency
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    const commitment = await this.prisma.futureSelfCommitment.create({
      data: {
        userId,
        letterId,
        dailyAmount,
        currency: user?.currency || 'USD',
      },
    });

    // Track commitment conversion as Opik feedback on the letter's trace
    try {
      // Find the letter to get its traceId context
      const letter = await this.prisma.futureSelfLetter.findFirst({
        where: { id: letterId, userId },
      });
      if (letter) {
        this.opikService.addFeedback({
          traceId: letterId, // Use letterId as trace correlation
          name: FEEDBACK_COMMITMENT_CONVERSION,
          value: 1,
          category: 'engagement',
          comment: `User committed ${dailyAmount}/day after reading letter`,
          source: 'user-action',
        });
      }
    } catch {
      // Feedback is best-effort
    }

    // Track A/B test result — commitment is the behavioral outcome we measure
    try {
      const abTestManager = this.metricsService.getABTestManager();
      // Determine which variant this user was in
      const variant = this.metricsService.selectABTestVariant(AB_TEST_LETTER_MODE, userId);
      if (variant) {
        abTestManager.trackResult(AB_TEST_LETTER_MODE, variant.id, {
          score: dailyAmount,
          passed: true,
          metadata: { userId, letterId, dailyAmount },
        });
      }
    } catch {
      // A/B tracking is best-effort
    }

    this.logger.log(`Commitment created for user ${userId}: ${dailyAmount}/day`);

    return {
      id: commitment.id,
      letterId: commitment.letterId,
      dailyAmount: Number(commitment.dailyAmount),
      currency: commitment.currency,
      status: commitment.status,
      startDate: commitment.startDate,
      endDate: commitment.endDate,
      streakDays: commitment.streakDays,
      longestStreak: commitment.longestStreak,
      lastCheckinDate: commitment.lastCheckinDate,
      createdAt: commitment.createdAt,
    };
  }

  /**
   * Get user's commitments
   */
  async getCommitments(userId: string): Promise<Array<{
    id: string;
    letterId: string;
    dailyAmount: number;
    currency: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    streakDays: number;
    longestStreak: number;
    lastCheckinDate: Date | null;
    createdAt: Date;
  }>> {
    const commitments = await this.prisma.futureSelfCommitment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return commitments.map(c => ({
      id: c.id,
      letterId: c.letterId,
      dailyAmount: Number(c.dailyAmount),
      currency: c.currency,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      streakDays: c.streakDays,
      longestStreak: c.longestStreak,
      lastCheckinDate: c.lastCheckinDate,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Update a commitment's status
   */
  async updateCommitment(
    userId: string,
    id: string,
    status?: string,
  ): Promise<{
    id: string;
    letterId: string;
    dailyAmount: number;
    currency: string;
    status: string;
    startDate: Date;
    endDate: Date | null;
    streakDays: number;
    longestStreak: number;
    lastCheckinDate: Date | null;
    createdAt: Date;
  } | null> {
    const existing = await this.prisma.futureSelfCommitment.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED' || status === 'ABANDONED') {
        updateData.endDate = new Date();
      }
    }

    const commitment = await this.prisma.futureSelfCommitment.update({
      where: { id },
      data: updateData,
    });

    return {
      id: commitment.id,
      letterId: commitment.letterId,
      dailyAmount: Number(commitment.dailyAmount),
      currency: commitment.currency,
      status: commitment.status,
      startDate: commitment.startDate,
      endDate: commitment.endDate,
      streakDays: commitment.streakDays,
      longestStreak: commitment.longestStreak,
      lastCheckinDate: commitment.lastCheckinDate,
      createdAt: commitment.createdAt,
    };
  }

  // ==========================================
  // CHECKIN METHODS
  // ==========================================

  /** Streak milestones that trigger celebration notifications */
  private readonly STREAK_MILESTONES = [7, 14, 30, 60, 90];

  /**
   * Check in for today on a commitment
   *
   * Creates a check-in record for today (Africa/Lagos timezone),
   * increments streakDays, updates longestStreak if new high.
   * Uses $transaction for atomicity.
   *
   * @throws ConflictException if already checked in today
   * @throws NotFoundException if commitment not found or not owned by user
   */
  async checkin(
    userId: string,
    commitmentId: string,
    note?: string,
  ): Promise<{
    id: string;
    commitmentId: string;
    checkinDate: Date;
    note: string | null;
    createdAt: Date;
    streakDays: number;
    longestStreak: number;
  }> {
    // Verify ownership and active status
    const commitment = await this.prisma.futureSelfCommitment.findFirst({
      where: { id: commitmentId, userId, status: 'ACTIVE' },
    });
    if (!commitment) {
      throw new NotFoundException('Active commitment not found');
    }

    // Get today's date in Africa/Lagos timezone
    const today = this.getTodayInLagos();

    // Use transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Try to create check-in (unique constraint will catch duplicates)
      let checkin;
      try {
        checkin = await tx.futureSelfCheckin.create({
          data: {
            commitmentId,
            checkinDate: today,
            note: note || null,
          },
        });
      } catch (error: unknown) {
        // Prisma unique constraint violation
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
          throw new ConflictException('You\'ve already checked in today. Keep up the great work!');
        }
        throw error;
      }

      // Increment streak and update lastCheckinDate
      const newStreakDays = commitment.streakDays + 1;
      const newLongestStreak = Math.max(commitment.longestStreak, newStreakDays);

      const updated = await tx.futureSelfCommitment.update({
        where: { id: commitmentId },
        data: {
          streakDays: newStreakDays,
          longestStreak: newLongestStreak,
          lastCheckinDate: today,
        },
      });

      return {
        checkin,
        streakDays: updated.streakDays,
        longestStreak: updated.longestStreak,
      };
    });

    // Check for milestone celebration (non-blocking)
    if (this.STREAK_MILESTONES.includes(result.streakDays)) {
      this.handleStreakMilestone(userId, commitment, result.streakDays).catch((err) => {
        this.logger.warn(`Failed to handle streak milestone: ${err instanceof Error ? err.message : 'Unknown'}`);
      });
    }

    this.logger.log(`Check-in recorded for user ${userId}, commitment ${commitmentId} (streak: ${result.streakDays})`);

    return {
      id: result.checkin.id,
      commitmentId: result.checkin.commitmentId,
      checkinDate: result.checkin.checkinDate,
      note: result.checkin.note,
      createdAt: result.checkin.createdAt,
      streakDays: result.streakDays,
      longestStreak: result.longestStreak,
    };
  }

  /**
   * Get check-in status for today
   */
  async getCheckinStatus(
    userId: string,
    commitmentId: string,
  ): Promise<{
    checkedInToday: boolean;
    streakDays: number;
    longestStreak: number;
    lastCheckinDate: Date | null;
  }> {
    const commitment = await this.prisma.futureSelfCommitment.findFirst({
      where: { id: commitmentId, userId },
    });
    if (!commitment) {
      throw new NotFoundException('Commitment not found');
    }

    const today = this.getTodayInLagos();
    const todayCheckin = await this.prisma.futureSelfCheckin.findUnique({
      where: {
        commitmentId_checkinDate: {
          commitmentId,
          checkinDate: today,
        },
      },
    });

    return {
      checkedInToday: !!todayCheckin,
      streakDays: commitment.streakDays,
      longestStreak: commitment.longestStreak,
      lastCheckinDate: commitment.lastCheckinDate,
    };
  }

  /**
   * Get paginated check-in history for a commitment
   */
  async getCheckinHistory(
    userId: string,
    commitmentId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{
    checkins: Array<{
      id: string;
      commitmentId: string;
      checkinDate: Date;
      note: string | null;
      createdAt: Date;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    // Verify ownership
    const commitment = await this.prisma.futureSelfCommitment.findFirst({
      where: { id: commitmentId, userId },
    });
    if (!commitment) {
      throw new NotFoundException('Commitment not found');
    }

    const cappedLimit = Math.min(Math.max(1, limit), 50);
    const cappedOffset = Math.max(0, offset);

    const [checkins, total] = await Promise.all([
      this.prisma.futureSelfCheckin.findMany({
        where: { commitmentId },
        orderBy: { checkinDate: 'desc' },
        take: cappedLimit + 1,
        skip: cappedOffset,
      }),
      this.prisma.futureSelfCheckin.count({
        where: { commitmentId },
      }),
    ]);

    const hasMore = checkins.length > cappedLimit;
    const displayCheckins = checkins.slice(0, cappedLimit);

    return {
      checkins: displayCheckins.map(c => ({
        id: c.id,
        commitmentId: c.commitmentId,
        checkinDate: c.checkinDate,
        note: c.note,
        createdAt: c.createdAt,
      })),
      total,
      hasMore,
    };
  }

  /**
   * Get today's date in Africa/Lagos timezone as a Date object (midnight UTC representation)
   */
  private getTodayInLagos(): Date {
    const now = new Date();
    // Africa/Lagos is UTC+1 (WAT, no DST)
    const lagosOffset = 1; // hours
    const lagosTime = new Date(now.getTime() + lagosOffset * 60 * 60 * 1000);
    const year = lagosTime.getUTCFullYear();
    const month = lagosTime.getUTCMonth();
    const day = lagosTime.getUTCDate();
    return new Date(Date.UTC(year, month, day));
  }

  /**
   * Handle streak milestone celebrations (non-blocking)
   */
  private async handleStreakMilestone(
    userId: string,
    commitment: { dailyAmount: unknown; currency: string },
    streakDays: number,
  ): Promise<void> {
    const totalSaved = Number(commitment.dailyAmount) * streakDays;
    const formattedTotal = this.formatCurrency(totalSaved, commitment.currency);

    this.logger.log(
      `Streak milestone reached! User ${userId}: ${streakDays}-day streak, ${formattedTotal} total saved`,
    );

    // Emit in-app notification event (GPS notification pattern)
    try {
      await this.prisma.gpsNotification.create({
        data: {
          userId,
          triggerType: 'BUDGET_WARNING', // Reuse existing trigger type for milestone
          categoryId: 'future-self',
          categoryName: 'Future Self',
          title: `${streakDays}-day streak!`,
          message: `You've saved ${formattedTotal} so far. Your future self is doing a happy dance!`,
          actionUrl: '/dashboard/future-self',
          metadata: { type: 'FUTURE_SELF_MILESTONE', streakDays, totalSaved },
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to create milestone notification: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // ==========================================
  // WEEKLY DEBRIEF METHODS
  // ==========================================

  /**
   * Get weekly debrief letters for a user
   *
   * Filters letter history by WEEKLY_DEBRIEF trigger type.
   */
  async getWeeklyDebriefs(
    userId: string,
    limit: number = 10,
  ): Promise<Array<{
    id: string;
    content: string;
    trigger: string;
    generatedAt: Date;
    readAt: Date | null;
    toneScore: number | null;
  }>> {
    const letters = await this.prisma.futureSelfLetter.findMany({
      where: {
        userId,
        trigger: LetterTrigger.WEEKLY_DEBRIEF,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        trigger: true,
        createdAt: true,
        readAt: true,
        toneEmpathyScore: true,
      },
    });

    return letters.map(l => ({
      id: l.id,
      content: l.content,
      trigger: l.trigger,
      generatedAt: l.createdAt,
      readAt: l.readAt,
      toneScore: l.toneEmpathyScore,
    }));
  }

  // ==========================================
  // EVENT-TRIGGERED LETTER GENERATION
  // ==========================================

  /**
   * Generate a triggered letter (POST_DECISION or GOAL_MILESTONE)
   *
   * Uses a trigger-specific prompt builder and shorter TTLs.
   * Reuses existing caching/idempotency patterns.
   */
  async generateTriggeredLetter(
    userId: string,
    trigger: LetterTrigger,
    eventContext: {
      expenseDescription?: string;
      expenseAmount?: number;
      goalName?: string;
      goalAmount?: number;
      currentAmount?: number;
      milestone?: number;
      currency?: string;
    },
  ): Promise<void> {
    // Idempotency: prevent duplicate triggered letters within 5 minutes
    const idempotencyKey = `${LETTER_IDEMPOTENCY_KEY_PREFIX}:triggered:${userId}:${trigger}`;
    let acquiredLock = false;
    try {
      acquiredLock = await this.redisService.setNx(idempotencyKey, { startedAt: Date.now() }, 300);
    } catch {
      acquiredLock = true; // If Redis fails, proceed anyway
    }
    if (!acquiredLock) {
      this.logger.debug(`Triggered letter already in progress for user ${userId} (${trigger})`);
      return;
    }

    // Create Opik trace for event-triggered letter
    let trace: TrackedTrace | null = null;
    try {
      trace = this.opikService.createTrace({
        name: TRACE_FUTURE_SELF_TRIGGERED,
        input: { userId, trigger, eventContext },
        metadata: {
          agent: 'future_self',
          version: '1.0',
          triggerType: trigger,
        },
        tags: ['future-self', 'event-trigger', trigger],
      });
    } catch {
      // Tracing is best-effort
    }

    try {
      // Get user data for prompt context
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, currency: true },
      });
      if (!user) {
        this.safeEndTrace(trace, { success: false, error: 'User not found' });
        return;
      }

      const currency = eventContext.currency || user.currency || 'NGN';
      const name = user.name || 'Friend';

      // Build trigger-specific prompt
      let prompt: string;

      if (trigger === LetterTrigger.POST_DECISION && eventContext.expenseAmount) {
        const dailyEquivalent = Math.round(eventContext.expenseAmount / 30);
        prompt = buildPostDecisionPrompt(
          name,
          eventContext.expenseDescription || 'a purchase',
          this.formatCurrency(eventContext.expenseAmount, currency),
          currency,
          this.formatCurrency(dailyEquivalent, currency),
        );
      } else if (trigger === LetterTrigger.GOAL_MILESTONE && eventContext.goalName) {
        prompt = buildMilestonePrompt(
          name,
          eventContext.goalName,
          eventContext.milestone || 0,
          this.formatCurrency(eventContext.goalAmount || 0, currency),
          this.formatCurrency(eventContext.currentAmount || 0, currency),
          currency,
        );
      } else {
        this.logger.warn(`Unknown trigger type or missing context: ${trigger}`);
        this.safeEndTrace(trace, { success: false, error: 'Unknown trigger or missing context' });
        return;
      }

      // Generate via Anthropic
      const response = await this.anthropicService.generate(
        prompt,
        LETTER_MAX_TOKENS,
        LETTER_SYSTEM_PROMPT,
      );

      const content = response.content;

      // Run through content moderation
      const moderation = this.contentModeration.moderate(content);
      if (!moderation.passed) {
        this.logger.warn(`Triggered letter failed moderation for user ${userId}: ${moderation.flags.join(', ')}`);
        this.safeEndTrace(trace, { success: false, error: `Moderation failed: ${moderation.flags.join(', ')}` });
        return;
      }

      // Persist to database
      await this.prisma.futureSelfLetter.create({
        data: {
          userId,
          content,
          trigger,
          currentSavingsRate: 0,
          optimizedSavingsRate: 0,
          currentNetWorth20yr: 0,
          optimizedNetWorth20yr: 0,
          wealthDifference20yr: 0,
          userAge: 0,
          futureAge: 60,
          toneEmpathyScore: null,
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
        },
      });

      this.safeEndTrace(trace, {
        success: true,
        result: {
          trigger,
          letterLength: content.length,
          promptTokens: response.usage?.promptTokens || 0,
        },
      });
      this.logger.log(`Triggered letter (${trigger}) generated for user ${userId}`);

      // Invalidate letter cache so next request picks up the new letter
      await this.invalidateCache(userId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.safeEndTrace(trace, { success: false, error: errorMessage });
      this.logger.error(
        `Failed to generate triggered letter for user ${userId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Safely end an Opik trace with error protection
   */
  private safeEndTrace(
    trace: TrackedTrace | null,
    result: { success: boolean; result?: Record<string, unknown>; error?: string },
  ): void {
    if (!trace) return;
    try {
      this.opikService.endTrace(trace, result);
    } catch {
      // Trace ending failed, continue
    }
  }

  /**
   * Format currency for triggered letter prompts
   */
  private formatCurrency(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
      NGN: '\u20A6', GHS: 'GH\u20B5', KES: 'KSh', ZAR: 'R', USD: '$', GBP: '\u00A3',
    };
    return `${symbols[currency] || currency}${amount.toLocaleString()}`;
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  /**
   * Invalidate cache for a user
   *
   * Should be called when user's financial data changes.
   * Failures are logged but don't throw - stale cache is acceptable.
   *
   * @param userId - The user's ID
   */
  async invalidateCache(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.redisService.del(SIMULATION_CACHE_KEY(userId)),
        this.redisService.del(LETTER_CACHE_KEY(userId)),
      ]);

      this.logger.debug(`Cache invalidated for user: ${userId}`);
    } catch (error) {
      this.logger.warn(
        `Redis cache invalidation failed for user (${userId}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - stale cache is acceptable, will expire via TTL
    }
  }

  /**
   * Get letter statistics for analytics
   *
   * @param userId - The user's ID
   * @returns Letter engagement statistics
   */
  async getLetterStats(userId: string): Promise<{
    totalLetters: number;
    readLetters: number;
    avgReadDurationMs: number | null;
    avgToneScore: number | null;
  }> {
    const stats = await this.prisma.futureSelfLetter.aggregate({
      where: { userId },
      _count: { id: true },
      _avg: {
        readDurationMs: true,
        toneEmpathyScore: true,
      },
    });

    const readCount = await this.prisma.futureSelfLetter.count({
      where: {
        userId,
        readAt: { not: null },
      },
    });

    return {
      totalLetters: stats._count.id,
      readLetters: readCount,
      avgReadDurationMs: stats._avg.readDurationMs,
      avgToneScore: stats._avg.toneEmpathyScore,
    };
  }
}
