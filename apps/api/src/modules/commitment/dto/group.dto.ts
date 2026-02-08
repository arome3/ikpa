/**
 * Group Accountability DTOs
 *
 * Request/response types for the group accountability endpoints.
 * Groups provide social reinforcement on top of individual commitment contracts.
 */

import { IsString, IsOptional, IsUUID, IsNumber, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================
// REQUEST DTOs
// ============================================

export class CreateGroupDto {
  @ApiProperty({ description: 'Group name', example: 'Savings Squad Q2' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Group description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Shared group goal amount' })
  @IsNumber()
  @IsOptional()
  sharedGoalAmount?: number;

  @ApiPropertyOptional({ description: 'Shared goal label', example: "Together we'll save N1M" })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  sharedGoalLabel?: string;
}

export class JoinGroupDto {
  @ApiProperty({ description: '8-character invite code', example: 'a1b2c3d4' })
  @IsString()
  @MinLength(8)
  @MaxLength(8)
  inviteCode!: string;
}

export class LinkContractDto {
  @ApiProperty({ description: 'Commitment contract ID to link' })
  @IsUUID()
  contractId!: string;
}

// ============================================
// RESPONSE DTOs
// ============================================

export class CreateGroupResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() inviteCode!: string;
  @ApiProperty() status!: string;
  @ApiProperty() maxMembers!: number;
}

export class JoinGroupResponseDto {
  @ApiProperty() success!: boolean;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() memberCount!: number;
}

export class GroupMemberProgressDto {
  @ApiProperty() userId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty() hasContract!: boolean;
  @ApiProperty({ enum: ['on_track', 'behind', 'completed', 'failed', 'pending'] })
  progress!: string;
  @ApiProperty() groupBonusAwarded!: boolean;
  @ApiProperty() joinedAt!: string;
}

export class GroupInfoDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() inviteCode!: string;
  @ApiProperty({ enum: ['FORMING', 'ACTIVE', 'COMPLETED', 'DISBANDED'] }) status!: string;
  @ApiProperty() memberCount!: number;
  @ApiProperty() maxMembers!: number;
  @ApiProperty() myRole!: string;
  @ApiProperty() createdAt!: string;
}

export class GroupDashboardResponseDto {
  @ApiProperty({ type: GroupInfoDto }) group!: GroupInfoDto;
  @ApiProperty({ type: [GroupMemberProgressDto] }) members!: GroupMemberProgressDto[];
  @ApiProperty() allResolved!: boolean;
  @ApiProperty() allSucceeded!: boolean;
  @ApiProperty() groupBonusAwarded!: boolean;
}

export class GroupListResponseDto {
  @ApiProperty({ type: [GroupInfoDto] }) groups!: GroupInfoDto[];
}

export class SendEncouragementDto {
  @ApiProperty({ description: 'User ID to encourage' })
  @IsUUID()
  toUserId!: string;

  @ApiPropertyOptional({ description: 'Encouragement message' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  message?: string;
}

export class ToggleReactionDto {
  @ApiProperty({ description: 'Target user ID to react to' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ description: 'Emoji name', example: 'thumbsup' })
  @IsString()
  @MaxLength(10)
  emoji!: string;
}
