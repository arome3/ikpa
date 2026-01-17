/**
 * GPS Analytics DTOs
 *
 * Data transfer objects for analytics and metrics endpoints.
 * These are response DTOs - properties are populated when returned from services.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ==========================================
// REQUEST DTOs
// ==========================================

/**
 * Query parameters for analytics endpoints
 */
export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days to include in the analytics period',
    example: 30,
    default: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  days?: number = 30;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

/**
 * Path selection distribution item
 */
export class PathSelectionDistributionDto {
  @ApiProperty({ description: 'Recovery path ID', example: 'time_adjustment' })
  pathId!: string;

  @ApiProperty({ description: 'Human-readable path name', example: 'Timeline Flex' })
  pathName!: string;

  @ApiProperty({ description: 'Number of times this path was selected', example: 42 })
  count!: number;

  @ApiProperty({ description: 'Percentage of total selections', example: 35.5 })
  percentage!: number;
}

/**
 * Goal survival metrics
 */
export class GoalSurvivalMetricsDto {
  @ApiProperty({ description: 'Total number of slip events', example: 100 })
  totalSlips!: number;

  @ApiProperty({ description: 'Number of users who selected a recovery path', example: 85 })
  recovered!: number;

  @ApiProperty({ description: 'Number of users who abandoned their goal', example: 10 })
  abandoned!: number;

  @ApiProperty({ description: 'Number of pending sessions', example: 5 })
  pending!: number;

  @ApiProperty({ description: 'Survival rate (0-1)', example: 0.85 })
  survivalRate!: number;
}

/**
 * Time to recovery distribution
 */
export class TimeDistributionDto {
  @ApiProperty({ description: 'Selections made within 1 hour', example: 30 })
  under1Hour!: number;

  @ApiProperty({ description: 'Selections made in 1-6 hours', example: 25 })
  hours1to6!: number;

  @ApiProperty({ description: 'Selections made in 6-24 hours', example: 15 })
  hours6to24!: number;

  @ApiProperty({ description: 'Selections made after 24 hours', example: 5 })
  over24Hours!: number;
}

/**
 * Time to recovery metrics
 */
export class TimeToRecoveryMetricsDto {
  @ApiProperty({ description: 'Average time to recovery in hours', example: 4.5 })
  averageHours!: number;

  @ApiProperty({ description: 'Median time to recovery in hours', example: 2.0 })
  medianHours!: number;

  @ApiProperty({ description: 'Minimum time to recovery in hours', example: 0.5 })
  minHours!: number;

  @ApiProperty({ description: 'Maximum time to recovery in hours', example: 48.0 })
  maxHours!: number;

  @ApiProperty({ description: 'Distribution of recovery times', type: TimeDistributionDto })
  distribution!: TimeDistributionDto;
}

/**
 * Probability restoration metrics
 */
export class ProbabilityRestorationMetricsDto {
  @ApiProperty({ description: 'Average probability drop percentage', example: 15.5 })
  averageDropPercent!: number;

  @ApiProperty({ description: 'Average probability restored percentage', example: 10.85 })
  averageRestoredPercent!: number;

  @ApiProperty({ description: 'Number of goals fully restored', example: 25 })
  fullyRestoredCount!: number;

  @ApiProperty({ description: 'Number of goals partially restored', example: 50 })
  partiallyRestoredCount!: number;

  @ApiProperty({ description: 'Restoration rate (0-1)', example: 0.75 })
  restorationRate!: number;
}

/**
 * Analytics period info
 */
export class AnalyticsPeriodDto {
  @ApiProperty({ description: 'Start of analytics period' })
  start!: Date;

  @ApiProperty({ description: 'End of analytics period' })
  end!: Date;
}

/**
 * Complete analytics dashboard response
 */
export class AnalyticsDashboardDto {
  @ApiProperty({ description: 'Analytics period', type: AnalyticsPeriodDto })
  period!: AnalyticsPeriodDto;

  @ApiProperty({
    description: 'Path selection distribution',
    type: [PathSelectionDistributionDto],
  })
  pathSelection!: PathSelectionDistributionDto[];

  @ApiProperty({ description: 'Goal survival metrics', type: GoalSurvivalMetricsDto })
  goalSurvival!: GoalSurvivalMetricsDto;

  @ApiProperty({ description: 'Time to recovery metrics', type: TimeToRecoveryMetricsDto })
  timeToRecovery!: TimeToRecoveryMetricsDto;

  @ApiProperty({
    description: 'Probability restoration metrics',
    type: ProbabilityRestorationMetricsDto,
  })
  probabilityRestoration!: ProbabilityRestorationMetricsDto;

  @ApiProperty({ description: 'Total number of recovery sessions', example: 150 })
  totalSessions!: number;

  @ApiProperty({ description: 'Total budget thresholds crossed', example: 200 })
  totalBudgetThresholdsCrossed!: number;
}

/**
 * User-specific analytics response
 */
export class UserAnalyticsDto {
  @ApiProperty({ description: 'Total number of budget slips', example: 5 })
  totalSlips!: number;

  @ApiProperty({ description: 'Recovery rate (0-1)', example: 0.8 })
  recoveryRate!: number;

  @ApiPropertyOptional({
    description: 'Most frequently selected recovery path',
    example: 'rate_adjustment',
  })
  preferredPath!: string | null;

  @ApiProperty({ description: 'Average time to recovery in hours', example: 3.5 })
  averageTimeToRecovery!: number;

  @ApiProperty({ description: 'Total probability points restored', example: 0.25 })
  totalProbabilityRestored!: number;
}

/**
 * Category analytics item
 */
export class CategoryAnalyticsDto {
  @ApiProperty({ description: 'Spending category name', example: 'Entertainment' })
  category!: string;

  @ApiProperty({ description: 'Total slip events in this category', example: 15 })
  totalSlips!: number;

  @ApiProperty({ description: 'Recovery rate for this category (0-1)', example: 0.73 })
  recoveryRate!: number;

  @ApiPropertyOptional({
    description: 'Most selected recovery path for this category',
    example: 'freeze_protocol',
  })
  mostSelectedPath!: string | null;
}

// ==========================================
// ACTIVE ADJUSTMENTS DTOs
// ==========================================

/**
 * Active savings rate adjustment
 */
export class ActiveSavingsAdjustmentDto {
  @ApiProperty({ description: 'Adjustment ID' })
  id!: string;

  @ApiProperty({ description: 'Recovery session ID that created this adjustment' })
  sessionId!: string;

  @ApiProperty({ description: 'Original savings rate before boost', example: 0.15 })
  originalRate!: number;

  @ApiProperty({ description: 'Additional savings rate', example: 0.05 })
  additionalRate!: number;

  @ApiProperty({ description: 'Effective total savings rate', example: 0.2 })
  effectiveRate!: number;

  @ApiProperty({ description: 'Duration in weeks', example: 4 })
  durationWeeks!: number;

  @ApiProperty({ description: 'Start date of adjustment' })
  startDate!: Date;

  @ApiProperty({ description: 'End date of adjustment' })
  endDate!: Date;

  @ApiProperty({ description: 'Days remaining', example: 14 })
  daysRemaining!: number;
}

/**
 * Active category freeze
 */
export class ActiveCategoryFreezeDto {
  @ApiProperty({ description: 'Freeze ID' })
  id!: string;

  @ApiProperty({ description: 'Recovery session ID that created this freeze' })
  sessionId!: string;

  @ApiProperty({ description: 'Category ID' })
  categoryId!: string;

  @ApiProperty({ description: 'Category name', example: 'Entertainment' })
  categoryName!: string;

  @ApiProperty({ description: 'Duration in weeks', example: 3 })
  durationWeeks!: number;

  @ApiProperty({ description: 'Start date of freeze' })
  startDate!: Date;

  @ApiProperty({ description: 'End date of freeze' })
  endDate!: Date;

  @ApiProperty({ description: 'Estimated savings amount', example: 5000 })
  savedAmount!: number;

  @ApiProperty({ description: 'Days remaining', example: 7 })
  daysRemaining!: number;
}

/**
 * Active recovery adjustments response
 */
export class ActiveAdjustmentsResponseDto {
  @ApiPropertyOptional({
    description: 'Active savings rate adjustment (if any)',
    type: ActiveSavingsAdjustmentDto,
  })
  savingsAdjustment!: ActiveSavingsAdjustmentDto | null;

  @ApiProperty({
    description: 'Active category freezes',
    type: [ActiveCategoryFreezeDto],
  })
  categoryFreezes!: ActiveCategoryFreezeDto[];

  @ApiProperty({ description: 'Whether any adjustments are active', example: true })
  hasActiveAdjustments!: boolean;
}
