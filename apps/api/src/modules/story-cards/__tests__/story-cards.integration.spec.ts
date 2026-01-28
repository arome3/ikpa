/**
 * Story Cards Integration Tests
 *
 * Integration tests for the Story Cards viral sharing system.
 * Tests complete flows with mocked Prisma and Redis at the service level.
 *
 * Run tests with: npm test src/modules/story-cards/__tests__/story-cards.integration.spec.ts
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StoryCardsService } from '../story-cards.service';
import { CardContentCalculator } from '../calculators';
import { StoryCardsMetrics } from '../story-cards.metrics';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { OpikService } from '../../ai/opik/opik.service';
import { StoryCardType, SharePlatform } from '@prisma/client';
import {
  StoryCardNotFoundException,
  StoryCardSourceNotFoundException,
  StoryCardLimitExceededException,
  StoryCardExpiredException,
} from '../exceptions';
import { STORY_CARD_EVENTS } from '../story-cards.events';

// ==========================================
// TEST DATA FACTORIES
// ==========================================

const createMockUser = (overrides = {}) => ({
  id: 'user-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'testuser@example.com',
  ...overrides,
});

const createMockLetter = (userId: string, overrides = {}) => ({
  id: 'letter-f1e2d3c4-b5a6-7890-1234-567890abcdef',
  userId,
  content:
    'Dear Future Me, That N20,000 you saved in January 2026? It became N5,000,000 by 2045. Your commitment to saving 25% of your income paid off massively. I am so proud of the choices you made. Remember when you thought you could not afford to save? Look at what discipline brought us. Keep going!',
  userAge: 28,
  futureAge: 60,
  currentNetWorth20yr: 1000000,
  wealthDifference20yr: 2850000,
  currentSavingsRate: 0.1,
  optimizedSavingsRate: 0.25,
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
  ...overrides,
});

const createMockCommitment = (userId: string, overrides = {}) => ({
  id: 'contract-a1b2c3d4-e5f6-7890-1234-567890abcdef',
  userId,
  goalId: 'goal-b2c3d4e5-f6a7-8901-2345-678901bcdef0',
  stakeType: 'ANTI_CHARITY',
  stakeAmount: 50000,
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date('2024-01-10T08:00:00Z'),
  goal: { name: 'Emergency Fund' },
  ...overrides,
});

const createMockGoal = (userId: string, overrides = {}) => ({
  id: 'goal-c3d4e5f6-a7b8-9012-3456-789012cdef01',
  userId,
  name: 'New Laptop',
  targetAmount: 500000,
  currentAmount: 500000,
  status: 'COMPLETED',
  category: 'MAJOR_PURCHASE',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-04-01T12:00:00Z'),
  ...overrides,
});

const createMockRecoverySession = (userId: string, overrides = {}) => ({
  id: 'session-d4e5f6a7-b8c9-0123-4567-890123def012',
  userId,
  category: 'Entertainment',
  overspendAmount: 25000,
  previousProbability: 0.65,
  newProbability: 0.82,
  status: 'COMPLETED',
  selectedPathId: 'category_freeze',
  createdAt: new Date('2024-02-15T14:00:00Z'),
  updatedAt: new Date('2024-02-15T15:30:00Z'),
  ...overrides,
});

const createMockCard = (userId: string, overrides = {}) => ({
  id: 'card-e5f6a7b8-c9d0-1234-5678-901234ef0123',
  userId,
  type: 'FUTURE_SELF' as StoryCardType,
  headline: 'A Letter From My Future Self',
  subheadline: 'Just received a letter from my 60-year-old self',
  keyMetricLabel: 'Potential 20-year wealth gain',
  keyMetricValue: '+285%',
  quote: 'Your commitment to saving 25% of your income paid off massively.',
  shareUrl: 'https://ikpa.app/share/abc123def456',
  platforms: ['TWITTER', 'LINKEDIN', 'WHATSAPP'],
  hashtags: ['#FutureMe', '#FinancialJourney', '#IKPA'],
  gradient: ['#667EEA', '#764BA2'],
  gradientIndex: 0,
  anonymizeAmounts: true,
  revealActualNumbers: false,
  includePersonalData: false,
  sourceId: 'letter-f1e2d3c4-b5a6-7890-1234-567890abcdef',
  viewCount: 0,
  referralCode: 'ref12345',
  isPublic: true,
  isActive: true,
  expiresAt: null,
  idempotencyKey: null,
  createdAt: new Date('2024-01-15T11:00:00Z'),
  updatedAt: new Date('2024-01-15T11:00:00Z'),
  ...overrides,
});

const createMockShareEvent = (cardId: string, overrides = {}) => ({
  id: 'event-f6a7b8c9-d0e1-2345-6789-012345f01234',
  cardId,
  platform: 'TWITTER' as SharePlatform,
  sharedAt: new Date('2024-01-15T12:00:00Z'),
  referralCode: 'ref12345',
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
  signupUserId: null,
  ...overrides,
});

// ==========================================
// MOCK FACTORIES
// ==========================================

interface MockPrismaService {
  storyCard: {
    findFirst: Mock;
    findUnique: Mock;
    findMany: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
    count: Mock;
    aggregate: Mock;
    groupBy: Mock;
  };
  shareEvent: {
    create: Mock;
    findFirst: Mock;
    findMany: Mock;
    update: Mock;
    count: Mock;
    deleteMany: Mock;
    groupBy: Mock;
  };
  futureSelfLetter: { findFirst: Mock };
  commitmentContract: { findFirst: Mock };
  goal: { findFirst: Mock };
  recoverySession: { findFirst: Mock };
  $transaction: Mock;
  $queryRaw: Mock;
}

interface MockRedisService {
  get: Mock;
  set: Mock;
  del: Mock;
  acquireLock: Mock;
  releaseLock: Mock;
  exists: Mock;
  incr: Mock;
  expire: Mock;
}

const createMockPrismaService = (): MockPrismaService => ({
  storyCard: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  shareEvent: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn(),
  },
  futureSelfLetter: { findFirst: vi.fn() },
  commitmentContract: { findFirst: vi.fn() },
  goal: { findFirst: vi.fn() },
  recoverySession: { findFirst: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn().mockResolvedValue([]),
});

const createMockRedisService = (): MockRedisService => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  acquireLock: vi.fn().mockResolvedValue(true),
  releaseLock: vi.fn().mockResolvedValue(true),
  exists: vi.fn().mockResolvedValue(false),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
});

const createMockCalculator = () => ({
  generateContent: vi.fn().mockReturnValue({
    headline: 'A Letter From My Future Self',
    subheadline: 'Just received a letter from my 60-year-old self',
    keyMetric: { label: 'Potential 20-year wealth gain', value: '+285%' },
    quote: 'Your commitment to saving 25% of your income paid off massively.',
    hashtags: ['#FutureMe', '#FinancialJourney', '#IKPA'],
    gradient: ['#667EEA', '#764BA2'],
    gradientIndex: 0,
  }),
});

const createMockOpikService = () => ({
  createTrace: vi.fn().mockReturnValue({ trace: {} }),
  endTrace: vi.fn(),
});

const createMockEventEmitter = () => ({
  emit: vi.fn(),
});

// Mock factory for StoryCardsMetrics - exported for use in test setup
export const createMockMetrics = (): Partial<StoryCardsMetrics> => ({
  incCardsGenerated: vi.fn(),
  incShares: vi.fn(),
  incCacheHit: vi.fn(),
  incCacheMiss: vi.fn(),
  incViews: vi.fn(),
  incHealthCheck: vi.fn(),
  getSnapshot: vi.fn().mockReturnValue({
    story_cards_generated_total: {},
    story_cards_shares_total: { TWITTER: 0, LINKEDIN: 0, WHATSAPP: 0, INSTAGRAM: 0 },
    story_cards_cache_hits_total: 0,
    story_cards_cache_misses_total: 0,
    story_cards_views_total: 0,
    story_cards_health_check_total: 0,
    timestamp: new Date(),
  }),
  reset: vi.fn(),
});

// ==========================================
// INTEGRATION TESTS
// ==========================================

describe('Story Cards Integration Tests', () => {
  let service: StoryCardsService;
  let prismaService: MockPrismaService;
  let redisService: MockRedisService;
  let eventEmitter: { emit: Mock };

  const mockUser = createMockUser();

  beforeEach(() => {
    prismaService = createMockPrismaService();
    redisService = createMockRedisService();
    const mockCalculator = createMockCalculator();
    const mockOpikService = createMockOpikService();
    eventEmitter = createMockEventEmitter();
    const mockMetrics = createMockMetrics();

    // Instantiate service directly with mocks
    service = new StoryCardsService(
      prismaService as unknown as PrismaService,
      redisService as unknown as RedisService,
      mockOpikService as unknown as OpikService,
      mockCalculator as unknown as CardContentCalculator,
      eventEmitter as unknown as EventEmitter2,
      mockMetrics as unknown as StoryCardsMetrics,
    );
  });

  // ==========================================
  // 1. CARD GENERATION WITH SOURCE DATA LOOKUP
  // ==========================================

  describe('Card Generation with Source Data Lookup', () => {
    describe('FUTURE_SELF type', () => {
      it('should generate a card from a Future Self letter', async () => {
        const letter = createMockLetter(mockUser.id);
        const card = createMockCard(mockUser.id, { sourceId: letter.id });

        prismaService.storyCard.count.mockResolvedValue(0);
        prismaService.storyCard.findFirst.mockResolvedValue(null); // No collision
        prismaService.futureSelfLetter.findFirst.mockResolvedValue(letter);

        // Mock the $transaction to execute callback and return the card
        prismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          const txClient = {
            storyCard: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(card),
            },
          };
          return callback(txClient);
        });

        const result = await service.generateCard(mockUser.id, {
          type: 'FUTURE_SELF',
          sourceId: letter.id,
          anonymizeAmounts: true,
        });

        expect(result).toBeDefined();
        expect(result.type).toBe('FUTURE_SELF');
        expect(result.headline).toBe('A Letter From My Future Self');
        expect(result.keyMetric.value).toMatch(/%/);
        expect(prismaService.futureSelfLetter.findFirst).toHaveBeenCalledWith({
          where: { id: letter.id, userId: mockUser.id },
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          STORY_CARD_EVENTS.CREATED,
          expect.objectContaining({
            cardId: card.id,
            userId: mockUser.id,
            type: 'FUTURE_SELF',
          }),
        );
      });

      it('should throw StoryCardSourceNotFoundException when letter not found', async () => {
        prismaService.storyCard.count.mockResolvedValue(0);
        prismaService.futureSelfLetter.findFirst.mockResolvedValue(null);

        await expect(
          service.generateCard(mockUser.id, {
            type: 'FUTURE_SELF',
            sourceId: 'nonexistent-letter-id',
          }),
        ).rejects.toThrow(StoryCardSourceNotFoundException);
      });
    });

    describe('COMMITMENT type', () => {
      it('should generate a card from a commitment contract', async () => {
        const commitment = createMockCommitment(mockUser.id);
        const card = createMockCard(mockUser.id, {
          type: 'COMMITMENT',
          sourceId: commitment.id,
          headline: 'I Made a Commitment',
        });

        prismaService.storyCard.count.mockResolvedValue(0);
        prismaService.storyCard.findFirst.mockResolvedValue(null);
        prismaService.commitmentContract.findFirst.mockResolvedValue(commitment);

        // Mock the $transaction to execute callback and return the card
        prismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          const txClient = {
            storyCard: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(card),
            },
          };
          return callback(txClient);
        });

        const result = await service.generateCard(mockUser.id, {
          type: 'COMMITMENT',
          sourceId: commitment.id,
        });

        expect(result.type).toBe('COMMITMENT');
        expect(prismaService.commitmentContract.findFirst).toHaveBeenCalledWith({
          where: { id: commitment.id, userId: mockUser.id },
          include: { goal: { select: { name: true } } },
        });
      });
    });

    describe('MILESTONE type', () => {
      it('should generate a card from a completed goal', async () => {
        const goal = createMockGoal(mockUser.id);
        const card = createMockCard(mockUser.id, {
          type: 'MILESTONE',
          sourceId: goal.id,
          headline: 'Goal Achieved!',
        });

        prismaService.storyCard.count.mockResolvedValue(0);
        prismaService.storyCard.findFirst.mockResolvedValue(null);
        prismaService.goal.findFirst.mockResolvedValue(goal);

        // Mock the $transaction to execute callback and return the card
        prismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          const txClient = {
            storyCard: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(card),
            },
          };
          return callback(txClient);
        });

        const result = await service.generateCard(mockUser.id, {
          type: 'MILESTONE',
          sourceId: goal.id,
        });

        expect(result.type).toBe('MILESTONE');
        expect(prismaService.goal.findFirst).toHaveBeenCalledWith({
          where: { id: goal.id, userId: mockUser.id, status: 'COMPLETED' },
        });
      });

      it('should throw when goal is not completed', async () => {
        prismaService.storyCard.count.mockResolvedValue(0);
        prismaService.goal.findFirst.mockResolvedValue(null);

        await expect(
          service.generateCard(mockUser.id, {
            type: 'MILESTONE',
            sourceId: 'incomplete-goal-id',
          }),
        ).rejects.toThrow(StoryCardSourceNotFoundException);
      });
    });

    describe('RECOVERY type', () => {
      it('should generate a card from a recovery session', async () => {
        const session = createMockRecoverySession(mockUser.id);
        const card = createMockCard(mockUser.id, {
          type: 'RECOVERY',
          sourceId: session.id,
          headline: 'Back on Track',
        });

        prismaService.storyCard.count.mockResolvedValue(0);
        prismaService.storyCard.findFirst.mockResolvedValue(null);
        prismaService.recoverySession.findFirst.mockResolvedValue(session);

        // Mock the $transaction to execute callback and return the card
        prismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
          const txClient = {
            storyCard: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(card),
            },
          };
          return callback(txClient);
        });

        const result = await service.generateCard(mockUser.id, {
          type: 'RECOVERY',
          sourceId: session.id,
        });

        expect(result.type).toBe('RECOVERY');
        expect(prismaService.recoverySession.findFirst).toHaveBeenCalledWith({
          where: { id: session.id, userId: mockUser.id, status: 'COMPLETED' },
        });
      });
    });
  });

  // ==========================================
  // 2. CARD RETRIEVAL WITH CACHE HIT/MISS
  // ==========================================

  describe('Card Retrieval with Cache Hit/Miss Scenarios', () => {
    it('should return card from cache on cache hit', async () => {
      const card = createMockCard(mockUser.id);
      redisService.get.mockResolvedValue(card);

      const result = await service.getCardById(mockUser.id, card.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(card.id);
      expect(redisService.get).toHaveBeenCalled();
      expect(prismaService.storyCard.findFirst).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache on cache miss', async () => {
      const card = createMockCard(mockUser.id);
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(card);

      const result = await service.getCardById(mockUser.id, card.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(card.id);
      expect(prismaService.storyCard.findFirst).toHaveBeenCalledWith({
        where: { id: card.id, userId: mockUser.id, isActive: true },
      });
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should throw StoryCardNotFoundException when card not in cache or database', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(null);

      await expect(
        service.getCardById(mockUser.id, 'nonexistent-card-id'),
      ).rejects.toThrow(StoryCardNotFoundException);
    });

    it('should throw StoryCardExpiredException for expired cards', async () => {
      const expiredCard = createMockCard(mockUser.id, {
        expiresAt: new Date('2023-01-01T00:00:00Z'),
      });
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(expiredCard);

      await expect(
        service.getCardById(mockUser.id, expiredCard.id),
      ).rejects.toThrow(StoryCardExpiredException);
    });

    it('should gracefully handle cache read errors', async () => {
      const card = createMockCard(mockUser.id);
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));
      prismaService.storyCard.findFirst.mockResolvedValue(card);

      const result = await service.getCardById(mockUser.id, card.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(card.id);
    });

    it('should return cached viral metrics on cache hit', async () => {
      const cachedMetrics = {
        totalCards: 5,
        totalShares: 12,
        sharesByPlatform: { TWITTER: 5, LINKEDIN: 4, WHATSAPP: 3, INSTAGRAM: 0 },
        totalViews: 150,
        signupsFromShares: 3,
        viralCoefficient: 0.25,
        topPerformingType: 'FUTURE_SELF',
        sharesByType: { FUTURE_SELF: 6, COMMITMENT: 3, MILESTONE: 2, RECOVERY: 1 },
        cardsByType: { FUTURE_SELF: 2, COMMITMENT: 1, MILESTONE: 1, RECOVERY: 1 },
        averageViewsPerCard: 30,
        conversionRate: 0.08,
      };
      redisService.get.mockResolvedValue(cachedMetrics);

      const result = await service.getViralMetrics(mockUser.id);

      expect(result).toEqual(cachedMetrics);
      expect(prismaService.storyCard.count).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 3. SHARE TRACKING AND VIRAL METRICS
  // ==========================================

  describe('Share Tracking and Viral Metrics Calculation', () => {
    it('should track share event and emit SHARED event', async () => {
      const card = createMockCard(mockUser.id);
      const shareEvent = createMockShareEvent(card.id);

      prismaService.storyCard.findFirst.mockResolvedValue({
        id: card.id,
        referralCode: card.referralCode,
      });
      prismaService.shareEvent.create.mockResolvedValue(shareEvent);

      const result = await service.trackShare(mockUser.id, card.id, {
        platform: 'TWITTER',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test',
      });

      expect(result.id).toBe(shareEvent.id);
      expect(result.platform).toBe('TWITTER');
      expect(result.referralCode).toBe(card.referralCode);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        STORY_CARD_EVENTS.SHARED,
        expect.objectContaining({
          cardId: card.id,
          platform: 'TWITTER',
        }),
      );
    });

    it('should throw StoryCardNotFoundException when tracking share for non-owned card', async () => {
      prismaService.storyCard.findFirst.mockResolvedValue(null);

      await expect(
        service.trackShare(mockUser.id, 'other-users-card', {
          platform: 'LINKEDIN',
        }),
      ).rejects.toThrow(StoryCardNotFoundException);
    });

    it('should calculate viral metrics correctly', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.count.mockResolvedValue(5);
      prismaService.storyCard.groupBy.mockResolvedValue([
        { type: 'FUTURE_SELF', _count: { id: 2 } },
        { type: 'COMMITMENT', _count: { id: 1 } },
        { type: 'MILESTONE', _count: { id: 2 } },
      ]);
      prismaService.storyCard.aggregate.mockResolvedValue({
        _sum: { viewCount: 200 },
      });
      // Mock shareEvent groupBy for platform aggregation
      prismaService.shareEvent.groupBy.mockResolvedValue([
        { platform: 'TWITTER', _count: { id: 2 } },
        { platform: 'LINKEDIN', _count: { id: 1 } },
        { platform: 'WHATSAPP', _count: { id: 1 } },
      ]);
      // Mock $queryRaw for share events by card type
      prismaService.$queryRaw.mockResolvedValue([
        { type: 'FUTURE_SELF', count: BigInt(2) },
        { type: 'COMMITMENT', count: BigInt(1) },
        { type: 'MILESTONE', count: BigInt(1) },
      ]);
      prismaService.shareEvent.count.mockResolvedValue(2);

      const result = await service.getViralMetrics(mockUser.id);

      expect(result.totalCards).toBe(5);
      expect(result.totalShares).toBe(4);
      expect(result.totalViews).toBe(200);
      expect(result.signupsFromShares).toBe(2);
      expect(result.viralCoefficient).toBe(0.5); // 2 signups / 4 shares
      expect(result.sharesByPlatform.TWITTER).toBe(2);
      expect(result.sharesByPlatform.LINKEDIN).toBe(1);
      expect(result.sharesByPlatform.WHATSAPP).toBe(1);
      expect(result.sharesByType.FUTURE_SELF).toBe(2);
      expect(result.sharesByType.COMMITMENT).toBe(1);
      expect(result.sharesByType.MILESTONE).toBe(1);
      expect(result.averageViewsPerCard).toBe(40);
    });

    it('should link signup to share referral code', async () => {
      const shareEvent = createMockShareEvent('card-id', {
        referralCode: 'test-referral',
      });

      prismaService.shareEvent.findFirst.mockResolvedValue(shareEvent);
      prismaService.shareEvent.update.mockResolvedValue({
        ...shareEvent,
        signupUserId: 'new-user-id',
      });

      await service.linkSignupToShare('new-user-id', 'test-referral');

      expect(prismaService.shareEvent.findFirst).toHaveBeenCalledWith({
        where: { referralCode: 'test-referral' },
        orderBy: { sharedAt: 'desc' },
      });
      expect(prismaService.shareEvent.update).toHaveBeenCalledWith({
        where: { id: shareEvent.id },
        data: { signupUserId: 'new-user-id' },
      });
    });
  });

  // ==========================================
  // 4. PUBLIC CARD VIEWING WITH VIEW COUNT
  // ==========================================

  describe('Public Card Viewing with View Count Increment', () => {
    it('should return public card data and increment view count', async () => {
      const card = createMockCard(mockUser.id);

      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(card);
      prismaService.storyCard.update.mockResolvedValue({
        ...card,
        viewCount: 1,
      });

      const result = await service.getPublicCard('abc123def456');

      expect(result.card).toBeDefined();
      expect(result.card.headline).toBe(card.headline);
      expect(result.referralCode).toBe(card.referralCode);
      expect(result.ogMeta.title).toContain('IKPA');
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should return cached public card and still increment view', async () => {
      const cachedPageData = {
        card: {
          id: 'card-id',
          type: 'FUTURE_SELF',
          headline: 'Cached Headline',
          subheadline: 'Cached subheadline',
          keyMetric: { label: 'Test', value: '+100%' },
          gradient: ['#000', '#FFF'],
          hashtags: ['#Test'],
          viewCount: 10,
          createdAt: new Date(),
        },
        referralCode: 'cached-ref',
        ogMeta: {
          title: 'Cached Title | IKPA',
          description: 'Cached description',
          url: 'https://ikpa.app/share/cached',
        },
      };
      redisService.get.mockResolvedValue(cachedPageData);

      const result = await service.getPublicCard('cachedcode', '192.168.1.1');

      expect(result).toEqual(cachedPageData);
      expect(prismaService.storyCard.findFirst).not.toHaveBeenCalled();
    });

    it('should throw StoryCardNotFoundException for invalid share code', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(null);

      await expect(service.getPublicCard('invalidcode')).rejects.toThrow(
        StoryCardNotFoundException,
      );
    });

    it('should throw StoryCardExpiredException for expired public card', async () => {
      const expiredCard = createMockCard(mockUser.id, {
        expiresAt: new Date('2023-01-01T00:00:00Z'),
      });
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(expiredCard);

      await expect(service.getPublicCard('expiredcode')).rejects.toThrow(
        StoryCardExpiredException,
      );
    });
  });

  // ==========================================
  // 5. CARD DELETION (SOFT AND HARD)
  // ==========================================

  describe('Card Deletion (Soft and Hard)', () => {
    it('should soft delete a card by setting isActive to false', async () => {
      const card = createMockCard(mockUser.id);

      prismaService.storyCard.findFirst.mockResolvedValue(card);
      prismaService.storyCard.update.mockResolvedValue({
        ...card,
        isActive: false,
      });

      const result = await service.deleteCard(mockUser.id, card.id, false);

      expect(result.success).toBe(true);
      expect(result.deleteType).toBe('soft');
      expect(result.cardId).toBe(card.id);
      expect(prismaService.storyCard.update).toHaveBeenCalledWith({
        where: { id: card.id },
        data: { isActive: false },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        STORY_CARD_EVENTS.DELETED,
        expect.objectContaining({
          cardId: card.id,
          hardDelete: false,
        }),
      );
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should hard delete a card and its share events', async () => {
      const card = createMockCard(mockUser.id);

      prismaService.storyCard.findFirst.mockResolvedValue(card);
      prismaService.$transaction.mockResolvedValue([
        { count: 3 },
        card,
      ]);

      const result = await service.deleteCard(mockUser.id, card.id, true);

      expect(result.success).toBe(true);
      expect(result.deleteType).toBe('hard');
      expect(result.message).toContain('permanently deleted');
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        STORY_CARD_EVENTS.DELETED,
        expect.objectContaining({
          cardId: card.id,
          hardDelete: true,
        }),
      );
    });

    it('should throw StoryCardNotFoundException when deleting non-owned card', async () => {
      prismaService.storyCard.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCard(mockUser.id, 'other-users-card', false),
      ).rejects.toThrow(StoryCardNotFoundException);
    });
  });

  // ==========================================
  // 6. IDEMPOTENCY KEY HANDLING
  // ==========================================

  describe('Idempotency Key Handling', () => {
    it('should return existing card when idempotency key matches', async () => {
      const existingCard = createMockCard(mockUser.id, {
        idempotencyKey: 'generate-card-user123-source456-1704067200',
      });

      prismaService.storyCard.findUnique.mockResolvedValue(existingCard);

      const result = await service.generateCard(mockUser.id, {
        type: 'FUTURE_SELF',
        sourceId: 'any-source-id',
        idempotencyKey: 'generate-card-user123-source456-1704067200',
      });

      expect(result.id).toBe(existingCard.id);
      expect(prismaService.storyCard.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'generate-card-user123-source456-1704067200' },
      });
      expect(prismaService.storyCard.create).not.toHaveBeenCalled();
    });

    it('should create new card when idempotency key is new', async () => {
      const letter = createMockLetter(mockUser.id);
      const newCard = createMockCard(mockUser.id, {
        idempotencyKey: 'new-idempotency-key',
      });

      prismaService.storyCard.findUnique.mockResolvedValue(null);
      prismaService.storyCard.count.mockResolvedValue(0);
      prismaService.storyCard.findFirst.mockResolvedValue(null);
      prismaService.futureSelfLetter.findFirst.mockResolvedValue(letter);

      // Mock the $transaction to execute callback and return the card
      prismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const txClient = {
          storyCard: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(newCard),
          },
        };
        return callback(txClient);
      });

      const result = await service.generateCard(mockUser.id, {
        type: 'FUTURE_SELF',
        sourceId: letter.id,
        idempotencyKey: 'new-idempotency-key',
      });

      expect(result.id).toBe(newCard.id);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should enforce daily card limit', async () => {
      prismaService.storyCard.count
        .mockResolvedValueOnce(5) // total cards
        .mockResolvedValueOnce(10); // today's cards at limit

      await expect(
        service.generateCard(mockUser.id, {
          type: 'FUTURE_SELF',
          sourceId: 'source-id',
        }),
      ).rejects.toThrow(StoryCardLimitExceededException);
    });

    it('should enforce total card limit', async () => {
      prismaService.storyCard.count.mockResolvedValue(100); // at total limit

      await expect(
        service.generateCard(mockUser.id, {
          type: 'FUTURE_SELF',
          sourceId: 'source-id',
        }),
      ).rejects.toThrow(StoryCardLimitExceededException);
    });
  });

  // ==========================================
  // PAGINATION TESTS
  // ==========================================

  describe('Pagination', () => {
    it('should return paginated user cards correctly', async () => {
      const cards = [
        createMockCard(mockUser.id, { id: 'card-1' }),
        createMockCard(mockUser.id, { id: 'card-2' }),
      ];

      prismaService.storyCard.findMany.mockResolvedValue(cards);
      prismaService.storyCard.count.mockResolvedValue(25);

      const result = await service.getUserCards(mockUser.id, {
        page: 2,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle last page correctly', async () => {
      prismaService.storyCard.findMany.mockResolvedValue([]);
      prismaService.storyCard.count.mockResolvedValue(20);

      const result = await service.getUserCards(mockUser.id, {
        page: 3,
        limit: 10,
      });

      expect(result.pagination.page).toBe(3);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should enforce maximum limit of 100', async () => {
      prismaService.storyCard.findMany.mockResolvedValue([]);
      prismaService.storyCard.count.mockResolvedValue(0);

      await service.getUserCards(mockUser.id, { page: 1, limit: 200 });

      expect(prismaService.storyCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });
});
