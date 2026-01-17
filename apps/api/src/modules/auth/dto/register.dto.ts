import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country } from '@prisma/client';
import { IsStrongPassword } from './password.validator';

/**
 * Registration DTO
 *
 * Validates user registration data:
 * - Email must be valid format
 * - Password must meet complexity requirements (uppercase, lowercase, number)
 * - Name must be 2-100 characters
 * - Country is optional (defaults to NIGERIA)
 */
export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({
    example: 'SecurePass123',
    description:
      'Password (8-100 characters, requires uppercase, lowercase, and number)',
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @IsStrongPassword()
  password!: string;

  @ApiProperty({
    example: 'Chidi Okonkwo',
    description: 'Full name (2-100 characters)',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name!: string;

  @ApiPropertyOptional({
    enum: Country,
    example: 'NIGERIA',
    description: 'Country of residence',
  })
  @IsOptional()
  @IsEnum(Country, { message: 'Please select a valid country' })
  country?: Country;
}
