/**
 * Subscription List DTOs
 *
 * DTOs for listing subscriptions with summary and pagination.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { SubscriptionStatus, Currency } from '@prisma/client';
import { SubscriptionDto } from './subscription.dto';

/**
 * Query parameters for listing subscriptions
 */
export class SubscriptionQueryDto {
  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    description: 'Filter by subscription status',
    example: SubscriptionStatus.ZOMBIE,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus, {
    message: 'Status must be one of: ACTIVE, ZOMBIE, UNKNOWN, CANCELLED',
  })
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Number of results to return',
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    description: 'Number of results to skip',
  })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Offset cannot be negative' })
  @Transform(({ value }) => parseInt(value, 10))
  offset?: number = 0;
}

/**
 * Summary statistics for subscription list
 */
export class SubscriptionSummaryDto {
  @ApiProperty({
    example: 8,
    description: 'Total number of detected subscriptions',
  })
  totalSubscriptions!: number;

  @ApiProperty({
    example: 3,
    description: 'Number of zombie (unused) subscriptions',
  })
  zombieCount!: number;

  @ApiProperty({
    example: 4,
    description: 'Number of active subscriptions',
  })
  activeCount!: number;

  @ApiProperty({
    example: 1,
    description: 'Number of subscriptions with unknown status',
  })
  unknownCount!: number;

  @ApiProperty({
    example: 120000,
    description: 'Total monthly cost across all subscriptions',
  })
  totalMonthlyCost!: number;

  @ApiProperty({
    example: 36000,
    description: 'Monthly cost from zombie subscriptions',
  })
  zombieMonthlyCost!: number;

  @ApiProperty({
    example: 432000,
    description: 'Potential annual savings from cancelling zombies',
  })
  potentialAnnualSavings!: number;

  @ApiProperty({
    enum: Currency,
    example: Currency.NGN,
    description: 'Currency for all amounts',
  })
  currency!: Currency;
}

/**
 * Pagination information
 */
export class PaginationDto {
  @ApiProperty({
    example: 8,
    description: 'Total number of results',
  })
  total!: number;

  @ApiProperty({
    example: 20,
    description: 'Results per page',
  })
  limit!: number;

  @ApiProperty({
    example: 0,
    description: 'Results skipped',
  })
  offset!: number;

  @ApiProperty({
    example: false,
    description: 'Whether there are more results',
  })
  hasMore!: boolean;
}

/**
 * Subscription list response DTO
 */
export class SubscriptionListResponseDto {
  @ApiProperty({
    type: [SubscriptionDto],
    description: 'List of subscriptions',
  })
  subscriptions!: SubscriptionDto[];

  @ApiProperty({
    type: SubscriptionSummaryDto,
    description: 'Summary statistics',
  })
  summary!: SubscriptionSummaryDto;

  @ApiProperty({
    type: PaginationDto,
    description: 'Pagination information',
  })
  pagination!: PaginationDto;
}
