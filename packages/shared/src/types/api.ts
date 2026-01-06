/**
 * Standard API success response
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

/**
 * Standard API error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

/**
 * API response type
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  pagination?: PaginationMeta;
}

/**
 * Paginated query parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Date range query parameters
 */
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Authentication tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Login response
 */
export interface LoginResponse extends AuthTokens {
  user: import('./user').User;
}

/**
 * Register response
 */
export interface RegisterResponse extends AuthTokens {
  user: import('./user').User;
}

/**
 * Error codes
 */
export const ErrorCodes = {
  // Authentication (1xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_TOKEN_INVALID: 'AUTH_1003',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_1004',
  AUTH_EMAIL_EXISTS: 'AUTH_1005',

  // Validation (2xxx)
  VALIDATION_ERROR: 'VAL_2001',
  VALIDATION_REQUIRED_FIELD: 'VAL_2002',
  VALIDATION_INVALID_FORMAT: 'VAL_2003',

  // Resources (3xxx)
  RESOURCE_NOT_FOUND: 'RES_3001',
  RESOURCE_ALREADY_EXISTS: 'RES_3002',
  RESOURCE_CONFLICT: 'RES_3003',

  // Rate Limiting (4xxx)
  RATE_LIMIT_EXCEEDED: 'RATE_4001',

  // AI Service (5xxx)
  AI_SERVICE_ERROR: 'AI_5001',
  AI_RATE_LIMIT: 'AI_5002',

  // Server (9xxx)
  INTERNAL_ERROR: 'SRV_9001',
  SERVICE_UNAVAILABLE: 'SRV_9002',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
