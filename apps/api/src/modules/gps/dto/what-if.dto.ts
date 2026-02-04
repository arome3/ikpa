/**
 * GPS What-If Simulation DTOs
 *
 * Data transfer objects for the what-if simulation feature that lets users
 * preview the impact of spending before committing.
 *
 * Answers the user need: "What happens if I spend more?"
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsPositive, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { RecoveryPathDto } from './recalculate-response.dto';

// ==========================================
// REQUEST DTOs
// ==========================================

/**
 * Request to simulate spending impact
 */
export class WhatIfRequestDto {
  @ApiProperty({
    description: 'Spending category name or ID',
    example: 'Food & Dining',
  })
  @IsNotEmpty()
  @IsString()
  category!: string;

  @ApiProperty({
    description: 'Additional amount to simulate spending',
    example: 10000,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  additionalSpend!: number;

  @ApiPropertyOptional({
    description: 'Goal ID to check impact against (uses primary goal if not specified)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  goalId?: string;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

/**
 * Budget impact preview
 */
export class BudgetImpactDto {
  @ApiProperty({
    description: 'Current budget amount',
    example: 50000,
  })
  budgetAmount!: number;

  @ApiProperty({
    description: 'Current spending (before simulated spend)',
    example: 35000,
  })
  currentSpending!: number;

  @ApiProperty({
    description: 'Projected spending (after simulated spend)',
    example: 45000,
  })
  projectedSpending!: number;

  @ApiProperty({
    description: 'Current percentage of budget used',
    example: 70,
  })
  currentPercentUsed!: number;

  @ApiProperty({
    description: 'Projected percentage of budget used',
    example: 90,
  })
  projectedPercentUsed!: number;

  @ApiProperty({
    description: 'Remaining budget after simulated spend',
    example: 5000,
  })
  remainingAfterSpend!: number;
}

/**
 * Goal probability impact
 */
export class ProbabilityImpactDto {
  @ApiProperty({
    description: 'Goal ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  goalId!: string;

  @ApiProperty({
    description: 'Goal name',
    example: 'Emergency Fund',
  })
  goalName!: string;

  @ApiProperty({
    description: 'Current probability of achieving goal (0-1)',
    example: 0.85,
  })
  currentProbability!: number;

  @ApiProperty({
    description: 'Projected probability after simulated spend (0-1)',
    example: 0.78,
  })
  projectedProbability!: number;

  @ApiProperty({
    description: 'Probability change (negative means decrease)',
    example: -0.07,
  })
  probabilityChange!: number;

  @ApiProperty({
    description: 'Probability change as percentage points',
    example: -7,
  })
  changePercentPoints!: number;
}

/**
 * Trigger level that would be reached
 */
export class TriggerPreviewDto {
  @ApiProperty({
    description: 'Whether any budget threshold would be crossed',
    example: true,
  })
  wouldTrigger!: boolean;

  @ApiPropertyOptional({
    description: 'Which trigger level would be reached',
    example: 'BUDGET_WARNING',
    enum: ['BUDGET_WARNING', 'BUDGET_EXCEEDED', 'BUDGET_CRITICAL'],
  })
  triggerLevel?: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';

  @ApiProperty({
    description: 'Human-readable description of the trigger',
    example: 'This would put you at 90% of your budget',
  })
  description!: string;
}

/**
 * What-If simulation response
 */
export class WhatIfResponseDto {
  @ApiProperty({
    description: 'Category being simulated',
    example: 'Food & Dining',
  })
  category!: string;

  @ApiProperty({
    description: 'Amount simulated',
    example: 10000,
  })
  simulatedAmount!: number;

  @ApiProperty({
    description: 'Budget impact preview',
    type: BudgetImpactDto,
  })
  budgetImpact!: BudgetImpactDto;

  @ApiProperty({
    description: 'Goal probability impact',
    type: ProbabilityImpactDto,
  })
  probabilityImpact!: ProbabilityImpactDto;

  @ApiProperty({
    description: 'Whether this spend would trigger a budget alert',
    type: TriggerPreviewDto,
  })
  triggerPreview!: TriggerPreviewDto;

  @ApiPropertyOptional({
    description: 'Preview of recovery options if triggered (only shown if threshold would be crossed)',
    type: [RecoveryPathDto],
  })
  recoveryPreview?: RecoveryPathDto[];

  @ApiProperty({
    description: 'Recommendation based on the simulation',
    example: 'This purchase would use 90% of your Food & Dining budget. Consider spacing it out.',
  })
  recommendation!: string;

  @ApiProperty({
    description: 'Severity of the impact (low, medium, high)',
    example: 'medium',
    enum: ['low', 'medium', 'high'],
  })
  severity!: 'low' | 'medium' | 'high';
}
