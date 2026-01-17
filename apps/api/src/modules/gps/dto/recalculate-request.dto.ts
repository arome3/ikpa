/**
 * GPS Re-Router Recalculate Request DTO
 *
 * Input for triggering the GPS recalculation after budget overspending.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

/**
 * Request body for the recalculate endpoint
 */
export class RecalculateRequestDto {
  @ApiProperty({
    example: 'Entertainment',
    description: 'The expense category name where overspending occurred',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  category!: string;

  @ApiPropertyOptional({
    example: 'goal-123-abc-def',
    description: 'Optional specific goal ID to calculate impact for (uses primary goal if not provided)',
  })
  @IsUUID('4', { message: 'goalId must be a valid UUID' })
  @IsOptional()
  goalId?: string;
}
