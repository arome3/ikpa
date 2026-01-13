import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorCodes } from '../constants/error-codes';
import { ApiErrorResponse } from '../dto/api-response.dto';

/**
 * Global HTTP Exception Filter
 *
 * Catches all exceptions and transforms them into a consistent API error response format.
 * Handles:
 * - HttpExceptions (including custom ApiExceptions)
 * - Validation errors from class-validator
 * - Unexpected errors (logged but not exposed)
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let code: string;
    let message: string;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        code = (res.code as string) || this.getDefaultCode(status);
        message = (res.message as string) || exception.message;
        details = res.details as Record<string, unknown> | undefined;

        // Handle validation errors from class-validator
        // class-validator returns an array of error messages
        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          details = { errors: res.message };
          code = ErrorCodes.VALIDATION_ERROR;
        }
      } else {
        code = this.getDefaultCode(status);
        message = exception.message;
      }
    } else {
      // Unexpected error - don't expose internal details
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ErrorCodes.INTERNAL_ERROR;
      message = 'An unexpected error occurred';

      // Log the full error for debugging
      this.logger.error(
        `Unexpected error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const errorResponse = new ApiErrorResponse(code, message, details);

    // Log all errors in development for debugging
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug({
        path: request.url,
        method: request.method,
        status,
        code,
        message,
        details,
      });
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Map HTTP status codes to default error codes
   */
  private getDefaultCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.RESOURCE_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCodes.RESOURCE_CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCodes.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
