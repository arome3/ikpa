import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckinDto {
  @ApiProperty({ description: 'The commitment ID to check in for' })
  @IsString()
  @IsNotEmpty()
  commitmentId!: string;

  @ApiProperty({ description: 'Optional note about the check-in', required: false })
  @IsString()
  @IsOptional()
  note?: string;
}

export class CheckinStatusResponseDto {
  @ApiProperty()
  checkedInToday!: boolean;

  @ApiProperty()
  streakDays!: number;

  @ApiProperty()
  longestStreak!: number;

  @ApiProperty({ nullable: true })
  lastCheckinDate!: Date | null;
}

export class CheckinResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  commitmentId!: string;

  @ApiProperty()
  checkinDate!: Date;

  @ApiProperty({ nullable: true })
  note!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  streakDays!: number;

  @ApiProperty()
  longestStreak!: number;
}

export class CheckinHistoryResponseDto {
  @ApiProperty({ type: [CheckinResponseDto] })
  checkins!: Array<{
    id: string;
    commitmentId: string;
    checkinDate: Date;
    note: string | null;
    createdAt: Date;
  }>;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  hasMore!: boolean;
}
