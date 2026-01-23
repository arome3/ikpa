/**
 * Future Self Timeline Response DTOs
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Response for GET /v1/future-self/timeline/:years
 *
 * Single timeline projection at a specific year horizon
 */
export class TimelineResponseDto {
  @ApiProperty({
    description: 'Net worth on current savings path',
    example: 4800000,
  })
  currentPath!: number;

  @ApiProperty({
    description: 'Net worth on optimized IKPA path',
    example: 8500000,
  })
  optimizedPath!: number;

  @ApiProperty({
    description: 'Difference (optimized - current)',
    example: 3700000,
  })
  difference!: number;

  @ApiProperty({
    description: 'Number of years in the future',
    example: 10,
  })
  years!: number;
}
