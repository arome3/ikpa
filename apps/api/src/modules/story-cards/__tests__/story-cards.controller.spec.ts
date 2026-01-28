import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { StoryCardsController } from '../story-cards.controller';
import { StoryCardsService } from '../story-cards.service';
import { StoryCardType, SharePlatform } from '@prisma/client';

describe('StoryCardsController', () => {
  let controller: StoryCardsController;
  let storyCardsService: {
    generateCard: Mock;
    getCardById: Mock;
    getUserCards: Mock;
    trackShare: Mock;
    getViralMetrics: Mock;
  };

  const mockUserId = 'user-123';
  const mockCardId = 'card-456';

  const mockCard = {
    id: mockCardId,
    type: 'FUTURE_SELF' as StoryCardType,
    headline: 'A Letter From My Future Self',
    subheadline: 'received a letter from their 60-year-old self',
    keyMetric: { label: 'Potential 20-year wealth gain', value: '+285%' },
    quote: 'Test quote',
    shareUrl: 'https://ikpa.app/share/abc123',
    platforms: ['TWITTER', 'LINKEDIN', 'WHATSAPP'],
    hashtags: ['#FutureMe', '#FinancialJourney'],
    gradient: ['#667EEA', '#764BA2'],
    anonymizeAmounts: true,
    viewCount: 0,
    referralCode: 'abc12345',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      generateCard: vi.fn(),
      getCardById: vi.fn(),
      getUserCards: vi.fn(),
      trackShare: vi.fn(),
      getViralMetrics: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoryCardsController],
      providers: [
        { provide: StoryCardsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<StoryCardsController>(StoryCardsController);
    storyCardsService = module.get(StoryCardsService);
  });

  describe('generateCard', () => {
    it('should generate a card and return with generated flag', async () => {
      storyCardsService.generateCard.mockResolvedValue(mockCard);

      const result = await controller.generateCard(mockUserId, {
        type: 'FUTURE_SELF' as StoryCardType,
        sourceId: 'source-123',
        anonymizeAmounts: true,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockCardId);
      expect(result.generated).toBe(true);
      expect(storyCardsService.generateCard).toHaveBeenCalledWith(mockUserId, {
        type: 'FUTURE_SELF',
        sourceId: 'source-123',
        anonymizeAmounts: true,
        revealActualNumbers: undefined,
        includePersonalData: undefined,
      });
    });
  });

  describe('getCardById', () => {
    it('should return card by ID', async () => {
      storyCardsService.getCardById.mockResolvedValue(mockCard);

      const result = await controller.getCardById(mockUserId, mockCardId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockCardId);
      expect(storyCardsService.getCardById).toHaveBeenCalledWith(mockUserId, mockCardId);
    });
  });

  describe('getUserCards', () => {
    it('should return paginated cards for matching user', async () => {
      const mockResponse = {
        data: [mockCard],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      };
      storyCardsService.getUserCards.mockResolvedValue(mockResponse);

      const result = await controller.getUserCards(mockUserId, mockUserId, '1', '10');

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(storyCardsService.getUserCards).toHaveBeenCalledWith(mockUserId, {
        page: 1,
        limit: 10,
      });
    });

    it('should return empty list for non-matching user', async () => {
      const result = await controller.getUserCards(mockUserId, 'different-user', '1', '10');

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(storyCardsService.getUserCards).not.toHaveBeenCalled();
    });
  });

  describe('trackShare', () => {
    it('should track share event', async () => {
      const mockShareEvent = {
        id: 'event-123',
        cardId: mockCardId,
        platform: 'TWITTER' as SharePlatform,
        sharedAt: new Date(),
        referralCode: 'abc12345',
      };
      storyCardsService.trackShare.mockResolvedValue(mockShareEvent);

      const result = await controller.trackShare(mockUserId, mockCardId, {
        platform: 'TWITTER' as SharePlatform,
      });

      expect(result.id).toBe('event-123');
      expect(result.platform).toBe('TWITTER');
      expect(storyCardsService.trackShare).toHaveBeenCalledWith(mockUserId, mockCardId, {
        platform: 'TWITTER',
        ipAddress: undefined,
        userAgent: undefined,
      });
    });
  });

  describe('getViralMetrics', () => {
    it('should return viral metrics', async () => {
      const mockMetrics = {
        totalCards: 5,
        totalShares: 10,
        sharesByPlatform: {
          TWITTER: 5,
          LINKEDIN: 3,
          WHATSAPP: 2,
          INSTAGRAM: 0,
        },
        totalViews: 100,
        signupsFromShares: 2,
        viralCoefficient: 0.2,
        topPerformingType: 'MILESTONE' as StoryCardType,
        sharesByType: {
          FUTURE_SELF: 2,
          COMMITMENT: 1,
          MILESTONE: 4,
          RECOVERY: 3,
        },
        averageViewsPerCard: 20,
        conversionRate: 0.1,
      };
      storyCardsService.getViralMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getViralMetrics(mockUserId);

      expect(result.totalCards).toBe(5);
      expect(result.viralCoefficient).toBe(0.2);
      expect(storyCardsService.getViralMetrics).toHaveBeenCalledWith(mockUserId);
    });
  });
});
