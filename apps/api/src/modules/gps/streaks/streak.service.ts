/**
 * GPS Streak Service
 *
 * Tracks consecutive days users stay under budget to encourage
 * positive financial habits. Part of the GPS Re-Router feature.
 *
 * Features:
 * - Daily streak tracking
 * - Achievement awards at milestones
 * - Non-judgmental, encouraging messages
 * - Streak reset on overspend (with supportive messaging)
 *
 * Answers the user need: "Am I doing well?"
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AchievementType, GpsEventType, Prisma } from '@prisma/client';
import { startOfDay, isToday, isYesterday } from 'date-fns';
import {
  StreakStatusDto,
  AchievementDto,
  LockedAchievementDto,
  AchievementsResponseDto,
  StreakUpdateResultDto,
} from '../dto/streak.dto';

/**
 * Achievement definitions with non-judgmental language
 */
const ACHIEVEMENT_DEFINITIONS: Record<
  AchievementType,
  {
    name: string;
    description: string;
    icon: string;
    unlockHint: string;
  }
> = {
  FIRST_RECOVERY: {
    name: 'First Steps',
    description: 'Completed your first recovery path',
    icon: 'footprints',
    unlockHint: 'Complete a recovery path to unlock',
  },
  STREAK_7_DAYS: {
    name: 'Streak Champion',
    description: 'Stayed under budget for 7 consecutive days',
    icon: 'trophy',
    unlockHint: 'Keep going for 7 days under budget',
  },
  STREAK_30_DAYS: {
    name: 'Consistency Master',
    description: 'Stayed under budget for 30 consecutive days',
    icon: 'medal',
    unlockHint: 'Maintain your streak for 30 days',
  },
  FREEZE_CHAMPION: {
    name: 'Freeze Champion',
    description: 'Successfully completed a category pause',
    icon: 'snowflake',
    unlockHint: 'Complete a category freeze recovery action',
  },
  COMEBACK_KID: {
    name: 'Comeback Story',
    description: 'Recovered from 3 or more budget slips',
    icon: 'rocket',
    unlockHint: 'Show resilience by completing 3+ recoveries',
  },
  MILESTONE_MASTER: {
    name: 'Milestone Master',
    description: 'Reached all recovery milestones in a session',
    icon: 'flag',
    unlockHint: 'Complete all milestones (25%, 50%, 75%, 100%) in a recovery',
  },
};

/**
 * Streak milestones and their achievement types
 */
const STREAK_MILESTONES = [
  { days: 7, achievement: AchievementType.STREAK_7_DAYS },
  { days: 30, achievement: AchievementType.STREAK_30_DAYS },
];

/**
 * Encouraging messages for different streak states
 * All messages are non-judgmental and supportive
 */
const STREAK_MESSAGES = {
  newStreak: [
    "Great start! You're on your way.",
    "Day 1 of your new journey. Let's go!",
    'Every streak starts with day one.',
  ],
  continuing: [
    "You're on fire! {days} days of staying on track.",
    '{days} days strong! Keep it going.',
    "Another great day! That's {days} in a row now.",
  ],
  milestoneReached: [
    "Amazing! You've hit {days} days!",
    "What an achievement! {days} days of consistency.",
    "{days} days - you're building a powerful habit!",
  ],
  reset: [
    "A fresh start is just as valuable. Day 1 begins now.",
    "New day, new opportunity. Let's begin again.",
    'Every expert was once a beginner. Starting fresh!',
  ],
  inactive: [
    'Ready to pick up where you left off?',
    "Your streak is waiting. Let's get back to it!",
    'Today is a great day to continue your journey.',
  ],
};

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current streak status for a user
   */
  async getStreakStatus(userId: string): Promise<StreakStatusDto> {
    const streak = await this.getOrCreateStreak(userId);

    // Check if streak is active today
    const isActiveToday = streak.lastDate ? isToday(streak.lastDate) : false;

    // Check if streak needs to be reset (missed a day)
    const streakBroken =
      streak.lastDate && !isToday(streak.lastDate) && !isYesterday(streak.lastDate);

    const effectiveStreak = streakBroken ? 0 : streak.currentStreak;

    // Calculate next milestone
    const nextMilestone = this.getNextMilestone(effectiveStreak);

    // Generate encouraging message
    const encouragement = this.generateEncouragement(effectiveStreak, isActiveToday);

    return {
      currentStreak: effectiveStreak,
      longestStreak: streak.longestStreak,
      lastDate: streak.lastDate,
      isActiveToday,
      encouragement,
      daysToNextMilestone: nextMilestone?.daysRemaining ?? null,
      nextMilestoneName: nextMilestone?.name ?? null,
    };
  }

  /**
   * Get user's achievements
   */
  async getAchievements(userId: string): Promise<AchievementsResponseDto> {
    // Get earned achievements
    const earnedRecords = await this.prisma.gpsAchievement.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
    });

    const earned: AchievementDto[] = earnedRecords.map((record) => {
      const def = ACHIEVEMENT_DEFINITIONS[record.type];
      return {
        type: record.type,
        name: def.name,
        description: def.description,
        icon: def.icon,
        awardedAt: record.awardedAt,
        metadata: record.metadata as Record<string, unknown> | undefined,
      };
    });

    // Get streak for progress calculations
    const streak = await this.getOrCreateStreak(userId);

    // Get recovery count for comeback achievement progress
    const recoveryCount = await this.prisma.recoverySession.count({
      where: {
        userId,
        status: { in: ['PATH_SELECTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
    });

    // Build available achievements
    const earnedTypes = new Set(earnedRecords.map((r) => r.type));
    const available: LockedAchievementDto[] = [];

    for (const [type, def] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
      if (earnedTypes.has(type as AchievementType)) continue;

      const achievementType = type as AchievementType;
      let progress = 0;
      let hint = def.unlockHint;

      // Calculate progress for specific achievements
      switch (achievementType) {
        case AchievementType.STREAK_7_DAYS:
          progress = Math.min(1, streak.currentStreak / 7);
          hint = `Keep going for ${Math.max(0, 7 - streak.currentStreak)} more days!`;
          break;
        case AchievementType.STREAK_30_DAYS:
          progress = Math.min(1, streak.currentStreak / 30);
          hint = `Keep going for ${Math.max(0, 30 - streak.currentStreak)} more days!`;
          break;
        case AchievementType.COMEBACK_KID:
          progress = Math.min(1, recoveryCount / 3);
          hint =
            recoveryCount < 3
              ? `Complete ${3 - recoveryCount} more recoveries`
              : def.unlockHint;
          break;
        default:
          progress = 0;
      }

      available.push({
        type,
        name: def.name,
        description: def.description,
        icon: def.icon,
        hint,
        progress,
      });
    }

    return {
      earned,
      available,
      totalEarned: earned.length,
      totalAvailable: Object.keys(ACHIEVEMENT_DEFINITIONS).length,
    };
  }

  /**
   * Update streak after a day passes under budget
   * Called by the expense event listener or cron job
   */
  async incrementStreak(userId: string): Promise<StreakUpdateResultDto> {
    const streak = await this.getOrCreateStreak(userId);
    const today = startOfDay(new Date());

    // If already updated today, return current status
    if (streak.lastDate && isToday(streak.lastDate)) {
      return {
        previousStreak: streak.currentStreak,
        newStreak: streak.currentStreak,
        increased: false,
        wasReset: false,
        message: 'Already recorded for today. Keep it up!',
      };
    }

    // Check if streak should be reset (missed a day)
    const shouldReset =
      streak.lastDate && !isToday(streak.lastDate) && !isYesterday(streak.lastDate);

    const previousStreak = streak.currentStreak;
    let newStreak: number;
    let message: string;
    let wasReset = false;

    if (shouldReset) {
      // Reset streak
      newStreak = 1;
      wasReset = true;
      message = this.pickRandom(STREAK_MESSAGES.reset);
    } else {
      // Continue streak
      newStreak = streak.currentStreak + 1;
      message = this.pickRandom(STREAK_MESSAGES.continuing).replace(
        '{days}',
        String(newStreak),
      );
    }

    // Update longest streak if needed
    const newLongestStreak = Math.max(streak.longestStreak, newStreak);

    // Update database
    await this.prisma.gpsStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastDate: today,
      },
    });

    // Check for streak achievements
    let newAchievement: AchievementDto | undefined;

    for (const milestone of STREAK_MILESTONES) {
      if (newStreak === milestone.days) {
        const awarded = await this.awardAchievement(userId, milestone.achievement, {
          streakDays: newStreak,
        });
        if (awarded) {
          const def = ACHIEVEMENT_DEFINITIONS[milestone.achievement];
          newAchievement = {
            type: milestone.achievement,
            name: def.name,
            description: def.description,
            icon: def.icon,
            awardedAt: new Date(),
            metadata: { streakDays: newStreak },
          };
          message = this.pickRandom(STREAK_MESSAGES.milestoneReached).replace(
            '{days}',
            String(newStreak),
          );
        }
        break;
      }
    }

    // Track analytics
    await this.trackStreakUpdate(userId, previousStreak, newStreak, wasReset);

    this.logger.log(
      `[incrementStreak] User ${userId}: streak ${previousStreak} -> ${newStreak}${wasReset ? ' (reset)' : ''}`,
    );

    return {
      previousStreak,
      newStreak,
      increased: newStreak > previousStreak,
      wasReset,
      newAchievement,
      message,
    };
  }

  /**
   * Reset streak when user overspends
   * Called by budget event listener
   */
  async resetStreak(userId: string, reason?: string): Promise<StreakUpdateResultDto> {
    const streak = await this.getOrCreateStreak(userId);
    const previousStreak = streak.currentStreak;

    // Reset to 0
    await this.prisma.gpsStreak.update({
      where: { userId },
      data: {
        currentStreak: 0,
        // Don't update lastDate - user needs to stay under budget to restart
      },
    });

    // Track analytics
    await this.trackStreakUpdate(userId, previousStreak, 0, true, reason);

    const message = this.pickRandom(STREAK_MESSAGES.reset);

    this.logger.log(
      `[resetStreak] User ${userId}: streak reset from ${previousStreak} to 0${reason ? ` (${reason})` : ''}`,
    );

    return {
      previousStreak,
      newStreak: 0,
      increased: false,
      wasReset: true,
      message,
    };
  }

  /**
   * Award an achievement to a user
   */
  async awardAchievement(
    userId: string,
    type: AchievementType,
    metadata?: Record<string, unknown>,
  ): Promise<boolean> {
    // Check if already earned
    const existing = await this.prisma.gpsAchievement.findUnique({
      where: { userId_type: { userId, type } },
    });

    if (existing) {
      return false; // Already has this achievement
    }

    // Award the achievement
    await this.prisma.gpsAchievement.create({
      data: {
        userId,
        type,
        metadata: (metadata || {}) as Prisma.InputJsonValue,
      },
    });

    // Track analytics
    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        eventType: GpsEventType.ACHIEVEMENT_AWARDED,
        eventData: { type, metadata } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`[awardAchievement] User ${userId}: awarded ${type}`);

    return true;
  }

  /**
   * Check and award FIRST_RECOVERY achievement
   */
  async checkFirstRecoveryAchievement(userId: string): Promise<boolean> {
    const recoveryCount = await this.prisma.recoverySession.count({
      where: {
        userId,
        status: { in: ['PATH_SELECTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
    });

    if (recoveryCount === 1) {
      return this.awardAchievement(userId, AchievementType.FIRST_RECOVERY);
    }

    return false;
  }

  /**
   * Check and award COMEBACK_KID achievement
   */
  async checkComebackAchievement(userId: string): Promise<boolean> {
    const recoveryCount = await this.prisma.recoverySession.count({
      where: {
        userId,
        status: { in: ['PATH_SELECTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
    });

    if (recoveryCount >= 3) {
      return this.awardAchievement(userId, AchievementType.COMEBACK_KID, {
        totalRecoveries: recoveryCount,
      });
    }

    return false;
  }

  /**
   * Check and award FREEZE_CHAMPION achievement
   */
  async checkFreezeChampionAchievement(userId: string): Promise<boolean> {
    // Check if user has completed a category freeze
    const completedFreeze = await this.prisma.categoryFreeze.findFirst({
      where: {
        userId,
        isActive: false, // Completed
        endDate: { lt: new Date() },
      },
    });

    if (completedFreeze) {
      return this.awardAchievement(userId, AchievementType.FREEZE_CHAMPION, {
        categoryName: completedFreeze.categoryName,
      });
    }

    return false;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Get or create streak record for a user
   */
  private async getOrCreateStreak(userId: string) {
    let streak = await this.prisma.gpsStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      streak = await this.prisma.gpsStreak.create({
        data: {
          userId,
          currentStreak: 0,
          longestStreak: 0,
        },
      });
    }

    return streak;
  }

  /**
   * Calculate next milestone for a streak
   */
  private getNextMilestone(
    currentStreak: number,
  ): { days: number; name: string; daysRemaining: number } | null {
    for (const milestone of STREAK_MILESTONES) {
      if (currentStreak < milestone.days) {
        return {
          days: milestone.days,
          name: `${ACHIEVEMENT_DEFINITIONS[milestone.achievement].name} (${milestone.days} days)`,
          daysRemaining: milestone.days - currentStreak,
        };
      }
    }
    return null; // All milestones achieved
  }

  /**
   * Generate encouraging message based on streak state
   */
  private generateEncouragement(currentStreak: number, isActiveToday: boolean): string {
    if (currentStreak === 0) {
      return this.pickRandom(STREAK_MESSAGES.newStreak);
    }

    if (!isActiveToday) {
      return this.pickRandom(STREAK_MESSAGES.inactive);
    }

    // Check if at a milestone
    const isMilestone = STREAK_MILESTONES.some((m) => m.days === currentStreak);
    if (isMilestone) {
      return this.pickRandom(STREAK_MESSAGES.milestoneReached).replace(
        '{days}',
        String(currentStreak),
      );
    }

    return this.pickRandom(STREAK_MESSAGES.continuing).replace(
      '{days}',
      String(currentStreak),
    );
  }

  /**
   * Pick a random message from an array
   */
  private pickRandom(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Track streak update for analytics
   */
  private async trackStreakUpdate(
    userId: string,
    previousStreak: number,
    newStreak: number,
    wasReset: boolean,
    reason?: string,
  ): Promise<void> {
    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        eventType: GpsEventType.STREAK_UPDATED,
        eventData: { wasReset, reason },
        previousValue: previousStreak,
        newValue: newStreak,
      },
    });
  }
}
