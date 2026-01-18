/**
 * Verify Commitment DTO
 *
 * Input for referee verification of a commitment.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class VerifyCommitmentDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Verification token received in email',
  })
  @IsString({ message: 'token must be a string' })
  @IsNotEmpty({ message: 'token is required' })
  token!: string;

  @ApiProperty({
    example: true,
    description: 'Verification decision: true = goal achieved, false = goal not achieved',
  })
  @IsBoolean({ message: 'decision must be a boolean' })
  @IsNotEmpty({ message: 'decision is required' })
  decision!: boolean;

  @ApiPropertyOptional({
    example: 'Confirmed via bank statement showing emergency fund balance',
    description: 'Optional notes about the verification',
    maxLength: 500,
  })
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes cannot exceed 500 characters' })
  @IsOptional()
  notes?: string;
}

/**
 * Verify commitment response
 */
export class VerifyCommitmentResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'contract-123-abc' })
  contractId!: string;

  @ApiProperty({ example: true })
  decision!: boolean;

  @ApiProperty({ example: 'SUCCEEDED' })
  newStatus!: string;

  @ApiProperty({
    example: { headline: 'Well done!', subtext: 'Your commitment was verified successfully.' },
    description: 'Supportive message with headline and subtext',
  })
  message!: { headline: string; subtext: string };

  @ApiPropertyOptional({
    example: 50000,
    description: 'Amount released or forfeited based on decision',
  })
  stakeProcessed?: number;
}
