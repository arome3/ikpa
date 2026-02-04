import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetPeriod, Currency } from '@prisma/client';

/**
 * DTO for creating a new budget
 *
 * Budgets are per-category spending limits used by GPS Re-Router
 * to detect overspending and trigger recovery paths.
 */
export class CreateBudgetDto {
  @ApiProperty({
    example: 'food-dining',
    description: 'ID of the expense category to budget',
  })
  @IsString({ message: 'Category ID must be a string' })
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId!: string;

  @ApiProperty({
    example: 50000,
    description: 'Budget amount for the period',
    minimum: 0,
    maximum: 1000000000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount cannot be negative' })
  @Max(1000000000, { message: 'Amount cannot exceed 1 billion' })
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    enum: BudgetPeriod,
    example: 'MONTHLY',
    description: 'Budget period (WEEKLY, MONTHLY, QUARTERLY, ANNUALLY)',
  })
  @IsEnum(BudgetPeriod, {
    message: `Period must be one of: ${Object.values(BudgetPeriod).join(', ')}`,
  })
  period!: BudgetPeriod;

  @ApiPropertyOptional({
    example: '2026-02-01',
    description: 'Budget start date (ISO 8601). Defaults to now.',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'NGN',
    description: 'Currency (defaults to user currency)',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}
