/**
 * GPS WhatsApp Notification Service
 *
 * Orchestrates WhatsApp delivery for GPS budget alerts.
 * Looks up user opt-in status and phone number, formats the message
 * for WhatsApp, and delegates to WhatsAppService for delivery.
 *
 * Does NOT duplicate fatigue prevention — the caller
 * (GpsNotificationService) already handles that.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsAppService, WhatsAppResult } from './whatsapp.service';

@Injectable()
export class GpsWhatsAppNotificationService {
  private readonly logger = new Logger(GpsWhatsAppNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  /**
   * Send a budget alert via WhatsApp if the user has opted in.
   *
   * @param userId - User to notify
   * @param title - Notification title (e.g., "Heads up on Food")
   * @param message - Notification body
   * @returns WhatsApp result, or null if user not eligible
   */
  async sendBudgetAlert(
    userId: string,
    title: string,
    message: string,
  ): Promise<WhatsAppResult | null> {
    // Look up user opt-in and phone number
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        phoneNumber: true,
        whatsappNotificationsEnabled: true,
        name: true,
      },
    });

    if (!user) {
      this.logger.warn(`[sendBudgetAlert] User ${userId} not found`);
      return null;
    }

    if (!user.whatsappNotificationsEnabled) {
      this.logger.debug(
        `[sendBudgetAlert] User ${userId} has WhatsApp notifications disabled`,
      );
      return null;
    }

    if (!user.phoneNumber) {
      this.logger.debug(
        `[sendBudgetAlert] User ${userId} has no phone number on file`,
      );
      return null;
    }

    // Format for WhatsApp: plain text, concise, no HTML
    const whatsappMessage = this.formatBudgetAlert(title, message, user.name);

    const result = await this.whatsappService.sendMessage(
      user.phoneNumber,
      whatsappMessage,
    );

    if (result.success) {
      this.logger.log(
        `[sendBudgetAlert] WhatsApp sent to user ${userId} (${result.messageSid})`,
      );
    } else {
      this.logger.warn(
        `[sendBudgetAlert] WhatsApp failed for user ${userId}: ${result.error}`,
      );
    }

    return result;
  }

  /**
   * Format a budget alert for WhatsApp delivery.
   * WhatsApp messages should be plain text, concise, and conversational.
   */
  private formatBudgetAlert(
    title: string,
    message: string,
    userName: string,
  ): string {
    return [
      `IKPA Budget Alert`,
      ``,
      `Hi ${userName},`,
      ``,
      `*${title}*`,
      message,
      ``,
      `Open IKPA to see recovery options.`,
    ].join('\n');
  }
}
