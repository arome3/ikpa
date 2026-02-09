import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvestmentType, Currency } from '@prisma/client';

/**
 * Response DTO for investment
 */
export class InvestmentResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'MTN Stocks' })
  name!: string;

  @ApiProperty({ enum: InvestmentType, example: 'STOCKS' })
  type!: InvestmentType;

  @ApiProperty({ example: 1000000 })
  value!: number;

  @ApiProperty({ enum: Currency, example: 'USD' })
  currency!: Currency;

  @ApiPropertyOptional({ example: 800000 })
  costBasis?: number | null;

  @ApiPropertyOptional({ example: 'Stanbic IBTC' })
  institution?: string | null;

  @ApiPropertyOptional({ example: 'Long-term hold' })
  notes?: string | null;

  @ApiPropertyOptional({ example: '2025-06-15T00:00:00.000Z' })
  purchaseDate?: Date | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({
    example: 200000,
    description: 'Unrealized gain/loss (value - costBasis)',
  })
  unrealizedGain?: number;
}

/**
 * Response DTO for list of investments
 */
export class InvestmentListResponseDto {
  @ApiProperty({ type: [InvestmentResponseDto] })
  items!: InvestmentResponseDto[];

  @ApiProperty({ example: 3 })
  count!: number;

  @ApiProperty({
    example: 2500000,
    description: 'Total value across all investments',
  })
  totalValue!: number;

  @ApiProperty({
    example: 400000,
    description: 'Total unrealized gain/loss',
  })
  totalUnrealizedGain!: number;
}
