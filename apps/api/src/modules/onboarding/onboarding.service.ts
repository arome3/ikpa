import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  OnboardingStatusResponseDto,
  OnboardingStepDto,
  UpdateProfileDto,
  UpdateProfileResponseDto,
  StepActionResponseDto,
  CompleteOnboardingResponseDto,
} from './dto';
import {
  OnboardingNotStartedException,
  OnboardingAlreadyCompletedException,
  OnboardingStepRequiredException,
  OnboardingPrerequisitesNotMetException,
  OnboardingMinimumDataRequiredException,
} from './exceptions';

/**
 * Onboarding step definition
 */
interface StepDefinition {
  id: string;
  name: string;
  order: number;
  required: boolean;
  description: string;
}

/**
 * Onboarding Service
 *
 * Manages the 6-step onboarding flow:
 * 1. Profile - Set country, currency, employment type
 * 2. Income - Add at least one income source (required)
 * 3. Financial Snapshot - Upload bank statements & emergency fund estimate (optional)
 * 4. Debts - Add debts (optional)
 * 5. Goals - Add at least one goal (required)
 * 6. Budgets - Set up category budgets (optional)
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  /**
   * Step definitions with order and requirements
   */
  private readonly steps: StepDefinition[] = [
    {
      id: 'profile',
      name: 'Profile Setup',
      order: 1,
      required: true,
      description: 'Set up your country, currency, and employment type',
    },
    {
      id: 'income',
      name: 'Income Sources',
      order: 2,
      required: true,
      description: 'Add your income sources (salary, freelance, etc.)',
    },
    {
      id: 'financial-snapshot',
      name: 'Financial Snapshot',
      order: 3,
      required: false,
      description: 'Upload bank statements and provide emergency fund estimate',
    },
    {
      id: 'debts',
      name: 'Debts & Loans',
      order: 4,
      required: false,
      description: 'Add any debts or loans you have',
    },
    {
      id: 'goals',
      name: 'Financial Goals',
      order: 5,
      required: true,
      description: 'Create at least one financial goal',
    },
    {
      id: 'budgets',
      name: 'Category Budgets',
      order: 6,
      required: false,
      description: 'Set spending limits for expense categories',
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get onboarding status for a user
   */
  async getStatus(userId: string): Promise<OnboardingStatusResponseDto> {
    // Get or create onboarding progress
    let progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await this.prisma.onboardingProgress.create({
        data: { userId },
      });
      this.logger.log(`Created onboarding progress for user ${userId}`);
    }

    // Get user profile
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        country: true,
        currency: true,
        employmentType: true,
        dateOfBirth: true,
        onboardingCompleted: true,
      },
    });

    // Build step statuses
    const stepStatuses = this.buildStepStatuses(
      progress.completedSteps,
      progress.skippedSteps,
    );

    // Calculate progress
    const requiredSteps = this.steps.filter((s) => s.required);
    const completedRequired = requiredSteps.filter((s) =>
      progress!.completedSteps.includes(s.id),
    );
    const progressPercent = Math.round(
      (completedRequired.length / requiredSteps.length) * 100,
    );

    // Determine next action
    const nextAction = this.getNextAction(stepStatuses, progress.currentStep);

    return {
      isCompleted: user?.onboardingCompleted ?? false,
      currentStep: progress.currentStep,
      progressPercent,
      steps: stepStatuses,
      profile: {
        country: user?.country,
        currency: user?.currency,
        employmentType: user?.employmentType ?? undefined,
        dateOfBirth: user?.dateOfBirth?.toISOString().split('T')[0],
      },
      startedAt: progress.startedAt,
      completedAt: progress.completedAt ?? undefined,
      nextAction,
    };
  }

  /**
   * Update user profile during onboarding
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdateProfileResponseDto> {
    // Update user profile
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.employmentType !== undefined && { employmentType: dto.employmentType }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.whatsappNotificationsEnabled !== undefined && {
          whatsappNotificationsEnabled: dto.whatsappNotificationsEnabled,
        }),
      },
    });

    // Check if profile step is complete
    const profileStepComplete = !!(
      user.country &&
      user.currency &&
      user.employmentType
    );

    this.logger.log(`Updated profile for user ${userId}, complete: ${profileStepComplete}`);

    return {
      country: user.country,
      currency: user.currency,
      employmentType: user.employmentType ?? undefined,
      dateOfBirth: user.dateOfBirth?.toISOString().split('T')[0],
      phoneNumber: user.phoneNumber ?? undefined,
      whatsappNotificationsEnabled: user.whatsappNotificationsEnabled,
      profileStepComplete,
    };
  }

  /**
   * Complete a step
   */
  async completeStep(userId: string, stepId: string): Promise<StepActionResponseDto> {
    const step = this.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new OnboardingPrerequisitesNotMetException(stepId, ['Invalid step']);
    }

    // Check onboarding is not already completed
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    });

    if (user?.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedException();
    }

    // Validate step requirements
    await this.validateStepCompletion(userId, stepId);

    // Get or create progress
    let progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await this.prisma.onboardingProgress.create({
        data: { userId },
      });
    }

    // Update progress
    const completedSteps = [...new Set([...progress.completedSteps, stepId])];
    const nextStep = this.getNextPendingStep(completedSteps, progress.skippedSteps);

    await this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        completedSteps,
        currentStep: nextStep,
      },
    });

    // Calculate new progress
    const requiredSteps = this.steps.filter((s) => s.required);
    const completedRequired = requiredSteps.filter((s) =>
      completedSteps.includes(s.id),
    );
    const progressPercent = Math.round(
      (completedRequired.length / requiredSteps.length) * 100,
    );

    this.logger.log(`Completed step "${stepId}" for user ${userId}`);

    return {
      step: stepId,
      action: 'completed',
      nextStep,
      progressPercent,
      message: this.getStepMessage(nextStep),
    };
  }

  /**
   * Skip an optional step
   */
  async skipStep(userId: string, stepId: string): Promise<StepActionResponseDto> {
    const step = this.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new OnboardingPrerequisitesNotMetException(stepId, ['Invalid step']);
    }

    // Cannot skip required steps
    if (step.required) {
      throw new OnboardingStepRequiredException(stepId);
    }

    // Check onboarding is not already completed
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    });

    if (user?.onboardingCompleted) {
      throw new OnboardingAlreadyCompletedException();
    }

    // Get or create progress
    let progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await this.prisma.onboardingProgress.create({
        data: { userId },
      });
    }

    // Update progress
    const skippedSteps = [...new Set([...progress.skippedSteps, stepId])];
    const nextStep = this.getNextPendingStep(progress.completedSteps, skippedSteps);

    await this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        skippedSteps,
        currentStep: nextStep,
      },
    });

    // Calculate progress (skipped steps don't count toward progress)
    const requiredSteps = this.steps.filter((s) => s.required);
    const completedRequired = requiredSteps.filter((s) =>
      progress!.completedSteps.includes(s.id),
    );
    const progressPercent = Math.round(
      (completedRequired.length / requiredSteps.length) * 100,
    );

    this.logger.log(`Skipped step "${stepId}" for user ${userId}`);

    return {
      step: stepId,
      action: 'skipped',
      nextStep,
      progressPercent,
      message: this.getStepMessage(nextStep),
    };
  }

  /**
   * Complete the onboarding flow
   */
  async completeOnboarding(userId: string): Promise<CompleteOnboardingResponseDto> {
    // Validate all required steps are completed
    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      throw new OnboardingNotStartedException();
    }

    const requiredSteps = this.steps.filter((s) => s.required);
    const missingSteps = requiredSteps.filter(
      (s) => !progress.completedSteps.includes(s.id),
    );

    if (missingSteps.length > 0) {
      throw new OnboardingMinimumDataRequiredException(
        'onboarding',
        `Complete these required steps: ${missingSteps.map((s) => s.name).join(', ')}`,
      );
    }

    // Mark onboarding as completed
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { onboardingCompleted: true },
      }),
      this.prisma.onboardingProgress.update({
        where: { userId },
        data: { completedAt: now },
      }),
    ]);

    this.logger.log(`Completed onboarding for user ${userId}`);

    return {
      success: true,
      completedAt: now,
      message: 'Welcome to IKPA! Your financial journey begins now.',
    };
  }

  /**
   * Save emergency fund estimate for a user
   */
  async saveEmergencyEstimate(
    userId: string,
    amount: number,
  ): Promise<{ success: boolean; amount: number }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emergencyFundEstimate: new Decimal(amount) },
    });

    this.logger.log(`Saved emergency fund estimate for user ${userId}: ${amount}`);

    return { success: true, amount };
  }

  /**
   * Build step statuses based on user data
   */
  private buildStepStatuses(
    completedSteps: string[],
    skippedSteps: string[],
  ): OnboardingStepDto[] {
    return this.steps.map((step) => {
      let status: 'pending' | 'completed' | 'skipped' = 'pending';

      if (completedSteps.includes(step.id)) {
        status = 'completed';
      } else if (skippedSteps.includes(step.id)) {
        status = 'skipped';
      }

      return {
        id: step.id,
        name: step.name,
        order: step.order,
        required: step.required,
        status,
        description: step.description,
      };
    });
  }

  /**
   * Validate that a step can be completed
   */
  private async validateStepCompletion(userId: string, stepId: string): Promise<void> {
    switch (stepId) {
      case 'profile': {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { country: true, currency: true, employmentType: true },
        });
        if (!user?.country || !user?.currency || !user?.employmentType) {
          throw new OnboardingMinimumDataRequiredException(
            'profile',
            'Set your country, currency, and employment type first.',
          );
        }
        break;
      }

      case 'income': {
        const incomeCount = await this.prisma.incomeSource.count({
          where: { userId, isActive: true },
        });
        if (incomeCount === 0) {
          throw new OnboardingMinimumDataRequiredException(
            'income',
            'Add at least one income source.',
          );
        }
        break;
      }

      case 'financial-snapshot': {
        // Optional - can be completed without data
        break;
      }

      case 'debts': {
        // Optional - can be completed without data
        break;
      }

      case 'goals': {
        const goalCount = await this.prisma.goal.count({
          where: { userId, status: 'ACTIVE' },
        });
        if (goalCount === 0) {
          throw new OnboardingMinimumDataRequiredException(
            'goals',
            'Add at least one financial goal.',
          );
        }
        break;
      }

      case 'budgets': {
        // Optional - can be completed without data
        break;
      }
    }
  }

  /**
   * Get the next pending step
   */
  private getNextPendingStep(completedSteps: string[], skippedSteps: string[]): string {
    const processedSteps = [...completedSteps, ...skippedSteps];

    for (const step of this.steps) {
      if (!processedSteps.includes(step.id)) {
        return step.id;
      }
    }

    // All steps done, return last step
    return 'complete';
  }

  /**
   * Get next action message for user
   */
  private getNextAction(
    steps: OnboardingStepDto[],
    currentStep: string,
  ): string {
    const current = steps.find((s) => s.id === currentStep);
    if (!current) {
      return 'Complete your onboarding to get started!';
    }

    if (current.status === 'completed') {
      return 'Proceed to the next step.';
    }

    return current.description;
  }

  /**
   * Get message for a step
   */
  private getStepMessage(stepId: string): string {
    if (stepId === 'complete') {
      return 'All steps done! Complete your onboarding to get started.';
    }

    const step = this.steps.find((s) => s.id === stepId);
    return step?.description ?? 'Continue with the next step.';
  }
}
