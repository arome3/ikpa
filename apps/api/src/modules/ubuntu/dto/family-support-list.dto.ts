import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { FamilySupportResponseDto } from './create-family-support.dto';

/**
 * Query parameters for listing family support
 */
export class FamilySupportListQueryDto {
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

  @ApiPropertyOptional({
    example: true,
    description: 'Filter to only active family support records',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'activeOnly must be a boolean' })
  @Type(() => Boolean)
  activeOnly?: boolean = true;
}

/**
 * Summary of family support obligations
 */
export class FamilySupportSummaryDto {
  @ApiProperty({
    example: 75000,
    description: 'Total monthly family support amount',
  })
  totalMonthly!: number;

  @ApiProperty({
    example: { PARENT: 40000, SIBLING: 25000, EXTENDED_FAMILY: 10000 },
    description: 'Monthly totals grouped by relationship type',
  })
  byRelationship!: Record<string, number>;
}

/**
 * Pagination metadata
 */
export class PaginationDto {
  @ApiProperty({ example: 5, description: 'Total number of records' })
  total!: number;

  @ApiProperty({ example: 20, description: 'Number of records per page' })
  limit!: number;

  @ApiProperty({ example: 0, description: 'Number of records skipped' })
  offset!: number;

  @ApiProperty({ example: false, description: 'Whether there are more records' })
  hasMore!: boolean;
}

/**
 * Response for listing family support
 */
export class FamilySupportListResponseDto {
  @ApiProperty({
    type: [FamilySupportResponseDto],
    description: 'List of family support records',
  })
  familySupport!: FamilySupportResponseDto[];

  @ApiProperty({
    type: FamilySupportSummaryDto,
    description: 'Summary of all active family support',
  })
  summary!: FamilySupportSummaryDto;

  @ApiProperty({
    type: PaginationDto,
    description: 'Pagination information',
  })
  pagination!: PaginationDto;
}
