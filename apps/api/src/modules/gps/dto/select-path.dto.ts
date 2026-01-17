/**
 * Select Path DTOs
 *
 * DTOs for selecting a recovery path.
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * Request body for selecting a recovery path
 */
export class SelectPathRequestDto {
  @ApiProperty({
    example: 'session-789-ghi',
    description: 'The recovery session ID',
  })
  @IsUUID('4', { message: 'sessionId must be a valid UUID' })
  @IsNotEmpty({ message: 'sessionId is required' })
  sessionId!: string;
}

/**
 * Response for selecting a recovery path
 */
export class SelectPathResponseDto {
  @ApiProperty({
    example: true,
    description: 'Whether the selection was successful',
  })
  success!: boolean;

  @ApiProperty({
    example: "Great choice! We've updated your plan to use Timeline Flex.",
    description: 'Human-readable confirmation message',
  })
  message!: string;

  @ApiProperty({
    example: 'time_adjustment',
    description: 'The selected path ID',
  })
  selectedPathId!: string;

  @ApiProperty({
    example: '2026-01-16T02:00:00.000Z',
    description: 'When the selection was made',
  })
  selectedAt!: Date;
}
