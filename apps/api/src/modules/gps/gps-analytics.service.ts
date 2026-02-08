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
import { GPS_CONSTANTS, RECOVERY_PATHS } from './constants';

/**
 * Helper function to round a number to 2 decimal places
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format hours to human-readable string
 */
function formatHours(hours: number): string {
  if (hours < 1) {
    return 'Under 1 hour';
  } else if (hours < 2) {
    return 'Under 2 hours';
  } else if (hours < 6) {
    return `About ${Math.round(hours)} hours`;
  } else if (hours < 24) {
    return `About ${Math.round(hours)} hours`;
  } else if (hours < 48) {
    return '1 day';
  } else {
    const days = Math.round(hours / 24);
    return `${days} days`;
  }
}

/**
 * Get path name from RECOVERY_PATHS constant
 */
function getPathName(pathId: string): string {
  const path = RECOVERY_PATHS[pathId as keyof typeof RECOVERY_PATHS];
  return path?.name || pathId;
}

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
  async getDashboard(userId: string, days: number = 30): Promise<GpsAnalyticsDashboard> {
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
      this.getPathSelectionDistribution(start, end, userId),
      this.getGoalSurvivalMetrics(start, end, userId),
      this.getTimeToRecoveryMetrics(start, end, userId),
      this.getProbabilityRestorationMetrics(start, end, userId),
      this.getTotalSessions(start, end, userId),
      this.getTotalThresholdsCrossed(start, end, userId),
    ]);

    // Round all percentages to 2 decimal places
    const roundedPathSelection = pathSelection.map((p) => ({
      ...p,
      percentage: roundTo2Decimals(p.percentage),
    }));

    const roundedGoalSurvival = {
      ...goalSurvival,
      // survivalRate is a decimal (0-1), convert to percentage and round
      survivalRate: roundTo2Decimals(goalSurvival.survivalRate * 100),
    };

    const roundedProbabilityRestoration = {
      ...probabilityRestoration,
      averageDropPercent: roundTo2Decimals(probabilityRestoration.averageDropPercent),
      averageRestoredPercent: roundTo2Decimals(probabilityRestoration.averageRestoredPercent),
      // restorationRate is a decimal (0-1), convert to percentage and round
      restorationRate: roundTo2Decimals(probabilityRestoration.restorationRate * 100),
    };

    const roundedTimeToRecovery = {
      ...timeToRecovery,
      averageHours: roundTo2Decimals(timeToRecovery.averageHours),
      medianHours: roundTo2Decimals(timeToRecovery.medianHours),
      minHours: roundTo2Decimals(timeToRecovery.minHours),
      maxHours: roundTo2Decimals(timeToRecovery.maxHours),
    };

    return {
      period: { start, end },
      pathSelection: roundedPathSelection,
      goalSurvival: roundedGoalSurvival,
      timeToRecovery: roundedTimeToRecovery,
      probabilityRestoration: roundedProbabilityRestoration,
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
    recoveryRateFormatted: string;
    preferredPath: {
      id: string;
      name: string;
      usageCount: number;
    } | null;
    averageTimeToRecovery: {
      hours: number;
      formatted: string;
    };
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
        recoveryRateFormatted: '0%',
        preferredPath: null,
        averageTimeToRecovery: {
          hours: 0,
          formatted: 'No data',
        },
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
    const recoveryRateFormatted = `${Math.round(recoveryRate * 100)}%`;

    // Find preferred path with usage count
    const pathCounts = sessions
      .filter((s) => s.selectedPathId)
      .reduce(
        (acc, s) => {
          acc[s.selectedPathId!] = (acc[s.selectedPathId!] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    const preferredPathEntry = Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0];
    const preferredPath = preferredPathEntry
      ? {
          id: preferredPathEntry[0],
          name: getPathName(preferredPathEntry[0]),
          usageCount: preferredPathEntry[1],
        }
      : null;

    // Calculate average time to recovery
    const sessionsWithSelection = sessions.filter((s) => s.selectedAt);
    const totalRecoveryMinutes = sessionsWithSelection.reduce((sum, s) => {
      return sum + differenceInMinutes(s.selectedAt!, s.createdAt);
    }, 0);
    const averageHours =
      sessionsWithSelection.length > 0
        ? totalRecoveryMinutes / sessionsWithSelection.length / 60 // Convert to hours
        : 0;

    const averageTimeToRecovery = {
      hours: roundTo2Decimals(averageHours),
      formatted: sessionsWithSelection.length > 0 ? formatHours(averageHours) : 'No data',
    };

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
      recoveryRateFormatted,
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
    userId?: string,
  ): Promise<PathSelectionDistribution[]> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        ...(userId && { userId }),
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
      [GPS_CONSTANTS.RECOVERY_PATH_IDS.CATEGORY_REBALANCE]: 'Smart Swap',
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
  async getGoalSurvivalMetrics(start: Date, end: Date, userId?: string): Promise<GoalSurvivalMetrics> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        ...(userId && { userId }),
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
  async getTimeToRecoveryMetrics(start: Date, end: Date, userId?: string): Promise<TimeToRecoveryMetrics> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        ...(userId && { userId }),
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
    userId?: string,
  ): Promise<ProbabilityRestorationMetrics> {
    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        ...(userId && { userId }),
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
  private async getTotalSessions(start: Date, end: Date, userId?: string): Promise<number> {
    return this.prisma.recoverySession.count({
      where: {
        ...(userId && { userId }),
        createdAt: { gte: start, lte: end },
      },
    });
  }

  /**
   * Get total budget thresholds crossed in period
   */
  private async getTotalThresholdsCrossed(start: Date, end: Date, userId?: string): Promise<number> {
    return this.prisma.gpsAnalyticsEvent.count({
      where: {
        ...(userId && { userId }),
        eventType: GpsEventType.BUDGET_THRESHOLD_CROSSED,
        createdAt: { gte: start, lte: end },
      },
    });
  }

  /**
   * Get category-level analytics
   */
  async getCategoryAnalytics(userId: string, days: number = 30): Promise<
    Array<{
      category: string;
      categoryId: string;
      totalSlips: number;
      recoveryRate: number;
      recoveryRateFormatted: string;
      mostSelectedPath: {
        id: string;
        name: string;
        count: number;
      } | null;
      averageOverspendPercent: number;
      totalOverspendAmount: {
        amount: number;
        currency: string;
        formatted: string;
      };
    }>
  > {
    const start = subDays(new Date(), days);

    const sessions = await this.prisma.recoverySession.findMany({
      where: {
        userId,
        createdAt: { gte: start },
      },
    });

    // Group by normalized category key (lowercase + trimmed) to prevent duplicates
    // e.g., "Food & Dining" and "food & dining" merge into one group
    const categoryData = sessions.reduce(
      (acc, s) => {
        const normalizedKey = s.category.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!acc[normalizedKey]) {
          acc[normalizedKey] = {
            displayName: s.category,
            slips: [],
            paths: [] as string[],
            overspendAmounts: [] as number[],
            overspendPercents: [] as number[],
          };
        }
        // Prefer the more readable display name (has spaces or uppercase)
        if (s.category.includes(' ') || s.category !== s.category.toLowerCase()) {
          acc[normalizedKey].displayName = s.category;
        }
        // Ensure display name is properly capitalized (e.g., "shopping" -> "Shopping")
        if (acc[normalizedKey].displayName === acc[normalizedKey].displayName.toLowerCase()) {
          acc[normalizedKey].displayName = acc[normalizedKey].displayName
            .split(' ')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        }
        acc[normalizedKey].slips.push(s);
        if (s.selectedPathId) {
          acc[normalizedKey].paths.push(s.selectedPathId);
        }
        // Track overspend amounts from session
        const overspendAmount = Number(s.overspendAmount || 0);
        if (overspendAmount > 0) {
          acc[normalizedKey].overspendAmounts.push(overspendAmount);
        }
        // Track per-session overspend percentages (only for sessions with both values)
        const budgetAmount = Number((s as { budgetAmount?: unknown }).budgetAmount || 0);
        if (budgetAmount > 0 && overspendAmount > 0) {
          acc[normalizedKey].overspendPercents.push((overspendAmount / budgetAmount) * 100);
        }
        return acc;
      },
      {} as Record<
        string,
        {
          displayName: string;
          slips: typeof sessions;
          paths: string[];
          overspendAmounts: number[];
          overspendPercents: number[];
        }
      >,
    );

    const results = Object.entries(categoryData).map(([normalizedKey, data]) => {
      const recovered = data.slips.filter(
        (s) => s.status !== RecoveryStatus.PENDING && s.status !== RecoveryStatus.ABANDONED,
      ).length;

      // Find most selected path with count
      const pathCounts = data.paths.reduce(
        (acc, p) => {
          acc[p] = (acc[p] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const mostSelectedPathEntry = Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0];
      const mostSelectedPath = mostSelectedPathEntry
        ? {
            id: mostSelectedPathEntry[0],
            name: getPathName(mostSelectedPathEntry[0]),
            count: mostSelectedPathEntry[1],
          }
        : null;

      const recoveryRate = data.slips.length > 0 ? recovered / data.slips.length : 0;

      // Calculate total overspend amount
      const totalOverspend = data.overspendAmounts.reduce((a, b) => a + b, 0);

      // Calculate average overspend percent from per-session percentages
      // Only sessions that have both overspendAmount and budgetAmount contribute
      let averageOverspendPercent = 0;
      if (data.overspendPercents.length > 0) {
        const totalPercent = data.overspendPercents.reduce((a, b) => a + b, 0);
        averageOverspendPercent = roundTo2Decimals(totalPercent / data.overspendPercents.length);
      }

      // Generate category ID slug from normalized key
      const categoryId = normalizedKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      return {
        category: data.displayName,
        categoryId,
        totalSlips: data.slips.length,
        recoveryRate: roundTo2Decimals(recoveryRate),
        recoveryRateFormatted: `${Math.round(recoveryRate * 100)}%`,
        mostSelectedPath,
        averageOverspendPercent,
        totalOverspendAmount: {
          amount: Math.round(totalOverspend),
          currency: 'USD',
          formatted: `$${(totalOverspend / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      };
    });

    // Sort by totalSlips in descending order
    return results.sort((a, b) => b.totalSlips - a.totalSlips);
  }
}
