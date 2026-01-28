/**
 * Track Share DTO
 *
 * Input for tracking share events.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SharePlatform } from '@prisma/client';

export class TrackShareDto {
  @ApiProperty({
    enum: SharePlatform,
    example: 'TWITTER',
    description: 'Platform where the card was shared: TWITTER, LINKEDIN, WHATSAPP, INSTAGRAM',
  })
  @IsEnum(SharePlatform, {
    message: 'platform must be one of: TWITTER, LINKEDIN, WHATSAPP, INSTAGRAM',
  })
  @IsNotEmpty({ message: 'platform is required' })
  platform!: SharePlatform;

  @ApiPropertyOptional({
    example: '192.168.1.1',
    description: 'IP address of the sharer (optional, for analytics)',
  })
  @IsString({ message: 'ipAddress must be a string' })
  @MaxLength(45, { message: 'ipAddress cannot exceed 45 characters' })
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({
    example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)',
    description: 'User agent of the sharer (optional, for analytics)',
  })
  @IsString({ message: 'userAgent must be a string' })
  @MaxLength(500, { message: 'userAgent cannot exceed 500 characters' })
  @IsOptional()
  userAgent?: string;
}
