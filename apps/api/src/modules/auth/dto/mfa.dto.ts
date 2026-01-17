/**
 * MFA (Multi-Factor Authentication) DTOs
 *
 * DTOs for TOTP-based MFA endpoints including setup,
 * verification, backup codes, and status.
 *
 * @module MfaDto
 */

import { IsString, Length, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * MFA Setup Response DTO
 *
 * Response when initiating MFA setup, includes
 * QR code and manual entry secret.
 */
export class MfaSetupResponseDto {
  @ApiProperty({
    description: 'Base64 encoded QR code image for authenticator app',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
  })
  qrCode!: string;

  @ApiProperty({
    description: 'Secret key for manual entry in authenticator app',
    example: 'JBSWY3DPEHPK3PXP',
  })
  secret!: string;

  @ApiProperty({
    description: 'OTP Auth URL for authenticator apps',
    example: 'otpauth://totp/IKPA:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=IKPA',
  })
  otpAuthUrl!: string;
}

/**
 * Verify MFA Setup DTO
 *
 * Confirms MFA setup by verifying a TOTP code.
 */
export class VerifyMfaSetupDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must contain only digits' })
  code!: string;
}

/**
 * Verify MFA Login DTO
 *
 * Completes login by verifying MFA code.
 * Used when login returns MFA challenge.
 */
export class VerifyMfaLoginDto {
  @ApiProperty({
    description: 'Temporary MFA token from login response',
    example: 'mfa_token_abc123...',
  })
  @IsString({ message: 'MFA token is required' })
  mfaToken!: string;

  @ApiProperty({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must contain only digits' })
  code!: string;
}

/**
 * Verify MFA Backup Code DTO
 *
 * Completes login using a backup code when
 * authenticator is unavailable.
 */
export class VerifyMfaBackupCodeDto {
  @ApiProperty({
    description: 'Temporary MFA token from login response',
    example: 'mfa_token_abc123...',
  })
  @IsString({ message: 'MFA token is required' })
  mfaToken!: string;

  @ApiProperty({
    description: 'One-time backup code',
    example: 'ABCD1234',
  })
  @IsString()
  @Length(8, 8, { message: 'Backup code must be exactly 8 characters' })
  backupCode!: string;
}

/**
 * Disable MFA DTO
 *
 * Requires current TOTP code or password to disable MFA.
 */
export class DisableMfaDto {
  @ApiPropertyOptional({
    description: '6-digit TOTP code from authenticator app',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'TOTP code must contain only digits' })
  code?: string;

  @ApiPropertyOptional({
    description: 'Current password (alternative to TOTP code)',
    example: 'currentPassword123',
  })
  @IsOptional()
  @IsString()
  password?: string;
}

/**
 * MFA Status Response DTO
 *
 * Returns current MFA configuration status.
 */
export class MfaStatusResponseDto {
  @ApiProperty({
    description: 'Whether MFA is enabled for the account',
    example: true,
  })
  enabled!: boolean;

  @ApiProperty({
    description: 'MFA method (currently only TOTP)',
    example: 'TOTP',
  })
  method!: string;

  @ApiProperty({
    description: 'When MFA was last verified',
    example: '2024-01-15T10:30:00Z',
    nullable: true,
  })
  lastUsedAt!: Date | null;

  @ApiProperty({
    description: 'Number of remaining backup codes',
    example: 8,
  })
  backupCodesRemaining!: number;
}

/**
 * Regenerate Backup Codes Response DTO
 *
 * Returns new backup codes after regeneration.
 * Old codes are invalidated.
 */
export class BackupCodesResponseDto {
  @ApiProperty({
    description: 'New one-time backup codes',
    example: ['ABCD1234', 'EFGH5678', 'IJKL9012'],
    type: [String],
  })
  backupCodes!: string[];

  @ApiProperty({
    description: 'Warning message about storing codes safely',
    example: 'Store these codes securely. They can only be used once.',
  })
  message!: string;
}

/**
 * MFA Challenge Response DTO
 *
 * Returned from login when MFA is required.
 */
export class MfaChallengeResponseDto {
  @ApiProperty({
    description: 'Indicates MFA verification is required',
    example: true,
  })
  mfaRequired!: boolean;

  @ApiProperty({
    description: 'Temporary token for MFA verification',
    example: 'mfa_abc123def456...',
  })
  mfaToken!: string;

  @ApiProperty({
    description: 'Available MFA methods',
    example: ['TOTP'],
    type: [String],
  })
  methods!: string[];
}
