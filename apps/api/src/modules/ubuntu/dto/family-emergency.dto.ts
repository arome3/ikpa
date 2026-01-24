import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmergencyType,
  EmergencyStatus,
  RelationshipType,
  AdjustmentType,
  Currency,
} from '@prisma/client';

/**
 * DTO for reporting a family emergency
 *
 * Family emergencies are unexpected financial needs that require
 * adjustment to the user's financial plan. The Ubuntu Manager
 * provides non-judgmental support options.
 */
export class ReportEmergencyDto {
  @ApiProperty({
    enum: EmergencyType,
    example: 'MEDICAL',
    description: 'Type of emergency',
  })
  @IsEnum(EmergencyType, {
    message: `Type must be one of: ${Object.values(EmergencyType).join(', ')}`,
  })
  type!: EmergencyType;

  @ApiProperty({
    example: 'Mom',
    description: 'Name of the family member needing support',
    maxLength: 100,
  })
  @IsString({ message: 'Recipient name must be a string' })
  @IsNotEmpty({ message: 'Recipient name is required' })
  @MaxLength(100, { message: 'Recipient name cannot exceed 100 characters' })
  recipientName!: string;

  @ApiProperty({
    enum: RelationshipType,
    example: 'PARENT',
    description: 'Relationship to the recipient',
  })
  @IsEnum(RelationshipType, {
    message: `Relationship must be one of: ${Object.values(RelationshipType).join(', ')}`,
  })
  relationship!: RelationshipType;

  @ApiProperty({
    example: 100000,
    description: 'Amount needed for the emergency',
    minimum: 0,
    maximum: 1000000000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount cannot be negative' })
  @Max(1000000000, { message: 'Amount cannot exceed 1 billion' })
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({
    example: 'Hospital bills for surgery',
    description: 'Description of the emergency',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @ApiPropertyOptional({
    enum: Currency,
    example: 'NGN',
    description: 'Currency (defaults to user currency)',
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency;
}

/**
 * Response after reporting an emergency
 */
export class EmergencyResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ enum: EmergencyType, example: 'MEDICAL' })
  type!: EmergencyType;

  @ApiProperty({ example: 'Mom' })
  recipientName!: string;

  @ApiProperty({ enum: RelationshipType, example: 'PARENT' })
  relationship!: RelationshipType;

  @ApiProperty({ example: 100000 })
  amount!: number;

  @ApiProperty({ enum: Currency, example: 'NGN' })
  currency!: Currency;

  @ApiProperty({ example: 'Hospital bills for surgery', required: false })
  description?: string | null;

  @ApiProperty({ enum: EmergencyStatus, example: 'PENDING' })
  status!: EmergencyStatus;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  reportedAt!: Date;

  @ApiProperty({
    description: 'Next steps message',
    example: 'Review your adjustment options to handle this emergency while protecting your goals.',
  })
  message!: string;
}

/**
 * DTO for selecting an adjustment
 */
export class SelectAdjustmentDto {
  @ApiProperty({
    example: 'uuid-here',
    description: 'ID of the emergency to adjust',
  })
  @IsUUID('4', { message: 'Emergency ID must be a valid UUID' })
  emergencyId!: string;

  @ApiProperty({
    enum: AdjustmentType,
    example: 'EMERGENCY_FUND_TAP',
    description: 'Type of adjustment to apply',
  })
  @IsEnum(AdjustmentType, {
    message: `Adjustment type must be one of: ${Object.values(AdjustmentType).join(', ')}`,
  })
  adjustmentType!: AdjustmentType;
}

/**
 * Response after applying an adjustment
 */
export class AdjustmentResultDto {
  @ApiProperty({ example: 'uuid-here' })
  emergencyId!: string;

  @ApiProperty({ example: 'RESOLVED' })
  status!: string;

  @ApiProperty({ enum: AdjustmentType, example: 'EMERGENCY_FUND_TAP' })
  adjustmentType!: AdjustmentType;

  @ApiProperty({
    example: 12,
    description: 'Estimated weeks to recover',
  })
  recoveryWeeks!: number;

  @ApiProperty({
    example: 0.72,
    description: 'Goal probability before adjustment',
  })
  originalGoalProbability!: number;

  @ApiProperty({
    example: 0.68,
    description: 'Goal probability after adjustment',
  })
  newGoalProbability!: number;

  @ApiProperty({
    example: "Your family is important, and so is your future. You've handled this emergency while keeping your goals on track.",
    description: 'Supportive message',
  })
  message!: string;

  @ApiProperty({
    description: 'Details of the adjustment applied',
    example: {
      availableFund: 60000,
      amountToTap: 60000,
      remainingFund: 0,
      coveragePercent: 60,
      shortfall: 40000,
      isPartialCoverage: true,
    },
  })
  details!: {
    availableFund?: number;
    amountToTap?: number;
    remainingFund?: number;
    /** Percentage of emergency covered by fund (0-100) */
    coveragePercent?: number;
    /** Amount not covered by fund (if partial coverage) */
    shortfall?: number;
    /** True if fund doesn't fully cover the emergency */
    isPartialCoverage?: boolean;
    currentDeadline?: Date;
    newDeadline?: Date;
    extensionWeeks?: number;
    currentRate?: number;
    temporaryRate?: number;
    durationWeeks?: number;
  };
}
