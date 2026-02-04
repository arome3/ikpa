import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for step completion/skip action
 */
export class StepActionResponseDto {
  @ApiProperty({ example: 'income' })
  step!: string;

  @ApiProperty({
    example: 'completed',
    enum: ['completed', 'skipped'],
  })
  action!: 'completed' | 'skipped';

  @ApiProperty({ example: 'goals' })
  nextStep!: string;

  @ApiProperty({ example: 50 })
  progressPercent!: number;

  @ApiProperty({ example: 'Add at least one financial goal to continue' })
  message!: string;
}

/**
 * Response DTO for completing onboarding
 */
export class CompleteOnboardingResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: '2026-01-24T11:00:00.000Z' })
  completedAt!: Date;

  @ApiProperty({ example: 'Welcome to IKPA! Your financial journey begins now.' })
  message!: string;

  @ApiProperty({
    example: 85,
    description: 'Initial Cash Flow Score',
  })
  cashFlowScore?: number;
}
