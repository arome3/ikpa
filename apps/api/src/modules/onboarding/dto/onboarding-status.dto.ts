import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country, Currency, EmploymentType } from '@prisma/client';

/**
 * Individual onboarding step status
 */
export class OnboardingStepDto {
  @ApiProperty({ example: 'profile' })
  id!: string;

  @ApiProperty({ example: 'Profile Setup' })
  name!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ example: true })
  required!: boolean;

  @ApiProperty({
    example: 'pending',
    enum: ['pending', 'completed', 'skipped'],
  })
  status!: 'pending' | 'completed' | 'skipped';

  @ApiProperty({ example: 'Set up your country, currency, and employment type' })
  description!: string;
}

/**
 * User profile data relevant to onboarding
 */
export class OnboardingProfileDto {
  @ApiPropertyOptional({ enum: Country, example: 'US' })
  country?: Country;

  @ApiPropertyOptional({ enum: Currency, example: 'USD' })
  currency?: Currency;

  @ApiPropertyOptional({ enum: EmploymentType, example: 'EMPLOYED' })
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: '1995-06-15' })
  dateOfBirth?: string;
}

/**
 * Response DTO for onboarding status
 */
export class OnboardingStatusResponseDto {
  @ApiProperty({ example: false })
  isCompleted!: boolean;

  @ApiProperty({ example: 'income' })
  currentStep!: string;

  @ApiProperty({
    example: 33,
    description: 'Percentage of required steps completed (0-100)',
  })
  progressPercent!: number;

  @ApiProperty({ type: [OnboardingStepDto] })
  steps!: OnboardingStepDto[];

  @ApiProperty({ type: OnboardingProfileDto })
  profile!: OnboardingProfileDto;

  @ApiPropertyOptional({
    example: '2026-01-24T10:00:00.000Z',
    description: 'When onboarding started',
  })
  startedAt?: Date;

  @ApiPropertyOptional({
    example: '2026-01-24T11:00:00.000Z',
    description: 'When onboarding was completed',
  })
  completedAt?: Date;

  @ApiProperty({
    example: 'Complete your profile to get started',
    description: 'Next action message for the user',
  })
  nextAction!: string;
}
