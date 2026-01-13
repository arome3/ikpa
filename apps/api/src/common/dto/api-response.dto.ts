/**
 * Standard API Response DTOs
 *
 * These classes provide consistent response formats across all API endpoints.
 * All responses include a timestamp for debugging and audit purposes.
 */

/**
 * Standard success response wrapper
 */
export class ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;

  constructor(data: T, message?: string) {
    this.success = true;
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Standard error response wrapper
 */
export class ApiErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    this.success = false;
    this.error = { code, message, details };
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Paginated response wrapper
 */
export class PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
  timestamp: string;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.success = true;
    this.data = data;
    this.meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrevious: page > 1,
    };
    this.timestamp = new Date().toISOString();
  }
}
