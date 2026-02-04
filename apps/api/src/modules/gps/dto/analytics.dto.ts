/**
 * GPS Analytics DTOs
 *
 * Data transfer objects for analytics and metrics endpoints.
 * These are response DTOs - properties are populated when returned from services.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MonetaryValueDto } from './recalculate-response.dto';

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
 * Time to recovery structured value
 */
export class TimeToRecoveryValueDto {
  @ApiProperty({ description: 'Time in hours, rounded to 2 decimal places', example: 2.5 })
  hours!: number;

  @ApiProperty({
    description: 'Human-readable formatted time',
    example: 'Under 2 hours',
  })
  formatted!: string;
}

/**
 * Preferred path details
 */
export class PreferredPathDto {
  @ApiProperty({ description: 'Recovery path ID', example: 'rate_adjustment' })
  id!: string;

  @ApiProperty({ description: 'Human-readable path name', example: 'Savings Boost' })
  name!: string;

  @ApiProperty({ description: 'Number of times this path was selected', example: 5 })
  usageCount!: number;
}

/**
 * User-specific analytics response
 */
export class UserAnalyticsDto {
  @ApiProperty({ description: 'Total number of budget slips', example: 5 })
  totalSlips!: number;

  @ApiProperty({ description: 'Recovery rate (0-1)', example: 0.8 })
  recoveryRate!: number;

  @ApiProperty({ description: 'Recovery rate formatted as percentage', example: '80%' })
  recoveryRateFormatted!: string;

  @ApiPropertyOptional({
    description: 'Most frequently selected recovery path with details',
    type: PreferredPathDto,
  })
  preferredPath!: PreferredPathDto | null;

  @ApiProperty({
    description: 'Average time to recovery with structured value',
    type: TimeToRecoveryValueDto,
  })
  averageTimeToRecovery!: TimeToRecoveryValueDto;

  @ApiProperty({ description: 'Total probability points restored', example: 0.25 })
  totalProbabilityRestored!: number;
}

/**
 * Most selected path details for category analytics
 */
export class MostSelectedPathDto {
  @ApiProperty({ description: 'Recovery path ID', example: 'freeze_protocol' })
  id!: string;

  @ApiProperty({ description: 'Human-readable path name', example: 'Category Pause' })
  name!: string;

  @ApiProperty({ description: 'Number of times this path was selected', example: 8 })
  count!: number;
}

/**
 * Category analytics item
 */
export class CategoryAnalyticsDto {
  @ApiProperty({ description: 'Spending category name', example: 'Entertainment' })
  category!: string;

  @ApiProperty({ description: 'Category identifier', example: 'entertainment' })
  categoryId!: string;

  @ApiProperty({ description: 'Total slip events in this category', example: 15 })
  totalSlips!: number;

  @ApiProperty({ description: 'Recovery rate for this category (0-1)', example: 0.73 })
  recoveryRate!: number;

  @ApiProperty({ description: 'Recovery rate formatted as percentage', example: '73%' })
  recoveryRateFormatted!: string;

  @ApiPropertyOptional({
    description: 'Most selected recovery path for this category',
    type: MostSelectedPathDto,
  })
  mostSelectedPath!: MostSelectedPathDto | null;

  @ApiProperty({ description: 'Average overspend as percentage of budget', example: 15.5 })
  averageOverspendPercent!: number;

  @ApiProperty({
    description: 'Total overspend amount',
    type: MonetaryValueDto,
  })
  totalOverspendAmount!: MonetaryValueDto;
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
 * Timeline extension from time_adjustment recovery path
 */
export class TimelineExtensionDto {
  @ApiProperty({ description: 'Goal ID' })
  goalId!: string;

  @ApiProperty({ description: 'Goal name', example: 'Emergency Fund' })
  goalName!: string;

  @ApiProperty({ description: 'Original deadline before extension' })
  originalDeadline!: Date;

  @ApiProperty({ description: 'New deadline after extension' })
  newDeadline!: Date;

  @ApiProperty({ description: 'Total days extended', example: 14 })
  extensionDays!: number;

  @ApiProperty({ description: 'Recovery session ID that caused this extension' })
  sessionId!: string;
}

/**
 * Summary of all active adjustments
 */
export class ActiveAdjustmentsSummaryDto {
  @ApiProperty({ description: 'Total number of active category freezes', example: 2 })
  totalActiveFreezes!: number;

  @ApiProperty({ description: 'Total number of active savings boosts (0 or 1)', example: 1 })
  totalActiveBoosts!: number;

  @ApiProperty({ description: 'Total number of timeline extensions', example: 1 })
  totalTimelineExtensions!: number;

  @ApiProperty({
    description: 'Estimated monthly savings from freezes and boosts with currency formatting',
    type: MonetaryValueDto,
    example: { amount: 15000, formatted: '₦15,000', currency: 'NGN' },
  })
  estimatedMonthlySavings!: MonetaryValueDto;

  @ApiPropertyOptional({ description: 'Earliest end date of active adjustments' })
  estimatedRecoveryDate!: Date | null;
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

  @ApiProperty({
    description: 'Estimated savings amount with currency formatting',
    type: MonetaryValueDto,
    example: { amount: 5000, formatted: '₦5,000', currency: 'NGN' },
  })
  savedAmount!: MonetaryValueDto;

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

  @ApiProperty({
    description: 'Timeline extensions from time_adjustment recovery paths',
    type: [TimelineExtensionDto],
  })
  timelineExtensions!: TimelineExtensionDto[];

  @ApiProperty({
    description: 'Summary of all active adjustments',
    type: ActiveAdjustmentsSummaryDto,
  })
  summary!: ActiveAdjustmentsSummaryDto;

  @ApiProperty({ description: 'Whether any adjustments are active', example: true })
  hasActiveAdjustments!: boolean;
}
