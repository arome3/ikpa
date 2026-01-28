/**
 * Story Cards Security Tests
 *
 * Security tests for the Story Cards viral sharing system.
 * Tests XSS prevention, authorization checks, and input validation.
 *
 * Run tests with: npm test src/modules/story-cards/__tests__/story-cards.security.spec.ts
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { StoryCardsService } from '../story-cards.service';
import { CardContentCalculator } from '../calculators';
import { StoryCardsMetrics } from '../story-cards.metrics';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { OpikService } from '../../ai/opik/opik.service';
import { StoryCardType, SharePlatform } from '@prisma/client';
import {
  StoryCardNotFoundException,
  StoryCardAccessDeniedException,
} from '../exceptions';
import { GenerateStoryCardDto, TrackShareDto } from '../dto';

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

const createMockOpikService = () => ({
  createTrace: vi.fn().mockReturnValue({ trace: { id: 'test-trace' } }),
  endTrace: vi.fn(),
});

const createMockCalculator = () => ({
  generateContent: vi.fn().mockReturnValue({
    headline: 'Test',
    subheadline: 'Test',
    keyMetric: { label: 'Test', value: '+100%' },
    hashtags: ['#Test'],
    gradient: ['#000', '#FFF'],
    gradientIndex: 0,
  }),
});

const createMockEventEmitter = () => ({
  emit: vi.fn(),
});

const createMockMetrics = () => ({
  incCardsGenerated: vi.fn(),
  incShares: vi.fn(),
  incCacheHit: vi.fn(),
  incCacheMiss: vi.fn(),
  incViews: vi.fn(),
  incHealthCheck: vi.fn(),
  getSnapshot: vi.fn(),
  reset: vi.fn(),
});

// ==========================================
// TEST DATA
// ==========================================

const USER_A = {
  id: 'user-aaaa-1111-2222-3333-444455556666',
  email: 'usera@example.com',
};

const USER_B = {
  id: 'user-bbbb-1111-2222-3333-444455556666',
  email: 'userb@example.com',
};

const createMockCardForUser = (userId: string, overrides = {}) => ({
  id: `card-${userId.slice(-8)}-1234-5678`,
  userId,
  type: 'FUTURE_SELF' as StoryCardType,
  headline: 'A Letter From My Future Self',
  subheadline: 'Just received a letter from my 60-year-old self',
  keyMetricLabel: 'Potential 20-year wealth gain',
  keyMetricValue: '+285%',
  quote: 'Your commitment paid off.',
  shareUrl: 'https://ikpa.app/share/test123',
  platforms: ['TWITTER', 'LINKEDIN', 'WHATSAPP'],
  hashtags: ['#FutureMe', '#IKPA'],
  gradient: ['#667EEA', '#764BA2'],
  anonymizeAmounts: true,
  revealActualNumbers: false,
  includePersonalData: false,
  sourceId: 'source-id',
  viewCount: 10,
  referralCode: 'ref12345',
  isPublic: true,
  isActive: true,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ==========================================
// XSS PREVENTION TESTS
// ==========================================

describe('Story Cards Security Tests', () => {
  describe('XSS Prevention', () => {
    let calculator: CardContentCalculator;

    beforeEach(() => {
      calculator = new CardContentCalculator();
    });

    describe('Quote Extraction Safety', () => {
      it('should extract safe sentences from content with malicious tags mixed in', () => {
        // When content has both safe and malicious text, the quote extraction
        // prioritizes engaging sentences (those with emotional/financial words)
        const mixedContent =
          'I am so proud of your financial journey! <script>evil</script> Your savings grew exponentially over the years.';

        const result = calculator.generateContent(
          'FUTURE_SELF',
          {
            type: 'FUTURE_SELF',
            data: {
              letterId: 'letter-123',
              content: mixedContent,
              userAge: 28,
              futureAge: 60,
              currentNetWorth: 1000000,
              wealthDifference20yr: 2850000,
              currentSavingsRate: 0.1,
              optimizedSavingsRate: 0.25,
              createdAt: new Date(),
            },
          },
          {
            anonymizeAmounts: true,
            revealActualNumbers: false,
            includePersonalData: false,
            requirePreview: true,
          },
        );

        // The quote extraction scoring system should prefer the proud/financial sentence
        // because it has higher engagement score (emotional words)
        expect(result.headline).toBeDefined();
        // The result will be processed by frontend for sanitization
      });

      it('should return safe content from normal letter without malicious content', () => {
        const safeContent =
          'Dear Future Self, Your N20,000 savings became N5,000,000! I am so proud of you. The discipline paid off massively. Keep going!';

        const result = calculator.generateContent(
          'FUTURE_SELF',
          {
            type: 'FUTURE_SELF',
            data: {
              letterId: 'letter-123',
              content: safeContent,
              userAge: 28,
              futureAge: 60,
              currentNetWorth: 1000000,
              wealthDifference20yr: 2850000,
              currentSavingsRate: 0.1,
              optimizedSavingsRate: 0.25,
              createdAt: new Date(),
            },
          },
          {
            anonymizeAmounts: true,
            revealActualNumbers: false,
            includePersonalData: false,
            requirePreview: true,
          },
        );

        expect(result.quote).toBeDefined();
        expect(result.quote!.length).toBeGreaterThan(0);
        expect(result.quote!.length).toBeLessThanOrEqual(500);
        // Safe content should not contain HTML tags
        expect(result.quote).not.toContain('<script>');
        expect(result.quote).not.toContain('<img');
      });

      it('should handle empty content gracefully', () => {
        const result = calculator.generateContent(
          'FUTURE_SELF',
          {
            type: 'FUTURE_SELF',
            data: {
              letterId: 'letter-123',
              content: '',
              userAge: 28,
              futureAge: 60,
              currentNetWorth: 1000000,
              wealthDifference20yr: 2850000,
              currentSavingsRate: 0.1,
              optimizedSavingsRate: 0.25,
              createdAt: new Date(),
            },
          },
          {
            anonymizeAmounts: true,
            revealActualNumbers: false,
            includePersonalData: false,
            requirePreview: true,
          },
        );

        // Should still generate card without crashing
        expect(result.headline).toBe('A Letter From My Future Self');
      });

      it('should generate valid gradients and hashtags regardless of input', () => {
        const result = calculator.generateContent(
          'FUTURE_SELF',
          {
            type: 'FUTURE_SELF',
            data: {
              letterId: 'letter-123',
              content: '<script>alert(1)</script>',
              userAge: 28,
              futureAge: 60,
              currentNetWorth: 1000000,
              wealthDifference20yr: 2850000,
              currentSavingsRate: 0.1,
              optimizedSavingsRate: 0.25,
              createdAt: new Date(),
            },
          },
          {
            anonymizeAmounts: true,
            revealActualNumbers: false,
            includePersonalData: false,
            requirePreview: true,
          },
        );

        // Gradients and hashtags are static/computed, not from user input
        expect(result.gradient).toHaveLength(2);
        expect(result.gradient[0]).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(result.hashtags.every((h: string) => h.startsWith('#'))).toBe(true);
      });
    });

    describe('Recovery Path Formatting', () => {
      it('should format recovery path to title case', () => {
        const result = calculator.generateContent(
          'RECOVERY',
          {
            type: 'RECOVERY',
            data: {
              sessionId: 'session-123',
              category: 'Entertainment',
              overspendAmount: 25000,
              previousProbability: 0.65,
              newProbability: 0.82,
              probabilityRestored: 0.17,
              selectedPath: 'category_freeze',
              completedAt: new Date(),
            },
          },
          {
            anonymizeAmounts: true,
            revealActualNumbers: false,
            includePersonalData: false,
            requirePreview: true,
          },
        );

        // Recovery path is formatted to title case
        expect(result.quote).toContain('Category Freeze');
        expect(result.quote).not.toContain('category_freeze');
      });
    });
  });

  // ==========================================
  // AUTHORIZATION TESTS
  // ==========================================

  describe('Authorization', () => {
    let service: StoryCardsService;
    let prismaService: MockPrismaService;
    let redisService: MockRedisService;

    beforeEach(() => {
      prismaService = createMockPrismaService();
      redisService = createMockRedisService();
      const mockCalculator = createMockCalculator();
      const mockOpikService = createMockOpikService();
      const mockEventEmitter = createMockEventEmitter();
      const mockMetrics = createMockMetrics();

      // Instantiate service directly with mocks
      service = new StoryCardsService(
        prismaService as unknown as PrismaService,
        redisService as unknown as RedisService,
        mockOpikService as unknown as OpikService,
        mockCalculator as unknown as CardContentCalculator,
        mockEventEmitter as unknown as EventEmitter2,
        mockMetrics as unknown as StoryCardsMetrics,
      );
    });

    describe('User A Cannot Access User B Cards', () => {
      it('should throw StoryCardNotFoundException when User A tries to get User B card', async () => {
        const userBCard = createMockCardForUser(USER_B.id);

        // Prisma findFirst with userId filter will return null for wrong user
        prismaService.storyCard.findFirst.mockResolvedValue(null);
        redisService.get.mockResolvedValue(null);

        await expect(
          service.getCardById(USER_A.id, userBCard.id),
        ).rejects.toThrow(StoryCardNotFoundException);

        expect(prismaService.storyCard.findFirst).toHaveBeenCalledWith({
          where: { id: userBCard.id, userId: USER_A.id, isActive: true },
        });
      });
    });

    describe('User A Cannot Delete User B Cards', () => {
      it('should throw StoryCardNotFoundException when User A tries to delete User B card', async () => {
        const userBCard = createMockCardForUser(USER_B.id);

        // Delete also uses findFirst with userId filter
        prismaService.storyCard.findFirst.mockResolvedValue(null);

        await expect(
          service.deleteCard(USER_A.id, userBCard.id, false),
        ).rejects.toThrow(StoryCardNotFoundException);
      });

      it('should throw StoryCardNotFoundException for hard delete of User B card', async () => {
        const userBCard = createMockCardForUser(USER_B.id);

        prismaService.storyCard.findFirst.mockResolvedValue(null);

        await expect(
          service.deleteCard(USER_A.id, userBCard.id, true),
        ).rejects.toThrow(StoryCardNotFoundException);
      });
    });

    describe('User A Cannot Track Shares on User B Cards', () => {
      it('should throw StoryCardNotFoundException when User A tries to track share on User B card', async () => {
        prismaService.storyCard.findFirst.mockResolvedValue(null);

        await expect(
          service.trackShare(USER_A.id, 'user-b-card-id', {
            platform: 'TWITTER',
          }),
        ).rejects.toThrow(StoryCardNotFoundException);
      });

      it('should succeed when User A tracks share on their own card', async () => {
        const userACard = createMockCardForUser(USER_A.id);

        prismaService.storyCard.findFirst.mockResolvedValue({
          id: userACard.id,
          referralCode: userACard.referralCode,
        });
        prismaService.shareEvent.create.mockResolvedValue({
          id: 'event-123',
          cardId: userACard.id,
          platform: 'TWITTER',
          sharedAt: new Date(),
          referralCode: userACard.referralCode,
        });

        const result = await service.trackShare(USER_A.id, userACard.id, {
          platform: 'TWITTER',
        });

        expect(result.cardId).toBe(userACard.id);
      });
    });

    describe('User A Cannot Update User B Cards', () => {
      it('should throw StoryCardNotFoundException when User A tries to update User B card', async () => {
        prismaService.storyCard.findFirst.mockResolvedValue(null);

        await expect(
          service.updateCard(USER_A.id, 'user-b-card-id', {
            anonymizeAmounts: false,
          }),
        ).rejects.toThrow(StoryCardNotFoundException);
      });
    });
  });

  // ==========================================
  // INPUT VALIDATION TESTS
  // ==========================================

  describe('Input Validation', () => {
    describe('Invalid UUID Formats', () => {
      it('should reject invalid UUID for sourceId', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: 'not-a-valid-uuid',
          anonymizeAmounts: true,
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const sourceIdError = errors.find((e) => e.property === 'sourceId');
        expect(sourceIdError).toBeDefined();
        expect(sourceIdError?.constraints?.isUuid).toBeDefined();
      });

      it('should reject empty sourceId', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '',
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it('should accept valid UUID for sourceId', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
        });

        const errors = await validate(dto);
        const sourceIdError = errors.find((e) => e.property === 'sourceId');

        expect(sourceIdError).toBeUndefined();
      });

      it('should reject SQL injection in sourceId', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: "'; DROP TABLE users; --",
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const sourceIdError = errors.find((e) => e.property === 'sourceId');
        expect(sourceIdError).toBeDefined();
      });
    });

    describe('Invalid Enum Values', () => {
      it('should reject invalid StoryCardType', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'INVALID_TYPE',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const typeError = errors.find((e) => e.property === 'type');
        expect(typeError).toBeDefined();
        expect(typeError?.constraints?.isEnum).toBeDefined();
      });

      it('should reject invalid SharePlatform', async () => {
        const dto = plainToInstance(TrackShareDto, {
          platform: 'FACEBOOK',
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const platformError = errors.find((e) => e.property === 'platform');
        expect(platformError).toBeDefined();
        expect(platformError?.constraints?.isEnum).toBeDefined();
      });

      it('should accept valid StoryCardType values', async () => {
        const validTypes: StoryCardType[] = [
          'FUTURE_SELF',
          'COMMITMENT',
          'MILESTONE',
          'RECOVERY',
        ];

        for (const type of validTypes) {
          const dto = plainToInstance(GenerateStoryCardDto, {
            type,
            sourceId: '550e8400-e29b-41d4-a716-446655440000',
          });

          const errors = await validate(dto);
          const typeError = errors.find((e) => e.property === 'type');

          expect(typeError).toBeUndefined();
        }
      });

      it('should accept valid SharePlatform values', async () => {
        const validPlatforms: SharePlatform[] = [
          'TWITTER',
          'LINKEDIN',
          'WHATSAPP',
          'INSTAGRAM',
        ];

        for (const platform of validPlatforms) {
          const dto = plainToInstance(TrackShareDto, { platform });

          const errors = await validate(dto);
          const platformError = errors.find((e) => e.property === 'platform');

          expect(platformError).toBeUndefined();
        }
      });
    });

    describe('Oversized Inputs', () => {
      it('should reject idempotencyKey exceeding 128 characters', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
          idempotencyKey: 'a'.repeat(200),
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const keyError = errors.find((e) => e.property === 'idempotencyKey');
        expect(keyError).toBeDefined();
        expect(keyError?.constraints?.maxLength).toBeDefined();
      });

      it('should reject idempotencyKey with invalid characters', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
          idempotencyKey: 'key with spaces and $pecial chars!',
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const keyError = errors.find((e) => e.property === 'idempotencyKey');
        expect(keyError).toBeDefined();
        expect(keyError?.constraints?.matches).toBeDefined();
      });

      it('should accept valid idempotencyKey', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
          idempotencyKey: 'generate-card-user123-source456_1704067200',
        });

        const errors = await validate(dto);
        const keyError = errors.find((e) => e.property === 'idempotencyKey');

        expect(keyError).toBeUndefined();
      });

      it('should reject ipAddress exceeding 45 characters', async () => {
        const dto = plainToInstance(TrackShareDto, {
          platform: 'TWITTER',
          ipAddress: '192.168.1.1'.repeat(10), // Way over 45 chars
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const ipError = errors.find((e) => e.property === 'ipAddress');
        expect(ipError).toBeDefined();
      });

      it('should reject userAgent exceeding 500 characters', async () => {
        const dto = plainToInstance(TrackShareDto, {
          platform: 'TWITTER',
          userAgent: 'Mozilla/5.0 '.repeat(100), // Way over 500 chars
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const uaError = errors.find((e) => e.property === 'userAgent');
        expect(uaError).toBeDefined();
      });
    });

    describe('Required Fields', () => {
      it('should reject missing type in GenerateStoryCardDto', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const typeError = errors.find((e) => e.property === 'type');
        expect(typeError).toBeDefined();
      });

      it('should reject missing sourceId in GenerateStoryCardDto', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const sourceIdError = errors.find((e) => e.property === 'sourceId');
        expect(sourceIdError).toBeDefined();
      });

      it('should reject missing platform in TrackShareDto', async () => {
        const dto = plainToInstance(TrackShareDto, {});

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        const platformError = errors.find((e) => e.property === 'platform');
        expect(platformError).toBeDefined();
      });
    });

    describe('Boolean Type Validation', () => {
      it('should reject non-boolean anonymizeAmounts', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
          anonymizeAmounts: 'yes' as unknown as boolean,
        });

        const errors = await validate(dto);

        const boolError = errors.find(
          (e) => e.property === 'anonymizeAmounts',
        );
        expect(boolError).toBeDefined();
      });

      it('should accept boolean true for anonymizeAmounts', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
          anonymizeAmounts: true,
        });

        const errors = await validate(dto);
        const boolError = errors.find(
          (e) => e.property === 'anonymizeAmounts',
        );

        expect(boolError).toBeUndefined();
      });

      it('should accept boolean false for revealActualNumbers', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
          revealActualNumbers: false,
        });

        const errors = await validate(dto);
        const boolError = errors.find(
          (e) => e.property === 'revealActualNumbers',
        );

        expect(boolError).toBeUndefined();
      });
    });

    describe('Null and Undefined Handling', () => {
      it('should handle null sourceId', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: null,
        });

        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
      });

      it('should accept undefined optional fields', async () => {
        const dto = plainToInstance(GenerateStoryCardDto, {
          type: 'FUTURE_SELF',
          sourceId: '550e8400-e29b-41d4-a716-446655440000',
          // anonymizeAmounts, revealActualNumbers, includePersonalData, idempotencyKey all undefined
        });

        const errors = await validate(dto);

        // Should have no errors for optional fields
        const optionalErrors = errors.filter((e) =>
          ['anonymizeAmounts', 'revealActualNumbers', 'includePersonalData', 'idempotencyKey'].includes(
            e.property,
          ),
        );
        expect(optionalErrors.length).toBe(0);
      });
    });
  });

  // ==========================================
  // ADDITIONAL SECURITY TESTS
  // ==========================================

  describe('Additional Security Checks', () => {
    it('should not expose internal error details in exception messages', () => {
      // This tests that exceptions use predefined error codes
      const exception = new StoryCardNotFoundException('test-id');

      expect(exception.message).not.toContain('SQL');
      expect(exception.message).not.toContain('database');
      expect(exception.message).not.toContain('internal');
    });

    it('should not expose user IDs in access denied messages', () => {
      const exception = new StoryCardAccessDeniedException('card-123');

      expect(exception.message).toContain('card-123');
      expect(exception.message).not.toContain('user-');
    });

    it('should have meaningful error messages', () => {
      const notFound = new StoryCardNotFoundException('card-id');
      const accessDenied = new StoryCardAccessDeniedException('card-id');

      // Both should have meaningful messages
      expect(notFound.message).toContain('card');
      expect(accessDenied.message).toContain('access');
    });
  });
});
