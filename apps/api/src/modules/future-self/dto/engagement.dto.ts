/**
 * Future Self Engagement DTOs
 *
 * Request/response types for tracking letter engagement.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';

/**
 * Request DTO for updating letter engagement metrics
 */
export class UpdateEngagementDto {
  @ApiPropertyOptional({
    description: 'Time spent reading the letter in milliseconds',
    example: 45000,
    minimum: 0,
    maximum: 3600000, // Max 1 hour
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600000)
  readDurationMs?: number;
}

/**
 * Response DTO for engagement update confirmation
 */
export class EngagementResponseDto {
  @ApiProperty({
    description: 'Letter ID that was updated',
    example: 'uuid-letter-123',
  })
  letterId!: string;

  @ApiProperty({
    description: 'When the letter was first read',
    example: '2026-01-22T10:05:00.000Z',
  })
  readAt!: Date;

  @ApiPropertyOptional({
    description: 'Total time spent reading in milliseconds',
    example: 45000,
  })
  readDurationMs!: number | null;
}
