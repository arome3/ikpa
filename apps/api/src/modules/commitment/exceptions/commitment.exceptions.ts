/**
 * Commitment Device Engine Exceptions
 *
 * Custom exceptions for the commitment system.
 */

import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Thrown when a commitment contract is not found
 */
export class CommitmentNotFoundException extends ApiException {
  constructor(contractId?: string) {
    super(
      ErrorCodes.COMMITMENT_CONTRACT_NOT_FOUND,
      contractId
        ? `Commitment contract with id '${contractId}' not found`
        : 'Commitment contract not found',
      HttpStatus.NOT_FOUND,
      contractId ? { contractId } : undefined,
    );
  }
}

/**
 * Thrown when a commitment already exists for a goal
 */
export class CommitmentAlreadyExistsException extends ApiException {
  constructor(goalId: string) {
    super(
      ErrorCodes.COMMITMENT_ALREADY_EXISTS,
      `An active commitment already exists for goal '${goalId}'. Only one commitment per goal is allowed.`,
      HttpStatus.CONFLICT,
      { goalId },
    );
  }
}

/**
 * Thrown when an invalid stake type is provided
 */
export class InvalidStakeTypeException extends ApiException {
  constructor(stakeType: string, validTypes: string[]) {
    super(
      ErrorCodes.COMMITMENT_INVALID_STAKE_TYPE,
      `Invalid stake type '${stakeType}'. Valid types are: ${validTypes.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { stakeType, validTypes },
    );
  }
}

/**
 * Thrown when the deadline has already passed
 */
export class DeadlinePassedException extends ApiException {
  constructor(deadline: Date) {
    super(
      ErrorCodes.COMMITMENT_DEADLINE_PASSED,
      `The deadline ${deadline.toISOString()} has already passed. Please choose a future date.`,
      HttpStatus.BAD_REQUEST,
      { deadline: deadline.toISOString() },
    );
  }
}

/**
 * Thrown when a commitment cannot be cancelled
 */
export class CannotCancelCommitmentException extends ApiException {
  constructor(contractId: string, reason: string) {
    super(
      ErrorCodes.COMMITMENT_CANNOT_CANCEL,
      `Cannot cancel commitment '${contractId}': ${reason}`,
      HttpStatus.BAD_REQUEST,
      { contractId, reason },
    );
  }
}

/**
 * Thrown when a referee is not found
 */
export class RefereeNotFoundException extends ApiException {
  constructor(refereeId?: string, email?: string) {
    const identifier = refereeId || email;
    super(
      ErrorCodes.COMMITMENT_REFEREE_NOT_FOUND,
      identifier
        ? `Referee '${identifier}' not found`
        : 'Referee not found',
      HttpStatus.NOT_FOUND,
      { refereeId, email },
    );
  }
}

/**
 * Thrown when a referee is not authorized to perform an action
 */
export class RefereeNotAuthorizedException extends ApiException {
  constructor(refereeId: string, action: string) {
    super(
      ErrorCodes.COMMITMENT_REFEREE_NOT_AUTHORIZED,
      `Referee '${refereeId}' is not authorized to ${action}`,
      HttpStatus.FORBIDDEN,
      { refereeId, action },
    );
  }
}

/**
 * Thrown when a verification is invalid
 */
export class InvalidVerificationException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.COMMITMENT_INVALID_VERIFICATION,
      `Invalid verification: ${reason}`,
      HttpStatus.BAD_REQUEST,
      details,
    );
  }
}

/**
 * Thrown when commitment is pending verification
 */
export class CommitmentPendingVerificationException extends ApiException {
  constructor(contractId: string) {
    super(
      ErrorCodes.COMMITMENT_PENDING_VERIFICATION,
      `Commitment '${contractId}' is pending verification and cannot be modified`,
      HttpStatus.CONFLICT,
      { contractId },
    );
  }
}

/**
 * Thrown when the associated goal is not active
 */
export class GoalNotActiveException extends ApiException {
  constructor(goalId: string) {
    super(
      ErrorCodes.COMMITMENT_GOAL_NOT_ACTIVE,
      `Goal '${goalId}' is not active. Commitments can only be created for active goals.`,
      HttpStatus.BAD_REQUEST,
      { goalId },
    );
  }
}

/**
 * Thrown when the stake amount is insufficient
 */
export class InsufficientStakeException extends ApiException {
  constructor(provided: number, minimum: number, maximum: number) {
    super(
      ErrorCodes.COMMITMENT_INSUFFICIENT_STAKE,
      `Stake amount ${provided} is invalid. Amount must be between ${minimum} and ${maximum}.`,
      HttpStatus.BAD_REQUEST,
      { provided, minimum, maximum },
    );
  }
}

/**
 * Thrown when invitation token is invalid or expired
 */
export class InvalidInviteTokenException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.COMMITMENT_REFEREE_NOT_AUTHORIZED,
      `Invalid invitation: ${reason}`,
      HttpStatus.BAD_REQUEST,
      { reason },
    );
  }
}

/**
 * Thrown when user tries to use their own email as referee
 */
export class SelfRefereeException extends ApiException {
  constructor() {
    super(
      ErrorCodes.COMMITMENT_INVALID_VERIFICATION,
      'You cannot be your own accountability partner. Please invite someone else to help keep you on track.',
      HttpStatus.BAD_REQUEST,
      { reason: 'self_referee' },
    );
  }
}

/**
 * Thrown when deadline extension exceeds maximum allowed
 */
export class InvalidDeadlineExtensionException extends ApiException {
  constructor(maxDeadline: Date, requestedDeadline: Date) {
    super(
      ErrorCodes.COMMITMENT_DEADLINE_PASSED,
      `Cannot extend deadline beyond ${maxDeadline.toISOString().split('T')[0]}. The maximum extension is 90 days from your original deadline.`,
      HttpStatus.BAD_REQUEST,
      {
        maxDeadline: maxDeadline.toISOString(),
        requestedDeadline: requestedDeadline.toISOString(),
        maxExtensionDays: 90,
      },
    );
  }
}

/**
 * Thrown when user exceeds maximum number of referees
 */
export class RefereeLimitExceededException extends ApiException {
  constructor(currentCount: number, maxLimit: number) {
    super(
      ErrorCodes.COMMITMENT_REFEREE_LIMIT_EXCEEDED,
      `You have reached the maximum number of accountability partners (${maxLimit}). Please remove an existing referee before adding a new one.`,
      HttpStatus.BAD_REQUEST,
      {
        currentCount,
        maxLimit,
      },
    );
  }
}

/**
 * Thrown when commitment deadline exceeds goal's target date
 */
export class DeadlineExceedsGoalTargetException extends ApiException {
  constructor(commitmentDeadline: Date, goalTargetDate: Date) {
    super(
      ErrorCodes.COMMITMENT_DEADLINE_PASSED,
      `Commitment deadline (${commitmentDeadline.toISOString().split('T')[0]}) cannot exceed your goal's target date (${goalTargetDate.toISOString().split('T')[0]}). Please choose an earlier deadline.`,
      HttpStatus.BAD_REQUEST,
      {
        commitmentDeadline: commitmentDeadline.toISOString(),
        goalTargetDate: goalTargetDate.toISOString(),
      },
    );
  }
}

/**
 * Thrown when fund locking fails for a commitment
 */
export class FundLockFailedException extends ApiException {
  constructor(reason?: string) {
    super(
      ErrorCodes.COMMITMENT_FUND_LOCK_FAILED,
      reason
        ? `Failed to lock funds for commitment: ${reason}`
        : 'Failed to lock funds for commitment. Please try again or contact support.',
      HttpStatus.PAYMENT_REQUIRED,
      { reason },
    );
  }
}

/**
 * Thrown when an invalid update is attempted on a commitment
 */
export class InvalidCommitmentUpdateException extends ApiException {
  constructor(field: string, reason: string) {
    super(
      ErrorCodes.COMMITMENT_INVALID_UPDATE,
      `Cannot update ${field}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      { field, reason },
    );
  }
}

/**
 * Thrown when stake validation fails
 */
export class StakeValidationException extends ApiException {
  constructor(errors: string[]) {
    super(
      ErrorCodes.COMMITMENT_INVALID_STAKE_TYPE,
      errors.join('. '),
      HttpStatus.BAD_REQUEST,
      { validationErrors: errors },
    );
  }
}
