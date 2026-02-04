/**
 * GPS Progress Service
 *
 * Tracks recovery progress and milestones for GPS Re-Router sessions.
 * Answers the user need: "How far along am I?"
 *
 * Features:
 * - Milestone tracking (25%, 50%, 75%, 100%)
 * - Progress percentage calculation
 * - Encouraging messages at each milestone
 * - Projected completion dates
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GpsEventType, RecoveryStatus } from '@prisma/client';
import { differenceInDays, addDays } from 'date-fns';
import { RecoveryProgressDto, RecoveryMilestoneDto } from '../dto/progress.dto';
import { GPS_CONSTANTS } from '../constants';

/**
 * Milestone percentages to track
 */
const MILESTONES = [25, 50, 75, 100];

/**
 * Encouraging messages for different progress states
 * All messages are non-judgmental and supportive
 */
const PROGRESS_MESSAGES = {
  early: [
    "You're off to a great start!",
    "Every step forward counts. Keep going!",
    "Building momentum - you've got this!",
  ],
  quarter: [
    "25% done! You're making real progress.",
    "A quarter of the way there. Great work!",
    "First milestone achieved! Keep the momentum.",
  ],
  halfway: [
    "Halfway there! You're doing great.",
    "50% complete - the finish line is in sight!",
    "You've reached the midpoint. Excellent progress!",
  ],
  threeQuarters: [
    "75% done! The home stretch.",
    "Three-quarters complete - almost there!",
    "Just a little more to go. You've got this!",
  ],
  almostDone: [
    "So close to completing your recovery!",
    "The finish line is right ahead.",
    "Final stretch - you're almost there!",
  ],
  completed: [
    "Congratulations! You've completed your recovery.",
    "Amazing work! Your recovery is complete.",
    "You did it! Recovery journey completed.",
  ],
};

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate recovery progress for a session
   */
  async getRecoveryProgress(
    userId: string,
    sessionId: string,
  ): Promise<RecoveryProgressDto | null> {
    const session = await this.prisma.recoverySession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session || !session.selectedPathId || !session.selectedAt) {
      return null;
    }

    // Get milestones separately
    const milestonesData = await this.prisma.recoveryMilestone.findMany({
      where: { sessionId },
      orderBy: { milestone: 'asc' },
    });

    const now = new Date();
    const startDate = session.selectedAt;

    // Calculate total days based on recovery path
    const totalDays = this.getTotalDaysForPath(session.selectedPathId);
    const daysCompleted = Math.min(totalDays, differenceInDays(now, startDate));
    const daysRemaining = Math.max(0, totalDays - daysCompleted);
    const percentComplete = Math.min(100, Math.round((daysCompleted / totalDays) * 100));

    // Build milestones
    const milestones = this.buildMilestones(
      { id: session.id, milestones: milestonesData },
      percentComplete,
      startDate,
      totalDays,
    );

    // Check if on track
    const expectedProgress = (daysCompleted / totalDays) * 100;
    const onTrack = percentComplete >= expectedProgress - 5; // 5% tolerance

    // Generate encouragement
    const encouragement = this.generateEncouragement(percentComplete, daysRemaining);

    // Estimated completion
    const estimatedCompletionDate = addDays(startDate, totalDays);

    return {
      daysCompleted,
      daysRemaining,
      percentComplete,
      milestones,
      encouragement,
      onTrack,
      estimatedCompletionDate,
    };
  }

  /**
   * Check and record new milestones
   * Called by cron job or on session access
   */
  async checkAndRecordMilestones(userId: string, sessionId: string): Promise<number[]> {
    const progress = await this.getRecoveryProgress(userId, sessionId);
    if (!progress) return [];

    const newMilestones: number[] = [];

    for (const milestone of MILESTONES) {
      if (progress.percentComplete >= milestone) {
        const recorded = await this.recordMilestone(userId, sessionId, milestone);
        if (recorded) {
          newMilestones.push(milestone);
        }
      }
    }

    return newMilestones;
  }

  /**
   * Record a milestone achievement
   */
  async recordMilestone(
    userId: string,
    sessionId: string,
    milestone: number,
  ): Promise<boolean> {
    // Check if already recorded
    const existing = await this.prisma.recoveryMilestone.findUnique({
      where: {
        sessionId_milestone: { sessionId, milestone },
      },
    });

    if (existing) {
      return false;
    }

    // Record the milestone
    await this.prisma.recoveryMilestone.create({
      data: {
        sessionId,
        milestone,
      },
    });

    // Track analytics
    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        sessionId,
        eventType: GpsEventType.MILESTONE_ACHIEVED,
        eventData: { milestone },
        newValue: milestone,
      },
    });

    this.logger.log(
      `[recordMilestone] User ${userId}: milestone ${milestone}% achieved for session ${sessionId}`,
    );

    // Check if all milestones completed
    if (milestone === 100) {
      await this.markRecoveryCompleted(userId, sessionId);
    }

    return true;
  }

  /**
   * Mark recovery session as completed
   */
  async markRecoveryCompleted(userId: string, sessionId: string): Promise<void> {
    await this.prisma.recoverySession.update({
      where: { id: sessionId },
      data: {
        status: RecoveryStatus.COMPLETED,
        actionExecutedAt: new Date(),
      },
    });

    // Track completion
    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        sessionId,
        eventType: GpsEventType.RECOVERY_COMPLETED,
        eventData: { completedAt: new Date().toISOString() },
      },
    });

    this.logger.log(`[markRecoveryCompleted] User ${userId}: session ${sessionId} completed`);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Get total recovery days based on path type
   */
  private getTotalDaysForPath(pathId: string): number {
    switch (pathId) {
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT:
        return GPS_CONSTANTS.DEFAULT_TIMELINE_EXTENSION_WEEKS * 7;
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT:
      case GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL:
        return GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS * 7;
      default:
        return GPS_CONSTANTS.DEFAULT_FREEZE_DURATION_WEEKS * 7;
    }
  }

  /**
   * Build milestone objects with achieved/projected dates
   */
  private buildMilestones(
    session: { id: string; milestones: Array<{ milestone: number; achievedAt: Date }> },
    currentProgress: number,
    startDate: Date,
    totalDays: number,
  ): RecoveryMilestoneDto[] {
    const milestoneMap = new Map(session.milestones.map((m) => [m.milestone, m.achievedAt]));

    return MILESTONES.map((percent) => {
      const achieved = milestoneMap.has(percent) || currentProgress >= percent;
      const achievedAt = milestoneMap.get(percent);

      // Calculate projected date for unachieved milestones
      let projectedAt: Date | undefined;
      if (!achieved) {
        const daysToMilestone = Math.ceil((percent / 100) * totalDays);
        projectedAt = addDays(startDate, daysToMilestone);
      }

      return {
        percent,
        achieved,
        achievedAt,
        projectedAt,
      };
    });
  }

  /**
   * Generate encouraging message based on progress
   */
  private generateEncouragement(percentComplete: number, daysRemaining: number): string {
    let messages: string[];

    if (percentComplete >= 100) {
      messages = PROGRESS_MESSAGES.completed;
    } else if (percentComplete >= 75) {
      messages = PROGRESS_MESSAGES.threeQuarters;
    } else if (percentComplete >= 50) {
      messages = PROGRESS_MESSAGES.halfway;
    } else if (percentComplete >= 25) {
      messages = PROGRESS_MESSAGES.quarter;
    } else if (percentComplete >= 10) {
      messages = PROGRESS_MESSAGES.early;
    } else {
      messages = PROGRESS_MESSAGES.early;
    }

    const baseMessage = messages[Math.floor(Math.random() * messages.length)];

    // Add days context if not complete
    if (percentComplete < 100 && daysRemaining > 0) {
      return `${baseMessage} ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to go.`;
    }

    return baseMessage;
  }
}
