/**
 * GPS Re-Router Recalculate Response DTO
 *
 * Response containing budget status, goal impact, and recovery paths.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  BudgetTrigger,
  EffortLevel,
  MonetaryValue,
} from '../interfaces/gps-rerouter.interface';

/**
 * Monetary value DTO with both amount and formatted string
 */
export class MonetaryValueDto implements MonetaryValue {
  @ApiProperty({
    example: 50000,
    description: 'Raw numeric amount',
  })
  amount!: number;

  @ApiProperty({
    example: '₦50,000',
    description: 'Formatted string with currency symbol',
  })
  formatted!: string;

  @ApiProperty({
    example: 'NGN',
    description: 'Currency code',
  })
  currency!: string;
}

/**
 * Budget status response DTO
 */
export class BudgetStatusDto {
  @ApiProperty({
    example: 'Entertainment',
    description: 'Expense category name',
  })
  category!: string;

  @ApiProperty({
    example: 'cat-123-abc',
    description: 'Category ID',
  })
  categoryId!: string;

  @ApiProperty({
    type: MonetaryValueDto,
    example: { amount: 50000, formatted: '₦50,000', currency: 'NGN' },
    description: 'Budgeted amount for the period with formatted currency',
  })
  budgeted!: MonetaryValueDto;

  @ApiProperty({
    type: MonetaryValueDto,
    example: { amount: 65000, formatted: '₦65,000', currency: 'NGN' },
    description: 'Amount spent so far with formatted currency',
  })
  spent!: MonetaryValueDto;

  @ApiProperty({
    type: MonetaryValueDto,
    example: { amount: -15000, formatted: '-₦15,000', currency: 'NGN' },
    description: 'Amount remaining (negative if overspent) with formatted currency',
  })
  remaining!: MonetaryValueDto;

  @ApiProperty({
    example: 30,
    description: 'Percentage over budget (0 if under, positive if over)',
  })
  overagePercent!: number;

  @ApiProperty({
    enum: ['BUDGET_WARNING', 'BUDGET_EXCEEDED', 'BUDGET_CRITICAL'],
    example: 'BUDGET_EXCEEDED',
    description: 'Which trigger threshold was hit',
  })
  trigger!: BudgetTrigger;

  @ApiProperty({
    example: 'MONTHLY',
    description: 'Budget period',
  })
  period!: string;
}

/**
 * Goal impact response DTO
 */
export class GoalImpactDto {
  @ApiProperty({
    example: 'goal-456-def',
    description: 'Goal ID',
  })
  goalId!: string;

  @ApiProperty({
    example: 'Emergency Fund',
    description: 'Goal name',
  })
  goalName!: string;

  @ApiProperty({
    type: MonetaryValueDto,
    example: { amount: 500000, formatted: '₦500,000', currency: 'NGN' },
    description: 'Goal target amount with formatted currency',
  })
  goalAmount!: MonetaryValueDto;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Goal deadline',
  })
  goalDeadline!: Date;

  @ApiProperty({
    example: 0.75,
    description: 'Probability before the overspend (0-1)',
  })
  previousProbability!: number;

  @ApiProperty({
    example: 0.68,
    description: 'Probability after the overspend (0-1)',
  })
  newProbability!: number;

  @ApiProperty({
    example: -0.07,
    description: 'Difference in probability (negative means decreased)',
  })
  probabilityDrop!: number;

  @ApiProperty({
    example: 'Your Emergency Fund probability decreased by 7 percentage points',
    description: 'Human-readable impact message',
  })
  message!: string;

  @ApiProperty({
    example: '2026-08-15T00:00:00.000Z',
    description: 'Projected date of goal achievement at current pace',
    required: false,
  })
  projectedDate?: Date;

  @ApiProperty({
    example: "You'll likely reach Emergency Fund by August 2026",
    description: 'Human-readable timeline projection',
    required: false,
  })
  humanReadable?: string;

  @ApiProperty({
    example: '3 months behind schedule',
    description: 'Schedule status relative to goal deadline (ahead/behind/on track)',
    required: false,
  })
  scheduleStatus?: string;
}

/**
 * Recovery path response DTO
 */
export class RecoveryPathDto {
  @ApiProperty({
    example: 'time_adjustment',
    description: 'Unique identifier for the path',
  })
  id!: string;

  @ApiProperty({
    example: 'Timeline Flex',
    description: 'Path name',
  })
  name!: string;

  @ApiProperty({
    example: 'Extend your Emergency Fund deadline by 2 weeks',
    description: 'Human-readable description of what this path involves',
  })
  description!: string;

  @ApiProperty({
    example: 0.78,
    description: 'Projected probability if this path is followed (0-1). Null in budget-only mode (no goals).',
    nullable: true,
  })
  newProbability!: number | null;

  @ApiProperty({
    enum: ['None', 'Low', 'Medium', 'High'],
    example: 'Low',
    description: 'Effort level required',
  })
  effort!: EffortLevel;

  @ApiProperty({
    example: '+2 weeks',
    description: 'How the timeline changes',
    required: false,
  })
  timelineImpact?: string;

  @ApiProperty({
    example: '+5% for 4 weeks',
    description: 'How savings rate changes',
    required: false,
  })
  savingsImpact?: string;

  @ApiProperty({
    example: 'Pause Entertainment for 4 weeks',
    description: 'Category freeze duration if applicable',
    required: false,
  })
  freezeDuration?: string;

  @ApiProperty({
    description: 'Rebalance info for Smart Swap path (category_rebalance only)',
    required: false,
    example: {
      fromCategory: 'Transport',
      fromCategoryId: 'abc-123',
      availableSurplus: 5000,
      coverageAmount: 3000,
      isFullCoverage: true,
    },
  })
  rebalanceInfo?: {
    fromCategory: string;
    fromCategoryId: string;
    availableSurplus: number;
    coverageAmount: number;
    isFullCoverage: boolean;
  };

  @ApiProperty({
    description: 'Concrete daily actions the user can take to save money',
    required: false,
    example: [
      'Cook at home 4+ nights this week \u2192 saves ~$80/week',
      'Pack lunch instead of eating out \u2014 saves ~$12/day \u2192 saves ~$60/week',
    ],
    type: [String],
  })
  concreteActions?: string[];

  @ApiProperty({
    example: 'Fully covers the \u20a650,000 overage',
    description: 'Budget impact description for budget-only mode (no goals)',
    required: false,
  })
  budgetImpact?: string;

  @ApiProperty({
    example: 'Moves your projected date from October to August',
    description: 'Timeline effect description showing how this path affects projected goal date',
    required: false,
  })
  timelineEffect?: string;
}

/**
 * Non-judgmental message response DTO
 */
export class NonJudgmentalMessageDto {
  @ApiProperty({
    example: 'Supportive',
    description: 'Message tone (always Supportive)',
  })
  tone!: 'Supportive';

  @ApiProperty({
    example: "Let's recalculate your route",
    description: 'Main headline',
  })
  headline!: string;

  @ApiProperty({
    example:
      "Spending more than planned happens to everyone. Here are three ways to get back on track.",
    description: 'Supporting text with context',
  })
  subtext!: string;
}

/**
 * Multi-goal impact summary DTO
 */
export class MultiGoalImpactSummaryDto {
  @ApiProperty({
    example: 3,
    description: 'Total number of goals affected',
  })
  totalGoalsAffected!: number;

  @ApiProperty({
    example: -0.05,
    description: 'Average probability drop across all goals',
  })
  averageProbabilityDrop!: number;

  @ApiProperty({
    example: 'Emergency Fund',
    description: 'Name of the most affected goal',
  })
  mostAffectedGoal!: string;

  @ApiProperty({
    example: 'Vacation Fund',
    description: 'Name of the least affected goal',
  })
  leastAffectedGoal!: string;
}

/**
 * Multi-goal impact response DTO
 */
export class MultiGoalImpactDto {
  @ApiProperty({
    type: GoalImpactDto,
    description: 'Impact on the primary (most affected) goal',
  })
  primaryGoal!: GoalImpactDto;

  @ApiProperty({
    type: [GoalImpactDto],
    description: 'Impact on all other active goals',
  })
  otherGoals!: GoalImpactDto[];

  @ApiProperty({
    type: MultiGoalImpactSummaryDto,
    description: 'Summary statistics across all goals',
  })
  summary!: MultiGoalImpactSummaryDto;
}

/**
 * Complete recalculate response DTO
 */
export class RecalculateResponseDto {
  @ApiProperty({
    example: 'session-789-ghi',
    description: 'Session ID for tracking this recovery interaction',
  })
  sessionId!: string;

  @ApiProperty({
    type: BudgetStatusDto,
    description: 'Current budget status',
  })
  budgetStatus!: BudgetStatusDto;

  @ApiProperty({
    type: GoalImpactDto,
    description: 'Impact on the user primary goal. Null when user has no active goals (budget-only mode).',
    nullable: true,
    required: false,
  })
  goalImpact?: GoalImpactDto | null;

  @ApiProperty({
    type: MultiGoalImpactDto,
    description: 'Impact on all active goals (multi-goal assessment)',
    required: false,
  })
  multiGoalImpact?: MultiGoalImpactDto;

  @ApiProperty({
    type: [RecoveryPathDto],
    description: 'Three recovery path options',
  })
  recoveryPaths!: RecoveryPathDto[];

  @ApiProperty({
    type: NonJudgmentalMessageDto,
    description: 'Non-judgmental supportive message',
  })
  message!: NonJudgmentalMessageDto;
}
