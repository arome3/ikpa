/**
 * GPS Notification Service
 *
 * Manages proactive notifications for budget events. Alerts users when
 * budget thresholds are crossed without being spammy.
 *
 * Features:
 * - Create notifications for budget threshold crossings
 * - Fatigue prevention (no duplicate notifications within 24h)
 * - Mark as read functionality
 * - Unread count for badge display
 *
 * Answers the user need: "Tell me when I overspend"
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BudgetTrigger as BudgetTriggerEnum } from '@prisma/client';
import { BudgetTrigger } from '../interfaces';
import {
  GpsNotificationDto,
  NotificationsResponseDto,
  UnreadCountResponseDto,
  MarkReadResponseDto,
} from '../dto/notification.dto';
import { format } from 'date-fns';
import { createMonetaryValue } from '../../../common/utils';
import { GpsWhatsAppNotificationService } from './gps-whatsapp-notification.service';

/**
 * Notification message templates
 * All messages are non-judgmental and supportive
 */
const NOTIFICATION_TEMPLATES = {
  BUDGET_WARNING: {
    titles: [
      "Heads up on {category}",
      "{category} budget check",
      "Quick update on {category}",
    ],
    messages: [
      "You've used {percent}% of your {category} budget. Still have room, just keeping you informed.",
      "Approaching your {category} limit at {percent}%. No worries - just a heads up.",
      "Your {category} spending is at {percent}%. A quick check-in to help you stay on track.",
    ],
  },
  BUDGET_EXCEEDED: {
    titles: [
      "{category} budget reached",
      "Time to recalculate for {category}",
      "{category} limit reached",
    ],
    messages: [
      "You've reached your {category} budget. Let's explore some options to keep your goals on track.",
      "Your {category} spending has hit the limit. Here are some paths forward.",
      "{category} budget reached. Every detour has a route back - let's find yours.",
    ],
  },
  BUDGET_CRITICAL: {
    titles: [
      "{category} needs attention",
      "Let's recalculate your {category} route",
      "{category} overspend detected",
    ],
    messages: [
      "Your {category} spending is at {percent}%. Let's look at some recovery options together.",
      "{category} is over budget. This is a detour, not a dead end - here are your options.",
      "Significant overspend in {category}. Let's find the best path back to your goals.",
    ],
  },
  SPENDING_DRIFT: {
    titles: [
      "Speed check for {category}",
      "Pacing ahead in {category}",
      "{category} pace alert",
    ],
    messages: [
      "Your {category} spending is {ratio}x faster than planned. At this pace, you'll exceed your budget around {date}. Aim for {correction}/day to stay on track.",
      "Heads up: {category} is {percent}% over pace. Try reducing to {correction}/day to course-correct.",
      "{category} is moving faster than expected. To stay under budget, aim for {correction}/day.",
    ],
  },
  PACE_WARNING: {
    titles: [
      "Heads up: {category} forecast",
      "{category} spending pace check",
      "Quick forecast for {category}",
    ],
    messages: [
      "Heads up: {category} is on pace to hit {projected} by month end (budget: {budgeted}). Safe daily limit: {dailyLimit}/day",
      "{category} is tracking toward {projected} this period (budget: {budgeted}). Try keeping to {dailyLimit}/day to stay on track.",
      "At current pace, {category} will reach {projected} by period end. Budget is {budgeted}. Aim for {dailyLimit}/day.",
    ],
  },
  FORECAST_ALERT: {
    titles: [
      "{category} forecast update",
      "Spending forecast: {category}",
      "{category} budget projection",
    ],
    messages: [
      "Your {category} spending is projected to reach {projected} (budget: {budgeted}). Safe daily limit: {dailyLimit}/day.",
      "{category} is on track for {projected} this period. Budget: {budgeted}. Consider limiting to {dailyLimit}/day.",
      "Forecast shows {category} heading to {projected} (budget: {budgeted}). You can stay on track with {dailyLimit}/day.",
    ],
  },
};

/**
 * Fatigue prevention configuration
 */
const FATIGUE_CONFIG = {
  /** Minimum hours between notifications for the same category and trigger level */
  minHoursBetween: 24,
  /** Maximum notifications per day per user */
  maxPerDayPerUser: 5,
};

@Injectable()
export class GpsNotificationService {
  private readonly logger = new Logger(GpsNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappNotificationService: GpsWhatsAppNotificationService,
  ) {}

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<NotificationsResponseDto> {
    const [notifications, unreadCount, totalCount] = await Promise.all([
      this.prisma.gpsNotification.findMany({
        where: {
          userId,
          ...(unreadOnly && { readAt: null }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.gpsNotification.count({
        where: { userId, readAt: null },
      }),
      this.prisma.gpsNotification.count({
        where: { userId },
      }),
    ]);

    return {
      notifications: notifications.map((n) => this.toDto(n)),
      unreadCount,
      totalCount,
    };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const count = await this.prisma.gpsNotification.count({
      where: { userId, readAt: null },
    });

    return {
      count,
      hasUnread: count > 0,
    };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<MarkReadResponseDto> {
    const result = await this.prisma.gpsNotification.updateMany({
      where: {
        id: notificationId,
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      success: result.count > 0,
      markedCount: result.count,
    };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<MarkReadResponseDto> {
    const result = await this.prisma.gpsNotification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      success: true,
      markedCount: result.count,
    };
  }

  /**
   * Create a notification for a budget threshold crossing
   * Includes fatigue prevention
   */
  async createBudgetNotification(
    userId: string,
    categoryId: string,
    categoryName: string,
    triggerType: BudgetTrigger,
    spentPercent: number,
  ): Promise<GpsNotificationDto | null> {
    // Check fatigue prevention
    const shouldSkip = await this.shouldSkipNotification(userId, categoryId, triggerType);
    if (shouldSkip) {
      this.logger.debug(
        `[createBudgetNotification] Skipping notification for user ${userId}, ` +
        `category ${categoryName} - fatigue prevention`,
      );
      return null;
    }

    // Generate message from templates
    const templates = NOTIFICATION_TEMPLATES[triggerType as keyof typeof NOTIFICATION_TEMPLATES];
    const title = this.pickRandom(templates.titles)
      .replace('{category}', categoryName);
    const message = this.pickRandom(templates.messages)
      .replace('{category}', categoryName)
      .replace('{percent}', String(Math.round(spentPercent)));

    // Create action URL
    const actionUrl = `/gps/recovery-paths?category=${encodeURIComponent(categoryName)}`;

    // Map interface type to Prisma enum
    const prismaTriggertType = triggerType as BudgetTriggerEnum;

    // Create notification
    const notification = await this.prisma.gpsNotification.create({
      data: {
        userId,
        triggerType: prismaTriggertType,
        categoryId,
        categoryName,
        title,
        message,
        actionUrl,
      },
    });

    this.logger.log(
      `[createBudgetNotification] Created ${triggerType} notification for user ${userId}, ` +
      `category ${categoryName} (${Math.round(spentPercent)}%)`,
    );

    // Fire-and-forget WhatsApp delivery (never blocks in-app notification)
    if (notification) {
      this.whatsappNotificationService
        .sendBudgetAlert(userId, title, message)
        .catch((err) => {
          this.logger.warn(
            `[createBudgetNotification] WhatsApp delivery failed: ${err.message}`,
          );
        });
    }

    return this.toDto(notification);
  }

  /**
   * Delete old notifications (cleanup)
   * Called by cron job
   */
  async deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.gpsNotification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        readAt: { not: null }, // Only delete read notifications
      },
    });

    if (result.count > 0) {
      this.logger.log(`[deleteOldNotifications] Deleted ${result.count} old notifications`);
    }

    return result.count;
  }

  /**
   * Create a notification for spending drift detection
   * Uses BUDGET_WARNING as trigger type with drift metadata to distinguish
   */
  async createDriftNotification(
    userId: string,
    categoryId: string,
    categoryName: string,
    velocityRatio: number,
    projectedOverspendDate: Date | null,
    courseCorrectionDaily: number,
    currency: string,
  ): Promise<GpsNotificationDto | null> {
    // Check drift-specific fatigue prevention
    const shouldSkip = await this.shouldSkipDriftNotification(userId, categoryId);
    if (shouldSkip) {
      this.logger.debug(
        `[createDriftNotification] Skipping drift notification for user ${userId}, ` +
        `category ${categoryName} - fatigue prevention`,
      );
      return null;
    }

    // Generate message from drift templates
    const templates = NOTIFICATION_TEMPLATES.SPENDING_DRIFT;
    const correctionFormatted = createMonetaryValue(
      Math.round(courseCorrectionDaily),
      currency,
    ).formatted;
    const overPacePercent = Math.round((velocityRatio - 1) * 100);
    const dateStr = projectedOverspendDate
      ? format(projectedOverspendDate, 'MMM d')
      : 'soon';

    const title = this.pickRandom(templates.titles)
      .replace('{category}', categoryName);
    const message = this.pickRandom(templates.messages)
      .replace('{category}', categoryName)
      .replace('{ratio}', velocityRatio.toFixed(1))
      .replace('{date}', dateStr)
      .replace('{correction}', correctionFormatted)
      .replace('{percent}', String(overPacePercent));

    const actionUrl = `/gps?drift=${categoryId}`;

    const notification = await this.prisma.gpsNotification.create({
      data: {
        userId,
        triggerType: BudgetTriggerEnum.BUDGET_WARNING,
        categoryId,
        categoryName,
        title,
        message,
        actionUrl,
        metadata: {
          type: 'drift',
          velocityRatio,
          projectedOverspendDate: projectedOverspendDate?.toISOString() ?? null,
          courseCorrectionDaily,
        },
      },
    });

    this.logger.log(
      `[createDriftNotification] Created drift notification for user ${userId}, ` +
      `category ${categoryName} (${velocityRatio.toFixed(1)}x pace)`,
    );

    // Fire-and-forget WhatsApp delivery (never blocks in-app notification)
    if (notification) {
      this.whatsappNotificationService
        .sendBudgetAlert(userId, title, message)
        .catch((err) => {
          this.logger.warn(
            `[createDriftNotification] WhatsApp delivery failed: ${err.message}`,
          );
        });
    }

    return this.toDto(notification);
  }

  /**
   * Check if drift notification should be skipped (24h cooldown per category)
   */
  private async shouldSkipDriftNotification(
    userId: string,
    categoryId: string,
  ): Promise<boolean> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Check for recent drift notification for this category
    const recentDrift = await this.prisma.gpsNotification.findFirst({
      where: {
        userId,
        categoryId,
        createdAt: { gte: twentyFourHoursAgo },
        metadata: {
          path: ['type'],
          equals: 'drift',
        },
      },
    });

    if (recentDrift) return true;

    // Check daily limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await this.prisma.gpsNotification.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });

    return todayCount >= FATIGUE_CONFIG.maxPerDayPerUser;
  }


  /**
   * Create a notification for a proactive budget forecast alert
   * Uses PACE_WARNING notification type with 3-day cooldown per category
   */
  async createForecastNotification(
    userId: string,
    categoryId: string,
    categoryName: string,
    projectedTotal: number,
    budgetedAmount: number,
    suggestedDailyLimit: number,
    currency: string,
  ): Promise<GpsNotificationDto | null> {
    // Check forecast-specific fatigue prevention (3 days per category)
    const shouldSkip = await this.shouldSkipForecastNotification(userId, categoryId);
    if (shouldSkip) {
      this.logger.debug(
        `[createForecastNotification] Skipping forecast notification for user ${userId}, ` +
        `category ${categoryName} - fatigue prevention (3-day cooldown)`,
      );
      return null;
    }

    // Generate message from PACE_WARNING templates
    const templates = NOTIFICATION_TEMPLATES.PACE_WARNING;
    const projectedFormatted = createMonetaryValue(
      Math.round(projectedTotal),
      currency,
    ).formatted;
    const budgetedFormatted = createMonetaryValue(
      Math.round(budgetedAmount),
      currency,
    ).formatted;
    const dailyLimitFormatted = createMonetaryValue(
      Math.round(suggestedDailyLimit * 100) / 100,
      currency,
    ).formatted;

    const title = this.pickRandom(templates.titles)
      .replace('{category}', categoryName);
    const message = this.pickRandom(templates.messages)
      .replace('{category}', categoryName)
      .replace('{projected}', projectedFormatted)
      .replace('{budgeted}', budgetedFormatted)
      .replace('{dailyLimit}', dailyLimitFormatted);

    const actionUrl = `/gps/forecast?category=${encodeURIComponent(categoryId)}`;

    const notification = await this.prisma.gpsNotification.create({
      data: {
        userId,
        triggerType: BudgetTriggerEnum.BUDGET_WARNING,
        categoryId,
        categoryName,
        title,
        message,
        actionUrl,
        metadata: {
          type: 'forecast',
          projectedTotal,
          budgetedAmount,
          suggestedDailyLimit,
        },
      },
    });

    this.logger.log(
      `[createForecastNotification] Created forecast notification for user ${userId}, ` +
      `category ${categoryName} (projected: ${projectedFormatted}, budget: ${budgetedFormatted})`,
    );

    // Fire-and-forget WhatsApp delivery
    if (notification) {
      this.whatsappNotificationService
        .sendBudgetAlert(userId, title, message)
        .catch((err) => {
          this.logger.warn(
            `[createForecastNotification] WhatsApp delivery failed: ${err.message}`,
          );
        });
    }

    return this.toDto(notification);
  }

  /**
   * Check if forecast notification should be skipped (3-day cooldown per category)
   */
  private async shouldSkipForecastNotification(
    userId: string,
    categoryId: string,
  ): Promise<boolean> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Check for recent forecast notification for this category
    const recentForecast = await this.prisma.gpsNotification.findFirst({
      where: {
        userId,
        categoryId,
        createdAt: { gte: threeDaysAgo },
        metadata: {
          path: ['type'],
          equals: 'forecast',
        },
      },
    });

    if (recentForecast) return true;

    // Check daily limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await this.prisma.gpsNotification.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });

    return todayCount >= FATIGUE_CONFIG.maxPerDayPerUser;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Check if notification should be skipped due to fatigue prevention
   */
  private async shouldSkipNotification(
    userId: string,
    categoryId: string,
    triggerType: BudgetTrigger,
  ): Promise<boolean> {
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - FATIGUE_CONFIG.minHoursBetween);

    // Check for recent notification with same category and trigger
    const recentSame = await this.prisma.gpsNotification.findFirst({
      where: {
        userId,
        categoryId,
        triggerType: triggerType as BudgetTriggerEnum,
        createdAt: { gte: hoursAgo },
      },
    });

    if (recentSame) {
      return true;
    }

    // Check daily limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await this.prisma.gpsNotification.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });

    if (todayCount >= FATIGUE_CONFIG.maxPerDayPerUser) {
      return true;
    }

    return false;
  }

  /**
   * Convert database record to DTO
   */
  private toDto(notification: {
    id: string;
    title: string;
    message: string;
    triggerType: BudgetTriggerEnum;
    categoryId: string;
    categoryName: string;
    readAt: Date | null;
    actionUrl: string | null;
    createdAt: Date;
  }): GpsNotificationDto {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      triggerType: notification.triggerType,
      categoryId: notification.categoryId,
      categoryName: notification.categoryName,
      isRead: notification.readAt !== null,
      readAt: notification.readAt || undefined,
      actionUrl: notification.actionUrl || undefined,
      createdAt: notification.createdAt,
    };
  }

  /**
   * Pick a random message from an array
   */
  private pickRandom(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
  }
}
