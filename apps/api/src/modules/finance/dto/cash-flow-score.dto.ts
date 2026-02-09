import { ApiProperty } from '@nestjs/swagger';

/**
 * Component score DTO for API responses
 */
export class ComponentScoreDto {
  @ApiProperty({
    example: 12,
    description: 'Raw value (percentage, months, or ratio)',
  })
  value!: number;

  @ApiProperty({
    example: 60,
    description: 'Normalized score (0-100)',
  })
  score!: number;
}

/**
 * All component scores in the Cash Flow Score
 */
export class CashFlowScoreComponentsDto {
  @ApiProperty({
    type: ComponentScoreDto,
    description: 'Savings rate component (30% weight)',
  })
  savingsRate!: ComponentScoreDto;

  @ApiProperty({
    type: ComponentScoreDto,
    description: 'Runway months component (25% weight)',
  })
  runwayMonths!: ComponentScoreDto;

  @ApiProperty({
    type: ComponentScoreDto,
    description: 'Debt-to-income ratio component (20% weight)',
  })
  debtToIncome!: ComponentScoreDto;

  @ApiProperty({
    type: ComponentScoreDto,
    description: 'Income stability component (15% weight)',
  })
  incomeStability!: ComponentScoreDto;

  @ApiProperty({
    type: ComponentScoreDto,
    description: 'Dependency ratio component (10% weight)',
  })
  dependencyRatio!: ComponentScoreDto;
}

/**
 * Cash Flow Score response DTO
 */
export class CashFlowScoreResponseDto {
  @ApiProperty({
    example: 70,
    description: 'Final weighted score (0-100)',
    minimum: 0,
    maximum: 100,
  })
  finalScore!: number;

  @ApiProperty({ type: CashFlowScoreComponentsDto })
  components!: CashFlowScoreComponentsDto;

  @ApiProperty({
    example: '(60*0.30) + (60*0.25) + (80*0.20) + (100*0.15) + (80*0.10)',
    description: 'Human-readable calculation breakdown',
  })
  calculation!: string;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the score was calculated',
  })
  timestamp!: Date;

  @ApiProperty({
    example: 'Good',
    description: 'Score label (Excellent, Good, Fair, Needs Attention, Critical)',
    required: false,
  })
  label?: string;

  @ApiProperty({
    example: '#84CC16',
    description: 'Color code for UI display',
    required: false,
  })
  color?: string;

  @ApiProperty({
    example: 68,
    description: 'Previous day score for comparison',
    required: false,
  })
  previousScore?: number;

  @ApiProperty({
    example: 2,
    description: 'Change from previous score (positive or negative)',
    required: false,
  })
  change?: number;
}
