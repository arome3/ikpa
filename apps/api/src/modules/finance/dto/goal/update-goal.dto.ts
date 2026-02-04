import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
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
import { GoalCategory, GoalStatus, Currency } from '@prisma/client';

/**
 * DTO for updating a financial goal
 *
 * All fields are optional - only provided fields will be updated.
 * Use status to change goal state (ACTIVE, PAUSED, COMPLETED, CANCELLED).
 */
export class UpdateGoalDto {
  @ApiPropertyOptional({
    example: 'Emergency Fund',
    description: 'Name of the goal',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    enum: GoalCategory,
    example: 'EMERGENCY_FUND',
    description: 'Category of the goal',
  })
  @IsEnum(GoalCategory, {
    message: `Category must be one of: ${Object.values(GoalCategory).join(', ')}`,
  })
  @IsOptional()
  category?: GoalCategory;

  @ApiPropertyOptional({
    example: 1000000,
    description: 'Target amount to save',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Target amount must be a number' })
  @Min(0, { message: 'Target amount cannot be negative' })
  @Max(1000000000000, { message: 'Target amount cannot exceed 1 trillion' })
  @IsOptional()
  @Type(() => Number)
  targetAmount?: number;

  @ApiPropertyOptional({
    example: 250000,
    description: 'Current progress toward the goal',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Current amount must be a number' })
  @Min(0, { message: 'Current amount cannot be negative' })
  @Max(1000000000000, { message: 'Current amount cannot exceed 1 trillion' })
  @IsOptional()
  @Type(() => Number)
  currentAmount?: number;

  @ApiPropertyOptional({
    example: '3 months of expenses for peace of mind',
    description: 'Description of the goal',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Target completion date (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Priority level (lower = higher priority)',
    minimum: 0,
    maximum: 100,
  })
  @IsInt({ message: 'Priority must be an integer' })
  @Min(0, { message: 'Priority cannot be negative' })
  @Max(100, { message: 'Priority cannot exceed 100' })
  @IsOptional()
  @Type(() => Number)
  priority?: number;

  @ApiPropertyOptional({
    enum: GoalStatus,
    example: 'ACTIVE',
    description: 'Goal status (ACTIVE, PAUSED, COMPLETED, CANCELLED)',
  })
  @IsEnum(GoalStatus, {
    message: `Status must be one of: ${Object.values(GoalStatus).join(', ')}`,
  })
  @IsOptional()
  status?: GoalStatus;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'NGN',
    description: 'Currency',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}
