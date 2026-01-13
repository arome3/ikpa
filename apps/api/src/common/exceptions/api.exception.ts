import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodes } from '../constants/error-codes';

/**
 * Base API Exception
 *
 * Extends HttpException with a standardized error code.
 * All custom exceptions should extend this class.
 */
export class ApiException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}

/**
 * Resource Not Found Exception (404)
 *
 * Use when a requested resource doesn't exist.
 */
export class NotFoundException extends ApiException {
  constructor(resource: string, id?: string) {
    super(
      ErrorCodes.RESOURCE_NOT_FOUND,
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Resource Conflict Exception (409)
 *
 * Use when there's a conflict with the current state of the resource.
 * Common for unique constraint violations.
 */
export class ConflictException extends ApiException {
  constructor(message: string) {
    super(ErrorCodes.RESOURCE_CONFLICT, message, HttpStatus.CONFLICT);
  }
}

/**
 * Unauthorized Exception (401)
 *
 * Use when authentication is required but not provided or invalid.
 */
export class UnauthorizedException extends ApiException {
  constructor(message: string = 'Unauthorized') {
    super(ErrorCodes.AUTH_UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Forbidden Exception (403)
 *
 * Use when the user is authenticated but lacks permission.
 */
export class ForbiddenException extends ApiException {
  constructor(message: string = 'Forbidden') {
    super(ErrorCodes.RESOURCE_FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

/**
 * Validation Exception (400)
 *
 * Use for validation errors with detailed field information.
 */
export class ValidationException extends ApiException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.VALIDATION_ERROR, message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * Rate Limit Exception (429)
 *
 * Use when the user has exceeded rate limits.
 */
export class RateLimitException extends ApiException {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(ErrorCodes.RATE_LIMIT_EXCEEDED, message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
