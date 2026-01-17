/**
 * Email Verification DTOs
 *
 * DTOs for email verification endpoints.
 *
 * @module EmailVerificationDto
 */

import { IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Verify Email DTO
 *
 * Validates email verification token from verification link.
 */
export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token from the verification link',
    example: 'abc123def456...',
  })
  @IsString({ message: 'Verification token is required' })
  token!: string;
}

/**
 * Resend Verification DTO
 *
 * Validates request to resend verification email.
 */
export class ResendVerificationDto {
  @ApiProperty({
    description: 'Email address to resend verification to',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;
}

/**
 * Email Verification Response
 *
 * Response after successful email verification.
 */
export class EmailVerificationResponseDto {
  @ApiProperty({
    description: 'Whether email was successfully verified',
    example: true,
  })
  verified!: boolean;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Email verified successfully',
  })
  message!: string;
}
