/**
 * GPS Budget Insight DTOs
 *
 * Request/response DTOs for the budget realism analysis feature.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * Monthly spending history entry DTO
 */
export class MonthlyHistoryDto {
  @ApiProperty({
    example: '2026-01',
    description: 'Month in YYYY-MM format',
  })
  month!: string;

  @ApiProperty({
    example: 680,
    description: 'Amount spent in this month',
  })
  spent!: number;
}

/**
 * Offset suggestion DTO
 */
export class OffsetSuggestionDto {
  @ApiProperty({
    example: 'cat-456-def',
    description: 'Category ID of the surplus category',
  })
  categoryId!: string;

  @ApiProperty({
    example: 'Entertainment',
    description: 'Name of the surplus category',
  })
  categoryName!: string;

  @ApiProperty({
    example: 200,
    description: 'Current budget of the surplus category',
  })
  currentBudget!: number;

  @ApiProperty({
    example: 115,
    description: 'Suggested reduction amount',
  })
  suggestedReduction!: number;

  @ApiProperty({
    example: 150,
    description: 'Average monthly surplus in this category',
  })
  averageSurplus!: number;
}

/**
 * Budget insight response DTO
 */
export class BudgetInsightDto {
  @ApiProperty({
    example: 'insight_cat-123_1706900000000',
    description: 'Unique identifier for the insight',
  })
  id!: string;

  @ApiProperty({
    enum: ['UNREALISTIC_BUDGET', 'CURRENT_MONTH_EXCEEDED', 'CONSISTENT_SURPLUS', 'NEW_CATEGORY'],
    example: 'UNREALISTIC_BUDGET',
    description: 'Type of insight detected',
  })
  type!: 'UNREALISTIC_BUDGET' | 'CURRENT_MONTH_EXCEEDED' | 'CONSISTENT_SURPLUS' | 'NEW_CATEGORY';

  @ApiProperty({
    example: 'Food & Dining',
    description: 'Category name',
  })
  category!: string;

  @ApiProperty({
    example: 'cat-123-abc',
    description: 'Category ID',
  })
  categoryId!: string;

  @ApiProperty({
    example: 500,
    description: 'Current budgeted amount',
  })
  budgeted!: number;

  @ApiProperty({
    example: 680,
    description: 'Average monthly spending over the lookback period',
  })
  averageSpent!: number;

  @ApiProperty({
    example: 3,
    description: 'Number of months where spending exceeded budget',
  })
  monthsExceeded!: number;

  @ApiProperty({
    type: [MonthlyHistoryDto],
    description: 'Monthly spending history for the lookback period',
  })
  monthlyHistory!: MonthlyHistoryDto[];

  @ApiProperty({
    example: 720,
    description: 'Suggested new budget amount',
  })
  suggestedBudget!: number;

  @ApiProperty({
    type: OffsetSuggestionDto,
    description: 'Offset suggestion from a surplus category',
    required: false,
  })
  offsetSuggestion?: OffsetSuggestionDto;

  @ApiProperty({
    example: "You've averaged $680/month on Food & Dining but your budget is $500",
    description: 'Human-readable message explaining the insight',
  })
  message!: string;
}

/**
 * Budget insights response DTO
 */
export class BudgetInsightsResponseDto {
  @ApiProperty({
    type: [BudgetInsightDto],
    description: 'Array of budget insights',
  })
  insights!: BudgetInsightDto[];

  @ApiProperty({
    example: true,
    description: 'Whether any unrealistic budgets were found',
  })
  hasUnrealisticBudgets!: boolean;
}

/**
 * Apply budget insight request DTO
 */
export class ApplyBudgetInsightRequestDto {
  @ApiProperty({
    example: 'cat-123-abc',
    description: 'Category ID of the underfunded budget',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId!: string;

  @ApiProperty({
    example: 720,
    description: 'New budget amount for the underfunded category',
  })
  @IsNumber()
  @Min(0, { message: 'Suggested budget must be non-negative' })
  suggestedBudget!: number;

  @ApiPropertyOptional({
    example: 'cat-456-def',
    description: 'Category ID of the surplus category to offset',
  })
  @IsString()
  @IsOptional()
  offsetCategoryId?: string;

  @ApiPropertyOptional({
    example: 115,
    description: 'Amount to reduce from the offset category',
  })
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Offset amount must be non-negative' })
  offsetAmount?: number;
}

/**
 * Apply budget insight response DTO
 */
export class ApplyBudgetInsightResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the adjustment was applied successfully',
  })
  success!: boolean;

  @ApiProperty({
    description: 'Updated budget amounts',
  })
  updated!: Array<{ categoryId: string; newAmount: number }>;

  @ApiProperty({
    example: 'Budget adjusted successfully',
    description: 'Confirmation message',
  })
  message!: string;
}
