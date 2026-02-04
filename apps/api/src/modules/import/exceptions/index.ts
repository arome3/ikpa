/**
 * Import Module Exceptions
 *
 * Custom exceptions for import processing errors.
 */

import { HttpStatus } from '@nestjs/common';
import { ApiException, ErrorCodes } from '../../../common';

export class ImportJobNotFoundException extends ApiException {
  constructor(jobId: string) {
    super(
      ErrorCodes.IMPORT_JOB_NOT_FOUND,
      `Import job with id '${jobId}' not found`,
      HttpStatus.NOT_FOUND,
      { jobId },
    );
  }
}

export class ImportFileTooLargeException extends ApiException {
  constructor(maxSizeBytes: number, actualSizeBytes: number) {
    super(
      ErrorCodes.IMPORT_FILE_TOO_LARGE,
      `File size ${(actualSizeBytes / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB`,
      HttpStatus.PAYLOAD_TOO_LARGE,
      { maxSizeBytes, actualSizeBytes },
    );
  }
}

export class ImportInvalidFileTypeException extends ApiException {
  constructor(mimeType: string, allowedTypes: string[]) {
    super(
      ErrorCodes.IMPORT_INVALID_FILE_TYPE,
      `File type '${mimeType}' is not supported. Allowed types: ${allowedTypes.join(', ')}`,
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      { mimeType, allowedTypes },
    );
  }
}

export class ImportParseException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.IMPORT_PARSE_ERROR,
      `Failed to parse import file: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { reason },
    );
  }
}

export class ImportNoTransactionsFoundException extends ApiException {
  constructor() {
    super(
      ErrorCodes.IMPORT_NO_TRANSACTIONS_FOUND,
      'No transactions could be extracted from the uploaded file',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ImportJobAlreadyProcessedException extends ApiException {
  constructor(jobId: string, status: string) {
    super(
      ErrorCodes.IMPORT_JOB_ALREADY_PROCESSED,
      `Import job '${jobId}' has already been processed with status '${status}'`,
      HttpStatus.CONFLICT,
      { jobId, status },
    );
  }
}

export class ImportTransactionNotFoundException extends ApiException {
  constructor(transactionId: string) {
    super(
      ErrorCodes.IMPORT_TRANSACTION_NOT_FOUND,
      `Parsed transaction with id '${transactionId}' not found`,
      HttpStatus.NOT_FOUND,
      { transactionId },
    );
  }
}

export class ImportEmailNotConfiguredException extends ApiException {
  constructor(userId: string) {
    super(
      ErrorCodes.IMPORT_EMAIL_NOT_CONFIGURED,
      'Import email address has not been set up for this user',
      HttpStatus.NOT_FOUND,
      { userId },
    );
  }
}

export class ImportEmailRegenerateLimitException extends ApiException {
  constructor(limitPerDay: number) {
    super(
      ErrorCodes.IMPORT_EMAIL_REGENERATE_LIMIT,
      `Email regeneration limit exceeded. You can regenerate up to ${limitPerDay} times per day.`,
      HttpStatus.TOO_MANY_REQUESTS,
      { limitPerDay },
    );
  }
}

export class ImportUploadRateLimitException extends ApiException {
  constructor(limitPerHour: number, source: string) {
    super(
      ErrorCodes.IMPORT_UPLOAD_RATE_LIMIT,
      `Upload limit exceeded for ${source}. Maximum ${limitPerHour} uploads per hour.`,
      HttpStatus.TOO_MANY_REQUESTS,
      { limitPerHour, source },
    );
  }
}

export class ImportStorageException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.IMPORT_STORAGE_ERROR,
      `File storage error: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { reason },
    );
  }
}

export class ImportVisionException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.IMPORT_VISION_ERROR,
      `Screenshot analysis error: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { reason },
    );
  }
}

export class ImportPdfParseException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.IMPORT_PDF_PARSE_ERROR,
      `PDF parsing error: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { reason },
    );
  }
}

export class ImportCsvParseException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.IMPORT_CSV_PARSE_ERROR,
      `CSV parsing error: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { reason },
    );
  }
}

export class ImportEmailWebhookInvalidException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.IMPORT_EMAIL_WEBHOOK_INVALID,
      `Invalid email webhook: ${reason}`,
      HttpStatus.BAD_REQUEST,
      { reason },
    );
  }
}

export class ImportConfirmationException extends ApiException {
  constructor(reason: string) {
    super(
      ErrorCodes.IMPORT_CONFIRMATION_ERROR,
      `Failed to confirm transactions: ${reason}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      { reason },
    );
  }
}
