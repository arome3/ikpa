import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SavingsType, Currency } from '@prisma/client';

/**
 * Response DTO for savings account
 */
export class SavingsResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'Emergency Fund' })
  name!: string;

  @ApiProperty({ enum: SavingsType, example: 'BANK_ACCOUNT' })
  type!: SavingsType;

  @ApiProperty({ example: 250000 })
  balance!: number;

  @ApiProperty({ enum: Currency, example: 'USD' })
  currency!: Currency;

  @ApiPropertyOptional({ example: 4.5 })
  interestRate?: number | null;

  @ApiPropertyOptional({ example: 'GTBank' })
  institution?: string | null;

  @ApiPropertyOptional({ example: '1234' })
  accountNumber?: string | null;

  @ApiProperty({ example: true })
  isEmergencyFund!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  updatedAt!: Date;
}

/**
 * Response DTO for list of savings accounts
 */
export class SavingsListResponseDto {
  @ApiProperty({ type: [SavingsResponseDto] })
  items!: SavingsResponseDto[];

  @ApiProperty({ example: 2 })
  count!: number;

  @ApiProperty({
    example: 500000,
    description: 'Total balance across all savings accounts',
  })
  totalBalance!: number;

  @ApiProperty({
    example: 200000,
    description: 'Total emergency fund balance',
  })
  emergencyFundTotal!: number;
}
