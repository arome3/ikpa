/**
 * Subscription Pattern Interfaces
 *
 * Defines patterns for detecting subscription services
 * from merchant names in expense records.
 */

import { SubscriptionCategory } from '@prisma/client';

/**
 * Pattern definition for subscription detection
 */
export interface SubscriptionPattern {
  /** Regex pattern to match merchant names */
  pattern: RegExp;
  /** Category for matched subscriptions */
  category: SubscriptionCategory;
  /** Human-readable display name for the category */
  displayName: string;
}

/**
 * Result of pattern matching against a merchant name
 */
export interface PatternMatchResult {
  /** Whether a pattern was matched */
  matched: boolean;
  /** Matched category (null if not matched) */
  category: SubscriptionCategory | null;
  /** Display name for the matched category */
  displayName: string | null;
  /** Confidence score (0-1) - higher for exact matches */
  confidence: number;
}

/**
 * Expense record for subscription detection
 */
export interface ExpenseForDetection {
  id: string;
  merchant: string | null;
  amount: number;
  currency: string;
  date: Date;
  isRecurring: boolean;
}

/**
 * Grouped expenses by merchant for analysis
 */
export interface MerchantExpenseGroup {
  merchant: string;
  expenses: Array<{
    amount: number;
    date: Date;
  }>;
  totalAmount: number;
  chargeCount: number;
  firstDate: Date;
  lastDate: Date;
  averageAmount: number;
}
