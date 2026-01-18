/**
 * Stake Response DTOs
 *
 * Response DTOs for commitment endpoints.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StakeType, VerificationMethod, CommitmentStatus } from '@prisma/client';

/**
 * Referee info in response
 */
export class RefereeInfoDto {
  @ApiProperty({ example: 'referee-123-abc' })
  id!: string;

  @ApiProperty({ example: 'Ada' })
  name!: string;

  @ApiProperty({ example: 'ada@example.com' })
  email!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

/**
 * Supportive message
 */
export class SupportiveMessageDto {
  @ApiProperty({ example: "You've raised the stakes" })
  headline!: string;

  @ApiProperty({ example: 'Research shows you are now 3x more likely to achieve your goal.' })
  subtext!: string;
}

/**
 * Main stake response
 */
export class StakeResponseDto {
  @ApiProperty({ example: 'contract-123-abc' })
  id!: string;

  @ApiProperty({ example: 'goal-456-def' })
  goalId!: string;

  @ApiProperty({ example: 'Emergency Fund' })
  goalName!: string;

  @ApiProperty({ example: 'user-789-ghi' })
  userId!: string;

  @ApiProperty({ enum: StakeType, example: 'SOCIAL' })
  stakeType!: StakeType;

  @ApiPropertyOptional({ example: 50000 })
  stakeAmount!: number | null;

  @ApiPropertyOptional({ example: 'Opposing Political Party Foundation' })
  antiCharityCause!: string | null;

  @ApiProperty({ enum: VerificationMethod, example: 'REFEREE_VERIFY' })
  verificationMethod!: VerificationMethod;

  @ApiProperty({ example: '2026-12-31T23:59:59.000Z' })
  deadline!: Date;

  @ApiProperty({ enum: CommitmentStatus, example: 'ACTIVE' })
  status!: CommitmentStatus;

  @ApiProperty({ example: 45 })
  daysRemaining!: number;

  @ApiProperty({
    example: 0.78,
    description: 'Probability of success (0-1) based on stake type',
  })
  successProbability!: number;

  @ApiPropertyOptional({ type: RefereeInfoDto })
  referee?: RefereeInfoDto;

  @ApiProperty({ type: SupportiveMessageDto })
  message!: SupportiveMessageDto;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  createdAt!: Date;
}

/**
 * Create stake response
 */
export class CreateStakeResponseDto extends StakeResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether a referee invitation was sent',
  })
  refereeInvited!: boolean;
}

/**
 * Pagination metadata
 *
 * Note: Maximum items per page is capped at 100 to prevent excessive
 * database load. Default is 20 items per page.
 */
export class PaginationDto {
  @ApiProperty({
    example: 1,
    description: 'Current page number (1-indexed)',
    minimum: 1,
  })
  page!: number;

  @ApiProperty({
    example: 20,
    description: 'Items per page (default: 20, max: 100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  limit!: number;

  @ApiProperty({ example: 45, description: 'Total number of items' })
  total!: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  totalPages!: number;

  @ApiProperty({ example: true, description: 'Whether there are more pages' })
  hasMore!: boolean;
}

/**
 * Stakes list response for a goal (paginated)
 */
export class StakesListResponseDto {
  @ApiProperty({ type: [StakeResponseDto] })
  data!: StakeResponseDto[];

  @ApiProperty({ example: 'goal-456-def' })
  goalId!: string;

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}

/**
 * Cancel stake response
 */
export class CancelStakeResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'contract-123-abc' })
  contractId!: string;

  @ApiProperty({ example: 'Commitment cancelled successfully. No stakes were forfeited.' })
  message!: string;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Amount refunded if funds were locked',
  })
  refundedAmount?: number;

  @ApiPropertyOptional({
    example: 10000,
    description: 'Penalty amount retained for early cancellation',
  })
  penaltyAmount?: number;
}
