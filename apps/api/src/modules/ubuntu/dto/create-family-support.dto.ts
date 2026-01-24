import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RelationshipType, Frequency, Currency } from '@prisma/client';

/**
 * DTO for creating a new family support obligation
 *
 * Represents ongoing family support commitments like:
 * - Monthly allowance to parents
 * - Sibling's school fees
 * - Extended family contributions
 */
export class CreateFamilySupportDto {
  @ApiProperty({
    example: 'Mom',
    description: 'Name or label for the family member',
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name!: string;

  @ApiProperty({
    enum: RelationshipType,
    example: 'PARENT',
    description: 'Relationship to the person receiving support',
  })
  @IsEnum(RelationshipType, {
    message: `Relationship must be one of: ${Object.values(RelationshipType).join(', ')}`,
  })
  relationship!: RelationshipType;

  @ApiProperty({
    example: 40000,
    description: 'Amount of support per frequency period',
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
    description: 'How often this support is given',
  })
  @IsEnum(Frequency, {
    message: `Frequency must be one of: ${Object.values(Frequency).join(', ')}`,
  })
  frequency!: Frequency;

  @ApiPropertyOptional({
    example: 'Monthly upkeep for Mom',
    description: 'Optional description of the support',
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
}

/**
 * Response after creating family support
 */
export class FamilySupportResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'Mom' })
  name!: string;

  @ApiProperty({ enum: RelationshipType, example: 'PARENT' })
  relationship!: RelationshipType;

  @ApiProperty({ example: 40000 })
  amount!: number;

  @ApiProperty({ enum: Currency, example: 'NGN' })
  currency!: Currency;

  @ApiProperty({ enum: Frequency, example: 'MONTHLY' })
  frequency!: Frequency;

  @ApiProperty({ example: 'Monthly upkeep for Mom', required: false })
  description?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({
    description: 'Reframed transaction label',
    example: 'Social Capital Investment',
  })
  reframedLabel!: string;
}
