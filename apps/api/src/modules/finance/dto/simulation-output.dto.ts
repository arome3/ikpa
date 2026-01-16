import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Confidence interval for projected values at a single time horizon
 */
export class ConfidenceIntervalDto {
  @ApiProperty({
    description: '10th percentile (pessimistic scenario)',
    example: 6800000,
  })
  low!: number;

  @ApiProperty({
    description: '90th percentile (optimistic scenario)',
    example: 12000000,
  })
  high!: number;
}

/**
 * Confidence intervals at all time horizons
 */
export class ConfidenceIntervalsByHorizonDto {
  @ApiProperty({
    type: ConfidenceIntervalDto,
    description: 'Confidence interval at 6 months',
  })
  '6mo'!: ConfidenceIntervalDto;

  @ApiProperty({
    type: ConfidenceIntervalDto,
    description: 'Confidence interval at 1 year',
  })
  '1yr'!: ConfidenceIntervalDto;

  @ApiProperty({
    type: ConfidenceIntervalDto,
    description: 'Confidence interval at 5 years',
  })
  '5yr'!: ConfidenceIntervalDto;

  @ApiProperty({
    type: ConfidenceIntervalDto,
    description: 'Confidence interval at 10 years',
  })
  '10yr'!: ConfidenceIntervalDto;

  @ApiProperty({
    type: ConfidenceIntervalDto,
    description: 'Confidence interval at 20 years',
  })
  '20yr'!: ConfidenceIntervalDto;
}

/**
 * Projected net worth at each time horizon
 */
export class ProjectedNetWorthDto {
  @ApiProperty({
    description: 'Projected net worth at 6 months',
    example: 550000,
  })
  '6mo'!: number;

  @ApiProperty({
    description: 'Projected net worth at 1 year',
    example: 620000,
  })
  '1yr'!: number;

  @ApiProperty({
    description: 'Projected net worth at 5 years',
    example: 1500000,
  })
  '5yr'!: number;

  @ApiProperty({
    description: 'Projected net worth at 10 years',
    example: 4200000,
  })
  '10yr'!: number;

  @ApiProperty({
    description: 'Projected net worth at 20 years',
    example: 9500000,
  })
  '20yr'!: number;
}

/**
 * Wealth difference at each time horizon
 */
export class WealthDifferenceDto {
  @ApiProperty({
    description: 'Wealth difference at 6 months (optimized - current)',
    example: 30000,
  })
  '6mo'!: number;

  @ApiProperty({
    description: 'Wealth difference at 1 year',
    example: 80000,
  })
  '1yr'!: number;

  @ApiProperty({
    description: 'Wealth difference at 5 years',
    example: 500000,
  })
  '5yr'!: number;

  @ApiProperty({
    description: 'Wealth difference at 10 years',
    example: 1800000,
  })
  '10yr'!: number;

  @ApiProperty({
    description: 'Wealth difference at 20 years',
    example: 5200000,
  })
  '20yr'!: number;
}

/**
 * Individual goal result in path output
 */
export class GoalPathResultDto {
  @ApiProperty({
    description: 'Goal identifier',
    example: 'goal-1',
  })
  goalId!: string;

  @ApiPropertyOptional({
    description: 'Goal name',
    example: 'Emergency Fund',
  })
  goalName?: string;

  @ApiProperty({
    description: 'Target amount for this goal',
    example: 1000000,
  })
  targetAmount!: number;

  @ApiProperty({
    description: 'Probability of achieving this goal (0.0 - 1.0)',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  probability!: number;

  @ApiPropertyOptional({
    description: 'Estimated achievement date (null if unlikely)',
    example: '2027-06-15T00:00:00.000Z',
    nullable: true,
  })
  achieveDate!: Date | null;
}

/**
 * Current path simulation result
 */
export class CurrentPathResultDto {
  @ApiProperty({
    description: 'Probability of achieving the primary goal (0.0 - 1.0)',
    example: 0.71,
    minimum: 0,
    maximum: 1,
  })
  probability!: number;

  @ApiProperty({
    type: ProjectedNetWorthDto,
    description: 'Projected net worth at each time horizon',
  })
  projectedNetWorth!: ProjectedNetWorthDto;

  @ApiPropertyOptional({
    description: 'Estimated date when primary goal will be achieved (null if unlikely)',
    example: '2027-08-15T00:00:00.000Z',
    nullable: true,
  })
  achieveGoalDate!: Date | null;

  @ApiProperty({
    type: ConfidenceIntervalsByHorizonDto,
    description: '10th-90th percentile confidence intervals at each time horizon',
  })
  confidenceIntervals!: ConfidenceIntervalsByHorizonDto;

  @ApiPropertyOptional({
    description: 'Probability of achieving ALL goals (when multiple goals provided)',
    example: 0.65,
    minimum: 0,
    maximum: 1,
  })
  allGoalsProbability?: number;

  @ApiPropertyOptional({
    description: 'Individual goal results (when multiple goals provided)',
    type: [GoalPathResultDto],
  })
  goalResults?: GoalPathResultDto[];
}

/**
 * Optimized path simulation result
 */
export class OptimizedPathResultDto extends CurrentPathResultDto {
  @ApiProperty({
    description: 'Recommended savings rate to achieve higher probability',
    example: 0.12,
    minimum: 0,
    maximum: 1,
  })
  requiredSavingsRate!: number;
}

/**
 * Simulation metadata for debugging and analytics
 */
export class SimulationMetadataDto {
  @ApiProperty({
    description: 'Number of Monte Carlo iterations',
    example: 10000,
  })
  iterations!: number;

  @ApiProperty({
    description: 'Simulation execution time in milliseconds',
    example: 1250,
  })
  durationMs!: number;

  @ApiProperty({
    description: 'Timestamp when simulation was run',
    example: '2026-01-16T10:30:00.000Z',
  })
  simulatedAt!: Date;

  @ApiProperty({
    description: 'Currency used for all monetary values',
    example: 'NGN',
  })
  currency!: string;
}

/**
 * Complete simulation response DTO
 */
export class SimulationResponseDto {
  @ApiProperty({
    type: CurrentPathResultDto,
    description: 'Results following the user\'s current savings behavior',
  })
  currentPath!: CurrentPathResultDto;

  @ApiProperty({
    type: OptimizedPathResultDto,
    description: 'Results following an optimized savings strategy',
  })
  optimizedPath!: OptimizedPathResultDto;

  @ApiProperty({
    type: WealthDifferenceDto,
    description: 'Net worth difference at each time horizon (optimized - current)',
  })
  wealthDifference!: WealthDifferenceDto;

  @ApiProperty({
    type: SimulationMetadataDto,
    description: 'Simulation metadata for debugging and analytics',
  })
  metadata!: SimulationMetadataDto;
}
