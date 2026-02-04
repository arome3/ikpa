import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DebtType, Currency } from '@prisma/client';

/**
 * DTO for creating a new debt
 *
 * Supports various debt types:
 * - Bank loans, credit cards
 * - BNPL (Buy Now Pay Later) - common in Africa
 * - Personal loans, mortgages
 * - Student loans, business loans
 */
export class CreateDebtDto {
  @ApiProperty({
    example: 'Car Loan',
    description: 'Name or label for the debt',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name!: string;

  @ApiProperty({
    enum: DebtType,
    example: 'BANK_LOAN',
    description: 'Type of debt',
  })
  @IsEnum(DebtType, {
    message: `Type must be one of: ${Object.values(DebtType).join(', ')}`,
  })
  type!: DebtType;

  @ApiProperty({
    example: 2000000,
    description: 'Original loan amount',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Original amount must be a number' })
  @Min(0, { message: 'Original amount cannot be negative' })
  @Max(1000000000000, { message: 'Original amount cannot exceed 1 trillion' })
  @Type(() => Number)
  originalAmount!: number;

  @ApiProperty({
    example: 1500000,
    description: 'Current remaining balance',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Remaining balance must be a number' })
  @Min(0, { message: 'Remaining balance cannot be negative' })
  @Max(1000000000000, { message: 'Remaining balance cannot exceed 1 trillion' })
  @Type(() => Number)
  remainingBalance!: number;

  @ApiProperty({
    example: 15.5,
    description: 'Annual interest rate percentage',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber({}, { message: 'Interest rate must be a number' })
  @Min(0, { message: 'Interest rate cannot be negative' })
  @Max(100, { message: 'Interest rate cannot exceed 100%' })
  @Type(() => Number)
  interestRate!: number;

  @ApiProperty({
    example: 75000,
    description: 'Minimum monthly payment',
    minimum: 0,
    maximum: 1000000000,
  })
  @IsNumber({}, { message: 'Minimum payment must be a number' })
  @Min(0, { message: 'Minimum payment cannot be negative' })
  @Max(1000000000, { message: 'Minimum payment cannot exceed 1 billion' })
  @Type(() => Number)
  minimumPayment!: number;

  @ApiProperty({
    example: '2025-01-15',
    description: 'Loan start date (ISO 8601)',
  })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    example: 15,
    description: 'Day of month payment is due (1-31)',
    minimum: 1,
    maximum: 31,
  })
  @IsInt({ message: 'Due date must be an integer' })
  @Min(1, { message: 'Due date must be between 1 and 31' })
  @Max(31, { message: 'Due date must be between 1 and 31' })
  @IsOptional()
  @Type(() => Number)
  dueDate?: number;

  @ApiPropertyOptional({
    example: 'Access Bank',
    description: 'Lender institution name',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Institution name cannot exceed 100 characters' })
  institution?: string;

  @ApiPropertyOptional({
    example: 'Loan for Toyota Corolla',
    description: 'Optional notes',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  notes?: string;

  @ApiPropertyOptional({
    example: '2027-01-15',
    description: 'Target payoff date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  targetPayoffDate?: string;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'NGN',
    description: 'Currency (defaults to user currency)',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}
