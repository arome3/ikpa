import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AchievementCardDto {
  @ApiProperty() goalName!: string;
  @ApiProperty() stakeType!: string;
  @ApiPropertyOptional() stakeAmount?: number;
  @ApiPropertyOptional() achievementTier?: string;
  @ApiProperty() succeededAt!: string;
  @ApiProperty() userName!: string;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() streakCount?: number;
}
