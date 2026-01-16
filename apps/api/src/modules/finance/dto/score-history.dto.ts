import { ApiProperty } from '@nestjs/swagger';

/**
 * Single score history entry
 */
export class ScoreHistoryEntryDto {
  @ApiProperty({
    example: '2026-01-16',
    description: 'Date of the score (YYYY-MM-DD)',
  })
  date!: string;

  @ApiProperty({
    example: 70,
    description: 'Score value (0-100)',
  })
  score!: number;
}

/**
 * Score history response with trend analysis
 */
export class ScoreHistoryResponseDto {
  @ApiProperty({
    type: [ScoreHistoryEntryDto],
    description: 'Array of historical score entries',
  })
  history!: ScoreHistoryEntryDto[];

  @ApiProperty({
    enum: ['up', 'down', 'stable'],
    example: 'stable',
    description: 'Overall trend direction based on comparing recent vs older scores',
  })
  trend!: 'up' | 'down' | 'stable';

  @ApiProperty({
    example: 70,
    description: 'Average score over the period',
  })
  averageScore!: number;

  @ApiProperty({
    example: 30,
    description: 'Number of days in the history period',
  })
  periodDays!: number;
}

/**
 * Metric history entry
 */
export class MetricHistoryEntryDto {
  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'Timestamp of the metric value',
  })
  date!: Date;

  @ApiProperty({
    example: 70,
    description: 'Metric value at this point in time',
  })
  value!: number;
}

/**
 * Individual metric detail response
 */
export class MetricDetailResponseDto {
  @ApiProperty({
    example: 70,
    description: 'Current metric value',
  })
  current!: number;

  @ApiProperty({
    example: 2.5,
    description: 'Change from previous period',
  })
  change!: number;

  @ApiProperty({
    enum: ['up', 'down', 'stable'],
    example: 'up',
    description: 'Trend direction',
  })
  trend!: 'up' | 'down' | 'stable';

  @ApiProperty({
    type: [MetricHistoryEntryDto],
    description: 'Historical metric values',
  })
  history!: MetricHistoryEntryDto[];
}
