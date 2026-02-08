import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO for upgrade eligibility check
 */
export class CheckUpgradeEligibilityResponseDto {
  @ApiProperty()
  eligible!: boolean;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: ['SOCIAL', 'ANTI_CHARITY', 'LOSS_POOL'] })
  suggestedStakeType!: string;

  @ApiProperty()
  suggestedAmount!: number;

  @ApiProperty()
  dailyAmount!: number;

  @ApiProperty()
  streakDays!: number;

  @ApiProperty({ type: [Object] })
  linkedGoals!: Array<{ id: string; name: string; targetAmount: number }>;
}

/**
 * Input DTO for upgrading a micro-commitment to a staked contract
 */
export class UpgradeCommitmentDto {
  @ApiProperty({ description: 'Goal ID to create the commitment contract for' })
  @IsString()
  @IsNotEmpty()
  goalId!: string;

  @ApiProperty({ description: 'Stake type', enum: ['SOCIAL', 'ANTI_CHARITY', 'LOSS_POOL'] })
  @IsString()
  @IsNotEmpty()
  stakeType!: string;

  @ApiPropertyOptional({ description: 'Stake amount for ANTI_CHARITY or LOSS_POOL' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stakeAmount?: number;

  @ApiPropertyOptional({ description: 'Anti-charity cause name' })
  @IsString()
  @IsOptional()
  antiCharityCause?: string;

  @ApiPropertyOptional({ description: 'Anti-charity URL' })
  @IsString()
  @IsOptional()
  antiCharityUrl?: string;

  @ApiProperty({ description: 'Verification method', enum: ['SELF_REPORT', 'REFEREE_VERIFY', 'AUTO_DETECT'] })
  @IsString()
  @IsNotEmpty()
  verificationMethod!: string;

  @ApiProperty({ description: 'Deadline for the commitment (ISO date string)' })
  @IsString()
  @IsNotEmpty()
  deadline!: string;

  @ApiPropertyOptional({ description: 'Referee email for SOCIAL stakes' })
  @IsString()
  @IsOptional()
  refereeEmail?: string;

  @ApiPropertyOptional({ description: 'Referee name' })
  @IsString()
  @IsOptional()
  refereeName?: string;

  @ApiPropertyOptional({ description: 'Referee relationship', enum: ['FRIEND', 'FAMILY', 'COLLEAGUE', 'COACH'] })
  @IsString()
  @IsOptional()
  refereeRelationship?: string;
}

/**
 * Response DTO for upgrade operation
 */
export class UpgradeCommitmentResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  contractId!: string;

  @ApiProperty()
  microCommitmentId!: string;

  @ApiProperty()
  message!: string;
}
