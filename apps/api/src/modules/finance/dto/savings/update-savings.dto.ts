import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SavingsType, Currency } from '@prisma/client';

/**
 * DTO for updating a savings account
 *
 * All fields are optional - only provided fields will be updated.
 * Use isActive: false to soft-delete.
 */
export class UpdateSavingsDto {
  @ApiPropertyOptional({
    example: 'Emergency Fund',
    description: 'Name or label for the savings account',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    enum: SavingsType,
    example: 'BANK_ACCOUNT',
    description: 'Type of savings account',
  })
  @IsEnum(SavingsType, {
    message: `Type must be one of: ${Object.values(SavingsType).join(', ')}`,
  })
  @IsOptional()
  type?: SavingsType;

  @ApiPropertyOptional({
    example: 250000,
    description: 'Current balance',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Balance must be a number' })
  @Min(0, { message: 'Balance cannot be negative' })
  @Max(1000000000000, { message: 'Balance cannot exceed 1 trillion' })
  @IsOptional()
  @Type(() => Number)
  balance?: number;

  @ApiPropertyOptional({
    example: 4.5,
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
    example: 'GTBank',
    description: 'Financial institution name',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Institution name cannot exceed 100 characters' })
  institution?: string;

  @ApiPropertyOptional({
    example: '1234',
    description: 'Last 4 digits of account number',
    maxLength: 4,
  })
  @IsString()
  @IsOptional()
  @MaxLength(4, { message: 'Account number should be last 4 digits only' })
  accountNumber?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Mark as emergency fund',
  })
  @IsBoolean()
  @IsOptional()
  isEmergencyFund?: boolean;

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
