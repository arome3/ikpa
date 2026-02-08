import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DebriefResponseDto {
  @ApiProperty() contractId!: string;
  @ApiProperty() analysis!: string;
  @ApiPropertyOptional() suggestedStakeType?: string;
  @ApiPropertyOptional() suggestedStakeAmount?: number;
  @ApiPropertyOptional() suggestedDeadlineDays?: number;
  @ApiProperty() keyInsights!: string[];
  @ApiProperty() createdAt!: string;
}
