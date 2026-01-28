/**
 * Preview Story Card DTO
 *
 * Input for previewing a story card without saving to database.
 * Same as GenerateStoryCardDto but without idempotencyKey.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { StoryCardType } from '@prisma/client';

export class PreviewStoryCardDto {
  @ApiProperty({
    enum: StoryCardType,
    example: 'FUTURE_SELF',
    description: 'Type of story card to preview: FUTURE_SELF (letter from future), COMMITMENT (new commitment), MILESTONE (goal achieved), RECOVERY (back on track)',
  })
  @IsEnum(StoryCardType, {
    message: 'type must be one of: FUTURE_SELF, COMMITMENT, MILESTONE, RECOVERY',
  })
  @IsNotEmpty({ message: 'type is required' })
  type!: StoryCardType;

  @ApiProperty({
    example: 'letter-uuid-here',
    description: 'The ID of the source (letter, commitment, goal, or recovery session)',
  })
  @IsUUID('4', { message: 'sourceId must be a valid UUID' })
  @IsNotEmpty({ message: 'sourceId is required' })
  sourceId!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Anonymize amounts as percentages (default: true)',
    default: true,
  })
  @IsBoolean({ message: 'anonymizeAmounts must be a boolean' })
  @IsOptional()
  anonymizeAmounts?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Reveal actual numbers instead of percentages (default: false)',
    default: false,
  })
  @IsBoolean({ message: 'revealActualNumbers must be a boolean' })
  @IsOptional()
  revealActualNumbers?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Include personal data like name and goals (default: false)',
    default: false,
  })
  @IsBoolean({ message: 'includePersonalData must be a boolean' })
  @IsOptional()
  includePersonalData?: boolean;
}
