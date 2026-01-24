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
import { Frequency } from '@prisma/client';

/**
 * DTO for updating an existing family support obligation
 *
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateFamilySupportDto {
  @ApiPropertyOptional({
    example: 'Mom',
    description: 'Name or label for the family member',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Amount of support per frequency period',
    minimum: 0,
    maximum: 1000000000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount cannot be negative' })
  @Max(1000000000, { message: 'Amount cannot exceed 1 billion' })
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    enum: Frequency,
    example: 'MONTHLY',
    description: 'How often this support is given',
  })
  @IsOptional()
  @IsEnum(Frequency, {
    message: `Frequency must be one of: ${Object.values(Frequency).join(', ')}`,
  })
  frequency?: Frequency;

  @ApiPropertyOptional({
    example: 'Monthly upkeep for Mom - increased for medical expenses',
    description: 'Description of the support',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this support obligation is active',
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  @Type(() => Boolean)
  isActive?: boolean;
}
