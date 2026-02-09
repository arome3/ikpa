import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Frequency } from '@prisma/client';

/**
 * DTO for creating an expense
 */
export class CreateExpenseDto {
  @ApiProperty({
    description: 'Category ID for the expense',
    example: 'food-dining',
  })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({
    description: 'Expense amount in the specified currency',
    example: 5000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Currency code (defaults to user currency)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Date of the expense (defaults to today)',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Description of the expense',
    example: 'Lunch at Chicken Republic',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Merchant or vendor name',
    example: 'Chicken Republic',
  })
  @IsOptional()
  @IsString()
  merchant?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a recurring expense',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'Frequency for recurring expenses',
    enum: Frequency,
  })
  @IsOptional()
  @IsEnum(Frequency)
  frequency?: Frequency;
}
