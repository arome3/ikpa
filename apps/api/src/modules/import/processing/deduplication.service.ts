/**
 * Deduplication Service
 *
 * Detects duplicate transactions across:
 * 1. Same batch (current import)
 * 2. Previous imports (other import jobs)
 * 3. Existing expenses (already in database)
 *
 * Uses hash-based detection with 1-day date variance tolerance
 * to handle bank processing delays.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { NormalizedTransaction, DeduplicationResult } from '../interfaces';
import { TransactionNormalizerService } from './transaction-normalizer.service';
import { DEDUPLICATION_DATE_VARIANCE_DAYS } from '../constants';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: TransactionNormalizerService,
  ) {}

  /**
   * Check transactions for duplicates
   * Returns transactions with duplicate status
   */
  async checkBatch(
    userId: string,
    jobId: string,
    transactions: NormalizedTransaction[],
  ): Promise<DeduplicationResult[]> {
    const results: DeduplicationResult[] = [];

    // Track hashes within this batch
    const batchHashes = new Set<string>();

    // Get existing hashes from previous imports
    const previousImportHashes = await this.getPreviousImportHashes(userId, jobId);

    // Get potential duplicate expenses
    const existingExpenses = await this.getExistingExpenses(userId, transactions);

    for (const txn of transactions) {
      let isDuplicate = false;
      let duplicateType: DeduplicationResult['duplicateType'] = null;
      let duplicateOfId: string | null = null;

      // Check 1: Same batch duplicate
      if (batchHashes.has(txn.deduplicationHash)) {
        isDuplicate = true;
        duplicateType = 'same_batch';
        this.logger.debug(`Same-batch duplicate: ${txn.deduplicationHash}`);
      }

      // Check 2: Previous import duplicate
      if (!isDuplicate && previousImportHashes.has(txn.deduplicationHash)) {
        isDuplicate = true;
        duplicateType = 'previous_import';
        this.logger.debug(`Previous import duplicate: ${txn.deduplicationHash}`);
      }

      // Check 3: Existing expense duplicate (with date variance)
      if (!isDuplicate) {
        const existingMatch = this.findExistingExpenseMatch(txn, existingExpenses);
        if (existingMatch) {
          isDuplicate = true;
          duplicateType = 'existing_expense';
          duplicateOfId = existingMatch.id;
          this.logger.debug(`Existing expense duplicate: ${existingMatch.id}`);
        }
      }

      // Add to batch hashes
      batchHashes.add(txn.deduplicationHash);

      results.push({
        transaction: txn,
        isDuplicate,
        duplicateType,
        duplicateOfId,
      });
    }

    const duplicateCount = results.filter((r) => r.isDuplicate).length;
    this.logger.log(
      `Deduplication: ${duplicateCount} duplicates found in ${transactions.length} transactions`,
    );

    return results;
  }

  /**
   * Get deduplication hashes from previous import jobs
   */
  private async getPreviousImportHashes(
    userId: string,
    currentJobId: string,
  ): Promise<Set<string>> {
    const hashes = new Set<string>();

    const previousTransactions = await this.prisma.parsedTransaction.findMany({
      where: {
        job: {
          userId,
          id: { not: currentJobId },
        },
        deduplicationHash: { not: null },
      },
      select: {
        deduplicationHash: true,
      },
    });

    for (const txn of previousTransactions) {
      if (txn.deduplicationHash) {
        hashes.add(txn.deduplicationHash);
      }
    }

    return hashes;
  }

  /**
   * Get existing expenses that could be duplicates
   * (within date range of transactions)
   */
  private async getExistingExpenses(
    userId: string,
    transactions: NormalizedTransaction[],
  ): Promise<Array<{
    id: string;
    date: Date;
    amount: number;
    merchant: string | null;
  }>> {
    if (transactions.length === 0) {
      return [];
    }

    // Find date range with variance
    const dates = transactions.map((t) => t.date);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add variance days to range
    minDate.setDate(minDate.getDate() - DEDUPLICATION_DATE_VARIANCE_DAYS);
    maxDate.setDate(maxDate.getDate() + DEDUPLICATION_DATE_VARIANCE_DAYS);

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: minDate,
          lte: maxDate,
        },
      },
      select: {
        id: true,
        date: true,
        amount: true,
        merchant: true,
      },
    });

    return expenses.map((e) => ({
      id: e.id,
      date: e.date,
      amount: Number(e.amount),
      merchant: e.merchant,
    }));
  }

  /**
   * Find matching existing expense with date variance tolerance
   */
  private findExistingExpenseMatch(
    txn: NormalizedTransaction,
    expenses: Array<{
      id: string;
      date: Date;
      amount: number;
      merchant: string | null;
    }>,
  ): { id: string } | null {
    const txnDate = txn.date.getTime();
    const varianceMs = DEDUPLICATION_DATE_VARIANCE_DAYS * 24 * 60 * 60 * 1000;

    for (const expense of expenses) {
      // Check amount match (exact)
      if (Math.abs(expense.amount - txn.amount) > 0.01) {
        continue;
      }

      // Check date within variance
      const dateDiff = Math.abs(expense.date.getTime() - txnDate);
      if (dateDiff > varianceMs) {
        continue;
      }

      // Check merchant match (if both have merchants)
      if (txn.normalizedMerchant && expense.merchant) {
        const normalizedExpenseMerchant = this.normalizer.normalizeMerchant(expense.merchant);
        if (normalizedExpenseMerchant !== txn.normalizedMerchant) {
          continue;
        }
      }

      // Match found
      return { id: expense.id };
    }

    return null;
  }

  }
