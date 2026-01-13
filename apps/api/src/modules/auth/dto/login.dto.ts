import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Login DTO
 *
 * Validates login credentials:
 * - Email must be valid format
 * - Password is required (no length validation on login)
 */
export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({
    example: 'securePassword123',
    description: 'User password',
  })
  @IsString({ message: 'Password is required' })
  password!: string;
}
