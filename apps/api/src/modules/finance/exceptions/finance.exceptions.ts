import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../common/exceptions';
import { ErrorCodes } from '../../../common/constants/error-codes';

/**
 * Thrown when there's insufficient data to calculate the Cash Flow Score
 *
 * This typically occurs when a user hasn't set up their financial profile
 * (income sources, expenses, savings accounts, etc.)
 */
export class InsufficientFinancialDataException extends ApiException {
  constructor(missingData?: string[]) {
    const message = missingData
      ? `Insufficient financial data to calculate Cash Flow Score. Missing: ${missingData.join(', ')}`
      : 'Insufficient financial data to calculate Cash Flow Score. Please complete your financial profile.';

    super(
      ErrorCodes.FINANCE_INSUFFICIENT_DATA,
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { missingData },
    );
  }
}

/**
 * Thrown when the score calculation fails due to an internal error
 */
export class ScoreCalculationException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.FINANCE_CALCULATION_ERROR,
      `Failed to calculate Cash Flow Score: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}

/**
 * Thrown when no score history is found for the requested period
 */
export class ScoreHistoryNotFoundException extends ApiException {
  constructor(userId?: string) {
    super(
      ErrorCodes.FINANCE_SNAPSHOT_NOT_FOUND,
      'No score history found. Please ensure your financial data is complete and check back after 24 hours.',
      HttpStatus.NOT_FOUND,
      userId ? { userId } : undefined,
    );
  }
}

/**
 * Thrown when a specific financial snapshot is not found
 */
export class FinancialSnapshotNotFoundException extends ApiException {
  constructor(snapshotId?: string) {
    super(
      ErrorCodes.FINANCE_SNAPSHOT_NOT_FOUND,
      snapshotId
        ? `Financial snapshot with id '${snapshotId}' not found`
        : 'Financial snapshot not found',
      HttpStatus.NOT_FOUND,
      snapshotId ? { snapshotId } : undefined,
    );
  }
}

/**
 * Thrown when an invalid metric name is requested
 */
export class InvalidMetricException extends ApiException {
  constructor(metric: string, validMetrics: string[]) {
    super(
      ErrorCodes.VALIDATION_ERROR,
      `Invalid metric '${metric}'. Valid metrics are: ${validMetrics.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { metric, validMetrics },
    );
  }
}

/**
 * Thrown when financial data contains mixed currencies
 *
 * This prevents incorrect calculations when summing amounts
 * in different currencies without proper conversion.
 */
export class CurrencyMismatchException extends ApiException {
  constructor(primaryCurrency: string, mismatchedCurrencies: string[]) {
    super(
      ErrorCodes.FINANCE_CALCULATION_ERROR,
      `Currency mismatch detected. Your primary currency is ${primaryCurrency}, ` +
        `but some financial data uses: ${mismatchedCurrencies.join(', ')}. ` +
        `Please update all entries to use the same currency.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { primaryCurrency, mismatchedCurrencies },
    );
  }
}

/**
 * Thrown when attempting to access finance data for a non-existent user
 *
 * This provides a defense-in-depth check at the service layer,
 * preventing unauthorized access if the service is called from other modules.
 */
export class UserNotFoundException extends ApiException {
  constructor(userId: string) {
    super(
      ErrorCodes.FINANCE_USER_NOT_FOUND,
      'User not found or access denied',
      HttpStatus.NOT_FOUND,
      { userId }, // Only included in logs, not exposed to client
    );
  }
}

/**
 * Thrown when financial data contains invalid or suspicious values
 *
 * This prevents calculation errors from corrupted or malformed data.
 */
export class InvalidFinancialDataException extends ApiException {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.FINANCE_INVALID_DATA,
      `Invalid financial data: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}
