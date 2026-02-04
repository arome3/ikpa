/**
 * Upload Statement DTO
 *
 * Request/response DTOs for bank statement (PDF/CSV) upload.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';

/**
 * Supported banks for optimized parsing
 */
export enum SupportedBank {
  GTBANK = 'GTBank',
  ACCESS_BANK = 'Access Bank',
  FIRST_BANK = 'First Bank',
  ZENITH_BANK = 'Zenith Bank',
  UBA = 'UBA',
  KUDA = 'Kuda',
  OPAY = 'Opay',
  MONIEPOINT = 'Moniepoint',
  OTHER = 'Other',
}

/**
 * Request body for statement upload
 */
export class UploadStatementDto {
  @ApiPropertyOptional({
    description: 'Bank name for optimized parsing',
    enum: SupportedBank,
    example: SupportedBank.GTBANK,
  })
  @IsOptional()
  @IsEnum(SupportedBank)
  bankName?: SupportedBank;

  @ApiPropertyOptional({
    description: 'Additional context for parsing',
    example: 'Savings account statement',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Response after successful statement upload
 */
export class UploadStatementResponseDto {
  @ApiProperty({
    description: 'Import job ID',
    example: 'job-123-abc-def',
  })
  jobId!: string;

  @ApiProperty({
    description: 'Job status',
    example: 'PROCESSING',
  })
  status!: string;

  @ApiProperty({
    description: 'Uploaded file name',
    example: 'statement-jan-2025.pdf',
  })
  fileName!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 524288,
  })
  fileSize!: number;

  @ApiProperty({
    description: 'Message indicating next steps',
    example: 'File uploaded successfully. Processing will complete shortly.',
  })
  message!: string;
}
