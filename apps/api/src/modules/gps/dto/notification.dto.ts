/**
 * GPS Notification DTOs
 *
 * Data transfer objects for the notification system that proactively
 * alerts users about budget events.
 *
 * Answers the user need: "Tell me when I overspend"
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ==========================================
// REQUEST DTOs
// ==========================================

/**
 * Query parameters for notifications list
 */
export class NotificationsQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of notifications to return',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Only return unread notifications',
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  unreadOnly?: boolean = false;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

/**
 * Individual notification item
 */
export class GpsNotificationDto {
  @ApiProperty({
    description: 'Notification ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Notification title',
    example: "You're approaching your Food & Dining limit",
  })
  title!: string;

  @ApiProperty({
    description: 'Notification message',
    example: "You've spent 85% of your Food & Dining budget. Let's check your options.",
  })
  message!: string;

  @ApiProperty({
    description: 'What triggered this notification',
    example: 'BUDGET_WARNING',
    enum: ['BUDGET_WARNING', 'BUDGET_EXCEEDED', 'BUDGET_CRITICAL'],
  })
  triggerType!: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';

  @ApiProperty({
    description: 'Category ID related to the notification',
    example: 'food-dining',
  })
  categoryId!: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Food & Dining',
  })
  categoryName!: string;

  @ApiProperty({
    description: 'Whether the notification has been read',
    example: false,
  })
  isRead!: boolean;

  @ApiPropertyOptional({
    description: 'When the notification was read',
  })
  readAt?: Date;

  @ApiPropertyOptional({
    description: 'Deep link to take action',
    example: '/gps/recovery-paths?category=food-dining',
  })
  actionUrl?: string;

  @ApiProperty({
    description: 'When the notification was created',
  })
  createdAt!: Date;
}

/**
 * Notifications list response
 */
export class NotificationsResponseDto {
  @ApiProperty({
    description: 'List of notifications',
    type: [GpsNotificationDto],
  })
  notifications!: GpsNotificationDto[];

  @ApiProperty({
    description: 'Total count of unread notifications',
    example: 3,
  })
  unreadCount!: number;

  @ApiProperty({
    description: 'Total count of all notifications',
    example: 15,
  })
  totalCount!: number;
}

/**
 * Unread count response
 */
export class UnreadCountResponseDto {
  @ApiProperty({
    description: 'Number of unread notifications',
    example: 3,
  })
  count!: number;

  @ApiProperty({
    description: 'Whether there are any unread notifications',
    example: true,
  })
  hasUnread!: boolean;
}

/**
 * Mark as read response
 */
export class MarkReadResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Number of notifications marked as read',
    example: 3,
  })
  markedCount!: number;
}
