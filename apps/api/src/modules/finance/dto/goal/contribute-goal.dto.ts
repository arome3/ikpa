import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for adding a contribution to a goal
 */
export class ContributeGoalDto {
  @ApiProperty({
    example: 50000,
    description: 'Amount to contribute',
    minimum: 0,
    maximum: 1000000000000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount cannot be negative' })
  @Max(1000000000000, { message: 'Amount cannot exceed 1 trillion' })
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({
    example: 'Monthly savings deposit',
    description: 'Optional note for the contribution',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Note cannot exceed 500 characters' })
  note?: string;
}

/**
 * Response DTO for goal contribution
 */
export class ContributionResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id!: string;

  @ApiProperty({ example: 'goal-uuid-here' })
  goalId!: string;

  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  date!: Date;

  @ApiPropertyOptional({ example: 'Monthly savings deposit' })
  note?: string | null;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({
    example: 300000,
    description: 'New current amount after contribution',
  })
  newCurrentAmount!: number;

  @ApiProperty({
    example: 30,
    description: 'New progress percentage after contribution',
  })
  newProgressPercent!: number;
}
