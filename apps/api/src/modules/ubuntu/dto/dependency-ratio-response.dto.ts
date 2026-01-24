import { ApiProperty } from '@nestjs/swagger';
import { RiskLevel, Currency } from '@prisma/client';

/**
 * Dependency ratio components breakdown
 */
export class DependencyRatioComponentsDto {
  @ApiProperty({
    example: 40000,
    description: 'Monthly support for parents, spouse, and children',
  })
  parentSupport!: number;

  @ApiProperty({
    example: 25000,
    description: 'Monthly support for siblings (typically education)',
  })
  siblingEducation!: number;

  @ApiProperty({
    example: 10000,
    description: 'Monthly support for extended family and others',
  })
  extendedFamily!: number;

  @ApiProperty({
    example: 0,
    description: 'Monthly community and friend contributions',
  })
  communityContribution!: number;
}

/**
 * Ubuntu message with culturally-sensitive messaging
 */
export class UbuntuMessageDto {
  @ApiProperty({
    example: 'Family comes first - and so does your future',
    description: 'Non-judgmental headline message',
  })
  headline!: string;

  @ApiProperty({
    example: 'Consider building a dedicated family support fund alongside your goals.',
    description: 'Actionable subtext message',
  })
  subtext!: string;
}

/**
 * Full dependency ratio response
 */
export class DependencyRatioResponseDto {
  @ApiProperty({
    example: 0.214,
    description: 'Total dependency ratio (family support / income)',
    minimum: 0,
    maximum: 1,
  })
  totalRatio!: number;

  @ApiProperty({
    enum: RiskLevel,
    example: 'ORANGE',
    description: 'Risk level: GREEN (0-10%), ORANGE (10-35%), RED (35%+)',
  })
  riskLevel!: RiskLevel;

  @ApiProperty({
    type: DependencyRatioComponentsDto,
    description: 'Breakdown by relationship category',
  })
  components!: DependencyRatioComponentsDto;

  @ApiProperty({
    example: 75000,
    description: 'Total monthly family support amount',
  })
  monthlyTotal!: number;

  @ApiProperty({
    example: 350000,
    description: 'Monthly income used for ratio calculation',
  })
  monthlyIncome!: number;

  @ApiProperty({
    enum: Currency,
    example: 'NGN',
    description: 'Currency for all monetary values',
  })
  currency!: Currency;

  @ApiProperty({
    type: UbuntuMessageDto,
    description: 'Culturally-sensitive guidance message',
  })
  message!: UbuntuMessageDto;

  @ApiProperty({
    enum: ['improving', 'stable', 'increasing'],
    example: 'stable',
    description: 'Trend direction compared to previous month',
  })
  trend!: 'improving' | 'stable' | 'increasing';
}
