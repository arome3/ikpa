import { ApiProperty } from '@nestjs/swagger';

/**
 * Full financial snapshot response DTO
 * Contains all financial metrics for a user at a point in time
 */
export class FinancialSnapshotDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique snapshot ID',
  })
  id!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'User ID',
  })
  userId!: string;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the snapshot was taken',
  })
  date!: Date;

  // Core metrics
  @ApiProperty({
    example: 70,
    description: 'Cash Flow Score (0-100)',
    minimum: 0,
    maximum: 100,
  })
  cashFlowScore!: number;

  @ApiProperty({
    example: 12.5,
    description: 'Savings rate percentage',
  })
  savingsRate!: number;

  @ApiProperty({
    example: 4.2,
    description: 'Emergency runway in months',
  })
  runwayMonths!: number;

  @ApiProperty({
    example: 150000,
    description: 'Monthly burn rate (expenses + debt payments)',
  })
  burnRate!: number;

  @ApiProperty({
    example: 21,
    description: 'Dependency ratio percentage (family support / income)',
  })
  dependencyRatio!: number;

  // Totals
  @ApiProperty({
    example: 2450000,
    description: 'Net worth (assets - liabilities)',
  })
  netWorth!: number;

  @ApiProperty({
    example: 400000,
    description: 'Total monthly income',
  })
  totalIncome!: number;

  @ApiProperty({
    example: 300000,
    description: 'Total monthly expenses',
  })
  totalExpenses!: number;

  @ApiProperty({
    example: 1500000,
    description: 'Total savings across all accounts',
  })
  totalSavings!: number;

  @ApiProperty({
    example: 500000,
    description: 'Total outstanding debt',
  })
  totalDebt!: number;

  @ApiProperty({
    example: 2000000,
    description: 'Total assets (savings + investments)',
  })
  totalAssets!: number;

  @ApiProperty({
    example: 75000,
    description: 'Total family support payments',
  })
  totalSupport!: number;

  @ApiProperty({
    example: 'NGN',
    description: 'Currency code',
  })
  currency!: string;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the record was created',
  })
  createdAt!: Date;
}

/**
 * Pagination metadata for list responses
 */
export class PaginationMetaDto {
  @ApiProperty({
    example: 150,
    description: 'Total number of records available',
  })
  total!: number;

  @ApiProperty({
    example: 100,
    description: 'Maximum records per page',
  })
  limit!: number;

  @ApiProperty({
    example: 0,
    description: 'Number of records skipped',
  })
  offset!: number;

  @ApiProperty({
    example: true,
    description: 'Whether more records exist beyond this page',
  })
  hasMore!: boolean;
}

/**
 * Snapshot list response with pagination
 */
export class SnapshotListResponseDto {
  @ApiProperty({
    type: [FinancialSnapshotDto],
    description: 'Array of financial snapshots',
  })
  snapshots!: FinancialSnapshotDto[];

  @ApiProperty({
    example: 30,
    description: 'Number of snapshots in this response',
  })
  count!: number;

  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Pagination metadata',
  })
  pagination!: PaginationMetaDto;
}
