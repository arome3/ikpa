/**
 * Import Confirmation Service
 *
 * Sends confirmation and welcome emails for the email import pipeline.
 * Looks up budget status to include budget impact in confirmation emails.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma';
import { EmailService } from '../../auth/email.service';
import { BudgetService } from '../../gps/budget.service';
import { EmailAutoConfirmedEvent, ImportEmailCreatedEvent } from './import-events';
import {
  buildExpenseConfirmationEmail,
  buildImportWelcomeEmail,
} from './email-templates';

@Injectable()
export class ImportConfirmationService {
  private readonly logger = new Logger(ImportConfirmationService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly budgetService: BudgetService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'https://app.ikpa.app';
  }

  /**
   * Send expense confirmation email after auto-import.
   * Includes budget impact if the user has a budget for that category.
   */
  async sendExpenseConfirmationEmail(
    event: EmailAutoConfirmedEvent,
  ): Promise<void> {
    try {
      // Look up user
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        this.logger.warn(
          `Cannot send confirmation email: user ${event.userId} has no email`,
        );
        return;
      }

      // Look up category name
      const category = await this.prisma.expenseCategory.findUnique({
        where: { id: event.categoryId },
        select: { name: true },
      });

      // Try to get budget status for the category
      let budgetPercent: number | null = null;
      let budgetTotal: number | null = null;
      let budgetSpent: number | null = null;
      let isOverBudget = false;

      try {
        const status = await this.budgetService.checkBudgetStatus(
          event.userId,
          event.categoryId,
        );
        budgetSpent = status.spent.amount;
        budgetTotal = status.budgeted.amount;
        budgetPercent =
          budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : null;
        isOverBudget = status.overagePercent > 0;
      } catch {
        // No budget for this category — that's fine
      }

      const emailData = buildExpenseConfirmationEmail({
        userName: user.name || 'there',
        amount: event.amount,
        currency: event.currency,
        merchant: event.merchant,
        categoryName: category?.name || 'Other',
        date: event.date,
        description: event.description,
        budgetPercent,
        budgetTotal,
        budgetSpent,
        isOverBudget,
        frontendUrl: this.frontendUrl,
      });

      const result = await this.emailService.sendCustomEmail(
        user.email,
        emailData.subject,
        emailData.html,
        emailData.text,
      );

      if (result.success) {
        this.logger.log(
          `Sent expense confirmation email to ${user.email} for expense ${event.expenseId}`,
        );
      } else {
        this.logger.warn(
          `Failed to send confirmation email: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending confirmation email: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Send welcome email when a user's import email address is first created.
   * Explains how to set up auto-forwarding.
   */
  async sendImportWelcomeEmail(event: ImportEmailCreatedEvent): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        this.logger.warn(
          `Cannot send welcome email: user ${event.userId} has no email`,
        );
        return;
      }

      const emailData = buildImportWelcomeEmail({
        userName: user.name || 'there',
        emailAddress: event.emailAddress,
        frontendUrl: this.frontendUrl,
      });

      const result = await this.emailService.sendCustomEmail(
        user.email,
        emailData.subject,
        emailData.html,
        emailData.text,
      );

      if (result.success) {
        this.logger.log(
          `Sent import welcome email to ${user.email}`,
        );
      } else {
        this.logger.warn(
          `Failed to send import welcome email: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending import welcome email: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
