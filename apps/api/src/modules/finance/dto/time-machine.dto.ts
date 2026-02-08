import { IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TimeMachineFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export class TimeMachineRequestDto {
  @ApiProperty({ description: 'Spending amount per frequency', example: 2000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({
    description: 'How often this spending recurs',
    enum: TimeMachineFrequency,
    example: 'daily',
  })
  @IsEnum(TimeMachineFrequency)
  frequency!: TimeMachineFrequency;

  @ApiPropertyOptional({ description: 'Years to project (default: 20)', example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  years?: number;

  @ApiPropertyOptional({
    description: 'Annual return rate as decimal (default: 0.10 = 10%)',
    example: 0.10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  returnRate?: number;
}

export class TimeMachineProjectionDto {
  @ApiProperty() year!: number;
  @ApiProperty() spent!: number;
  @ApiProperty() invested!: number;
}

export class TimeMachineResponseDto {
  @ApiProperty() totalSpent!: number;
  @ApiProperty() investedValue!: number;
  @ApiProperty() difference!: number;
  @ApiProperty({ type: [TimeMachineProjectionDto] })
  projections!: TimeMachineProjectionDto[];
}
