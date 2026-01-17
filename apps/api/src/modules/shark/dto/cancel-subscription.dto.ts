/**
 * Cancel Subscription DTOs
 *
 * DTOs for subscription cancellation requests and responses.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cancellation request input
 */
export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation (for analytics)',
    maxLength: 500,
    example: 'Not using this service anymore',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
  reason?: string;
}

/**
 * Cancellation result response
 */
export class CancellationResultDto {
  @ApiProperty({
    example: 'sub-123-abc-def',
    description: 'The cancelled subscription ID',
  })
  subscriptionId!: string;

  @ApiProperty({
    example: true,
    description: 'Whether the cancellation was successful',
  })
  success!: boolean;

  @ApiProperty({
    example: 'Subscription marked as cancelled. Annual savings: ₦60,000',
    description: 'Human-readable result message',
  })
  message!: string;

  @ApiProperty({
    example: 60000,
    description: 'Annual amount saved by cancelling',
  })
  annualSavings!: number;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the subscription was cancelled',
  })
  cancelledAt!: Date;
}
