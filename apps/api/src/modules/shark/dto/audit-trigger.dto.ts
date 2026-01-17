/**
 * Audit Trigger DTOs
 *
 * DTOs for triggering and receiving subscription audit results.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { Currency } from '@prisma/client';

/**
 * Trigger manual audit input
 */
export class TriggerAuditDto {
  @ApiPropertyOptional({
    description: 'Force re-scan even if recently audited',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'force must be a boolean value' })
  force?: boolean = false;
}

/**
 * Audit result response DTO
 */
export class AuditResultDto {
  @ApiProperty({
    example: 8,
    description: 'Total number of subscriptions after audit',
  })
  totalSubscriptions!: number;

  @ApiProperty({
    example: 3,
    description: 'Number of newly detected subscriptions in this audit',
  })
  newlyDetected!: number;

  @ApiProperty({
    example: 2,
    description: 'Number of zombie subscriptions detected',
  })
  zombiesDetected!: number;

  @ApiProperty({
    example: 432000,
    description: 'Potential annual savings from cancelling zombies',
  })
  potentialAnnualSavings!: number;

  @ApiProperty({
    enum: Currency,
    example: Currency.NGN,
    description: 'Currency for savings amount',
  })
  currency!: Currency;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'Timestamp of the audit',
  })
  auditedAt!: Date;
}
