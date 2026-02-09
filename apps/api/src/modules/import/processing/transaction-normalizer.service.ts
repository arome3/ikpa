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
  'disney plus': ['disney plus', 'disney+', 'disneyplus', 'disneyplus.com'],
  hulu: ['hulu', 'hulu llc'],
  'hbo max': ['hbo max', 'hbo', 'max.com'],
  'paramount plus': ['paramount+', 'paramount plus'],
  'apple tv': ['apple tv', 'apple tv+'],
  peacock: ['peacock', 'peacock tv'],

  // Regional streaming/TV
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
  doordash: ['doordash', 'door dash'],
  grubhub: ['grubhub', 'grub hub'],
  instacart: ['instacart'],
  postmates: ['postmates'],

  // Ride-sharing
  uber: ['uber', 'uber bv', 'uber trip'],
  bolt: ['bolt', 'bolt eu', 'bolt ride'],
  lyft: ['lyft', 'lyft inc'],

  // Cloud/Software
  icloud: ['icloud', 'apple icloud', 'apple.com/bill icloud'],
  google: ['google', 'google play', 'google.com'],
  microsoft: ['microsoft', 'ms365', 'office 365'],
  dropbox: ['dropbox'],
  adobe: ['adobe', 'adobe systems'],

  // Retail - US
  amazon: ['amazon', 'amzn', 'amazon.com', 'amzn mktp'],
  walmart: ['walmart', 'wal-mart', 'wal mart'],
  target: ['target'],
  costco: ['costco', 'costco wholesale'],
  'whole foods': ['whole foods', 'wholefds', 'wholefoods'],
  'trader joes': ['trader joe', 'trader joes'],
  kroger: ['kroger'],
  publix: ['publix'],

  // Gas stations
  shell: ['shell', 'shell oil'],
  chevron: ['chevron'],
  exxon: ['exxon', 'exxonmobil'],
  bp: ['bp'],

  // Retail - International
  shoprite: ['shoprite', 'shoprite nigeria'],
  spar: ['spar', 'spar nigeria'],
  'game stores': ['game stores', 'game nigeria'],

  // Restaurants / Fast food
  starbucks: ['starbucks'],
  'chick-fil-a': ['chick-fil-a', 'chick fil a', 'chickfila'],
  chipotle: ['chipotle'],
  mcdonalds: ['mcdonalds', "mcdonald's", 'mcd'],
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
      txn.description,
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

    // Common bank description patterns
    const nigerianPatterns = [
      // "POS PURCHASE - MERCHANT"
      /POS\s+(?:PURCHASE|PAYMENT)\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
      // "Transfer to MERCHANT"
      /Transfer\s+to\s+(.+?)(?:\s+\d|$)/i,
      // "WEB PAYMENT - MERCHANT"
      /WEB\s+(?:PURCHASE|PAYMENT)\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
      // "USSD - MERCHANT"
      /USSD\s*[-:]\s*(.+?)(?:\s+\d|$)/i,
    ];

    for (const pattern of nigerianPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return this.normalizeMerchant(match[1]);
      }
    }

    // US/International bank description patterns
    const intlPatterns = [
      // "PURCHASE AUTHORIZED ON 12/20 NETFLIX.COM" or "RECURRING PAYMENT AUTHORIZED ON 12/20 SPOTIFY"
      /(?:PURCHASE|PAYMENT|RECURRING)\s+(?:AUTHORIZED|AUTH)\s+(?:ON\s+\d{2}\/\d{2}\s+)?(.+?)(?:\s+CARD\s+\d|$)/i,
      // "DEBIT CARD PURCHASE - WHOLE FOODS MARKET #10234 AUSTIN TX"
      /(?:DEBIT\s+)?CARD\s+PURCHASE\s*[-:]\s*(.+?)(?:\s+\d{5}|\s+[A-Z]{2}\s*$)/i,
      // "ACH DEBIT NETFLIX.COM"
      /ACH\s+(?:DEBIT|CREDIT|PAYMENT)\s+(.+?)(?:\s+\d|$)/i,
      // "DIRECT DEP TECHCORP INC PAYROLL" → "TECHCORP INC"
      /DIRECT\s+DEP(?:OSIT)?\s+(.+?)(?:\s+PAYROLL|\s+SALARY|\s+PAY\s|$)/i,
      // "CHECK CARD PURCHASE CHEVRON 12345 AUSTIN TX"
      /CHECK\s+CARD\s+(?:PURCHASE\s+)?(.+?)(?:\s+\d{4,}|\s+[A-Z]{2}\s*$)/i,
      // "VENMO PAYMENT" / "ZELLE PAYMENT TO JOHN"
      /(?:VENMO|ZELLE|CASHAPP|PAYPAL)\s+(?:PAYMENT|TRANSFER|SENT)?\s*(?:TO\s+)?(.+?)$/i,
    ];

    for (const pattern of intlPatterns) {
      const match = description.match(pattern);
      if (match && match[1] && match[1].trim().length > 1) {
        return this.normalizeMerchant(match[1].trim());
      }
    }

    // Fallback: Check if description matches any known alias directly
    const lowerDesc = description.toLowerCase();
    for (const [canonical, aliases] of Object.entries(MERCHANT_ALIASES)) {
      if (aliases.some((alias) => lowerDesc.includes(alias))) {
        return canonical;
      }
    }

    // Last resort: use the description itself as merchant (cleaned up)
    // Strip common prefixes, trailing numbers/locations, and normalize
    const cleaned = description
      .replace(/^(?:POS|DEBIT|CREDIT|ACH|CHECK CARD|PURCHASE|PAYMENT)\s*/i, '')
      .replace(/\s+#?\d{4,}.*$/i, '') // trailing store numbers
      .replace(/\s+[A-Z]{2}\s*\d{5}.*$/i, '') // trailing STATE ZIP
      .replace(/\s+[A-Z]{2}\s*$/i, '') // trailing STATE
      .trim();

    if (cleaned.length >= 3) {
      return this.normalizeMerchant(cleaned);
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
    description?: string | null,
  ): string {
    // Use date string without time
    const dateStr = date.toISOString().split('T')[0];

    // Use absolute amount with 2 decimal precision
    const amountStr = Math.abs(amount).toFixed(2);

    // Use normalized merchant, or fallback to a cleaned description snippet
    // to prevent false collisions between different merchants on the same day
    let identifierStr = normalizedMerchant || '';
    if (!identifierStr && description) {
      // Use first 40 chars of lowercased, whitespace-collapsed description
      identifierStr = description
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 40);
    }

    // Create hash input
    const input = `${dateStr}|${amountStr}|${identifierStr}`;

    // Generate SHA256 hash
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
  }
}
