import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalCategory, GoalStatus, Currency } from '@prisma/client';

/**
 * Response DTO for financial goal
 */
export class GoalResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'Emergency Fund' })
  name!: string;

  @ApiProperty({ enum: GoalCategory, example: 'EMERGENCY_FUND' })
  category!: GoalCategory;

  @ApiProperty({ example: 1000000 })
  targetAmount!: number;

  @ApiProperty({ example: 250000 })
  currentAmount!: number;

  @ApiProperty({ enum: Currency, example: 'NGN' })
  currency!: Currency;

  @ApiPropertyOptional({ example: '3 months of expenses' })
  description?: string | null;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z' })
  targetDate?: Date | null;

  @ApiProperty({ example: 1 })
  priority!: number;

  @ApiProperty({ enum: GoalStatus, example: 'ACTIVE' })
  status!: GoalStatus;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({
    example: 25,
    description: 'Progress percentage (currentAmount / targetAmount * 100)',
  })
  progressPercent!: number;

  @ApiPropertyOptional({
    example: 750000,
    description: 'Remaining amount to reach goal',
  })
  remainingAmount!: number;
}

/**
 * Response DTO for list of goals
 */
export class GoalListResponseDto {
  @ApiProperty({ type: [GoalResponseDto] })
  items!: GoalResponseDto[];

  @ApiProperty({ example: 3 })
  count!: number;

  @ApiProperty({
    example: 2500000,
    description: 'Total target across all active goals',
  })
  totalTarget!: number;

  @ApiProperty({
    example: 750000,
    description: 'Total current amount across all active goals',
  })
  totalCurrent!: number;

  @ApiProperty({
    example: 30,
    description: 'Overall progress percentage',
  })
  overallProgress!: number;
}
