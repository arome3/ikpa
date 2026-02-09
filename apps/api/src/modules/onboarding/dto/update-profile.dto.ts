import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsDateString,
  IsString,
  IsBoolean,
  Matches,
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
    example: 'US',
    description: 'Country of residence',
  })
  @IsEnum(Country, {
    message: `Country must be one of: ${Object.values(Country).join(', ')}`,
  })
  @IsOptional()
  country?: Country;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'USD',
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

  @ApiPropertyOptional({
    example: '+12025551234',
    description: 'Phone number in E.164 format for WhatsApp notifications',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +12025551234)',
  })
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable WhatsApp budget alert notifications',
  })
  @IsBoolean()
  @IsOptional()
  whatsappNotificationsEnabled?: boolean;
}

/**
 * Response after updating profile
 */
export class UpdateProfileResponseDto {
  @ApiPropertyOptional({ enum: Country, example: 'US' })
  country?: Country;

  @ApiPropertyOptional({ enum: Currency, example: 'USD' })
  currency?: Currency;

  @ApiPropertyOptional({ enum: EmploymentType, example: 'EMPLOYED' })
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: '1995-06-15' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: false })
  whatsappNotificationsEnabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether profile step is now complete',
  })
  profileStepComplete?: boolean;
}
