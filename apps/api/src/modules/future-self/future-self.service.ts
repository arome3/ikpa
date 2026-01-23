/**
 * Future Self Service
 *
 * Orchestration layer for the Future Self Simulator feature.
 * Features:
 * - Redis caching for simulations (5 min TTL)
 * - Database persistence for letters (with history)
 * - Cache invalidation when user data changes
 */

import { Injectable, Logger } from '@nestjs/common';
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
} from './constants';
import { LetterTrigger } from '@prisma/client';

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
  ) {}

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
  ): Promise<LetterFromFuture & { id: string }> {
    const cacheKey = LETTER_CACHE_KEY(userId);
    const idempotencyKey = `${LETTER_IDEMPOTENCY_KEY_PREFIX}:${userId}`;

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
    const letter = await this.futureSelfAgent.generateLetter(userId);

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
