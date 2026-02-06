import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, SkipEmailVerification } from '../../common/decorators';
import { OnboardingService } from './onboarding.service';
import {
  OnboardingStatusResponseDto,
  UpdateProfileDto,
  UpdateProfileResponseDto,
  StepActionResponseDto,
  CompleteOnboardingResponseDto,
} from './dto';

/**
 * Onboarding Controller
 *
 * Manages the onboarding flow for new users.
 *
 * The 6-step onboarding flow:
 * 1. Profile - Set country, currency, employment type (required)
 * 2. Income - Add at least one income source (required)
 * 3. Financial Snapshot - Upload bank statements & emergency fund estimate (optional)
 * 4. Debts - Add debts (optional, can skip)
 * 5. Goals - Add at least one goal (required)
 * 6. Budgets - Set up category budgets (optional, can skip)
 */
@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipEmailVerification()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /**
   * Get onboarding status
   */
  @Get('status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get Onboarding Status',
    description:
      'Returns the current onboarding progress, including which steps are ' +
      'completed/skipped, progress percentage, and the current profile data. ' +
      'If onboarding has not started, it will be initialized.',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status retrieved successfully',
    type: OnboardingStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatus(
    @CurrentUser('id') userId: string,
  ): Promise<OnboardingStatusResponseDto> {
    return this.onboardingService.getStatus(userId);
  }

  /**
   * Update profile
   */
  @Patch('profile')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Update Profile',
    description:
      'Updates the user\'s profile fields during onboarding. ' +
      'Required for the "profile" step: country, currency, and employmentType. ' +
      'dateOfBirth is optional but recommended for personalized advice.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UpdateProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UpdateProfileResponseDto> {
    return this.onboardingService.updateProfile(userId, dto);
  }

  /**
   * Submit emergency fund estimate
   */
  @Post('emergency-estimate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Submit Emergency Fund Estimate',
    description:
      'Saves the user\'s self-reported emergency fund estimate. ' +
      'Used during the Financial Snapshot onboarding step.',
  })
  @ApiResponse({
    status: 201,
    description: 'Emergency fund estimate saved',
  })
  @ApiResponse({ status: 400, description: 'Invalid amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async submitEmergencyEstimate(
    @CurrentUser('id') userId: string,
    @Body() body: { amount: number },
  ): Promise<{ success: boolean; amount: number }> {
    return this.onboardingService.saveEmergencyEstimate(userId, body.amount);
  }

  /**
   * Complete a step
   */
  @Post('steps/:step/complete')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Complete Step',
    description:
      'Marks a step as completed. Validates that minimum requirements are met:\n' +
      '- profile: country, currency, employmentType must be set\n' +
      '- income: at least one income source\n' +
      '- goals: at least one active goal\n' +
      'Other steps can be completed without data.',
  })
  @ApiParam({
    name: 'step',
    description: 'Step ID to complete',
    enum: ['profile', 'income', 'financial-snapshot', 'debts', 'goals', 'budgets'],
  })
  @ApiResponse({
    status: 201,
    description: 'Step completed successfully',
    type: StepActionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid step or step already completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Onboarding already completed' })
  @ApiResponse({ status: 422, description: 'Minimum requirements not met' })
  async completeStep(
    @CurrentUser('id') userId: string,
    @Param('step') step: string,
  ): Promise<StepActionResponseDto> {
    return this.onboardingService.completeStep(userId, step);
  }

  /**
   * Skip an optional step
   */
  @Post('steps/:step/skip')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Skip Step',
    description:
      'Skips an optional step. Only these steps can be skipped:\n' +
      '- financial-snapshot\n' +
      '- debts\n' +
      '- budgets\n\n' +
      'Required steps (profile, income, goals) cannot be skipped.',
  })
  @ApiParam({
    name: 'step',
    description: 'Step ID to skip',
    enum: ['financial-snapshot', 'debts', 'budgets'],
  })
  @ApiResponse({
    status: 201,
    description: 'Step skipped successfully',
    type: StepActionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Step is required and cannot be skipped' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Onboarding already completed' })
  async skipStep(
    @CurrentUser('id') userId: string,
    @Param('step') step: string,
  ): Promise<StepActionResponseDto> {
    return this.onboardingService.skipStep(userId, step);
  }

  /**
   * Complete onboarding
   */
  @Post('complete')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Complete Onboarding',
    description:
      'Finalizes the onboarding flow. Requires all required steps to be completed:\n' +
      '- profile\n' +
      '- income\n' +
      '- goals\n\n' +
      'Sets onboardingCompleted=true on the user, enabling full app features.',
  })
  @ApiResponse({
    status: 201,
    description: 'Onboarding completed successfully',
    type: CompleteOnboardingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Onboarding not started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 422, description: 'Required steps not completed' })
  async completeOnboarding(
    @CurrentUser('id') userId: string,
  ): Promise<CompleteOnboardingResponseDto> {
    return this.onboardingService.completeOnboarding(userId);
  }
}
