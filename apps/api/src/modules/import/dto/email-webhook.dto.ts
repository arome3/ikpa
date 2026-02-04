/**
 * Email Webhook DTO
 *
 * DTOs for handling Resend inbound email webhooks.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Email webhook data payload
 */
class EmailWebhookDataDto {
  @ApiProperty({
    description: 'Resend email ID',
    example: 'email-abc-123',
  })
  @IsString()
  email_id!: string;

  @ApiProperty({
    description: 'Sender email address',
    example: 'alerts@gtbank.com',
  })
  @IsString()
  from!: string;

  @ApiProperty({
    description: 'Recipient email addresses',
    example: ['ikpa-abc123@import.ikpa.app'],
  })
  @IsArray()
  @IsString({ each: true })
  to!: string[];

  @ApiProperty({
    description: 'Email subject',
    example: 'GTBank Debit Alert',
  })
  @IsString()
  subject!: string;
}

/**
 * Resend inbound email webhook payload
 */
export class EmailWebhookDto {
  @ApiProperty({
    description: 'Webhook event type',
    example: 'email.received',
  })
  @IsString()
  type!: string;

  @ApiProperty({
    description: 'Event timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  @IsString()
  created_at!: string;

  @ApiProperty({
    description: 'Email data',
    type: EmailWebhookDataDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => EmailWebhookDataDto)
  data!: EmailWebhookDataDto;
}

/**
 * Response for email webhook
 */
export class EmailWebhookResponseDto {
  @ApiProperty({
    description: 'Whether the webhook was processed successfully',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Import job ID if processing started',
    example: 'job-789-abc-def',
  })
  jobId?: string;

  @ApiProperty({
    description: 'Message about the webhook processing',
    example: 'Email received and processing started',
  })
  message!: string;
}
