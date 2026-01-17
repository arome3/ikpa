/**
 * Subscription DTOs
 *
 * Data Transfer Objects for subscription responses.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SubscriptionStatus,
  SubscriptionCategory,
  Currency,
  SwipeAction,
} from '@prisma/client';

/**
 * Annualized framing for subscription cost display
 */
export class AnnualizedFramingDto {
  @ApiProperty({
    example: '₦5,000/month',
    description: 'Formatted monthly cost',
  })
  monthly!: string;

  @ApiProperty({
    example: '₦60,000/year',
    description: 'Formatted annual cost',
  })
  annual!: string;

  @ApiProperty({
    example: "That's equivalent to a weekend trip to Calabar",
    description: 'Relatable context comparison',
  })
  context!: string;

  @ApiProperty({
    example: 'Cancelling could save you ₦60,000 this year',
    description: 'Impact statement',
  })
  impact!: string;
}

/**
 * Last swipe decision on a subscription
 */
export class LastDecisionDto {
  @ApiProperty({
    enum: SwipeAction,
    example: SwipeAction.REVIEW_LATER,
    description: 'The action taken',
  })
  action!: SwipeAction;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the decision was made',
  })
  decidedAt!: Date;
}

/**
 * Single subscription response DTO
 */
export class SubscriptionDto {
  @ApiProperty({
    example: 'sub-123-abc-def',
    description: 'Unique subscription ID',
  })
  id!: string;

  @ApiProperty({
    example: 'Netflix',
    description: 'Subscription service name',
  })
  name!: string;

  @ApiProperty({
    enum: SubscriptionCategory,
    example: SubscriptionCategory.STREAMING,
    description: 'Service category',
  })
  category!: SubscriptionCategory;

  @ApiProperty({
    example: 5000,
    description: 'Monthly cost amount',
  })
  monthlyCost!: number;

  @ApiProperty({
    example: 60000,
    description: 'Annual cost amount (monthly x 12)',
  })
  annualCost!: number;

  @ApiProperty({
    enum: Currency,
    example: Currency.NGN,
    description: 'Currency code',
  })
  currency!: Currency;

  @ApiProperty({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ZOMBIE,
    description: 'Subscription status (ACTIVE, ZOMBIE, UNKNOWN, CANCELLED)',
  })
  status!: SubscriptionStatus;

  @ApiPropertyOptional({
    example: '2025-08-15T00:00:00.000Z',
    description: 'Last usage date (null if unknown)',
  })
  lastUsageDate?: Date | null;

  @ApiProperty({
    example: '2026-01-10T00:00:00.000Z',
    description: 'When the subscription was detected',
  })
  detectedAt!: Date;

  @ApiPropertyOptional({
    example: '2025-03-15T00:00:00.000Z',
    description: 'Date of first charge',
  })
  firstChargeDate?: Date | null;

  @ApiPropertyOptional({
    example: '2026-01-15T00:00:00.000Z',
    description: 'Date of most recent charge',
  })
  lastChargeDate?: Date | null;

  @ApiProperty({
    example: 12,
    description: 'Total number of charges detected',
  })
  chargeCount!: number;

  @ApiProperty({
    type: AnnualizedFramingDto,
    description: 'Annualized cost framing for UI display',
  })
  framing!: AnnualizedFramingDto;

  @ApiPropertyOptional({
    type: LastDecisionDto,
    description: 'Last swipe decision (if any)',
  })
  lastDecision?: LastDecisionDto;
}
