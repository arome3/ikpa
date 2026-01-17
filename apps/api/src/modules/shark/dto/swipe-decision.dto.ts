/**
 * Swipe Decision DTOs
 *
 * DTOs for recording and responding to subscription swipe decisions.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum } from 'class-validator';
import { SwipeAction } from '@prisma/client';

/**
 * Swipe decision input DTO
 */
export class SwipeDecisionDto {
  @ApiProperty({
    example: 'sub-123-abc-def',
    description: 'The subscription ID to make a decision on',
  })
  @IsUUID('4', { message: 'subscriptionId must be a valid UUID' })
  subscriptionId!: string;

  @ApiProperty({
    enum: SwipeAction,
    example: SwipeAction.CANCEL,
    description: 'The action to take (KEEP, CANCEL, REVIEW_LATER)',
  })
  @IsEnum(SwipeAction, {
    message: 'Action must be one of: KEEP, CANCEL, REVIEW_LATER',
  })
  action!: SwipeAction;
}

/**
 * Swipe decision response DTO
 */
export class SwipeDecisionResponseDto {
  @ApiProperty({
    example: 'decision-456-ghi-jkl',
    description: 'The created decision ID',
  })
  id!: string;

  @ApiProperty({
    example: 'sub-123-abc-def',
    description: 'The subscription ID',
  })
  subscriptionId!: string;

  @ApiProperty({
    enum: SwipeAction,
    example: SwipeAction.CANCEL,
    description: 'The action taken',
  })
  action!: SwipeAction;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the decision was made',
  })
  decidedAt!: Date;

  @ApiProperty({
    example: 'Subscription queued for cancellation',
    description: 'Human-readable message about the decision',
  })
  message!: string;
}
