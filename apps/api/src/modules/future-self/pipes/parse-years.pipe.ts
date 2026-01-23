/**
 * Parse Years Pipe
 *
 * Custom validation pipe for the timeline years parameter.
 * Validates that years is a positive integer between 1 and 50.
 *
 * Note: Valid year values are mapped to time horizons in the agent:
 * - 0.5 or less → '6mo'
 * - 1 or less → '1yr'
 * - 5 or less → '5yr'
 * - 10 or less → '10yr'
 * - > 10 → '20yr'
 *
 * This means years like 3, 7, or 15 are valid inputs but will be
 * rounded to the nearest supported horizon for projection data.
 */

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

/**
 * Minimum allowed years for timeline projection
 */
const MIN_YEARS = 1;

/**
 * Maximum allowed years for timeline projection (reasonable projection horizon)
 */
const MAX_YEARS = 50;

@Injectable()
export class ParseYearsPipe implements PipeTransform<string, number> {
  /**
   * Transform and validate years parameter
   *
   * @param value - The raw value from the request
   * @param _metadata - Argument metadata (unused)
   * @returns The validated years as a number
   * @throws BadRequestException if validation fails
   */
  transform(value: string, _metadata: ArgumentMetadata): number {
    // Parse to integer
    const years = parseInt(value, 10);

    // Check if it's a valid number
    if (isNaN(years)) {
      throw new BadRequestException(
        `Invalid years parameter: "${value}" is not a valid number`,
      );
    }

    // Check minimum
    if (years < MIN_YEARS) {
      throw new BadRequestException(
        `Years must be at least ${MIN_YEARS}. Received: ${years}`,
      );
    }

    // Check maximum
    if (years > MAX_YEARS) {
      throw new BadRequestException(
        `Years cannot exceed ${MAX_YEARS}. Received: ${years}`,
      );
    }

    return years;
  }
}
