/**
 * Create Stake DTO
 *
 * Input for creating a new commitment with stakes.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEmail,
  IsUrl,
  Min,
  Max,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StakeType, VerificationMethod, RefereeRelationship } from '@prisma/client';
import { COMMITMENT_CONSTANTS } from '../constants';

export class CreateStakeDto {
  @ApiPropertyOptional({
    example: 'create-stake-user123-goal456-1704067200',
    description: 'Client-provided idempotency key to prevent duplicate commitments on retry',
    maxLength: 128,
  })
  @IsString({ message: 'idempotencyKey must be a string' })
  @MaxLength(128, { message: 'idempotencyKey cannot exceed 128 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'idempotencyKey can only contain alphanumeric characters, underscores, and hyphens',
  })
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({
    example: 'session-123-abc-def',
    description: 'AI coach negotiation session ID, if this commitment was created via the AI coach. Enables Opik tracking.',
  })
  @IsString({ message: 'negotiationSessionId must be a string' })
  @IsOptional()
  negotiationSessionId?: string;

  @ApiProperty({
    example: 'goal-123-abc-def',
    description: 'The ID of the goal to commit to',
  })
  @IsUUID('4', { message: 'goalId must be a valid UUID' })
  @IsNotEmpty({ message: 'goalId is required' })
  goalId!: string;

  @ApiProperty({
    enum: StakeType,
    example: 'SOCIAL',
    description: 'Type of stake: SOCIAL (referee verification), ANTI_CHARITY (donate to opposing cause), or LOSS_POOL (funds locked)',
  })
  @IsEnum(StakeType, { message: 'stakeType must be one of: SOCIAL, ANTI_CHARITY, LOSS_POOL' })
  @IsNotEmpty({ message: 'stakeType is required' })
  stakeType!: StakeType;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Stake amount in user currency. Required for ANTI_CHARITY and LOSS_POOL types.',
    minimum: COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT,
    maximum: COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT,
  })
  @ValidateIf((o) => o.stakeType === 'ANTI_CHARITY' || o.stakeType === 'LOSS_POOL')
  @IsNumber({}, { message: 'stakeAmount must be a number' })
  @Min(COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT, {
    message: `stakeAmount must be at least ${COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT}`,
  })
  @Max(COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT, {
    message: `stakeAmount cannot exceed ${COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT}`,
  })
  @Type(() => Number)
  @IsOptional()
  stakeAmount?: number;

  @ApiPropertyOptional({
    example: 'Opposing Political Party Foundation',
    description: 'Name of the anti-charity cause. Required for ANTI_CHARITY type.',
    maxLength: 200,
  })
  @ValidateIf((o) => o.stakeType === 'ANTI_CHARITY')
  @IsString({ message: 'antiCharityCause must be a string' })
  @IsNotEmpty({ message: 'antiCharityCause is required for ANTI_CHARITY stake type' })
  @MaxLength(200, { message: 'antiCharityCause cannot exceed 200 characters' })
  @IsOptional()
  antiCharityCause?: string;

  @ApiPropertyOptional({
    example: 'https://example.org/opposing-cause',
    description: 'URL of the anti-charity organization (optional)',
  })
  @IsUrl({}, { message: 'antiCharityUrl must be a valid URL' })
  @IsOptional()
  antiCharityUrl?: string;

  @ApiProperty({
    enum: VerificationMethod,
    example: 'REFEREE_VERIFY',
    description: 'How goal completion will be verified',
  })
  @IsEnum(VerificationMethod, {
    message: 'verificationMethod must be one of: SELF_REPORT, REFEREE_VERIFY, AUTO_DETECT',
  })
  @IsNotEmpty({ message: 'verificationMethod is required' })
  verificationMethod!: VerificationMethod;

  @ApiProperty({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Deadline for achieving the goal (ISO 8601 format)',
  })
  @IsDateString({}, { message: 'deadline must be a valid ISO 8601 date string' })
  @IsNotEmpty({ message: 'deadline is required' })
  deadline!: string;

  @ApiPropertyOptional({
    example: 'sister@example.com',
    description: 'Email of the referee. Required for SOCIAL stake type or REFEREE_VERIFY method.',
  })
  @ValidateIf((o) => o.stakeType === 'SOCIAL' || o.verificationMethod === 'REFEREE_VERIFY')
  @IsEmail({}, { message: 'refereeEmail must be a valid email address' })
  @IsNotEmpty({ message: 'refereeEmail is required for SOCIAL stakes or REFEREE_VERIFY method' })
  @IsOptional()
  refereeEmail?: string;

  @ApiPropertyOptional({
    example: 'Ada',
    description: 'Name of the referee. Required when refereeEmail is provided.',
    maxLength: 100,
  })
  @ValidateIf((o) => o.refereeEmail)
  @IsString({ message: 'refereeName must be a string' })
  @IsNotEmpty({ message: 'refereeName is required when refereeEmail is provided' })
  @MaxLength(100, { message: 'refereeName cannot exceed 100 characters' })
  @IsOptional()
  refereeName?: string;

  @ApiPropertyOptional({
    enum: RefereeRelationship,
    example: 'FAMILY',
    description: 'Relationship to the referee. Required when refereeEmail is provided.',
  })
  @ValidateIf((o) => o.refereeEmail)
  @IsEnum(RefereeRelationship, {
    message: 'refereeRelationship must be one of: FRIEND, FAMILY, COLLEAGUE, COACH',
  })
  @IsNotEmpty({ message: 'refereeRelationship is required when refereeEmail is provided' })
  @IsOptional()
  refereeRelationship?: RefereeRelationship;
}
