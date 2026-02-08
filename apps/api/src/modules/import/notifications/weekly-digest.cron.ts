/**
 * Weekly Digest Cron Service
 *
 * Sends a weekly email digest to users who had email-imported
 * expenses in the past 7 days. Runs every Monday at 8 AM UTC.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ImportSource } from '@prisma/client';
import { PrismaService } from '../../../prisma';
import { EmailService } from '../../auth/email.service';
import { BudgetService } from '../../gps/budget.service';
import { buildWeeklyDigestEmail, WeeklyDigestData } from './email-templates';

@Injectable()
export class WeeklyDigestCronService {
  private readonly logger = new Logger(WeeklyDigestCronService.name);
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
   * Every Monday at 8 AM UTC, send weekly digest to eligible users.
   */
  @Cron('0 8 * * 1')
  async sendWeeklyDigests(): Promise<void> {
    this.logger.log('Starting weekly import digest...');

    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 7);

    try {
      // Find users who have weeklyReportEnabled AND had email-imported expenses
      const usersWithImports = await this.prisma.importJob.findMany({
        where: {
          source: ImportSource.EMAIL_FORWARD,
          createdAt: { gte: periodStart },
          status: 'COMPLETED',
          user: { weeklyReportEnabled: true },
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });

      if (usersWithImports.length === 0) {
        this.logger.log('No users with email imports this week');
        return;
      }

      this.logger.log(
        `Sending weekly digests to ${usersWithImports.length} users`,
      );

      let sent = 0;
      for (const { userId } of usersWithImports) {
        try {
          await this.sendDigestForUser(userId, periodStart, periodEnd);
          sent++;
        } catch (error) {
          this.logger.warn(
            `Failed to send digest for user ${userId}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }

      this.logger.log(`Weekly digest complete: ${sent}/${usersWithImports.length} sent`);
    } catch (error) {
      this.logger.error(
        `Weekly digest cron failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async sendDigestForUser(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user?.email) return;

    // Get expenses created from email imports in the period
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        createdAt: { gte: periodStart, lte: periodEnd },
        // Find expenses that were created from import jobs with EMAIL_FORWARD source
        // We join through ParsedTransaction -> ImportJob
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Filter to only email-imported expenses by checking if they have a linked ParsedTransaction
    // from an EMAIL_FORWARD job
    const emailExpenseIds = await this.prisma.parsedTransaction.findMany({
      where: {
        createdExpenseId: { in: expenses.map((e) => e.id) },
        job: { source: ImportSource.EMAIL_FORWARD },
      },
      select: { createdExpenseId: true },
    });

    const emailExpenseIdSet = new Set(
      emailExpenseIds.map((t) => t.createdExpenseId).filter(Boolean),
    );
    const emailExpenses = expenses.filter((e) => emailExpenseIdSet.has(e.id));

    if (emailExpenses.length === 0) return;

    // Aggregate by category
    const categoryMap = new Map<
      string,
      { name: string; amount: number; count: number; categoryId: string }
    >();

    let totalAmount = 0;
    let currency = 'NGN';

    for (const expense of emailExpenses) {
      const catId = expense.categoryId;
      const catName = expense.category?.name || 'Other';
      const amount = Number(expense.amount);
      currency = expense.currency;
      totalAmount += amount;

      const existing = categoryMap.get(catId);
      if (existing) {
        existing.amount += amount;
        existing.count++;
      } else {
        categoryMap.set(catId, {
          name: catName,
          amount,
          count: 1,
          categoryId: catId,
        });
      }
    }

    // Get budget percentages for each category
    const categories: WeeklyDigestData['categories'] = [];
    for (const cat of categoryMap.values()) {
      let budgetPercent: number | null = null;
      try {
        const status = await this.budgetService.checkBudgetStatus(
          userId,
          cat.categoryId,
        );
        const budgetedAmount = status.budgeted.amount;
        if (budgetedAmount > 0) {
          budgetPercent = (status.spent.amount / budgetedAmount) * 100;
        }
      } catch {
        // No budget for this category
      }

      categories.push({
        name: cat.name,
        amount: cat.amount,
        count: cat.count,
        budgetPercent,
      });
    }

    // Sort by amount descending
    categories.sort((a, b) => b.amount - a.amount);

    const emailData = buildWeeklyDigestEmail({
      userName: user.name || 'there',
      totalImported: emailExpenses.length,
      totalAmount,
      currency,
      categories,
      frontendUrl: this.frontendUrl,
      periodStart,
      periodEnd,
    });

    await this.emailService.sendCustomEmail(
      user.email,
      emailData.subject,
      emailData.html,
      emailData.text,
    );
  }
}
