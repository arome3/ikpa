import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Thrown when onboarding has not been started yet
 */
export class OnboardingNotStartedException extends HttpException {
  constructor() {
    super(
      {
        code: ErrorCodes.ONBOARD_NOT_STARTED,
        message: 'Onboarding has not been started. Create your account to begin.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Thrown when trying to perform onboarding actions after completion
 */
export class OnboardingAlreadyCompletedException extends HttpException {
  constructor() {
    super(
      {
        code: ErrorCodes.ONBOARD_ALREADY_COMPLETED,
        message: 'Onboarding has already been completed.',
      },
      HttpStatus.CONFLICT,
    );
  }
}

/**
 * Thrown when trying to skip a required onboarding step
 */
export class OnboardingStepRequiredException extends HttpException {
  constructor(step: string) {
    super(
      {
        code: ErrorCodes.ONBOARD_STEP_REQUIRED,
        message: `The "${step}" step is required and cannot be skipped.`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Thrown when trying to complete a step before prerequisites are met
 */
export class OnboardingPrerequisitesNotMetException extends HttpException {
  constructor(step: string, missing: string[]) {
    super(
      {
        code: ErrorCodes.ONBOARD_PREREQUISITES_NOT_MET,
        message: `Cannot complete "${step}" step. Missing prerequisites: ${missing.join(', ')}.`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Thrown when minimum data requirements are not met for a step
 */
export class OnboardingMinimumDataRequiredException extends HttpException {
  constructor(step: string, requirement: string) {
    super(
      {
        code: ErrorCodes.ONBOARD_MINIMUM_DATA_REQUIRED,
        message: `Cannot complete "${step}" step. ${requirement}`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
