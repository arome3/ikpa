/**
 * Story Card Response DTOs
 *
 * Response types for story card endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StoryCardType, SharePlatform } from '@prisma/client';

/**
 * Key metric response
 */
export class KeyMetricDto {
  @ApiProperty({ example: 'Potential 20-year wealth gain' })
  label!: string;

  @ApiProperty({ example: '+285%' })
  value!: string;
}

/**
 * Story card response
 */
export class StoryCardResponseDto {
  @ApiProperty({ example: 'abc123xyz' })
  id!: string;

  @ApiProperty({ enum: StoryCardType, example: 'FUTURE_SELF' })
  type!: StoryCardType;

  @ApiProperty({ example: 'A Letter From My Future Self' })
  headline!: string;

  @ApiProperty({ example: 'received a letter from their 60-year-old self' })
  subheadline!: string;

  @ApiProperty({ type: KeyMetricDto })
  keyMetric!: KeyMetricDto;

  @ApiPropertyOptional({ example: 'That ₦20,000 you saved in January 2026? It became...' })
  quote?: string;

  @ApiProperty({ example: 'https://ikpa.app/share/abc12345' })
  shareUrl!: string;

  @ApiProperty({ type: [String], example: ['TWITTER', 'LINKEDIN', 'WHATSAPP'] })
  platforms!: string[];

  @ApiProperty({ type: [String], example: ['#FutureMe', '#FinancialJourney', '#IKPA'] })
  hashtags!: string[];

  @ApiProperty({ type: [String], example: ['#667EEA', '#764BA2'] })
  gradient!: [string, string];

  @ApiProperty({ example: true })
  anonymizeAmounts!: boolean;

  @ApiProperty({ example: 0 })
  viewCount!: number;

  @ApiProperty({ example: 'abc12345' })
  referralCode!: string;

  @ApiPropertyOptional({ example: 'letter-uuid-here' })
  sourceId?: string;

  @ApiPropertyOptional({ example: '2026-02-28T12:00:00.000Z' })
  expiresAt?: Date;

  @ApiProperty({ example: '2026-01-28T12:00:00.000Z' })
  createdAt!: Date;
}

/**
 * Create story card response (includes generated status)
 */
export class CreateStoryCardResponseDto extends StoryCardResponseDto {
  @ApiProperty({ example: true })
  generated!: boolean;
}

/**
 * Story card list item (lighter)
 */
export class StoryCardListItemDto {
  @ApiProperty({ example: 'abc123xyz' })
  id!: string;

  @ApiProperty({ enum: StoryCardType, example: 'FUTURE_SELF' })
  type!: StoryCardType;

  @ApiProperty({ example: 'A Letter From My Future Self' })
  headline!: string;

  @ApiProperty({ example: 'https://ikpa.app/share/abc12345' })
  shareUrl!: string;

  @ApiProperty({ example: 42 })
  viewCount!: number;

  @ApiProperty({ example: 'abc12345' })
  referralCode!: string;

  @ApiProperty({ example: '2026-01-28T12:00:00.000Z' })
  createdAt!: Date;
}

/**
 * Pagination info
 */
export class PaginationDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;

  @ApiProperty({ example: true })
  hasMore!: boolean;
}

/**
 * Paginated story cards response
 */
export class StoryCardsListResponseDto {
  @ApiProperty({ type: [StoryCardListItemDto] })
  data!: StoryCardListItemDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}

/**
 * Share event tracking response
 */
export class TrackShareResponseDto {
  @ApiProperty({ example: 'event-uuid' })
  id!: string;

  @ApiProperty({ example: 'card-uuid' })
  cardId!: string;

  @ApiProperty({ enum: SharePlatform, example: 'TWITTER' })
  platform!: SharePlatform;

  @ApiProperty({ example: '2026-01-28T12:00:00.000Z' })
  sharedAt!: Date;

  @ApiProperty({ example: 'abc12345' })
  referralCode!: string;
}

/**
 * Viral metrics response
 */
export class ViralMetricsResponseDto {
  @ApiProperty({ example: 15 })
  totalCards!: number;

  @ApiProperty({ example: 42 })
  totalShares!: number;

  @ApiProperty({
    example: { TWITTER: 20, LINKEDIN: 15, WHATSAPP: 5, INSTAGRAM: 2 },
  })
  sharesByPlatform!: Record<SharePlatform, number>;

  @ApiProperty({ example: 150 })
  totalViews!: number;

  @ApiProperty({ example: 3 })
  signupsFromShares!: number;

  @ApiProperty({
    example: 0.071,
    description: 'Viral coefficient (signups / shares ratio)',
  })
  viralCoefficient!: number;

  @ApiPropertyOptional({
    enum: StoryCardType,
    example: 'MILESTONE',
  })
  topPerformingType!: StoryCardType | null;

  @ApiProperty({
    example: { FUTURE_SELF: 5, COMMITMENT: 3, MILESTONE: 4, RECOVERY: 3 },
  })
  sharesByType!: Record<StoryCardType, number>;

  @ApiProperty({ example: 10 })
  averageViewsPerCard!: number;

  @ApiProperty({
    example: 0.28,
    description: 'Conversion rate (views that result in shares)',
  })
  conversionRate!: number;
}

/**
 * Public share page response
 */
export class SharePageResponseDto {
  @ApiProperty()
  card!: {
    id: string;
    type: StoryCardType;
    headline: string;
    subheadline: string;
    keyMetric: KeyMetricDto;
    quote?: string;
    gradient: [string, string];
    hashtags: string[];
    viewCount: number;
    createdAt: Date;
  };

  @ApiProperty({ example: 'abc12345' })
  referralCode!: string;

  @ApiProperty({
    example: {
      title: 'A Letter From My Future Self | IKPA',
      description: 'received a letter from their 60-year-old self',
      url: 'https://ikpa.app/share/abc12345',
    },
  })
  ogMeta!: {
    title: string;
    description: string;
    image?: string;
    url: string;
  };
}

/**
 * Delete card response for GDPR compliance
 */
export class DeleteCardResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'card-uuid-here' })
  cardId!: string;

  @ApiProperty({
    example: 'soft',
    enum: ['soft', 'hard'],
    description: 'Type of deletion performed',
  })
  deleteType!: 'soft' | 'hard';

  @ApiProperty({ example: '2026-01-28T12:00:00.000Z' })
  deletedAt!: Date;

  @ApiPropertyOptional({
    example: 'Card has been deactivated. Use hard delete for permanent removal.',
    description: 'Additional information about the deletion',
  })
  message?: string;
}

/**
 * Update card response
 */
export class UpdateStoryCardResponseDto extends StoryCardResponseDto {
  @ApiProperty({ example: true })
  updated!: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the content was regenerated',
  })
  regenerated?: boolean;
}

/**
 * Preview card response (not saved to database)
 */
export class PreviewStoryCardResponseDto {
  @ApiProperty({ example: true, description: 'Indicates this is a preview, not saved' })
  preview!: boolean;

  @ApiProperty({ enum: StoryCardType, example: 'FUTURE_SELF' })
  type!: StoryCardType;

  @ApiProperty({ example: 'A Letter From My Future Self' })
  headline!: string;

  @ApiProperty({ example: 'received a letter from their 60-year-old self' })
  subheadline!: string;

  @ApiProperty({ type: KeyMetricDto })
  keyMetric!: KeyMetricDto;

  @ApiPropertyOptional({ example: 'That N20,000 you saved in January 2026? It became...' })
  quote?: string;

  @ApiProperty({ type: [String], example: ['TWITTER', 'LINKEDIN', 'WHATSAPP'] })
  platforms!: string[];

  @ApiProperty({ type: [String], example: ['#FutureMe', '#FinancialJourney', '#IKPA'] })
  hashtags!: string[];

  @ApiProperty({ type: [String], example: ['#667EEA', '#764BA2'] })
  gradient!: [string, string];

  @ApiProperty({ example: true })
  anonymizeAmounts!: boolean;

  @ApiPropertyOptional({ example: 'letter-uuid-here' })
  sourceId?: string;

  @ApiProperty({ example: '2026-01-28T12:00:00.000Z' })
  generatedAt!: Date;
}
