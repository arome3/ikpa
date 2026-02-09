import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod, Currency } from '@prisma/client';

/**
 * Category info embedded in budget response
 */
export class BudgetCategoryDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'Food & Dining' })
  name!: string;

  @ApiProperty({ example: 'utensils' })
  icon!: string;

  @ApiProperty({ example: '#FF6B6B' })
  color!: string;
}

/**
 * Response DTO for budget
 */
export class BudgetResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'uuid-here', description: 'The expense category ID' })
  categoryId!: string;

  @ApiProperty({ type: BudgetCategoryDto })
  category!: BudgetCategoryDto;

  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ enum: Currency, example: 'USD' })
  currency!: Currency;

  @ApiProperty({ enum: BudgetPeriod, example: 'MONTHLY' })
  period!: BudgetPeriod;

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  startDate!: Date;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({
    example: 35000,
    description: 'Amount spent in current period (if calculated)',
  })
  spent?: number;

  @ApiPropertyOptional({
    example: 15000,
    description: 'Remaining budget (if calculated)',
  })
  remaining?: number;

  @ApiPropertyOptional({
    example: 70,
    description: 'Percentage of budget used (if calculated)',
  })
  percentUsed?: number;
}

/**
 * Response DTO for list of budgets
 */
export class BudgetListResponseDto {
  @ApiProperty({ type: [BudgetResponseDto] })
  items!: BudgetResponseDto[];

  @ApiProperty({ example: 5 })
  count!: number;

  @ApiProperty({
    example: 250000,
    description: 'Total budget across all categories',
  })
  totalBudget!: number;

  @ApiPropertyOptional({
    example: 175000,
    description: 'Total spent across all categories (if calculated)',
  })
  totalSpent?: number;

  @ApiPropertyOptional({
    example: 75000,
    description: 'Total remaining across all categories (if calculated)',
  })
  totalRemaining?: number;
}
