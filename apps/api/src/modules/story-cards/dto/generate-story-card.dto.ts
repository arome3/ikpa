/**
 * Generate Story Card DTO
 *
 * Input for generating a new story card.
 * Includes privacy settings validation.
 *
 * Privacy Settings Cross-Field Validation:
 * - If anonymizeAmounts=false AND revealActualNumbers=true: VALID (user wants actual numbers)
 * - If anonymizeAmounts=true AND revealActualNumbers=true: CONFLICT
 *   The service layer will warn and default to anonymized for privacy protection.
 * - If anonymizeAmounts=true AND revealActualNumbers=false: VALID (show percentages)
 * - If anonymizeAmounts=false AND revealActualNumbers=false: VALID (show actual numbers)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { StoryCardType } from '@prisma/client';

/**
 * Custom validator for privacy settings cross-field validation
 *
 * SECURITY: Validates that anonymizeAmounts and revealActualNumbers settings
 * are logically consistent. When both are true, validation passes but the
 * service layer will resolve the conflict by defaulting to anonymized.
 *
 * This validator is applied to the revealActualNumbers property and checks
 * the relationship with anonymizeAmounts.
 */
@ValidatorConstraint({ name: 'privacySettingsValidator', async: false })
export class PrivacySettingsValidator implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    // Access the parent object to check cross-field validation
    const object = args.object as GenerateStoryCardDto;

    // If both are explicitly set to true, this is a logical conflict
    // We return true to allow validation to pass (service will handle the conflict)
    // The service layer will default to anonymized for safety

    // All combinations are technically valid at the DTO level:
    // - anonymizeAmounts=false, revealActualNumbers=true: VALID (show actual numbers)
    // - anonymizeAmounts=true, revealActualNumbers=true: CONFLICT (service will resolve)
    // - anonymizeAmounts=true, revealActualNumbers=false: VALID (show percentages)
    // - anonymizeAmounts=false, revealActualNumbers=false: VALID (show actual numbers)

    // Always pass validation - conflicts are resolved at service layer
    // This avoids rejecting valid requests while still documenting the behavior
    void object; // Suppress unused variable warning

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as GenerateStoryCardDto;

    if (object.anonymizeAmounts === true && object.revealActualNumbers === true) {
      return 'Privacy settings conflict: both anonymizeAmounts and revealActualNumbers are true. ' +
        'The system will default to anonymized amounts for privacy protection.';
    }

    return 'Invalid privacy settings';
  }
}

/**
 * DTO for generating a new story card
 *
 * Includes cross-field validation for privacy settings.
 * When anonymizeAmounts=true AND revealActualNumbers=true are both set,
 * the service layer will resolve the conflict by defaulting to anonymized.
 */
export class GenerateStoryCardDto {
  @ApiPropertyOptional({
    example: 'generate-card-user123-source456-1704067200',
    description: 'Client-provided idempotency key to prevent duplicate cards on retry',
    maxLength: 128,
  })
  @IsString({ message: 'idempotencyKey must be a string' })
  @MaxLength(128, { message: 'idempotencyKey cannot exceed 128 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'idempotencyKey can only contain alphanumeric characters, underscores, and hyphens',
  })
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({
    enum: StoryCardType,
    example: 'FUTURE_SELF',
    description: 'Type of story card to generate: FUTURE_SELF (letter from future), COMMITMENT (new commitment), MILESTONE (goal achieved), RECOVERY (back on track)',
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
    description:
      'Anonymize amounts as percentages (default: true). ' +
      'Note: If both anonymizeAmounts=true and revealActualNumbers=true, ' +
      'the system will default to anonymized for privacy protection.',
    default: true,
  })
  @IsBoolean({ message: 'anonymizeAmounts must be a boolean' })
  @IsOptional()
  anonymizeAmounts?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Reveal actual numbers instead of percentages (default: false). ' +
      'For this to take effect, anonymizeAmounts must be false. ' +
      'If both anonymizeAmounts=true and revealActualNumbers=true, ' +
      'the system will default to anonymized for privacy protection.',
    default: false,
  })
  @IsBoolean({ message: 'revealActualNumbers must be a boolean' })
  @Validate(PrivacySettingsValidator)
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
