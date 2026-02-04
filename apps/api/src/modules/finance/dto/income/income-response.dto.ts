import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncomeType, Frequency, Currency } from '@prisma/client';

/**
 * Response DTO for income source
 */
export class IncomeResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'Monthly Salary' })
  name!: string;

  @ApiProperty({ enum: IncomeType, example: 'SALARY' })
  type!: IncomeType;

  @ApiProperty({ example: 500000 })
  amount!: number;

  @ApiProperty({ enum: Currency, example: 'NGN' })
  currency!: Currency;

  @ApiProperty({ enum: Frequency, example: 'MONTHLY' })
  frequency!: Frequency;

  @ApiProperty({ example: 10 })
  variancePercentage!: number;

  @ApiPropertyOptional({ example: 'Primary job at TechCo' })
  description?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  startDate!: Date;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z' })
  endDate?: Date | null;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  updatedAt!: Date;
}

/**
 * Response DTO for list of income sources
 */
export class IncomeListResponseDto {
  @ApiProperty({ type: [IncomeResponseDto] })
  items!: IncomeResponseDto[];

  @ApiProperty({ example: 3 })
  count!: number;

  @ApiProperty({
    example: 650000,
    description: 'Total monthly income (normalized from all frequencies)',
  })
  totalMonthly!: number;
}
