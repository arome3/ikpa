import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dto/api-response.dto';

/**
 * Transform Interceptor
 *
 * Wraps all successful responses in a consistent API response format.
 * Skips wrapping if the response is already wrapped (has 'success' property).
 *
 * This ensures clients always receive:
 * {
 *   success: true,
 *   data: <response data>,
 *   timestamp: <ISO timestamp>
 * }
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If already wrapped in ApiResponse format, return as-is
        // This allows controllers to customize their response
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        // Wrap in standard response format
        return new ApiResponse<T>(data);
      }),
    );
  }
}
