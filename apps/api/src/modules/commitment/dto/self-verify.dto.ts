import { IsBoolean, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SelfVerifyDto {
  @ApiProperty({ description: 'Did you achieve your goal?', example: true })
  @IsBoolean()
  decision!: boolean;

  @ApiPropertyOptional({ description: 'Optional notes about your progress' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
