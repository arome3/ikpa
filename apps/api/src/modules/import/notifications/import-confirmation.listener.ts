/**
 * Import Confirmation Event Listener
 *
 * Listens for import events and triggers notification emails.
 * Follows the same pattern as GpsNotificationListener.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ImportConfirmationService } from './import-confirmation.service';
import {
  IMPORT_EVENTS,
  EmailAutoConfirmedEvent,
  ImportEmailCreatedEvent,
} from './import-events';

@Injectable()
export class ImportConfirmationListener {
  private readonly logger = new Logger(ImportConfirmationListener.name);

  constructor(
    private readonly confirmationService: ImportConfirmationService,
  ) {}

  /**
   * Handle auto-confirmed email import.
   * Sends a styled confirmation email with budget impact.
   */
  @OnEvent(IMPORT_EVENTS.EMAIL_AUTO_CONFIRMED)
  async handleEmailAutoConfirmed(
    event: EmailAutoConfirmedEvent,
  ): Promise<void> {
    this.logger.debug(
      `[handleEmailAutoConfirmed] Processing auto-confirmed expense ${event.expenseId} for user ${event.userId}`,
    );

    try {
      await this.confirmationService.sendExpenseConfirmationEmail(event);
    } catch (error) {
      this.logger.warn(
        `[handleEmailAutoConfirmed] Failed to send confirmation: ${error}`,
      );
    }
  }

  /**
   * Handle new import email address creation.
   * Sends a welcome/onboarding email.
   */
  @OnEvent(IMPORT_EVENTS.IMPORT_EMAIL_CREATED)
  async handleImportEmailCreated(
    event: ImportEmailCreatedEvent,
  ): Promise<void> {
    this.logger.debug(
      `[handleImportEmailCreated] Sending welcome email for user ${event.userId}`,
    );

    try {
      await this.confirmationService.sendImportWelcomeEmail(event);
    } catch (error) {
      this.logger.warn(
        `[handleImportEmailCreated] Failed to send welcome email: ${error}`,
      );
    }
  }
}
