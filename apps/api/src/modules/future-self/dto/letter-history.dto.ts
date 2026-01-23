/**
 * Future Self Letter History DTOs
 *
 * Request/response types for letter history and retrieval endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LetterTrigger } from '@prisma/client';

/**
 * Single letter summary for history list
 */
export class LetterSummaryDto {
  @ApiProperty({
    description: 'Unique letter identifier',
    example: 'uuid-letter-123',
  })
  id!: string;

  @ApiProperty({
    description: 'First 200 characters of the letter content',
    example: "Dear Aisha,\n\nI'm writing this from the balcony of our home in Victoria Island...",
  })
  preview!: string;

  @ApiProperty({
    description: 'What triggered this letter generation',
    enum: LetterTrigger,
    example: 'USER_REQUEST',
  })
  trigger!: LetterTrigger;

  @ApiProperty({
    description: 'When the letter was generated',
    example: '2026-01-22T10:00:00.000Z',
  })
  generatedAt!: Date;

  @ApiPropertyOptional({
    description: 'When the user first read the letter (null if unread)',
    example: '2026-01-22T10:05:00.000Z',
    nullable: true,
  })
  readAt!: Date | null;

  @ApiProperty({
    description: 'Tone empathy score from G-Eval (1-5)',
    example: 4,
    nullable: true,
  })
  toneScore!: number | null;
}

/**
 * Response DTO for letter history list
 */
export class LetterHistoryResponseDto {
  @ApiProperty({
    description: 'List of letter summaries',
    type: [LetterSummaryDto],
  })
  letters!: LetterSummaryDto[];

  @ApiProperty({
    description: 'Total number of letters',
    example: 15,
  })
  total!: number;

  @ApiProperty({
    description: 'Whether there are more letters to fetch',
    example: true,
  })
  hasMore!: boolean;
}

/**
 * Full letter detail response
 */
export class LetterDetailResponseDto {
  @ApiProperty({
    description: 'Unique letter identifier',
    example: 'uuid-letter-123',
  })
  id!: string;

  @ApiProperty({
    description: 'Full letter content',
    example: "Dear Aisha,\n\nI'm writing this from the balcony of our home in Victoria Island...",
  })
  content!: string;

  @ApiProperty({
    description: 'What triggered this letter generation',
    enum: LetterTrigger,
    example: 'USER_REQUEST',
  })
  trigger!: LetterTrigger;

  @ApiProperty({
    description: 'When the letter was generated',
    example: '2026-01-22T10:00:00.000Z',
  })
  generatedAt!: Date;

  @ApiPropertyOptional({
    description: 'When the user first read the letter',
    example: '2026-01-22T10:05:00.000Z',
    nullable: true,
  })
  readAt!: Date | null;

  @ApiProperty({
    description: "User's age at time of letter generation",
    example: 28,
  })
  userAge!: number;

  @ApiProperty({
    description: 'Future self age used in the letter',
    example: 60,
  })
  futureAge!: number;

  @ApiProperty({
    description: 'Current savings rate at time of generation',
    example: 0.12,
  })
  currentSavingsRate!: number;

  @ApiProperty({
    description: 'Optimized savings rate target',
    example: 0.18,
  })
  optimizedSavingsRate!: number;

  @ApiProperty({
    description: 'Projected wealth difference at 20 years',
    example: 16000000,
  })
  wealthDifference20yr!: number;

  @ApiProperty({
    description: 'Tone empathy score from G-Eval (1-5)',
    example: 4,
    nullable: true,
  })
  toneScore!: number | null;
}
