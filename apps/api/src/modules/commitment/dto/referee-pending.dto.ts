/**
 * Referee Pending DTOs
 *
 * DTOs for referee-facing endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { StakeType } from '@prisma/client';

/**
 * Query params for pending verifications
 */
export class RefereePendingQueryDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Referee authentication token',
  })
  @IsString({ message: 'token must be a string' })
  @IsNotEmpty({ message: 'token is required' })
  token!: string;
}

/**
 * Single pending verification item
 */
export class PendingVerificationDto {
  @ApiProperty({ example: 'contract-123-abc' })
  contractId!: string;

  @ApiProperty({ example: 'Emergency Fund Goal' })
  goalName!: string;

  @ApiProperty({ example: 'Emeka' })
  userName!: string;

  @ApiProperty({ example: 'emeka@example.com' })
  userEmail!: string;

  @ApiProperty({ enum: StakeType, example: 'SOCIAL' })
  stakeType!: StakeType;

  @ApiPropertyOptional({ example: 50000 })
  stakeAmount!: number | null;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  deadline!: Date;

  @ApiProperty({
    example: 2,
    description: 'Number of days since deadline passed (0 if not passed yet)',
  })
  daysOverdue!: number;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt!: Date;
}

/**
 * Pending verifications response
 */
export class PendingVerificationsResponseDto {
  @ApiProperty({ type: [PendingVerificationDto] })
  pending!: PendingVerificationDto[];

  @ApiProperty({ example: 2 })
  total!: number;

  @ApiProperty({ example: 'referee-123-abc' })
  refereeId!: string;

  @ApiProperty({ example: 'Ada' })
  refereeName!: string;
}

/**
 * Accept referee invitation
 */
export class AcceptInviteDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Invitation token from email',
  })
  @IsString({ message: 'token must be a string' })
  @IsNotEmpty({ message: 'token is required' })
  token!: string;
}

/**
 * Accept invite response
 */
export class AcceptInviteResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'referee-123-abc' })
  refereeId!: string;

  @ApiProperty({
    example: "Welcome! You're now an accountability partner for Emeka.",
  })
  message!: string;

  @ApiProperty({
    example: 'Emeka',
    description: 'Name of the user you are now a referee for',
  })
  userName!: string;
}
