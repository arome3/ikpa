/**
 * Bulk Operations DTOs
 *
 * Input and response types for bulk story card operations.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { StoryCardType } from '@prisma/client';

/**
 * DTO for bulk delete operation (GDPR compliance)
 */
export class BulkDeleteDto {
  @ApiProperty({
    type: [String],
    example: ['card-uuid-1', 'card-uuid-2', 'card-uuid-3'],
    description: 'Array of card IDs to delete (max 100 items)',
    maxItems: 100,
  })
  @IsArray({ message: 'cardIds must be an array' })
  @ArrayMinSize(1, { message: 'cardIds must contain at least 1 item' })
  @ArrayMaxSize(100, { message: 'cardIds cannot exceed 100 items' })
  @IsUUID('4', { each: true, message: 'Each cardId must be a valid UUID' })
  cardIds!: string[];

  @ApiPropertyOptional({
    example: false,
    description: 'If true, permanently delete cards (GDPR right to erasure). Default is soft delete.',
    default: false,
  })
  @IsBoolean({ message: 'hardDelete must be a boolean' })
  @IsOptional()
  hardDelete?: boolean;
}

/**
 * Failed deletion item
 */
export class BulkDeleteFailedItemDto {
  @ApiProperty({ example: 'card-uuid-here' })
  id!: string;

  @ApiProperty({ example: 'Card not found or access denied' })
  reason!: string;
}

/**
 * Response for bulk delete operation
 */
export class BulkDeleteResponseDto {
  @ApiProperty({
    type: [String],
    example: ['card-uuid-1', 'card-uuid-2'],
    description: 'IDs of successfully deleted cards',
  })
  deleted!: string[];

  @ApiProperty({
    type: [BulkDeleteFailedItemDto],
    description: 'Cards that failed to delete with reasons',
  })
  failed!: BulkDeleteFailedItemDto[];

  @ApiProperty({
    example: 'hard',
    enum: ['soft', 'hard'],
    description: 'Type of deletion performed',
  })
  deleteType!: 'soft' | 'hard';

  @ApiProperty({ example: '2026-01-28T12:00:00.000Z' })
  processedAt!: Date;

  @ApiProperty({
    example: { requested: 5, deleted: 3, failed: 2 },
    description: 'Summary of the bulk operation',
  })
  summary!: {
    requested: number;
    deleted: number;
    failed: number;
  };
}

/**
 * DTO for bulk generate operation
 */
export class BulkGenerateItemDto {
  @ApiProperty({
    enum: StoryCardType,
    example: 'FUTURE_SELF',
    description: 'Type of story card to generate',
  })
  type!: StoryCardType;

  @ApiProperty({
    example: 'source-uuid-here',
    description: 'The ID of the source',
  })
  @IsUUID('4', { message: 'sourceId must be a valid UUID' })
  sourceId!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Anonymize amounts as percentages (default: true)',
  })
  @IsBoolean({ message: 'anonymizeAmounts must be a boolean' })
  @IsOptional()
  anonymizeAmounts?: boolean;
}

export class BulkGenerateDto {
  @ApiProperty({
    type: [BulkGenerateItemDto],
    description: 'Array of cards to generate (max 10 items)',
    maxItems: 10,
  })
  @IsArray({ message: 'items must be an array' })
  @ArrayMinSize(1, { message: 'items must contain at least 1 item' })
  @ArrayMaxSize(10, { message: 'items cannot exceed 10 items for batch generation' })
  items!: BulkGenerateItemDto[];
}

/**
 * Failed generation item
 */
export class BulkGenerateFailedItemDto {
  @ApiProperty({ example: 'source-uuid-here' })
  sourceId!: string;

  @ApiProperty({ enum: StoryCardType, example: 'FUTURE_SELF' })
  type!: StoryCardType;

  @ApiProperty({ example: 'Source not found' })
  reason!: string;
}

/**
 * Response for bulk generate operation
 */
export class BulkGenerateResponseDto {
  @ApiProperty({
    type: [String],
    example: ['card-uuid-1', 'card-uuid-2'],
    description: 'IDs of successfully generated cards',
  })
  generated!: string[];

  @ApiProperty({
    type: [BulkGenerateFailedItemDto],
    description: 'Items that failed to generate with reasons',
  })
  failed!: BulkGenerateFailedItemDto[];

  @ApiProperty({ example: '2026-01-28T12:00:00.000Z' })
  processedAt!: Date;

  @ApiProperty({
    example: { requested: 5, generated: 3, failed: 2 },
    description: 'Summary of the bulk operation',
  })
  summary!: {
    requested: number;
    generated: number;
    failed: number;
  };
}
