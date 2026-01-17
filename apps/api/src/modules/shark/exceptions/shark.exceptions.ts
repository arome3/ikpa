/**
 * Shark Auditor Exceptions
 *
 * Custom exception classes for the Shark Auditor subscription
 * detection and management system.
 */

import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Thrown when a subscription is not found
 *
 * This occurs when attempting to access, cancel, or swipe on
 * a subscription that doesn't exist or doesn't belong to the user.
 */
export class SubscriptionNotFoundException extends ApiException {
  constructor(subscriptionId: string) {
    super(
      ErrorCodes.SHARK_SUBSCRIPTION_NOT_FOUND,
      `Subscription with id '${subscriptionId}' not found`,
      HttpStatus.NOT_FOUND,
      { subscriptionId },
    );
  }
}

/**
 * Thrown when there's insufficient expense data to detect subscriptions
 *
 * This occurs when a user hasn't recorded enough recurring expenses
 * for the subscription detection algorithm to work effectively.
 */
export class InsufficientExpenseDataException extends ApiException {
  constructor(minRequired: number = 2) {
    super(
      ErrorCodes.SHARK_INSUFFICIENT_DATA,
      `Insufficient recurring expense data. At least ${minRequired} recurring expenses ` +
        `are needed to detect subscriptions. Please add more expense records.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { minRequired },
    );
  }
}

/**
 * Thrown when the subscription audit operation fails
 *
 * This is a general exception for audit-related failures,
 * including database errors or calculation issues.
 */
export class AuditOperationException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.SHARK_AUDIT_ERROR,
      `Subscription audit failed: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

/**
 * Thrown when subscription cancellation fails
 *
 * This occurs when the cancellation process encounters an error,
 * such as the subscription being in an invalid state.
 */
export class SubscriptionCancellationException extends ApiException {
  constructor(subscriptionId: string, reason: string) {
    super(
      ErrorCodes.SHARK_CANCELLATION_ERROR,
      `Failed to process cancellation for subscription '${subscriptionId}': ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { subscriptionId, reason },
    );
  }
}

/**
 * Thrown when an invalid swipe action is provided
 *
 * This validates that only valid swipe actions (KEEP, CANCEL, REVIEW_LATER)
 * are accepted.
 */
export class InvalidSwipeActionException extends ApiException {
  constructor(action: string, validActions: string[]) {
    super(
      ErrorCodes.VALIDATION_ERROR,
      `Invalid swipe action '${action}'. Valid actions are: ${validActions.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { action, validActions },
    );
  }
}

/**
 * Thrown when a subscription already has a pending decision
 *
 * This prevents duplicate swipe decisions on the same subscription
 * within a short time period.
 */
export class DuplicateSwipeDecisionException extends ApiException {
  constructor(subscriptionId: string) {
    super(
      ErrorCodes.SHARK_DUPLICATE_DECISION,
      `Subscription '${subscriptionId}' already has a recent swipe decision. ` +
        `Wait a moment before swiping again.`,
      HttpStatus.CONFLICT,
      { subscriptionId },
    );
  }
}

/**
 * Thrown when attempting to access shark data for a non-existent user
 *
 * This provides a defense-in-depth check at the service layer.
 */
export class SharkUserNotFoundException extends ApiException {
  constructor(userId: string) {
    super(
      ErrorCodes.RESOURCE_NOT_FOUND,
      'User not found or access denied',
      HttpStatus.NOT_FOUND,
      { userId },
    );
  }
}
