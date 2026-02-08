import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommitmentDto {
  @ApiProperty({ description: 'The letter ID that triggered the commitment' })
  @IsString()
  @IsNotEmpty()
  letterId!: string;

  @ApiProperty({ description: 'Daily commitment amount' })
  @IsNumber()
  @Min(1)
  dailyAmount!: number;
}

export class UpdateCommitmentDto {
  @ApiProperty({ description: 'New status', enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'] })
  @IsString()
  @IsOptional()
  status?: string;
}

export class CommitmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  letterId!: string;

  @ApiProperty()
  dailyAmount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty({ nullable: true })
  endDate!: Date | null;

  @ApiProperty()
  streakDays!: number;

  @ApiProperty()
  createdAt!: Date;
}
