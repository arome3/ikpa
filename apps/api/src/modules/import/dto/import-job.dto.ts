/**
 * Import Job DTO
 *
 * DTOs for import job status and management.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { Currency, ImportSource, ImportJobStatus, ParsedTransactionStatus } from '@prisma/client';

/**
 * Parsed transaction in job response
 */
export class ParsedTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'txn-123-abc-def',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction amount (negative for debits)',
    example: -5000,
  })
  amount!: number;

  @ApiProperty({
    description: 'Currency code',
    enum: Currency,
    example: 'NGN',
  })
  currency!: Currency;

  @ApiProperty({
    description: 'Transaction date',
    example: '2025-01-15T00:00:00Z',
  })
  date!: Date;

  @ApiPropertyOptional({
    description: 'Transaction description',
    example: 'POS PURCHASE - SHOPRITE',
  })
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Merchant name',
    example: 'Shoprite',
  })
  merchant?: string | null;

  @ApiPropertyOptional({
    description: 'Normalized merchant name',
    example: 'shoprite',
  })
  normalizedMerchant?: string | null;

  @ApiProperty({
    description: 'Whether this appears to be a recurring transaction',
    example: false,
  })
  isRecurringGuess!: boolean;

  @ApiProperty({
    description: 'Transaction status',
    enum: ParsedTransactionStatus,
    example: 'PENDING',
  })
  status!: ParsedTransactionStatus;

  @ApiPropertyOptional({
    description: 'ID of duplicate expense if detected',
    example: null,
  })
  duplicateOfId?: string | null;

  @ApiPropertyOptional({
    description: 'Parsing confidence score (0-1)',
    example: 0.95,
  })
  confidence?: number | null;
}

/**
 * Import job summary for list view
 */
export class ImportJobSummaryDto {
  @ApiProperty({
    description: 'Job ID',
    example: 'job-123-abc-def',
  })
  id!: string;

  @ApiProperty({
    description: 'Import source',
    enum: ImportSource,
    example: 'BANK_STATEMENT_PDF',
  })
  source!: ImportSource;

  @ApiProperty({
    description: 'Job status',
    enum: ImportJobStatus,
    example: 'AWAITING_REVIEW',
  })
  status!: ImportJobStatus;

  @ApiPropertyOptional({
    description: 'Original file name',
    example: 'statement-jan-2025.pdf',
  })
  fileName?: string | null;

  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'GTBank',
  })
  bankName?: string | null;

  @ApiProperty({
    description: 'Total transactions parsed',
    example: 45,
  })
  totalParsed!: number;

  @ApiProperty({
    description: 'Transactions pending review',
    example: 40,
  })
  pendingReview!: number;

  @ApiProperty({
    description: 'Expenses created',
    example: 0,
  })
  created!: number;

  @ApiProperty({
    description: 'Duplicates detected',
    example: 5,
  })
  duplicates!: number;

  @ApiProperty({
    description: 'Job creation time',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt!: Date;
}

/**
 * Full import job details
 */
export class ImportJobDetailsDto extends ImportJobSummaryDto {
  @ApiPropertyOptional({
    description: 'Error message if job failed',
    example: null,
  })
  errorMessage?: string | null;

  @ApiProperty({
    description: 'Parsed transactions',
    type: [ParsedTransactionDto],
  })
  transactions!: ParsedTransactionDto[];
}

/**
 * Import job list response
 */
export class ImportJobListResponseDto {
  @ApiProperty({
    description: 'List of import jobs',
    type: [ImportJobSummaryDto],
  })
  jobs!: ImportJobSummaryDto[];

  @ApiProperty({
    description: 'Total count of jobs',
    example: 10,
  })
  total!: number;
}

/**
 * Update transaction status request
 */
export class UpdateTransactionDto {
  @ApiPropertyOptional({
    description: 'New status for the transaction',
    enum: ['CONFIRMED', 'REJECTED'],
    example: 'CONFIRMED',
  })
  @IsOptional()
  @IsEnum(['CONFIRMED', 'REJECTED'])
  status?: 'CONFIRMED' | 'REJECTED';

  @ApiPropertyOptional({
    description: 'Override merchant name',
    example: 'Netflix',
  })
  @IsOptional()
  @IsString()
  merchant?: string;

  @ApiPropertyOptional({
    description: 'Mark as recurring',
    example: true,
  })
  @IsOptional()
  isRecurring?: boolean;
}

/**
 * Confirm job transactions request
 */
export class ConfirmJobDto {
  @ApiProperty({
    description: 'Transaction IDs to confirm and create expenses from',
    example: ['txn-1', 'txn-2', 'txn-3'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  transactionIds!: string[];

  @ApiProperty({
    description: 'Category ID for the expenses',
    example: 'cat-123-abc',
  })
  @IsUUID('4')
  categoryId!: string;
}

/**
 * Confirm job response
 */
export class ConfirmJobResponseDto {
  @ApiProperty({
    description: 'Number of expenses created',
    example: 35,
  })
  expensesCreated!: number;

  @ApiProperty({
    description: 'Number of transactions skipped (duplicates, rejected)',
    example: 5,
  })
  skipped!: number;

  @ApiProperty({
    description: 'IDs of created expenses',
    example: ['exp-1', 'exp-2', 'exp-3'],
  })
  expenseIds!: string[];

  @ApiProperty({
    description: 'Message about the confirmation',
    example: '35 expenses created successfully',
  })
  message!: string;
}
