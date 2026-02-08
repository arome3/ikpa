/**
 * Select Path DTOs
 *
 * DTOs for selecting a recovery path.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * Request body for selecting a recovery path
 */
export class SelectPathRequestDto {
  @ApiProperty({
    example: 'session-789-ghi',
    description: 'The recovery session ID',
  })
  @IsUUID('4', { message: 'sessionId must be a valid UUID' })
  @IsNotEmpty({ message: 'sessionId is required' })
  sessionId!: string;
}

/**
 * Detailed information about the executed recovery action
 */
export class RecoveryActionDetailsDto {
  @ApiPropertyOptional({
    example: 0.15,
    description: 'Original savings rate before adjustment (for rate_adjustment)',
  })
  originalRate?: number;

  @ApiPropertyOptional({
    example: 0.2,
    description: 'New savings rate after adjustment (for rate_adjustment)',
  })
  newRate?: number;

  @ApiPropertyOptional({
    example: 0.05,
    description: 'Additional savings rate boost amount as decimal (for rate_adjustment)',
  })
  boostAmount?: number;

  @ApiProperty({
    example: 4,
    description: 'Duration of the recovery action in weeks',
  })
  durationWeeks!: number;

  @ApiProperty({
    example: '2026-02-28T00:00:00.000Z',
    description: 'When the recovery action ends',
  })
  endDate!: Date;

  @ApiPropertyOptional({
    example: 25000,
    description: 'Estimated amount to recover during the action period',
  })
  estimatedRecovery?: number;

  @ApiPropertyOptional({
    example: 'Entertainment',
    description: 'Category name that has been frozen (for freeze_protocol)',
  })
  categoryFrozen?: string;

  @ApiPropertyOptional({
    example: '2026-01-15T00:00:00.000Z',
    description: 'Previous goal deadline before extension (for time_adjustment)',
  })
  previousDeadline?: Date;

  @ApiPropertyOptional({
    example: '2026-01-29T00:00:00.000Z',
    description: 'New goal deadline after extension (for time_adjustment)',
  })
  newDeadline?: Date;
}

/**
 * Response for selecting a recovery path
 */
export class SelectPathResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the selection was successful',
  })
  success!: boolean;

  @ApiProperty({
    example: "Great choice! We've updated your plan to use Timeline Flex.",
    description: 'Human-readable confirmation message',
  })
  message!: string;

  @ApiProperty({
    example: 'time_adjustment',
    description: 'The selected path ID',
  })
  selectedPathId!: string;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the selection was made',
  })
  selectedAt!: Date;

  @ApiPropertyOptional({
    type: RecoveryActionDetailsDto,
    description: 'Detailed information about the executed recovery action',
  })
  details?: RecoveryActionDetailsDto;

  @ApiPropertyOptional({
    example: [
      'Your "Emergency Fund" goal deadline has been automatically updated',
      'Review your updated timeline in the Goals section',
      'Consider adjusting your budget to stay on track',
    ],
    description: 'Helpful next steps for the user',
    type: [String],
  })
  nextSteps?: string[];
}
