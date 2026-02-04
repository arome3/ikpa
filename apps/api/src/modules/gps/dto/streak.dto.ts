/**
 * GPS Streak DTOs
 *
 * Data transfer objects for the streak system that tracks
 * consecutive days users stay under budget.
 *
 * Answers the user need: "Am I doing well?"
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ==========================================
// RESPONSE DTOs
// ==========================================

/**
 * Current streak status response
 */
export class StreakStatusDto {
  @ApiProperty({
    description: 'Current consecutive days staying under budget',
    example: 7,
  })
  currentStreak!: number;

  @ApiProperty({
    description: 'All-time longest streak',
    example: 14,
  })
  longestStreak!: number;

  @ApiProperty({
    description: 'Date of last streak update',
    example: '2026-02-01',
    nullable: true,
  })
  lastDate!: Date | null;

  @ApiProperty({
    description: 'Whether the streak is active today',
    example: true,
  })
  isActiveToday!: boolean;

  @ApiProperty({
    description: 'Encouraging message about the streak',
    example: "You're on fire! 7 days of staying on track.",
  })
  encouragement!: string;

  @ApiProperty({
    description: 'Days until next achievement milestone',
    example: 3,
    nullable: true,
  })
  daysToNextMilestone!: number | null;

  @ApiProperty({
    description: 'Next milestone name',
    example: 'Streak Champion (7 days)',
    nullable: true,
  })
  nextMilestoneName!: string | null;
}

/**
 * Achievement item
 */
export class AchievementDto {
  @ApiProperty({
    description: 'Achievement type identifier',
    example: 'STREAK_7_DAYS',
  })
  type!: string;

  @ApiProperty({
    description: 'Human-readable achievement name',
    example: 'Streak Champion',
  })
  name!: string;

  @ApiProperty({
    description: 'Achievement description',
    example: 'Stayed under budget for 7 consecutive days',
  })
  description!: string;

  @ApiProperty({
    description: 'Achievement icon identifier',
    example: 'trophy',
  })
  icon!: string;

  @ApiProperty({
    description: 'When the achievement was awarded',
  })
  awardedAt!: Date;

  @ApiPropertyOptional({
    description: 'Additional context about the achievement',
    example: { streakDays: 7 },
  })
  metadata?: Record<string, unknown>;
}

/**
 * Available (locked) achievement
 */
export class LockedAchievementDto {
  @ApiProperty({
    description: 'Achievement type identifier',
    example: 'STREAK_30_DAYS',
  })
  type!: string;

  @ApiProperty({
    description: 'Human-readable achievement name',
    example: 'Consistency Master',
  })
  name!: string;

  @ApiProperty({
    description: 'Achievement description',
    example: 'Stay under budget for 30 consecutive days',
  })
  description!: string;

  @ApiProperty({
    description: 'Achievement icon identifier',
    example: 'medal',
  })
  icon!: string;

  @ApiProperty({
    description: 'Hint on how to unlock',
    example: 'Keep your streak going for 23 more days!',
  })
  hint!: string;

  @ApiProperty({
    description: 'Progress towards unlocking (0-1)',
    example: 0.23,
  })
  progress!: number;
}

/**
 * User achievements response
 */
export class AchievementsResponseDto {
  @ApiProperty({
    description: 'Achievements the user has earned',
    type: [AchievementDto],
  })
  earned!: AchievementDto[];

  @ApiProperty({
    description: 'Achievements still available to earn',
    type: [LockedAchievementDto],
  })
  available!: LockedAchievementDto[];

  @ApiProperty({
    description: 'Total achievements earned',
    example: 3,
  })
  totalEarned!: number;

  @ApiProperty({
    description: 'Total achievements available',
    example: 6,
  })
  totalAvailable!: number;
}

/**
 * Streak update result (internal use, returned after expense check)
 */
export class StreakUpdateResultDto {
  @ApiProperty({
    description: 'Previous streak count',
    example: 6,
  })
  previousStreak!: number;

  @ApiProperty({
    description: 'New streak count',
    example: 7,
  })
  newStreak!: number;

  @ApiProperty({
    description: 'Whether the streak increased',
    example: true,
  })
  increased!: boolean;

  @ApiProperty({
    description: 'Whether the streak was reset',
    example: false,
  })
  wasReset!: boolean;

  @ApiPropertyOptional({
    description: 'New achievement earned (if any)',
    type: AchievementDto,
  })
  newAchievement?: AchievementDto;

  @ApiProperty({
    description: 'Encouraging message about the update',
    example: 'Another great day! Your streak is now 7 days.',
  })
  message!: string;
}
