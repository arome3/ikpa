import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { StoryCardsService } from '../story-cards.service';
import { StoryCardsGenerationService } from '../services/story-cards-generation.service';
import { StoryCardsAnalyticsService } from '../services/story-cards-analytics.service';
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
} from '../exceptions';

describe('StoryCardsService', () => {
  let service: StoryCardsService;
  let prismaService: {
    storyCard: {
      findFirst: Mock;
      findUnique: Mock;
      findMany: Mock;
      create: Mock;
      update: Mock;
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
    };
    futureSelfLetter: { findFirst: Mock };
    commitmentContract: { findFirst: Mock };
    goal: { findFirst: Mock };
    recoverySession: { findFirst: Mock };
  };
  let redisService: {
    get: Mock;
    set: Mock;
    del: Mock;
  };

  const mockUserId = 'user-123';
  const mockCardId = 'card-456';
  const mockSourceId = 'source-789';

  const mockLetter = {
    id: mockSourceId,
    userId: mockUserId,
    content: 'Test letter content.',
    userAge: 28,
    futureAge: 60,
    currentNetWorth20yr: 1000000,
    wealthDifference20yr: 2850000,
    currentSavingsRate: 0.1,
    optimizedSavingsRate: 0.25,
    createdAt: new Date(),
  };

  const mockCard = {
    id: mockCardId,
    userId: mockUserId,
    type: 'FUTURE_SELF' as StoryCardType,
    headline: 'A Letter From My Future Self',
    subheadline: 'received a letter from their 60-year-old self',
    keyMetricLabel: 'Potential 20-year wealth gain',
    keyMetricValue: '+285%',
    quote: 'Test quote',
    shareUrl: 'https://ikpa.app/share/abc123',
    platforms: ['TWITTER', 'LINKEDIN', 'WHATSAPP'],
    hashtags: ['#FutureMe', '#FinancialJourney'],
    gradient: ['#667EEA', '#764BA2'],
    anonymizeAmounts: true,
    revealActualNumbers: false,
    includePersonalData: false,
    sourceId: mockSourceId,
    viewCount: 0,
    referralCode: 'abc12345',
    isPublic: true,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      storyCard: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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
      },
      futureSelfLetter: { findFirst: vi.fn() },
      commitmentContract: { findFirst: vi.fn() },
      goal: { findFirst: vi.fn() },
      recoverySession: { findFirst: vi.fn() },
    };

    const mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    const mockCalculator = {
      generateContent: vi.fn().mockReturnValue({
        headline: 'A Letter From My Future Self',
        subheadline: 'received a letter from their 60-year-old self',
        keyMetric: { label: 'Potential 20-year wealth gain', value: '+285%' },
        quote: 'Test quote',
        hashtags: ['#FutureMe', '#FinancialJourney'],
        gradient: ['#667EEA', '#764BA2'],
      }),
    };

    const mockOpikService = {
      createTrace: vi.fn().mockReturnValue({ trace: {} }),
      endTrace: vi.fn(),
    };

    const mockEventEmitter = {
      emit: vi.fn(),
    };

    const mockMetrics = {
      incCardsGenerated: vi.fn(),
      incShares: vi.fn(),
      incCacheHit: vi.fn(),
      incCacheMiss: vi.fn(),
      incViews: vi.fn(),
      incHealthCheck: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoryCardsService,
        StoryCardsGenerationService,
        StoryCardsAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: CardContentCalculator, useValue: mockCalculator },
        { provide: OpikService, useValue: mockOpikService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: StoryCardsMetrics, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<StoryCardsService>(StoryCardsService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
  });

  describe('generateCard', () => {
    const generateInput = {
      type: 'FUTURE_SELF' as StoryCardType,
      sourceId: mockSourceId,
      anonymizeAmounts: true,
    };

    it('should generate a card successfully', async () => {
      // Setup mocks
      prismaService.storyCard.count.mockResolvedValue(0);
      prismaService.futureSelfLetter.findFirst.mockResolvedValue(mockLetter);
      prismaService.storyCard.create.mockResolvedValue(mockCard);

      const result = await service.generateCard(mockUserId, generateInput);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockCardId);
      expect(result.type).toBe('FUTURE_SELF');
      expect(result.headline).toBe('A Letter From My Future Self');
      expect(prismaService.storyCard.create).toHaveBeenCalled();
    });

    it('should throw StoryCardSourceNotFoundException when source not found', async () => {
      prismaService.storyCard.count.mockResolvedValue(0);
      prismaService.futureSelfLetter.findFirst.mockResolvedValue(null);

      await expect(service.generateCard(mockUserId, generateInput)).rejects.toThrow(
        StoryCardSourceNotFoundException,
      );
    });

    it('should throw StoryCardLimitExceededException when daily limit exceeded', async () => {
      // First call returns total, second call returns today's count
      prismaService.storyCard.count
        .mockResolvedValueOnce(5) // total cards
        .mockResolvedValueOnce(10); // today's cards (at limit)

      await expect(service.generateCard(mockUserId, generateInput)).rejects.toThrow(
        StoryCardLimitExceededException,
      );
    });

    it('should throw StoryCardLimitExceededException when total limit exceeded', async () => {
      prismaService.storyCard.count.mockResolvedValue(100); // at total limit

      await expect(service.generateCard(mockUserId, generateInput)).rejects.toThrow(
        StoryCardLimitExceededException,
      );
    });
  });

  describe('getCardById', () => {
    it('should return card from cache if available', async () => {
      const cachedCard = { ...mockCard };
      redisService.get.mockResolvedValue(cachedCard);

      const result = await service.getCardById(mockUserId, mockCardId);

      expect(result).toBeDefined();
      expect(redisService.get).toHaveBeenCalled();
      expect(prismaService.storyCard.findFirst).not.toHaveBeenCalled();
    });

    it('should return card from database if not in cache', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(mockCard);

      const result = await service.getCardById(mockUserId, mockCardId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockCardId);
      expect(prismaService.storyCard.findFirst).toHaveBeenCalled();
    });

    it('should throw StoryCardNotFoundException when card not found', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findFirst.mockResolvedValue(null);

      await expect(service.getCardById(mockUserId, mockCardId)).rejects.toThrow(
        StoryCardNotFoundException,
      );
    });
  });

  describe('getUserCards', () => {
    it('should return paginated cards', async () => {
      const mockCards = [mockCard];
      prismaService.storyCard.findMany.mockResolvedValue(mockCards);
      prismaService.storyCard.count.mockResolvedValue(1);

      const result = await service.getUserCards(mockUserId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      prismaService.storyCard.findMany.mockResolvedValue([]);
      prismaService.storyCard.count.mockResolvedValue(25);

      const result = await service.getUserCards(mockUserId, { page: 2, limit: 10 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  describe('trackShare', () => {
    it('should create share event successfully', async () => {
      prismaService.storyCard.findFirst.mockResolvedValue({
        id: mockCardId,
        referralCode: 'abc12345',
      });
      prismaService.shareEvent.create.mockResolvedValue({
        id: 'event-123',
        cardId: mockCardId,
        platform: 'TWITTER' as SharePlatform,
        sharedAt: new Date(),
        referralCode: 'abc12345',
      });

      const result = await service.trackShare(mockUserId, mockCardId, {
        platform: 'TWITTER' as SharePlatform,
      });

      expect(result.id).toBe('event-123');
      expect(result.platform).toBe('TWITTER');
      expect(prismaService.shareEvent.create).toHaveBeenCalled();
    });

    it('should throw StoryCardNotFoundException when card not found', async () => {
      prismaService.storyCard.findFirst.mockResolvedValue(null);

      await expect(
        service.trackShare(mockUserId, mockCardId, {
          platform: 'TWITTER' as SharePlatform,
        }),
      ).rejects.toThrow(StoryCardNotFoundException);
    });
  });

  describe('getViralMetrics', () => {
    it('should return viral metrics', async () => {
      prismaService.storyCard.count.mockResolvedValue(5);
      prismaService.storyCard.groupBy.mockResolvedValue([
        { type: 'FUTURE_SELF', _count: { id: 3 } },
        { type: 'MILESTONE', _count: { id: 2 } },
      ]);
      prismaService.storyCard.aggregate.mockResolvedValue({
        _sum: { viewCount: 150 },
      });
      prismaService.shareEvent.findMany.mockResolvedValue([
        { platform: 'TWITTER', signupUserId: null },
        { platform: 'TWITTER', signupUserId: 'user-new' },
        { platform: 'LINKEDIN', signupUserId: null },
      ]);
      prismaService.shareEvent.count.mockResolvedValue(1);

      const result = await service.getViralMetrics(mockUserId);

      expect(result.totalCards).toBe(5);
      expect(result.totalShares).toBe(3);
      expect(result.totalViews).toBe(150);
      expect(result.signupsFromShares).toBe(1);
      expect(result.viralCoefficient).toBeCloseTo(0.333, 2);
      expect(result.sharesByPlatform.TWITTER).toBe(2);
      expect(result.sharesByPlatform.LINKEDIN).toBe(1);
    });

    it('should return metrics from cache if available', async () => {
      const cachedMetrics = {
        totalCards: 5,
        totalShares: 10,
        sharesByPlatform: { TWITTER: 5, LINKEDIN: 3, WHATSAPP: 2, INSTAGRAM: 0 },
        totalViews: 100,
        signupsFromShares: 2,
        viralCoefficient: 0.2,
        topPerformingType: 'MILESTONE',
        sharesByType: { FUTURE_SELF: 2, COMMITMENT: 1, MILESTONE: 4, RECOVERY: 3 },
        averageViewsPerCard: 20,
        conversionRate: 0.1,
      };
      redisService.get.mockResolvedValue(cachedMetrics);

      const result = await service.getViralMetrics(mockUserId);

      expect(result).toEqual(cachedMetrics);
      expect(prismaService.storyCard.count).not.toHaveBeenCalled();
    });
  });

  describe('getPublicCard', () => {
    it('should return public card data', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findUnique.mockResolvedValue(mockCard);
      prismaService.storyCard.update.mockResolvedValue({ ...mockCard, viewCount: 1 });

      const result = await service.getPublicCard('abc123');

      expect(result.card).toBeDefined();
      expect(result.card.headline).toBe('A Letter From My Future Self');
      expect(result.referralCode).toBe('abc12345');
      expect(result.ogMeta.title).toContain('IKPA');
    });

    it('should throw StoryCardNotFoundException when card not found', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.storyCard.findUnique.mockResolvedValue(null);

      await expect(service.getPublicCard('nonexistent')).rejects.toThrow(
        StoryCardNotFoundException,
      );
    });
  });
});
