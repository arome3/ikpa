/**
 * Future Self Simulation Response DTOs
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Projected net worth at time horizons
 */
export class ProjectedNetWorthDto {
  @ApiProperty({
    description: 'Projected net worth at 6 months',
    example: 550000,
  })
  '6mo': number;

  @ApiProperty({
    description: 'Projected net worth at 1 year',
    example: 620000,
  })
  '1yr': number;

  @ApiProperty({
    description: 'Projected net worth at 5 years',
    example: 2100000,
  })
  '5yr': number;

  @ApiProperty({
    description: 'Projected net worth at 10 years',
    example: 4800000,
  })
  '10yr': number;

  @ApiProperty({
    description: 'Projected net worth at 20 years',
    example: 12000000,
  })
  '20yr': number;
}

/**
 * Single path behavior showing savings rate and projections
 */
export class PathBehaviorDto {
  @ApiProperty({
    description: 'Savings rate as a decimal (0.0 - 1.0)',
    example: 0.12,
  })
  savingsRate!: number;

  @ApiProperty({
    description: 'Projected net worth at each time horizon',
    type: ProjectedNetWorthDto,
  })
  projectedNetWorth!: ProjectedNetWorthDto;
}

/**
 * Response for GET /v1/future-self/simulation
 *
 * Dual-path simulation comparing current behavior vs optimized IKPA path
 */
export class SimulationResponseDto {
  @ApiProperty({
    description: "User's current savings behavior projection",
    type: PathBehaviorDto,
  })
  currentBehavior!: PathBehaviorDto;

  @ApiProperty({
    description: 'Optimized path with IKPA recommendations',
    type: PathBehaviorDto,
  })
  withIKPA!: PathBehaviorDto;

  @ApiProperty({
    description: 'Net worth difference at 20 years (optimized - current)',
    example: 16000000,
  })
  difference_20yr!: number;
}
