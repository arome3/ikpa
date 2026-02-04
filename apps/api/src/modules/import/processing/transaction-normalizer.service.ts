/**
 * Transaction Normalizer Service
 *
 * Normalizes parsed transactions for consistent storage and deduplication.
 * Handles:
 * - Date standardization
 * - Amount normalization (debits always negative)
 * - Merchant name standardization
 * - Deduplication hash generation
 */

import { Injectable, Logger } from '@nestjs/common';
import { Currency } from '@prisma/client';
import * as crypto from 'crypto';
import { RawParsedTransaction, NormalizedTransaction } from '../interfaces';

/**
 * Common merchant name variations to normalize
 */
const MERCHANT_ALIASES: Record<string, string[]> = {
  // Streaming
  netflix: ['netflix', 'netflix.com', 'netflix inc'],
  spotify: ['spotify', 'spotify ab', 'spotify.com'],
  'apple music': ['apple music', 'itunes', 'apple.com/bill'],
  youtube: ['youtube', 'youtube premium', 'google youtube'],
  'amazon prime': ['amazon prime', 'prime video', 'amzn prime'],

  // Nigerian services
  dstv: ['dstv', 'multichoice', 'dstv subscription'],
  gotv: ['gotv', 'gotv subscription'],
  startimes: ['startimes', 'star times'],

  // Telecom
  mtn: ['mtn', 'mtn nigeria', 'mtn ng'],
  glo: ['glo', 'globacom', 'glo ng'],
  airtel: ['airtel', 'airtel nigeria', 'airtel ng'],
  '9mobile': ['9mobile', 'etisalat', '9mobile ng'],

  // Food delivery
  jumia: ['jumia', 'jumia food', 'jumia.com'],
  'uber eats': ['uber eats', 'ubereats'],
  glovo: ['glovo'],
  chowdeck: ['chowdeck'],

  // Ride-sharing
  uber: ['uber', 'uber bv', 'uber trip'],
  bolt: ['bolt', 'bolt eu', 'bolt ride'],

  // Cloud/Software
  icloud: ['icloud', 'apple icloud', 'apple.com/bill icloud'],
  google: ['google', 'google play', 'google.com'],
  microsoft: ['microsoft', 'ms365', 'office 365'],
  dropbox: ['dropbox'],

  // Retail
  shoprite: ['shoprite', 'shoprite nigeria'],
  spar: ['spar', 'spar nigeria'],
  'game stores': ['game stores', 'game nigeria'],
};

@Injectable()
export class TransactionNormalizerService {
  private readonly logger = new Logger(TransactionNormalizerService.name);

  /**
   * Normalize a batch of raw transactions
   */
  normalize(
    transactions: RawParsedTransaction[],
    currency: Currency,
  ): NormalizedTransaction[] {
    const normalized: NormalizedTransaction[] = [];

    for (const txn of transactions) {
      try {
        const normalizedTxn = this.normalizeTransaction(txn, currency);
        if (normalizedTxn) {
          normalized.push(normalizedTxn);
        }
      } catch (error) {
        this.logger.debug(
          `Failed to normalize transaction: ${JSON.stringify(txn)}`,
        );
      }
    }

    this.logger.log(
      `Normalized ${normalized.length} of ${transactions.length} transactions`,
    );

    return normalized;
  }

  /**
   * Normalize a single transaction
   */
  private normalizeTransaction(
    txn: RawParsedTransaction,
    currency: Currency,
  ): NormalizedTransaction | null {
    // Parse and validate date
    const date = this.parseDate(txn.date);
    if (!date) {
      this.logger.debug(`Invalid date: ${txn.date}`);
      return null;
    }

    // Normalize amount (debits = negative, credits = positive)
    let amount = txn.amount;
    if (txn.type === 'debit' && amount > 0) {
      amount = -amount;
    } else if (txn.type === 'credit' && amount < 0) {
      amount = Math.abs(amount);
    }

    // Skip zero amounts
    if (amount === 0) {
      return null;
    }

    // Normalize merchant name
    const merchant = txn.merchant || null;
    const normalizedMerchant = merchant
      ? this.normalizeMerchant(merchant)
      : this.extractMerchantFromDescription(txn.description);

    // Generate deduplication hash
    const deduplicationHash = this.generateDeduplicationHash(
      date,
      amount,
      normalizedMerchant,
    );

    return {
      date,
      amount,
      currency,
      description: txn.description || null,
      merchant,
      normalizedMerchant,
      isRecurringGuess: txn.isRecurring || this.detectRecurring(merchant, txn.description),
      confidence: txn.confidence ?? 1.0,
      deduplicationHash,
    };
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | null {
    // Expect YYYY-MM-DD format
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    // Validate date is reasonable (not in far future, not too old)
    const now = new Date();
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(now.getFullYear() - 5);

    const oneMonthAhead = new Date();
    oneMonthAhead.setMonth(now.getMonth() + 1);

    if (date < fiveYearsAgo || date > oneMonthAhead) {
      return null;
    }

    return date;
  }

  /**
   * Normalize merchant name for consistent matching
   */
  normalizeMerchant(merchant: string): string {
    // Clean and lowercase
    let normalized = merchant
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special chars except hyphen
      .replace(/\s+/g, ' '); // Collapse whitespace

    // Check against known aliases
    for (const [canonical, aliases] of Object.entries(MERCHANT_ALIASES)) {
      if (aliases.some((alias) => normalized.includes(alias))) {
        return canonical;
      }
    }

    // Remove common suffixes
    normalized = normalized
      .replace(/\s*(ltd|limited|inc|corp|llc|plc|nigeria|ng)\s*$/i, '')
      .trim();

    return normalized;
  }

  /**
   * Try to extract merchant from description
   */
  private extractMerchantFromDescription(
    description: string | null,
  ): string | null {
    if (!description) return null;

    // Common patterns in Nigerian bank descriptions
    const patterns = [
      // "POS PURCHASE - MERCHANT"
      /POS\s+(?:PURCHASE|PAYMENT)\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
      // "Transfer to MERCHANT"
      /Transfer\s+to\s+(.+?)(?:\s+\d|$)/i,
      // "WEB PAYMENT - MERCHANT"
      /WEB\s+(?:PURCHASE|PAYMENT)\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
      // "USSD - MERCHANT"
      /USSD\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return this.normalizeMerchant(match[1]);
      }
    }

    return null;
  }

  /**
   * Detect if transaction is likely recurring
   */
  private detectRecurring(
    merchant: string | null,
    description: string | null,
  ): boolean {
    const text = `${merchant || ''} ${description || ''}`.toLowerCase();

    // Known subscription services
    const subscriptionPatterns = [
      /netflix/i,
      /spotify/i,
      /apple/i,
      /google/i,
      /amazon prime/i,
      /dstv/i,
      /gotv/i,
      /startimes/i,
      /icloud/i,
      /youtube/i,
      /microsoft/i,
      /dropbox/i,
      /subscription/i,
      /recurring/i,
      /monthly/i,
      /annual/i,
    ];

    return subscriptionPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Generate deduplication hash
   *
   * Hash is based on:
   * - Date (day precision)
   * - Absolute amount
   * - Normalized merchant (if available)
   *
   * This allows detecting duplicates with:
   * - Same transaction imported multiple times
   * - 1-day date variance (handled in deduplication service)
   */
  generateDeduplicationHash(
    date: Date,
    amount: number,
    normalizedMerchant: string | null,
  ): string {
    // Use date string without time
    const dateStr = date.toISOString().split('T')[0];

    // Use absolute amount with 2 decimal precision
    const amountStr = Math.abs(amount).toFixed(2);

    // Use normalized merchant or empty string
    const merchantStr = normalizedMerchant || '';

    // Create hash input
    const input = `${dateStr}|${amountStr}|${merchantStr}`;

    // Generate SHA256 hash
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
  }
}
