/**
 * Future Self Simulator Exceptions
 *
 * Custom exceptions for the Future Self feature.
 * All exceptions extend ApiException for consistent error handling.
 */

import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions/api.exception';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Thrown when letter generation fails
 */
export class LetterGenerationException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.FUTURE_SELF_LETTER_GENERATION_ERROR,
      `Failed to generate future self letter: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

/**
 * Thrown when Anthropic service is unavailable
 */
export class AnthropicServiceUnavailableException extends ApiException {
  constructor() {
    super(
      ErrorCodes.FUTURE_SELF_ANTHROPIC_UNAVAILABLE,
      'AI service is temporarily unavailable. Please try again later.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Thrown when user is not found
 */
export class FutureSelfUserNotFoundException extends ApiException {
  constructor(userId: string) {
    super(
      ErrorCodes.FUTURE_SELF_USER_NOT_FOUND,
      `User not found: ${userId}`,
      HttpStatus.NOT_FOUND,
      { userId },
    );
  }
}

/**
 * Thrown when user has insufficient data for simulation
 */
export class InsufficientUserDataException extends ApiException {
  constructor(missingFields?: string[]) {
    const message = missingFields?.length
      ? `Insufficient user data for future self simulation. Missing: ${missingFields.join(', ')}`
      : 'Insufficient user data for future self simulation. Please complete your financial profile.';

    super(
      ErrorCodes.FUTURE_SELF_INSUFFICIENT_DATA,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { missingFields },
    );
  }
}

/**
 * Thrown when simulation fails
 */
export class FutureSelfSimulationException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.FUTURE_SELF_SIMULATION_ERROR,
      `Failed to run future self simulation: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}
