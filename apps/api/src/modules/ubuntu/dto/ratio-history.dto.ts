import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RiskLevel } from '@prisma/client';

/**
 * Query parameters for ratio history
 */
export class RatioHistoryQueryDto {
  @ApiPropertyOptional({
    example: 30,
    description: 'Number of days of history to retrieve (7-365)',
    minimum: 7,
    maximum: 365,
    default: 30,
  })
  @IsOptional()
  @IsInt({ message: 'Days must be an integer' })
  @Min(7, { message: 'Days must be at least 7' })
  @Max(365, { message: 'Days cannot exceed 365' })
  @Type(() => Number)
  days?: number = 30;
}

/**
 * Single history entry
 */
export class RatioHistoryEntryDto {
  @ApiProperty({
    example: '2026-01-24',
    description: 'Date of the ratio snapshot (YYYY-MM-DD)',
  })
  date!: string;

  @ApiProperty({
    example: 0.214,
    description: 'Total dependency ratio on this date',
    minimum: 0,
    maximum: 1,
  })
  totalRatio!: number;

  @ApiProperty({
    enum: RiskLevel,
    example: 'ORANGE',
    description: 'Risk level on this date',
  })
  riskLevel!: RiskLevel;

  @ApiProperty({
    example: 75000,
    description: 'Total monthly family support on this date',
  })
  monthlyTotal!: number;
}

/**
 * Response for ratio history
 */
export class RatioHistoryResponseDto {
  @ApiProperty({
    type: [RatioHistoryEntryDto],
    description: 'Historical ratio data points',
  })
  history!: RatioHistoryEntryDto[];

  @ApiProperty({
    enum: ['improving', 'stable', 'increasing'],
    example: 'stable',
    description: 'Overall trend direction based on historical data',
  })
  trend!: 'improving' | 'stable' | 'increasing';

  @ApiProperty({
    example: 0.22,
    description: 'Average ratio over the period',
    minimum: 0,
    maximum: 1,
  })
  averageRatio!: number;

  @ApiProperty({
    example: 30,
    description: 'Number of days in the analysis period',
  })
  periodDays!: number;
}
