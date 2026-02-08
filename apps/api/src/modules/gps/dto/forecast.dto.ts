/**
 * GPS Proactive Forecast DTOs
 *
 * Data transfer objects for the spending forecast system that warns
 * users BEFORE they overspend.
 */

import { ApiProperty } from '@nestjs/swagger';
import { ForecastRiskLevel } from '../interfaces';

/**
 * Individual category forecast DTO
 */
export class BudgetForecastDto {
  @ApiProperty({
    description: 'Category ID',
    example: 'food-dining',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Food & Dining',
  })
  categoryName!: string;

  @ApiProperty({
    description: 'Budgeted amount for the period',
    example: 500,
  })
  budgeted!: number;

  @ApiProperty({
    description: 'Amount spent so far',
    example: 320,
  })
  spent!: number;

  @ApiProperty({
    description: 'Projected total spending at end of period',
    example: 720,
  })
  projectedTotal!: number;

  @ApiProperty({
    description: 'Projected overage (0 if under budget)',
    example: 220,
  })
  projectedOverage!: number;

  @ApiProperty({
    description: 'Days until projected spending crosses budget, null if safe',
    example: 5,
    nullable: true,
  })
  daysUntilExceed!: number | null;

  @ApiProperty({
    description: 'Suggested daily spending limit to stay on budget',
    example: 8.5,
  })
  suggestedDailyLimit!: number;

  @ApiProperty({
    description: 'Risk level: safe (<80%), caution (80-100%), warning (>100%)',
    enum: ['safe', 'caution', 'warning'],
    example: 'warning',
  })
  riskLevel!: ForecastRiskLevel;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency!: string;
}

/**
 * Forecast response for all categories
 */
export class ForecastResponseDto {
  @ApiProperty({
    description: 'Forecasts for all budgeted categories',
    type: [BudgetForecastDto],
  })
  forecasts!: BudgetForecastDto[];

  @ApiProperty({
    description: 'Number of categories at risk (caution or warning)',
    example: 2,
  })
  atRiskCount!: number;

  @ApiProperty({
    description: 'Total number of budgeted categories',
    example: 5,
  })
  totalCategories!: number;
}
