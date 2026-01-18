/**
 * Update Stake DTO
 *
 * Input for updating an existing commitment.
 * Only certain fields can be updated before deadline.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsDateString,
  IsString,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { COMMITMENT_CONSTANTS } from '../constants';

export class UpdateStakeDto {
  @ApiPropertyOptional({
    example: '2027-03-31T23:59:59.000Z',
    description: 'New deadline (can only extend, not shorten)',
  })
  @IsDateString({}, { message: 'deadline must be a valid ISO 8601 date string' })
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({
    example: 75000,
    description: 'Updated stake amount (can only increase)',
    minimum: COMMITMENT_CONSTANTS.MINIMUM_STAKE_AMOUNT,
    maximum: COMMITMENT_CONSTANTS.MAXIMUM_STAKE_AMOUNT,
  })
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
    example: 'Different Opposing Cause',
    description: 'Updated anti-charity cause name',
  })
  @IsString({ message: 'antiCharityCause must be a string' })
  @IsOptional()
  antiCharityCause?: string;

  @ApiPropertyOptional({
    example: 'https://example.org/different-cause',
    description: 'Updated anti-charity URL',
  })
  @IsUrl({}, { message: 'antiCharityUrl must be a valid URL' })
  @IsOptional()
  antiCharityUrl?: string;
}
