/**
 * Future Self Preferences DTOs
 *
 * Request/response types for user preference management
 * including opt-out of weekly letters.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Request DTO for updating Future Self preferences
 */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    description: 'Enable/disable weekly "Letters from 2045" delivery',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  weeklyLettersEnabled?: boolean;
}

/**
 * Response DTO for Future Self preferences
 */
export class PreferencesResponseDto {
  @ApiProperty({
    description: 'Whether weekly letters are enabled',
    example: true,
  })
  weeklyLettersEnabled!: boolean;

  @ApiProperty({
    description: 'When the preference was last updated',
    example: '2026-01-22T10:30:00.000Z',
  })
  updatedAt!: Date;
}
