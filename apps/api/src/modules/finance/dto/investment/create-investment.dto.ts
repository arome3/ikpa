import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvestmentType, Currency } from '@prisma/client';

/**
 * DTO for creating a new investment
 *
 * Supports various investment types:
 * - Stocks, bonds, mutual funds
 * - Real estate, pension contributions
 * - Cryptocurrency
 */
export class CreateInvestmentDto {
  @ApiProperty({
    example: 'MTN Stocks',
    description: 'Name or label for the investment',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name!: string;

  @ApiProperty({
    enum: InvestmentType,
    example: 'STOCKS',
    description: 'Type of investment',
  })
  @IsEnum(InvestmentType, {
    message: `Type must be one of: ${Object.values(InvestmentType).join(', ')}`,
  })
  type!: InvestmentType;

  @ApiProperty({
    example: 1000000,
    description: 'Current market value',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Value must be a number' })
  @Min(0, { message: 'Value cannot be negative' })
  @Max(1000000000000, { message: 'Value cannot exceed 1 trillion' })
  @Type(() => Number)
  value!: number;

  @ApiPropertyOptional({
    example: 800000,
    description: 'Original purchase cost (for gain/loss calculation)',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Cost basis must be a number' })
  @Min(0, { message: 'Cost basis cannot be negative' })
  @Max(1000000000000, { message: 'Cost basis cannot exceed 1 trillion' })
  @IsOptional()
  @Type(() => Number)
  costBasis?: number;

  @ApiPropertyOptional({
    example: 'Stanbic IBTC',
    description: 'Financial institution or broker',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Institution name cannot exceed 100 characters' })
  institution?: string;

  @ApiPropertyOptional({
    example: 'Long-term hold for retirement',
    description: 'Optional notes about the investment',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;

  @ApiPropertyOptional({
    example: '2025-06-15',
    description: 'Purchase date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'USD',
    description: 'Currency (defaults to user currency)',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}
