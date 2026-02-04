/**
 * Upload Screenshot DTO
 *
 * Request/response DTOs for banking screenshot OCR upload.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Request body for screenshot upload
 */
export class UploadScreenshotDto {
  @ApiPropertyOptional({
    description: 'Description of what the screenshots contain',
    example: 'GTBank mobile app transaction history',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Response after successful screenshot upload
 */
export class UploadScreenshotResponseDto {
  @ApiProperty({
    description: 'Import job ID',
    example: 'job-456-abc-def',
  })
  jobId!: string;

  @ApiProperty({
    description: 'Job status',
    example: 'PROCESSING',
  })
  status!: string;

  @ApiProperty({
    description: 'Number of images uploaded',
    example: 3,
  })
  imageCount!: number;

  @ApiProperty({
    description: 'Total size of all images in bytes',
    example: 2097152,
  })
  totalSize!: number;

  @ApiProperty({
    description: 'Message indicating next steps',
    example: '3 screenshots uploaded. OCR processing will complete shortly.',
  })
  message!: string;
}
