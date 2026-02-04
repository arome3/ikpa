import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Country, Currency, EmploymentType } from '@prisma/client';

/**
 * DTO for updating profile during onboarding
 *
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    enum: Country,
    example: 'NIGERIA',
    description: 'Country of residence',
  })
  @IsEnum(Country, {
    message: `Country must be one of: ${Object.values(Country).join(', ')}`,
  })
  @IsOptional()
  country?: Country;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'NGN',
    description: 'Primary currency',
  })
  @IsEnum(Currency, {
    message: `Currency must be one of: ${Object.values(Currency).join(', ')}`,
  })
  @IsOptional()
  currency?: Currency;

  @ApiPropertyOptional({
    enum: EmploymentType,
    example: 'EMPLOYED',
    description: 'Employment status',
  })
  @IsEnum(EmploymentType, {
    message: `Employment type must be one of: ${Object.values(EmploymentType).join(', ')}`,
  })
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiPropertyOptional({
    example: '1995-06-15',
    description: 'Date of birth (ISO 8601)',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}

/**
 * Response after updating profile
 */
export class UpdateProfileResponseDto {
  @ApiPropertyOptional({ enum: Country, example: 'NIGERIA' })
  country?: Country;

  @ApiPropertyOptional({ enum: Currency, example: 'NGN' })
  currency?: Currency;

  @ApiPropertyOptional({ enum: EmploymentType, example: 'EMPLOYED' })
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: '1995-06-15' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether profile step is now complete',
  })
  profileStepComplete?: boolean;
}
