import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetPeriod, Currency } from '@prisma/client';

/**
 * DTO for updating a budget
 *
 * All fields are optional - only provided fields will be updated.
 * Note: categoryId cannot be changed; create a new budget instead.
 * Use isActive: false to soft-delete.
 */
export class UpdateBudgetDto {
  @ApiPropertyOptional({
    example: 50000,
    description: 'Budget amount for the period',
    minimum: 0,
    maximum: 1000000000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount cannot be negative' })
  @Max(1000000000, { message: 'Amount cannot exceed 1 billion' })
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    enum: BudgetPeriod,
    example: 'MONTHLY',
    description: 'Budget period (WEEKLY, MONTHLY, QUARTERLY, ANNUALLY)',
  })
  @IsEnum(BudgetPeriod, {
    message: `Period must be one of: ${Object.values(BudgetPeriod).join(', ')}`,
  })
  @IsOptional()
  period?: BudgetPeriod;

  @ApiPropertyOptional({
    example: '2026-02-01',
    description: 'Budget start date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'USD',
    description: 'Currency',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiPropertyOptional({
    example: false,
    description: 'Set to false to soft-delete',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
