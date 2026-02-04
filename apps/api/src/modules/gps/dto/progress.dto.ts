/**
 * GPS Progress Tracking DTOs
 *
 * Data transfer objects for recovery progress tracking.
 * Answers the user need: "How far along am I?"
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Individual milestone in recovery progress
 */
export class RecoveryMilestoneDto {
  @ApiProperty({
    description: 'Milestone percentage (25, 50, 75, 100)',
    example: 25,
  })
  percent!: number;

  @ApiProperty({
    description: 'Whether this milestone has been achieved',
    example: true,
  })
  achieved!: boolean;

  @ApiPropertyOptional({
    description: 'When the milestone was achieved (if achieved)',
    example: '2026-01-20T10:30:00Z',
  })
  achievedAt?: Date;

  @ApiPropertyOptional({
    description: 'Projected date to achieve (if not yet achieved)',
    example: '2026-02-03T00:00:00Z',
  })
  projectedAt?: Date;
}

/**
 * Recovery progress details
 */
export class RecoveryProgressDto {
  @ApiProperty({
    description: 'Days completed in recovery',
    example: 10,
  })
  daysCompleted!: number;

  @ApiProperty({
    description: 'Days remaining in recovery',
    example: 4,
  })
  daysRemaining!: number;

  @ApiProperty({
    description: 'Percentage complete (0-100)',
    example: 71,
  })
  percentComplete!: number;

  @ApiProperty({
    description: 'Recovery milestones',
    type: [RecoveryMilestoneDto],
  })
  milestones!: RecoveryMilestoneDto[];

  @ApiProperty({
    description: 'Encouraging message about progress',
    example: "You're doing great! 10 days down, 4 to go.",
  })
  encouragement!: string;

  @ApiProperty({
    description: 'Whether user is on track to complete recovery',
    example: true,
  })
  onTrack!: boolean;

  @ApiPropertyOptional({
    description: 'Estimated completion date',
    example: '2026-02-06T00:00:00Z',
  })
  estimatedCompletionDate?: Date;
}

/**
 * Enhanced recovery session with progress tracking
 */
export class EnhancedRecoverySessionDto {
  @ApiProperty({ description: 'Session ID' })
  id!: string;

  @ApiProperty({ description: 'Spending category', example: 'Food & Dining' })
  category!: string;

  @ApiProperty({ description: 'Overspend amount', example: 15000 })
  overspendAmount!: number;

  @ApiProperty({ description: 'Previous probability (0-1)', example: 0.85 })
  previousProbability!: number;

  @ApiProperty({ description: 'New probability after overspend (0-1)', example: 0.78 })
  newProbability!: number;

  @ApiPropertyOptional({
    description: 'Selected recovery path ID',
    example: 'time_adjustment',
  })
  selectedPathId?: string;

  @ApiPropertyOptional({ description: 'When path was selected' })
  selectedAt?: Date;

  @ApiProperty({
    description: 'Recovery session status',
    example: 'IN_PROGRESS',
    enum: ['PENDING', 'PATH_SELECTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
  })
  status!: string;

  @ApiProperty({ description: 'When session was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'When session was last updated' })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Recovery progress (when a path is selected)',
    type: RecoveryProgressDto,
  })
  recoveryProgress?: RecoveryProgressDto;

  @ApiPropertyOptional({
    description: 'Details about the selected recovery path',
  })
  selectedPath?: {
    id: string;
    name: string;
    expectedCompletion: Date;
  };
}
