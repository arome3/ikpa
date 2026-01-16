/**
 * Opik Custom Exceptions
 *
 * These exceptions follow the ApiException pattern from
 * apps/api/src/common/exceptions/api.exception.ts
 *
 * All Opik-related errors are categorized under:
 * - AI_SERVICE_ERROR (AI_5001) - General Opik service errors
 * - EXTERNAL_SERVICE_ERROR (EXT_6001) - Configuration and external service issues
 */

import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../../../../common/exceptions';
import { ErrorCodes } from '../../../../common/constants';

/**
 * Opik Service Exception
 *
 * Thrown when Opik client operations fail during tracing.
 * Uses AI_SERVICE_ERROR code (AI_5001) for consistency with AI-related errors.
 *
 * @example
 * ```typescript
 * throw new OpikException('Failed to create trace', { traceName: 'my_trace' });
 * ```
 */
export class OpikException extends ApiException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      ErrorCodes.AI_SERVICE_ERROR,
      `Opik Error: ${message}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}

/**
 * Opik Configuration Exception
 *
 * Thrown when Opik is not properly configured (missing environment variables).
 * Uses EXTERNAL_SERVICE_ERROR code (EXT_6001) as this is a configuration issue.
 *
 * @example
 * ```typescript
 * throw new OpikConfigurationException('OPIK_API_KEY');
 * // Error message: "Opik configuration error: Missing OPIK_API_KEY"
 * ```
 */
export class OpikConfigurationException extends ApiException {
  constructor(missingKey: string) {
    super(
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      `Opik configuration error: Missing ${missingKey}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { missingKey },
    );
  }
}

/**
 * Opik Flush Exception
 *
 * Thrown when flushing traces to Opik fails.
 * This is typically a network or service availability issue.
 *
 * @example
 * ```typescript
 * throw new OpikFlushException({ error: 'Network timeout', pendingTraces: 5 });
 * ```
 */
export class OpikFlushException extends ApiException {
  constructor(details?: Record<string, unknown>) {
    super(
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      'Failed to flush Opik traces',
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}

/**
 * Opik Trace Exception
 *
 * Thrown when creating or ending a trace fails.
 *
 * @example
 * ```typescript
 * throw new OpikTraceException('create', 'my_trace', { error: 'Invalid input' });
 * ```
 */
export class OpikTraceException extends ApiException {
  constructor(
    operation: 'create' | 'end',
    traceName: string,
    details?: Record<string, unknown>,
  ) {
    super(
      ErrorCodes.AI_SERVICE_ERROR,
      `Failed to ${operation} Opik trace: ${traceName}`,
      HttpStatus.SERVICE_UNAVAILABLE,
      { traceName, operation, ...details },
    );
  }
}

/**
 * Opik Span Exception
 *
 * Thrown when creating or ending a span fails.
 *
 * @example
 * ```typescript
 * throw new OpikSpanException('create', 'llm_call', 'llm', { error: 'Invalid model' });
 * ```
 */
export class OpikSpanException extends ApiException {
  constructor(
    operation: 'create' | 'end',
    spanName: string,
    spanType: string,
    details?: Record<string, unknown>,
  ) {
    super(
      ErrorCodes.AI_SERVICE_ERROR,
      `Failed to ${operation} Opik span: ${spanName} (type: ${spanType})`,
      HttpStatus.SERVICE_UNAVAILABLE,
      { spanName, spanType, operation, ...details },
    );
  }
}
