/**
 * Expense Creator Service
 *
 * Creates Expense records from confirmed ParsedTransaction records.
 * Sets isRecurring flag based on pattern detection and matches
 * merchant names to Shark Auditor subscription patterns.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma';
import { ImportConfirmationException } from '../exceptions';
import { ParsedTransactionStatus } from '@prisma/client';

/**
 * Known subscription merchants for Shark Auditor integration
 */
const SUBSCRIPTION_MERCHANTS: string[] = [
  'netflix',
  'spotify',
  'apple music',
  'youtube',
  'amazon prime',
  'dstv',
  'gotv',
  'startimes',
  'icloud',
  'google',
  'microsoft',
  'dropbox',
  'adobe',
  'canva',
  'notion',
  'figma',
  'github',
  'linkedin',
  'twitter',
  'medium',
  'coursera',
  'udemy',
  'skillshare',
  'headspace',
  'calm',
  'strava',
  'gympass',
];

@Injectable()
export class ExpenseCreatorService {
  private readonly logger = new Logger(ExpenseCreatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create expenses from confirmed transactions
   */
  async createExpenses(
    userId: string,
    jobId: string,
    transactionIds: string[],
    categoryId: string,
  ): Promise<{
    expensesCreated: number;
    skipped: number;
    expenseIds: string[];
  }> {
    // Validate category exists
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new ImportConfirmationException(
        `Category with id '${categoryId}' not found`,
      );
    }

    // Get confirmed transactions
    const transactions = await this.prisma.parsedTransaction.findMany({
      where: {
        id: { in: transactionIds },
        jobId,
        job: { userId },
        status: {
          in: [ParsedTransactionStatus.CONFIRMED, ParsedTransactionStatus.PENDING],
        },
      },
    });

    if (transactions.length === 0) {
      throw new ImportConfirmationException(
        'No valid transactions found to confirm',
      );
    }

    const expenseIds: string[] = [];
    let skipped = 0;

    // Create expenses in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const txn of transactions) {
        // Skip if already created or duplicate
        if (
          txn.status === ParsedTransactionStatus.CREATED ||
          txn.status === ParsedTransactionStatus.DUPLICATE
        ) {
          skipped++;
          continue;
        }

        // Determine if recurring based on merchant
        const isRecurring = this.isSubscriptionMerchant(txn.normalizedMerchant);

        // Create expense
        const expense = await tx.expense.create({
          data: {
            userId,
            categoryId,
            amount: txn.amount,
            currency: txn.currency,
            date: txn.date,
            description: txn.description,
            merchant: txn.merchant || txn.normalizedMerchant,
            isRecurring: isRecurring || txn.isRecurringGuess,
          },
        });

        expenseIds.push(expense.id);

        // Update transaction status
        await tx.parsedTransaction.update({
          where: { id: txn.id },
          data: {
            status: ParsedTransactionStatus.CREATED,
            createdExpenseId: expense.id,
          },
        });
      }

      // Update job counters
      await tx.importJob.update({
        where: { id: jobId },
        data: {
          created: { increment: expenseIds.length },
          status: 'COMPLETED',
        },
      });
    });

    this.logger.log(
      `Created ${expenseIds.length} expenses from job ${jobId} (${skipped} skipped)`,
    );

    // Emit event for Shark Auditor to re-scan
    if (expenseIds.length > 0) {
      this.eventEmitter.emit('expenses.created', {
        userId,
        expenseIds,
        source: 'import',
        jobId,
      });
    }

    return {
      expensesCreated: expenseIds.length,
      skipped,
      expenseIds,
    };
  }

  /**
   * Create a single expense from a transaction
   */
  async createSingleExpense(
    userId: string,
    transactionId: string,
    categoryId: string,
    overrides?: {
      merchant?: string;
      isRecurring?: boolean;
    },
  ): Promise<string> {
    // Get transaction
    const transaction = await this.prisma.parsedTransaction.findFirst({
      where: {
        id: transactionId,
        job: { userId },
        status: {
          in: [ParsedTransactionStatus.CONFIRMED, ParsedTransactionStatus.PENDING],
        },
      },
    });

    if (!transaction) {
      throw new ImportConfirmationException(
        `Transaction with id '${transactionId}' not found or already processed`,
      );
    }

    // Validate category
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new ImportConfirmationException(
        `Category with id '${categoryId}' not found`,
      );
    }

    // Determine final values
    const merchant = overrides?.merchant || transaction.merchant || transaction.normalizedMerchant;
    const isRecurring =
      overrides?.isRecurring ??
      transaction.isRecurringGuess ??
      this.isSubscriptionMerchant(transaction.normalizedMerchant);

    // Create expense and update transaction
    const [expense] = await this.prisma.$transaction([
      this.prisma.expense.create({
        data: {
          userId,
          categoryId,
          amount: transaction.amount,
          currency: transaction.currency,
          date: transaction.date,
          description: transaction.description,
          merchant,
          isRecurring,
        },
      }),
      this.prisma.parsedTransaction.update({
        where: { id: transactionId },
        data: {
          status: ParsedTransactionStatus.CREATED,
          createdExpenseId: '', // Will update below
        },
      }),
    ]);

    // Update with actual expense ID
    await this.prisma.parsedTransaction.update({
      where: { id: transactionId },
      data: { createdExpenseId: expense.id },
    });

    // Update job counter
    await this.prisma.importJob.update({
      where: { id: transaction.jobId },
      data: { created: { increment: 1 } },
    });

    this.logger.log(`Created expense ${expense.id} from transaction ${transactionId}`);

    // Emit event
    this.eventEmitter.emit('expenses.created', {
      userId,
      expenseIds: [expense.id],
      source: 'import',
    });

    return expense.id;
  }

  /**
   * Check if merchant is a known subscription service
   */
  private isSubscriptionMerchant(normalizedMerchant: string | null): boolean {
    if (!normalizedMerchant) return false;

    const lowerMerchant = normalizedMerchant.toLowerCase();
    return SUBSCRIPTION_MERCHANTS.some((sub) =>
      lowerMerchant.includes(sub) || sub.includes(lowerMerchant),
    );
  }

  /**
   * Reject transactions (mark as REJECTED)
   */
  async rejectTransactions(
    userId: string,
    jobId: string,
    transactionIds: string[],
  ): Promise<number> {
    const result = await this.prisma.parsedTransaction.updateMany({
      where: {
        id: { in: transactionIds },
        jobId,
        job: { userId },
        status: ParsedTransactionStatus.PENDING,
      },
      data: {
        status: ParsedTransactionStatus.REJECTED,
      },
    });

    // Update job counter
    if (result.count > 0) {
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: { rejected: { increment: result.count } },
      });
    }

    this.logger.log(`Rejected ${result.count} transactions from job ${jobId}`);

    return result.count;
  }
}
