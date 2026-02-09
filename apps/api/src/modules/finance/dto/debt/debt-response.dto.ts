import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebtType, Currency } from '@prisma/client';

/**
 * Response DTO for debt
 */
export class DebtResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'Car Loan' })
  name!: string;

  @ApiProperty({ enum: DebtType, example: 'BANK_LOAN' })
  type!: DebtType;

  @ApiProperty({ example: 2000000 })
  originalAmount!: number;

  @ApiProperty({ example: 1500000 })
  remainingBalance!: number;

  @ApiProperty({ enum: Currency, example: 'USD' })
  currency!: Currency;

  @ApiProperty({ example: 15.5 })
  interestRate!: number;

  @ApiProperty({ example: 75000 })
  minimumPayment!: number;

  @ApiPropertyOptional({ example: 15 })
  dueDate?: number | null;

  @ApiPropertyOptional({ example: 'Access Bank' })
  institution?: string | null;

  @ApiPropertyOptional({ example: 'Loan for Toyota Corolla' })
  notes?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2025-01-15T00:00:00.000Z' })
  startDate!: Date;

  @ApiPropertyOptional({ example: '2027-01-15T00:00:00.000Z' })
  targetPayoffDate?: Date | null;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({
    example: 25,
    description: 'Percentage paid off ((original - remaining) / original * 100)',
  })
  percentPaidOff!: number;
}

/**
 * Response DTO for list of debts
 */
export class DebtListResponseDto {
  @ApiProperty({ type: [DebtResponseDto] })
  items!: DebtResponseDto[];

  @ApiProperty({ example: 2 })
  count!: number;

  @ApiProperty({
    example: 3500000,
    description: 'Total remaining balance across all debts',
  })
  totalRemainingBalance!: number;

  @ApiProperty({
    example: 125000,
    description: 'Total monthly minimum payments',
  })
  totalMinimumPayments!: number;
}
