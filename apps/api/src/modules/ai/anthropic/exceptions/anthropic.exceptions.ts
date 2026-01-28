/**
 * Anthropic Service Exceptions
 *
 * Custom exceptions for Claude API interactions.
 * All exceptions extend ApiException for consistent error handling.
 */

import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../../common/exceptions/api.exception';
import { ErrorCodes } from '../../../../common/constants/error-codes';

/**
 * Thrown when Anthropic service is unavailable
 * (API key not configured, circuit breaker open, rate limited)
 */
export class AnthropicServiceUnavailableException extends ApiException {
  constructor(reason?: string) {
    super(
      ErrorCodes.AI_SERVICE_ERROR,
      reason || 'AI service is temporarily unavailable. Please try again later.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Thrown when Anthropic API rate limit is exceeded
 */
export class AnthropicRateLimitException extends ApiException {
  constructor() {
    super(
      ErrorCodes.AI_RATE_LIMIT,
      'AI service rate limit exceeded. Please try again in a moment.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * Thrown when Anthropic API returns an error
 */
export class AnthropicApiException extends ApiException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.AI_SERVICE_ERROR,
      `AI service error: ${message}`,
      HttpStatus.BAD_GATEWAY,
      details,
    );
  }
}
