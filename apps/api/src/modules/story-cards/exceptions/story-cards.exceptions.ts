/**
 * Story Cards Exceptions
 *
 * Custom exceptions for the Story Cards viral sharing system.
 */

import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { StoryCardType } from '@prisma/client';

/**
 * Thrown when a story card is not found
 */
export class StoryCardNotFoundException extends ApiException {
  constructor(cardId?: string, shareCode?: string) {
    const identifier = cardId || shareCode;
    super(
      ErrorCodes.STORY_CARD_NOT_FOUND,
      identifier
        ? `Story card '${identifier}' not found`
        : 'Story card not found',
      HttpStatus.NOT_FOUND,
      { cardId, shareCode },
    );
  }
}

/**
 * Thrown when card generation fails
 */
export class StoryCardGenerationFailedException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.STORY_CARD_GENERATION_FAILED,
      `Failed to generate story card: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

/**
 * Thrown when the source data for a card is not found
 */
export class StoryCardSourceNotFoundException extends ApiException {
  constructor(type: StoryCardType, sourceId: string) {
    super(
      ErrorCodes.STORY_CARD_SOURCE_NOT_FOUND,
      `Source ${type.toLowerCase()} with id '${sourceId}' not found. Please ensure the source exists before generating a card.`,
      HttpStatus.NOT_FOUND,
      { type, sourceId },
    );
  }
}

/**
 * Thrown when user exceeds card generation limits
 */
export class StoryCardLimitExceededException extends ApiException {
  constructor(currentCount: number, maxLimit: number, period: 'daily' | 'total') {
    const message =
      period === 'daily'
        ? `You have reached the daily limit of ${maxLimit} story cards. Please try again tomorrow.`
        : `You have reached the maximum limit of ${maxLimit} story cards. Please delete some old cards to create new ones.`;

    super(
      ErrorCodes.STORY_CARD_LIMIT_EXCEEDED,
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      { currentCount, maxLimit, period },
    );
  }
}

/**
 * Thrown when a story card has expired
 */
export class StoryCardExpiredException extends ApiException {
  constructor(cardId: string, expiredAt: Date) {
    super(
      ErrorCodes.STORY_CARD_EXPIRED,
      `Story card '${cardId}' has expired on ${expiredAt.toISOString().split('T')[0]}`,
      HttpStatus.GONE,
      { cardId, expiredAt: expiredAt.toISOString() },
    );
  }
}

/**
 * Thrown when user doesn't have access to a story card
 */
export class StoryCardAccessDeniedException extends ApiException {
  constructor(cardId: string) {
    super(
      ErrorCodes.STORY_CARD_ACCESS_DENIED,
      `You don't have permission to access story card '${cardId}'`,
      HttpStatus.FORBIDDEN,
      { cardId },
    );
  }
}

/**
 * Thrown when an invalid card type is provided
 */
export class StoryCardInvalidTypeException extends ApiException {
  constructor(type: string, validTypes: string[]) {
    super(
      ErrorCodes.STORY_CARD_INVALID_TYPE,
      `Invalid card type '${type}'. Valid types are: ${validTypes.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { type, validTypes },
    );
  }
}

/**
 * Thrown when circuit breaker is open for a source type
 */
export class StoryCardCircuitOpenException extends ApiException {
  constructor(sourceType: StoryCardType, retryAfterMs: number) {
    super(
      ErrorCodes.STORY_CARD_SERVICE_UNAVAILABLE,
      `Service temporarily unavailable for ${sourceType} cards. Please try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
      HttpStatus.SERVICE_UNAVAILABLE,
      { sourceType, retryAfterMs },
    );
  }
}
