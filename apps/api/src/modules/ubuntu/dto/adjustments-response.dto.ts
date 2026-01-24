import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentType, RelationshipType } from '@prisma/client';

/**
 * Details for each adjustment type
 */
export class AdjustmentDetailsDto {
  @ApiPropertyOptional({
    example: 250000,
    description: 'Available emergency fund (for EMERGENCY_FUND_TAP)',
  })
  availableFund?: number;

  @ApiPropertyOptional({
    example: 100000,
    description: 'Amount to tap from fund (for EMERGENCY_FUND_TAP)',
  })
  amountToTap?: number;

  @ApiPropertyOptional({
    example: 150000,
    description: 'Remaining fund after tap (for EMERGENCY_FUND_TAP)',
  })
  remainingFund?: number;

  @ApiPropertyOptional({
    example: '2026-03-01T00:00:00.000Z',
    description: 'Current goal deadline (for GOAL_TIMELINE_EXTEND)',
  })
  currentDeadline?: Date;

  @ApiPropertyOptional({
    example: '2026-03-29T00:00:00.000Z',
    description: 'New goal deadline after extension (for GOAL_TIMELINE_EXTEND)',
  })
  newDeadline?: Date;

  @ApiPropertyOptional({
    example: 4,
    description: 'Weeks to extend deadline (for GOAL_TIMELINE_EXTEND)',
  })
  extensionWeeks?: number;

  @ApiPropertyOptional({
    example: 0.2,
    description: 'Current savings rate (for SAVINGS_RATE_REDUCE)',
  })
  currentRate?: number;

  @ApiPropertyOptional({
    example: 0.1,
    description: 'Temporary reduced savings rate (for SAVINGS_RATE_REDUCE)',
  })
  temporaryRate?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Duration of reduced rate in weeks (for SAVINGS_RATE_REDUCE)',
  })
  durationWeeks?: number;
}

/**
 * Individual adjustment option
 */
export class AdjustmentOptionDto {
  @ApiProperty({
    enum: AdjustmentType,
    example: 'EMERGENCY_FUND_TAP',
    description: 'Type of adjustment',
  })
  type!: AdjustmentType;

  @ApiProperty({
    example: 'Use Emergency Fund',
    description: 'Human-readable label',
  })
  label!: string;

  @ApiProperty({
    example: 'Tap into your emergency fund to cover this need immediately.',
    description: 'Description of what this adjustment does',
  })
  description!: string;

  @ApiProperty({
    example: 12,
    description: 'Estimated weeks to recover from this adjustment',
  })
  recoveryWeeks!: number;

  @ApiProperty({
    example: 0.68,
    description: 'New goal achievement probability after applying this adjustment',
    minimum: 0,
    maximum: 1,
  })
  newGoalProbability!: number;

  @ApiProperty({
    example: true,
    description: 'Whether this option is recommended based on current situation',
  })
  recommended!: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether this option is available (has required resources)',
  })
  available!: boolean;

  @ApiPropertyOptional({
    example: 'Emergency fund is less than 50% of the required amount',
    description: 'Reason why this option is not available (if applicable)',
  })
  unavailableReason?: string;

  @ApiProperty({
    type: AdjustmentDetailsDto,
    description: 'Specific details for this adjustment type',
  })
  details!: AdjustmentDetailsDto;
}

/**
 * Full response for adjustment options
 */
export class AdjustmentsResponseDto {
  @ApiProperty({
    example: 'uuid-here',
    description: 'ID of the emergency being addressed',
  })
  emergencyId!: string;

  @ApiProperty({
    example: 100000,
    description: 'Amount needed for the emergency',
  })
  emergencyAmount!: number;

  @ApiProperty({
    example: 'Mom',
    description: 'Name of the person needing support',
  })
  recipientName!: string;

  @ApiProperty({
    enum: RelationshipType,
    example: 'PARENT',
    description: 'Relationship to the recipient',
  })
  relationship!: RelationshipType;

  @ApiProperty({
    example: 0.72,
    description: 'Current goal achievement probability before any adjustment',
    minimum: 0,
    maximum: 1,
  })
  originalGoalProbability!: number;

  @ApiProperty({
    type: [AdjustmentOptionDto],
    description: 'Available adjustment options',
  })
  options!: AdjustmentOptionDto[];

  @ApiProperty({
    example: "We understand family comes first. Here are your options to handle this while protecting your future.",
    description: 'Supportive message',
  })
  message!: string;
}
