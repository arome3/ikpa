/**
 * Recovery Path DTOs
 *
 * DTOs for getting and selecting recovery paths.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { RecoveryPathDto } from './recalculate-response.dto';

/**
 * Query parameters for getting recovery paths
 */
export class GetRecoveryPathsQueryDto {
  @ApiPropertyOptional({
    example: 'session-789-ghi',
    description: 'Optional session ID to get paths for a specific session',
  })
  @IsUUID('4', { message: 'sessionId must be a valid UUID' })
  @IsOptional()
  sessionId?: string;
}

/**
 * Response for getting recovery paths
 */
export class GetRecoveryPathsResponseDto {
  @ApiProperty({
    type: [RecoveryPathDto],
    description: 'Available recovery paths',
  })
  paths!: RecoveryPathDto[];

  @ApiProperty({
    example: 'session-789-ghi',
    description: 'Session ID these paths are associated with',
    required: false,
  })
  sessionId?: string;
}
