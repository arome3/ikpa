/**
 * GPS Notification Event Listener
 *
 * Listens for GPS events and creates notifications automatically.
 * Integrates with the budget event system to proactively notify users.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GpsNotificationService } from './gps-notification.service';
import { GPS_EVENTS, BudgetThresholdCrossedEvent } from '../budget-event.listener';

/**
 * Notification event payload
 */
export interface GpsNotificationRequiredEvent {
  userId: string;
  type: 'BUDGET_THRESHOLD';
  data: BudgetThresholdCrossedEvent;
}

@Injectable()
export class GpsNotificationListener {
  private readonly logger = new Logger(GpsNotificationListener.name);

  constructor(private readonly notificationService: GpsNotificationService) {}

  /**
   * Handle notification required events from budget threshold crossings
   */
  @OnEvent(GPS_EVENTS.GPS_NOTIFICATION_REQUIRED)
  async handleNotificationRequired(event: GpsNotificationRequiredEvent): Promise<void> {
    this.logger.debug(
      `[handleNotificationRequired] Processing notification for user ${event.userId}`,
    );

    try {
      if (event.type === 'BUDGET_THRESHOLD') {
        await this.handleBudgetThresholdNotification(event.data);
      }
    } catch (error) {
      // Don't let notification failures break other processes
      this.logger.warn(
        `[handleNotificationRequired] Failed to create notification: ${error}`,
      );
    }
  }

  /**
   * Handle budget threshold crossing notification
   */
  private async handleBudgetThresholdNotification(
    event: BudgetThresholdCrossedEvent,
  ): Promise<void> {
    const spentPercent = event.budgeted > 0
      ? (event.spent / event.budgeted) * 100
      : 0;

    // The trigger is already the correct type from BudgetThresholdCrossedEvent
    await this.notificationService.createBudgetNotification(
      event.userId,
      event.categoryId,
      event.categoryName,
      event.trigger,
      spentPercent,
    );
  }
}
