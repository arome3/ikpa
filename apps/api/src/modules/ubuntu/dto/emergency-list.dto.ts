import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmergencyType,
  EmergencyStatus,
  RelationshipType,
  Currency,
  AdjustmentType,
} from '@prisma/client';
import { PaginationDto } from './family-support-list.dto';

/**
 * Query parameters for listing emergencies
 */
export class EmergencyListQueryDto {
  @ApiPropertyOptional({
    enum: EmergencyStatus,
    example: 'PENDING',
    description: 'Filter by emergency status',
  })
  @IsOptional()
  @IsEnum(EmergencyStatus, {
    message: `Status must be one of: ${Object.values(EmergencyStatus).join(', ')}`,
  })
  status?: EmergencyStatus;

  @ApiPropertyOptional({
    example: 20,
    description: 'Number of records to return (1-100)',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 0,
    description: 'Number of records to skip',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Offset must be an integer' })
  @Min(0, { message: 'Offset cannot be negative' })
  @Type(() => Number)
  offset?: number = 0;
}

/**
 * Emergency item in list response
 */
export class EmergencyListItemDto {
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

  @ApiProperty({ example: '2026-01-24T12:00:00.000Z', required: false })
  resolvedAt?: Date | null;

  @ApiPropertyOptional({ enum: AdjustmentType, example: 'EMERGENCY_FUND_TAP' })
  adjustmentType?: AdjustmentType | null;

  @ApiProperty({
    example: 'Review your adjustment options',
    description: 'Status-appropriate message',
  })
  message!: string;
}

/**
 * Response for listing emergencies
 */
export class EmergencyListResponseDto {
  @ApiProperty({
    type: [EmergencyListItemDto],
    description: 'List of family emergencies',
  })
  emergencies!: EmergencyListItemDto[];

  @ApiProperty({
    type: PaginationDto,
    description: 'Pagination information',
  })
  pagination!: PaginationDto;
}
