import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Reset Password DTO
 *
 * Validates password reset data:
 * - Token from email link
 * - New password (8-100 characters)
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token from email',
  })
  @IsString({ message: 'Reset token is required' })
  token!: string;

  @ApiProperty({
    example: 'newSecurePassword123',
    description: 'New password (8-100 characters)',
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
  password!: string;
}
