/**
 * Import Module Interfaces
 *
 * Type definitions for import processing pipeline.
 */

import { Currency, ImportSource, ImportJobStatus, ParsedTransactionStatus } from '@prisma/client';

/**
 * Raw transaction extracted from parsing
 */
export interface RawParsedTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
  description: string | null;
  merchant: string | null;
  isRecurring: boolean;
  type: 'debit' | 'credit';
  confidence?: number;
  reference?: string;
}

/**
 * Result from Claude parsing
 */
export interface ParseResult {
  transactions: RawParsedTransaction[];
  bankName: string | null;
  accountNumber: string | null;
  currency: Currency;
  statementPeriod?: {
    start: string;
    end: string;
  };
  errors?: string[];
}

/**
 * Normalized transaction ready for deduplication
 */
export interface NormalizedTransaction {
  date: Date;
  amount: number; // Always negative for debits, positive for credits
  currency: Currency;
  description: string | null;
  merchant: string | null;
  normalizedMerchant: string | null;
  isRecurringGuess: boolean;
  confidence: number;
  deduplicationHash: string;
}

/**
 * Deduplication check result
 */
export interface DeduplicationResult {
  transaction: NormalizedTransaction;
  isDuplicate: boolean;
  duplicateType: 'same_batch' | 'previous_import' | 'existing_expense' | null;
  duplicateOfId: string | null;
}

/**
 * Import job creation input
 */
export interface CreateImportJobInput {
  userId: string;
  source: ImportSource;
  fileName?: string;
  fileSize?: number;
  storagePath?: string;
  bankName?: string;
  rawContent?: string;
}

/**
 * Import job with transactions
 */
export interface ImportJobWithTransactions {
  id: string;
  userId: string;
  source: ImportSource;
  status: ImportJobStatus;
  fileName: string | null;
  fileSize: number | null;
  bankName: string | null;
  totalParsed: number;
  created: number;
  duplicates: number;
  rejected: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  transactions: ParsedTransactionDetails[];
}

/**
 * Parsed transaction details for API response
 */
export interface ParsedTransactionDetails {
  id: string;
  amount: number;
  currency: Currency;
  date: Date;
  description: string | null;
  merchant: string | null;
  normalizedMerchant: string | null;
  isRecurringGuess: boolean;
  status: ParsedTransactionStatus;
  duplicateOfId: string | null;
  confidence: number | null;
}

/**
 * File storage metadata
 */
export interface StoredFile {
  path: string;
  size: number;
  mimeType: string;
  originalName: string;
}

/**
 * Email webhook payload (Resend format)
 */
export interface ResendEmailWebhookPayload {
  type: 'email.received';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    // Body and attachments fetched separately via API
  };
}

/**
 * Email content fetched from Resend API
 */
export interface ResendEmailContent {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    content_type: string;
    content: string; // Base64 encoded
  }>;
}

/**
 * Expense creation input from confirmed transaction
 */
export interface CreateExpenseFromTransactionInput {
  userId: string;
  transactionId: string;
  categoryId: string;
  merchant?: string;
  isRecurring?: boolean;
}

/**
 * Batch confirmation input
 */
export interface BatchConfirmInput {
  transactionIds: string[];
  categoryId: string;
}
