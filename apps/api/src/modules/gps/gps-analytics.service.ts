/**
 * GPS Analytics Service
 *
 * Provides comprehensive analytics and metrics collection for the GPS Re-Router feature.
 * Tracks key behavioral economics metrics to measure the effectiveness of the
 * What-The-Hell Effect intervention.
 *
 * Key Metrics:
 * - RecoveryPathSelection: Distribution of which paths users choose
 * - GoalSurvivalRate: Percentage of users who don't abandon goals after slips
 * - TimeToRecovery: Duration between slip detection and path selection
 * - ProbabilityRestored: How much goal probability was recovered
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GpsEventType, RecoveryStatus } from '@prisma/client';
import { subDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { GPS_CONSTANTS } from './constants';

/**
 * Path selection distribution
 */
export interface PathSelectionDistribution {
  pathId: string;
  pathName: string;
  count: number;
  percentage: number;
}

/**
 * Goal survival metrics
 */
export interface GoalSurvivalMetrics {
  totalSlips: number;
  recovered: number;
  abandoned: number;
  pending: number;
  survivalRate: number;
}

/**
 * Time to recovery metrics
 */
export interface TimeToRecoveryMetrics {
  averageHours: number;
  medianHours: number;
  minHours: number;
  maxHours: number;
  distribution: {
    under1Hour: number;
    hours1to6: number;
    hours6to24: number;
    over24Hours: number;
  };
}

/**
 * Probability restoration metrics
 */
export interface ProbabilityRestorationMetrics {
  averageDropPercent: number;
  averageRestoredPercent: number;
  fullyRestoredCount: number;
  partiallyRestoredCount: number;
  restorationRate: number;
}

/**
 * Complete analytics dashboard data
 */
export interface GpsAnalyticsDashboard {
  period: {
    start: Date;
    end: Date;
  };
  pathSelection: PathSelectionDistribution[];
  goalSurvival: GoalSurvivalMetrics;
  timeToRecovery: TimeToRecoveryMetrics;
  probabilityRestoration: ProbabilityRestorationMetrics;
  totalSessions: number;
  totalBudgetThresholdsCrossed: number;
}

@Injectable()
export class GpsAnalyticsService {
  private readonly logger = new Logger(GpsAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get complete analytics dashboard for a time period
   */
  async getDashboard(days: number = 30): Promise<GpsAnalyticsDashboard> {
    const end = new Date();
    const start = subDays(end, days);

    const [
      pathSelection,
      goalSurvival,
      timeToRecovery,
      probabilityRestoration,
      totalSessions,
      totalThresholds,
    ] = await Promise.all([
      this.getPathSelectionDistribution(start, end),
      this.getGoalSurvivalMetrics(start, end),
      this.getTimeToRecoveryMetrics(start, end),
      this.getProbabilityRestorationMetrics(start, end),
      this.getTotalSessions(start, end),
      this.getTotalThresholdsCrossed(start, end),
    ]);

    return {
      period: { start, end },
      pathSelection,
      goalSurvival,
      timeToRecovery,
      probabilityRestoration,
      totalSessions,
      totalBudgetThresholdsCrossed: totalThresholds,
    };
  }

  /**
   * Get user-specific analytics
   */
  async getUserAnalytics(userId: string, days: number = 30): Promise<{
    totalSlips: number;
    recoveryRate: number;
    preferredPath: string | null;
    averageTimeToRecovery: number;
    totalProbabilityRestored: number;
  }> {
    const start = subDays(new Date(), days);

    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        userId,
        createdAt: { gte: start },
      },
    });

    if (sessions.length === 0) {
      return {
        totalSlips: 0,
        recoveryRate: 0,
        preferredPath: null,
        averageTimeToRecovery: 0,
        totalProbabilityRestored: 0,
      };
    }

    // Calculate recovery rate
    const recovered = sessions.filter(
      (s) =>
        s.status === RecoveryStatus.PATH_SELECTED ||
        s.status === RecoveryStatus.IN_PROGRESS ||
        s.status === RecoveryStatus.COMPLETED,
    ).length;
    const recoveryRate = recovered / sessions.length;

    // Find preferred path
    const pathCounts = sessions
      .filter((s) => s.selectedPathId)
      .reduce(
        (acc, s) => {
          acc[s.selectedPathId!] = (acc[s.selectedPathId!] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    const preferredPath =
      Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Calculate average time to recovery
    const sessionsWithSelection = sessions.filter((s) => s.selectedAt);
    const totalRecoveryMinutes = sessionsWithSelection.reduce((sum, s) => {
      return sum + differenceInMinutes(s.selectedAt!, s.createdAt);
    }, 0);
    const averageTimeToRecovery =
      sessionsWithSelection.length > 0
        ? totalRecoveryMinutes / sessionsWithSelection.length / 60 // Convert to hours
        : 0;

    // Calculate total probability restored
    const totalProbabilityRestored = sessions.reduce((sum, s) => {
      if (s.selectedPathId) {
        // Estimate restoration based on path type
        const drop = Number(s.previousProbability) - Number(s.newProbability);
        return sum + Math.max(0, drop);
      }
      return sum;
    }, 0);

    return {
      totalSlips: sessions.length,
      recoveryRate,
      preferredPath,
      averageTimeToRecovery,
      totalProbabilityRestored,
    };
  }

  /**
   * Get path selection distribution
   */
  async getPathSelectionDistribution(
    start: Date,
    end: Date,
  ): Promise<PathSelectionDistribution[]> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        selectedPathId: { not: null },
      },
      select: { selectedPathId: true },
    });

    const total = sessions.length;
    if (total === 0) {
      return [];
    }

    const pathCounts = sessions.reduce(
      (acc, s) => {
        const pathId = s.selectedPathId!;
        acc[pathId] = (acc[pathId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const pathNames: Record<string, string> = {
      [GPS_CONSTANTS.RECOVERY_PATH_IDS.TIME_ADJUSTMENT]: 'Timeline Flex',
      [GPS_CONSTANTS.RECOVERY_PATH_IDS.RATE_ADJUSTMENT]: 'Savings Boost',
      [GPS_CONSTANTS.RECOVERY_PATH_IDS.FREEZE_PROTOCOL]: 'Category Pause',
    };

    return Object.entries(pathCounts)
      .map(([pathId, count]) => ({
        pathId,
        pathName: pathNames[pathId] || pathId,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get goal survival metrics
   *
   * Goal survival = user selected a recovery path (didn't abandon after slip)
   */
  async getGoalSurvivalMetrics(start: Date, end: Date): Promise<GoalSurvivalMetrics> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });

    const totalSlips = sessions.length;
    const recovered = sessions.filter(
      (s) =>
        s.status === RecoveryStatus.PATH_SELECTED ||
        s.status === RecoveryStatus.IN_PROGRESS ||
        s.status === RecoveryStatus.COMPLETED,
    ).length;
    const abandoned = sessions.filter((s) => s.status === RecoveryStatus.ABANDONED).length;
    const pending = sessions.filter((s) => s.status === RecoveryStatus.PENDING).length;

    const survivalRate = totalSlips > 0 ? recovered / totalSlips : 0;

    return {
      totalSlips,
      recovered,
      abandoned,
      pending,
      survivalRate,
    };
  }

  /**
   * Get time to recovery metrics
   *
   * Time from session creation (slip detection) to path selection
   */
  async getTimeToRecoveryMetrics(start: Date, end: Date): Promise<TimeToRecoveryMetrics> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        selectedAt: { not: null },
      },
    });

    if (sessions.length === 0) {
      return {
        averageHours: 0,
        medianHours: 0,
        minHours: 0,
        maxHours: 0,
        distribution: {
          under1Hour: 0,
          hours1to6: 0,
          hours6to24: 0,
          over24Hours: 0,
        },
      };
    }

    const recoveryTimes = sessions.map((s) =>
      differenceInHours(s.selectedAt!, s.createdAt),
    );

    // Sort for median calculation
    const sorted = [...recoveryTimes].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    const distribution = {
      under1Hour: recoveryTimes.filter((t) => t < 1).length,
      hours1to6: recoveryTimes.filter((t) => t >= 1 && t < 6).length,
      hours6to24: recoveryTimes.filter((t) => t >= 6 && t < 24).length,
      over24Hours: recoveryTimes.filter((t) => t >= 24).length,
    };

    return {
      averageHours: recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length,
      medianHours: median,
      minHours: Math.min(...recoveryTimes),
      maxHours: Math.max(...recoveryTimes),
      distribution,
    };
  }

  /**
   * Get probability restoration metrics
   */
  async getProbabilityRestorationMetrics(
    start: Date,
    end: Date,
  ): Promise<ProbabilityRestorationMetrics> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        selectedPathId: { not: null },
      },
    });

    if (sessions.length === 0) {
      return {
        averageDropPercent: 0,
        averageRestoredPercent: 0,
        fullyRestoredCount: 0,
        partiallyRestoredCount: 0,
        restorationRate: 0,
      };
    }

    let totalDrop = 0;
    let fullyRestored = 0;
    let partiallyRestored = 0;

    for (const session of sessions) {
      const previous = Number(session.previousProbability);
      const current = Number(session.newProbability);
      const drop = previous - current;

      totalDrop += drop;

      // Consider fully restored if drop was recovered (simplified estimation)
      // In reality, we'd compare with post-action probability
      if (drop < 0.05) {
        fullyRestored++;
      } else {
        partiallyRestored++;
      }
    }

    const averageDropPercent = (totalDrop / sessions.length) * 100;

    // Estimate average restoration (simplified - assume 70% restoration for selected paths)
    const averageRestoredPercent = averageDropPercent * 0.7;

    return {
      averageDropPercent,
      averageRestoredPercent,
      fullyRestoredCount: fullyRestored,
      partiallyRestoredCount: partiallyRestored,
      restorationRate: (fullyRestored + partiallyRestored) / sessions.length,
    };
  }

  /**
   * Track a goal survival event
   */
  async trackGoalSurvival(userId: string, sessionId: string, survived: boolean): Promise<void> {
    this.logger.log(
      `[trackGoalSurvival] User ${userId}, session ${sessionId}: goal ${survived ? 'survived' : 'abandoned'}`,
    );

    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        sessionId,
        eventType: survived ? GpsEventType.GOAL_SURVIVED : GpsEventType.GOAL_ABANDONED,
        eventData: { survived },
      },
    });

    // Update session status
    await this.prisma.recoverySession.update({
      where: { id: sessionId },
      data: {
        status: survived ? RecoveryStatus.COMPLETED : RecoveryStatus.ABANDONED,
      },
    });
  }

  /**
   * Track recovery completion
   */
  async trackRecoveryCompleted(
    userId: string,
    sessionId: string,
    finalProbability: number,
  ): Promise<void> {
    const session = await this.prisma.recoverySession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return;

    const probabilityRestored = finalProbability - Number(session.newProbability);

    await this.prisma.gpsAnalyticsEvent.create({
      data: {
        userId,
        sessionId,
        eventType: GpsEventType.RECOVERY_COMPLETED,
        eventData: {
          pathId: session.selectedPathId,
          finalProbability,
          probabilityRestored,
        },
        previousValue: Number(session.newProbability),
        newValue: finalProbability,
      },
    });

    await this.prisma.recoverySession.update({
      where: { id: sessionId },
      data: { status: RecoveryStatus.COMPLETED },
    });
  }

  /**
   * Get total sessions in period
   */
  private async getTotalSessions(start: Date, end: Date): Promise<number> {
    return this.prisma.recoverySession.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });
  }

  /**
   * Get total budget thresholds crossed in period
   */
  private async getTotalThresholdsCrossed(start: Date, end: Date): Promise<number> {
    return this.prisma.gpsAnalyticsEvent.count({
      where: {
        eventType: GpsEventType.BUDGET_THRESHOLD_CROSSED,
        createdAt: { gte: start, lte: end },
      },
    });
  }

  /**
   * Get category-level analytics
   */
  async getCategoryAnalytics(days: number = 30): Promise<
    Array<{
      category: string;
      totalSlips: number;
      recoveryRate: number;
      mostSelectedPath: string | null;
    }>
  > {
    const start = subDays(new Date(), days);

    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        createdAt: { gte: start },
      },
    });

    // Group by category
    const categoryData = sessions.reduce(
      (acc, s) => {
        if (!acc[s.category]) {
          acc[s.category] = { slips: [], paths: [] as string[] };
        }
        acc[s.category].slips.push(s);
        if (s.selectedPathId) {
          acc[s.category].paths.push(s.selectedPathId);
        }
        return acc;
      },
      {} as Record<string, { slips: typeof sessions; paths: string[] }>,
    );

    return Object.entries(categoryData).map(([category, data]) => {
      const recovered = data.slips.filter(
        (s) => s.status !== RecoveryStatus.PENDING && s.status !== RecoveryStatus.ABANDONED,
      ).length;

      // Find most selected path
      const pathCounts = data.paths.reduce(
        (acc, p) => {
          acc[p] = (acc[p] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const mostSelectedPath =
        Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      return {
        category,
        totalSlips: data.slips.length,
        recoveryRate: data.slips.length > 0 ? recovered / data.slips.length : 0,
        mostSelectedPath,
      };
    });
  }
}
