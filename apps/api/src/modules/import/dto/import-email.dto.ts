/**
 * Import Email DTO
 *
 * DTOs for managing user import email addresses.
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * User's import email address response
 */
export class ImportEmailResponseDto {
  @ApiProperty({
    description: 'User\'s dedicated import email address',
    example: 'ikpa-a1b2c3d4@import.ikpa.app',
  })
  emailAddress!: string;

  @ApiProperty({
    description: 'Whether the email address is active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'When the email address was created',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last time an email was received',
    example: '2025-01-20T14:45:00Z',
  })
  lastUsedAt?: Date | null;

  @ApiProperty({
    description: 'Instructions for using the import email',
    example: 'Forward your bank alerts to this email address to automatically import transactions.',
  })
  instructions!: string;
}

/**
 * Regenerate email address response
 */
export class RegenerateEmailResponseDto {
  @ApiProperty({
    description: 'New import email address',
    example: 'ikpa-x9y8z7w6@import.ikpa.app',
  })
  emailAddress!: string;

  @ApiProperty({
    description: 'Message about the regeneration',
    example: 'New import email address generated. The old address will no longer receive emails.',
  })
  message!: string;

  @ApiProperty({
    description: 'Number of regenerations remaining today',
    example: 2,
  })
  remainingToday!: number;
}
