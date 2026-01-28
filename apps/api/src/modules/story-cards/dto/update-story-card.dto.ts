/**
 * Update Story Card DTO
 *
 * Request types for updating story cards.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO for updating a story card
 */
export class UpdateStoryCardDto {
  @ApiPropertyOptional({
    description: 'Whether to anonymize monetary amounts (show percentages instead)',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  anonymizeAmounts?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to reveal actual numbers in the card',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  revealActualNumbers?: boolean;

  @ApiPropertyOptional({
    description: 'Whether to include personal data in the card',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  includePersonalData?: boolean;

  @ApiPropertyOptional({
    description: 'If true, re-fetch source data and regenerate card content',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  regenerateContent?: boolean;
}
