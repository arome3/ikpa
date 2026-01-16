import {
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Supported history periods
 */
export enum HistoryPeriod {
  DAYS_30 = 30,
  DAYS_90 = 90,
  DAYS_365 = 365,
}

/**
 * Valid metric names for the metrics endpoint
 */
export enum ValidMetric {
  CASH_FLOW = 'cash-flow',
  SAVINGS_RATE = 'savings-rate',
  RUNWAY = 'runway',
  DEPENDENCY = 'dependency',
  NET_WORTH = 'net-worth',
}

/**
 * Custom validator to ensure startDate is before or equal to endDate
 */
@ValidatorConstraint({ name: 'dateRangeValidator', async: false })
export class DateRangeValidator implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { startDate?: string; endDate?: string };

    // If both dates are not provided, validation passes
    if (!obj.startDate || !obj.endDate) {
      return true;
    }

    const start = new Date(obj.startDate);
    const end = new Date(obj.endDate);

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return true; // Let IsDateString handle invalid dates
    }

    return start <= end;
  }

  defaultMessage(): string {
    return 'startDate must be before or equal to endDate';
  }
}

/**
 * Supported history intervals
 */
export enum HistoryInterval {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/**
 * Query parameters for score history endpoint
 */
export class ScoreHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Number of days of history to retrieve',
    enum: [30, 90, 365],
    default: 30,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsEnum(HistoryPeriod)
  days?: number = 30;
}

/**
 * Query parameters for snapshot history endpoint
 *
 * Cross-validated to ensure startDate <= endDate when both are provided.
 * Supports pagination with limit and offset parameters.
 */
export class SnapshotHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for history range (ISO 8601)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  @Validate(DateRangeValidator)
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for history range (ISO 8601)',
    example: '2026-01-16',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Interval for grouping data points',
    enum: HistoryInterval,
    default: HistoryInterval.DAY,
    example: 'day',
  })
  @IsOptional()
  @IsEnum(HistoryInterval)
  interval?: HistoryInterval = HistoryInterval.DAY;

  @ApiPropertyOptional({
    description: 'Maximum number of records to return (default: 100, max: 365)',
    example: 100,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Number of records to skip for pagination',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number = 0;
}
