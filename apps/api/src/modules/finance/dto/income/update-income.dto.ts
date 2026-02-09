import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncomeType, Frequency, Currency } from '@prisma/client';

/**
 * DTO for updating an income source
 *
 * All fields are optional - only provided fields will be updated.
 * Use isActive: false to soft-delete.
 */
export class UpdateIncomeDto {
  @ApiPropertyOptional({
    example: 'Monthly Salary',
    description: 'Name or label for the income source',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    enum: IncomeType,
    example: 'SALARY',
    description: 'Type of income',
  })
  @IsEnum(IncomeType, {
    message: `Type must be one of: ${Object.values(IncomeType).join(', ')}`,
  })
  @IsOptional()
  type?: IncomeType;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Income amount per frequency period',
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
    enum: Frequency,
    example: 'MONTHLY',
    description: 'How often this income is received',
  })
  @IsEnum(Frequency, {
    message: `Frequency must be one of: ${Object.values(Frequency).join(', ')}`,
  })
  @IsOptional()
  frequency?: Frequency;

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
    example: 'USD',
    description: 'Currency',
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

  @ApiPropertyOptional({
    example: false,
    description: 'Set to false to soft-delete',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
