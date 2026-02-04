import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncomeType, Frequency, Currency } from '@prisma/client';

/**
 * DTO for creating a new income source
 *
 * Represents income from various sources:
 * - Salary, freelance, business income
 * - Investment returns, rental income
 * - Allowances, gifts
 */
export class CreateIncomeDto {
  @ApiProperty({
    example: 'Monthly Salary',
    description: 'Name or label for the income source',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name!: string;

  @ApiProperty({
    enum: IncomeType,
    example: 'SALARY',
    description: 'Type of income',
  })
  @IsEnum(IncomeType, {
    message: `Type must be one of: ${Object.values(IncomeType).join(', ')}`,
  })
  type!: IncomeType;

  @ApiProperty({
    example: 500000,
    description: 'Income amount per frequency period',
    minimum: 0,
    maximum: 1000000000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount cannot be negative' })
  @Max(1000000000, { message: 'Amount cannot exceed 1 billion' })
  @Type(() => Number)
  amount!: number;

  @ApiProperty({
    enum: Frequency,
    example: 'MONTHLY',
    description: 'How often this income is received',
  })
  @IsEnum(Frequency, {
    message: `Frequency must be one of: ${Object.values(Frequency).join(', ')}`,
  })
  frequency!: Frequency;

  @ApiPropertyOptional({
    example: 10,
    description: 'Expected variance percentage for irregular income (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsInt({ message: 'Variance percentage must be an integer' })
  @Min(0, { message: 'Variance percentage cannot be negative' })
  @Max(100, { message: 'Variance percentage cannot exceed 100' })
  @IsOptional()
  @Type(() => Number)
  variancePercentage?: number;

  @ApiPropertyOptional({
    example: 'Primary job at TechCo',
    description: 'Optional description',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'NGN',
    description: 'Currency (defaults to user currency)',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date of income (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'End date of income if temporary (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
