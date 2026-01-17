import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from './password.validator';

/**
 * Reset Password DTO
 *
 * Validates password reset data:
 * - Token from email link
 * - New password meeting complexity requirements
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token from email',
  })
  @IsString({ message: 'Reset token is required' })
  token!: string;

  @ApiProperty({
    example: 'NewSecurePass123',
    description:
      'New password (8-100 characters, requires uppercase, lowercase, and number)',
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @IsStrongPassword()
  password!: string;
}
