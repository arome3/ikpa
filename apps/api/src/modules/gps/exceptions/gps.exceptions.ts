import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';
import { findBestMatches, generateDidYouMeanMessage } from '../../../common/utils';

/**
 * Thrown when no budget is found for the specified category
 *
 * This occurs when a user tries to check budget status for a category
 * where they haven't set up a budget.
 *
 * Features:
 * - Fuzzy matching to suggest similar category names ("Did you mean?")
 * - Lists available categories with their IDs for easy reference
 * - Accepts both category names and IDs in suggestions
 */
export class NoBudgetFoundException extends ApiException {
  constructor(
    category?: string,
    userId?: string,
    availableCategories?: Array<{ id: string; name: string }>,
  ) {
    // Find best matches using fuzzy matching
    const suggestions =
      category && availableCategories
        ? findBestMatches(category, availableCategories, {
            maxResults: 5,
            minSimilarity: 0.3,
          })
        : [];

    // Generate "Did you mean?" message
    const didYouMean = category ? generateDidYouMeanMessage(category, suggestions) : null;

    // Build the error message
    let message: string;
    if (didYouMean) {
      message = didYouMean;
    } else if (category) {
      message = `No budget found for category '${category}'. Please set up a budget before tracking overspending.`;
      // Add hint about available categories if no fuzzy match found
      if (availableCategories && availableCategories.length > 0) {
        const categoryList = availableCategories
          .slice(0, 5)
          .map((c) => `"${c.name}" (id: ${c.id})`)
          .join(', ');
        message += ` Available categories with budgets: ${categoryList}`;
      }
    } else {
      message = 'No budget found. Please set up a budget before tracking overspending.';
    }

    // Build suggestions array for the response
    const suggestionNames = suggestions.map((s) => s.name);

    super(ErrorCodes.GPS_NO_BUDGET_FOUND, message, HttpStatus.NOT_FOUND, {
      category,
      userId,
      suggestions: suggestionNames,
      availableCategories: availableCategories?.map((c) => ({
        id: c.id,
        name: c.name,
      })),
      hint: 'You can use either the category name (e.g., "Food & Dining") or category ID (e.g., "food-dining")',
    });
  }
}

/**
 * Thrown when the user has no active financial goal
 *
 * GPS Re-Router requires at least one active goal to calculate
 * the probability impact of overspending.
 */
export class GpsNoActiveGoalException extends ApiException {
  constructor(userId?: string) {
    super(
      ErrorCodes.GPS_NO_ACTIVE_GOAL,
      'No active financial goal found. Please create a savings goal to use the GPS Re-Router.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      userId ? { userId } : undefined,
    );
  }
}

/**
 * Thrown when the GPS calculation fails due to an internal error
 */
export class GpsCalculationException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.GPS_CALCULATION_ERROR,
      `Failed to calculate recovery paths: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

/**
 * Thrown when a recovery session is not found
 */
export class RecoverySessionNotFoundException extends ApiException {
  constructor(sessionId?: string) {
    super(
      ErrorCodes.GPS_RECOVERY_SESSION_NOT_FOUND,
      sessionId
        ? `Recovery session with id '${sessionId}' not found`
        : 'Recovery session not found',
      HttpStatus.NOT_FOUND,
      sessionId ? { sessionId } : undefined,
    );
  }
}

/**
 * Thrown when an invalid recovery path ID is provided
 */
export class InvalidRecoveryPathException extends ApiException {
  constructor(pathId: string, validPaths: string[]) {
    super(
      ErrorCodes.GPS_INVALID_RECOVERY_PATH,
      `Invalid recovery path '${pathId}'. Valid paths are: ${validPaths.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { pathId, validPaths },
    );
  }
}

/**
 * Thrown when trying to select a path for an already resolved session
 */
export class SessionAlreadyResolvedException extends ApiException {
  constructor(sessionId: string, currentStatus: string) {
    super(
      ErrorCodes.GPS_SESSION_ALREADY_RESOLVED,
      `Recovery session '${sessionId}' has already been resolved with status: ${currentStatus}`,
      HttpStatus.CONFLICT,
      { sessionId, currentStatus },
    );
  }
}

/**
 * Thrown when there's insufficient data to run GPS calculations
 */
export class GpsInsufficientDataException extends ApiException {
  constructor(missingData?: string[]) {
    const message = missingData
      ? `Insufficient data for GPS Re-Router. Missing: ${missingData.join(', ')}`
      : 'Insufficient data for GPS Re-Router. Please complete your financial profile.';

    super(ErrorCodes.GPS_INSUFFICIENT_DATA, message, HttpStatus.UNPROCESSABLE_ENTITY, {
      missingData,
    });
  }
}

/**
 * Thrown when a message contains banned words
 * This is an internal error - messages should be validated before being shown
 */
export class BannedWordException extends ApiException {
  constructor(bannedWords: string[]) {
    super(
      ErrorCodes.GPS_CALCULATION_ERROR,
      'Message validation failed - internal error',
      HttpStatus.INTERNAL_SERVER_ERROR,
      { bannedWords, reason: 'Message contained banned judgmental words' },
    );
  }
}
