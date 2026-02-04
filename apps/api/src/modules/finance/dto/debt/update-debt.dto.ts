import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DebtType, Currency } from '@prisma/client';

/**
 * DTO for updating a debt
 *
 * All fields are optional - only provided fields will be updated.
 * Use isActive: false to soft-delete (e.g., when paid off).
 */
export class UpdateDebtDto {
  @ApiPropertyOptional({
    example: 'Car Loan',
    description: 'Name or label for the debt',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    enum: DebtType,
    example: 'BANK_LOAN',
    description: 'Type of debt',
  })
  @IsEnum(DebtType, {
    message: `Type must be one of: ${Object.values(DebtType).join(', ')}`,
  })
  @IsOptional()
  type?: DebtType;

  @ApiPropertyOptional({
    example: 2000000,
    description: 'Original loan amount',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Original amount must be a number' })
  @Min(0, { message: 'Original amount cannot be negative' })
  @Max(1000000000000, { message: 'Original amount cannot exceed 1 trillion' })
  @IsOptional()
  @Type(() => Number)
  originalAmount?: number;

  @ApiPropertyOptional({
    example: 1500000,
    description: 'Current remaining balance',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Remaining balance must be a number' })
  @Min(0, { message: 'Remaining balance cannot be negative' })
  @Max(1000000000000, { message: 'Remaining balance cannot exceed 1 trillion' })
  @IsOptional()
  @Type(() => Number)
  remainingBalance?: number;

  @ApiPropertyOptional({
    example: 15.5,
    description: 'Annual interest rate percentage',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber({}, { message: 'Interest rate must be a number' })
  @Min(0, { message: 'Interest rate cannot be negative' })
  @Max(100, { message: 'Interest rate cannot exceed 100%' })
  @IsOptional()
  @Type(() => Number)
  interestRate?: number;

  @ApiPropertyOptional({
    example: 75000,
    description: 'Minimum monthly payment',
    minimum: 0,
    maximum: 1000000000,
  })
  @IsNumber({}, { message: 'Minimum payment must be a number' })
  @Min(0, { message: 'Minimum payment cannot be negative' })
  @Max(1000000000, { message: 'Minimum payment cannot exceed 1 billion' })
  @IsOptional()
  @Type(() => Number)
  minimumPayment?: number;

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
    description: 'Currency',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;

  @ApiPropertyOptional({
    example: false,
    description: 'Set to false to soft-delete (e.g., when paid off)',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
