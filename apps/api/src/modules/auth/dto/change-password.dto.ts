/**
 * Change Password DTO
 *
 * DTO for authenticated password change.
 * Requires current password verification before accepting new password.
 *
 * @module ChangePasswordDto
 */

import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from './password.validator';

/**
 * Change Password DTO
 *
 * Validates authenticated password change request.
 * - Current password must be verified
 * - New password must meet complexity requirements
 * - New password cannot be same as current
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'CurrentPass123',
  })
  @IsString({ message: 'Current password is required' })
  currentPassword!: string;

  @ApiProperty({
    description:
      'New password (8-100 characters, requires uppercase, lowercase, and number)',
    example: 'NewSecurePass456',
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}

/**
 * Password Changed Response DTO
 *
 * Response after successful password change.
 */
export class PasswordChangedResponseDto {
  @ApiProperty({
    description: 'Whether password was successfully changed',
    example: true,
  })
  changed!: boolean;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Password changed successfully',
  })
  message!: string;

  @ApiProperty({
    description:
      'Whether all other sessions were revoked (security best practice)',
    example: true,
  })
  sessionsRevoked!: boolean;
}
