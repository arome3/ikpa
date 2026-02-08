/**
 * GPS Quick Rebalance DTOs
 *
 * Data transfer objects for the lightweight budget move feature.
 * Allows users to quickly move budget between categories without
 * triggering Monte Carlo simulation or creating a recovery session.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ==========================================
// REQUEST DTOs
// ==========================================

/**
 * Request body for quick rebalance
 */
export class QuickRebalanceDto {
  @ApiProperty({
    description: 'Source category ID to move budget from',
    example: 'transport',
  })
  @IsString()
  @IsNotEmpty({ message: 'fromCategoryId is required' })
  fromCategoryId!: string;

  @ApiProperty({
    description: 'Destination category ID to move budget to',
    example: 'food-dining',
  })
  @IsString()
  @IsNotEmpty({ message: 'toCategoryId is required' })
  toCategoryId!: string;

  @ApiProperty({
    description: 'Amount to move between categories',
    example: 5000,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  @Type(() => Number)
  amount!: number;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

/**
 * Monetary value with formatted currency
 */
export class QuickRebalanceMonetaryValueDto {
  @ApiProperty({ example: 5000 })
  amount!: number;

  @ApiProperty({ example: '5,000' })
  formatted!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}

/**
 * Quick rebalance response
 */
export class QuickRebalanceResponseDto {
  @ApiProperty({ description: 'Source category name', example: 'Transport' })
  fromCategory!: string;

  @ApiProperty({ description: 'Destination category name', example: 'Food and Dining' })
  toCategory!: string;

  @ApiProperty({ description: 'Amount moved', type: QuickRebalanceMonetaryValueDto })
  amount!: QuickRebalanceMonetaryValueDto;

  @ApiProperty({ description: 'Remaining budget in source category', type: QuickRebalanceMonetaryValueDto })
  fromRemaining!: QuickRebalanceMonetaryValueDto;

  @ApiProperty({ description: 'New remaining budget in destination category', type: QuickRebalanceMonetaryValueDto })
  toNewRemaining!: QuickRebalanceMonetaryValueDto;

  @ApiProperty({ description: 'Confirmation message', example: 'Done! 5,000 moved from Transport to Food and Dining' })
  message!: string;
}

/**
 * Surplus category option for rebalance
 */
export class RebalanceOptionDto {
  @ApiProperty({ description: 'Category ID', example: 'transport' })
  categoryId!: string;

  @ApiProperty({ description: 'Category name', example: 'Transport' })
  categoryName!: string;

  @ApiProperty({ description: 'Budgeted amount', example: 50000 })
  budgeted!: number;

  @ApiProperty({ description: 'Amount spent', example: 20000 })
  spent!: number;

  @ApiProperty({ description: 'Raw surplus (budgeted - spent)', example: 30000 })
  surplus!: number;

  @ApiProperty({ description: 'Prorated surplus for remaining days', example: 15000 })
  proratedSurplus!: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency!: string;
}

/**
 * Rebalance options response
 */
export class RebalanceOptionsResponseDto {
  @ApiProperty({ description: 'Available surplus categories', type: [RebalanceOptionDto] })
  options!: RebalanceOptionDto[];

  @ApiProperty({ description: 'Number of rebalances used this period', example: 0 })
  rebalancesUsed!: number;

  @ApiProperty({ description: 'Maximum rebalances allowed per period', example: 2 })
  maxRebalances!: number;

  @ApiProperty({ description: 'Whether user can still rebalance', example: true })
  canRebalance!: boolean;
}
