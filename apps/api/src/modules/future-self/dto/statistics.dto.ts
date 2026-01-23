/**
 * Future Self Statistics DTOs
 *
 * Response types for user's Future Self engagement statistics.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for Future Self statistics
 */
export class StatisticsResponseDto {
  @ApiProperty({
    description: 'Total number of letters generated for the user',
    example: 15,
  })
  totalLetters!: number;

  @ApiProperty({
    description: 'Number of letters the user has read',
    example: 12,
  })
  lettersRead!: number;

  @ApiProperty({
    description: 'Average time spent reading letters in milliseconds',
    example: 42000,
    nullable: true,
  })
  avgReadDurationMs!: number | null;

  @ApiProperty({
    description: 'Average tone empathy score across all letters (1-5)',
    example: 4.2,
    nullable: true,
  })
  avgToneScore!: number | null;

  @ApiProperty({
    description: 'Date of the first letter generated',
    example: '2025-06-15T09:00:00.000Z',
    nullable: true,
  })
  firstLetterDate!: Date | null;

  @ApiProperty({
    description: 'Date of the most recent letter',
    example: '2026-01-22T09:00:00.000Z',
    nullable: true,
  })
  lastLetterDate!: Date | null;

  @ApiProperty({
    description: 'Breakdown of letters by trigger type',
    example: { USER_REQUEST: 5, WEEKLY_SCHEDULED: 10 },
  })
  byTrigger!: Record<string, number>;

  @ApiProperty({
    description: 'Number of letters generated this month',
    example: 2,
  })
  thisMonth!: number;
}
