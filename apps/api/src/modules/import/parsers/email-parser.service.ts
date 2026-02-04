/**
 * Email Parser Service
 *
 * Parses forwarded bank alert emails to extract transactions.
 * Handles:
 * - Nigerian bank alert formats (GTBank, Access, Zenith, etc.)
 * - Email body text parsing
 * - PDF/CSV attachments
 */

import { Injectable, Logger } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { AnthropicService } from '../../ai/anthropic/anthropic.service';
import { RawParsedTransaction, ParseResult, ResendEmailContent } from '../interfaces';
import { ImportParseException } from '../exceptions';
import { CsvParserService } from './csv-parser.service';
import { PdfParserService } from './pdf-parser.service';
import {
  EMAIL_ALERT_SYSTEM_PROMPT,
  EMAIL_PARSING_PROMPT,
} from '../constants/prompts';
import { PARSING_MAX_TOKENS, PARSING_TIMEOUT_MS } from '../constants';

/**
 * Expected JSON structure from Claude
 */
interface ClaudeEmailResponse {
  transactions: Array<{
    date: string;
    amount: number;
    description: string | null;
    merchant: string | null;
    isRecurring: boolean;
    type: 'debit' | 'credit';
    reference?: string;
  }>;
  bankName: string | null;
  accountNumber: string | null;
  currency: string;
}

@Injectable()
export class EmailParserService {
  private readonly logger = new Logger(EmailParserService.name);

  constructor(
    private readonly anthropicService: AnthropicService,
    private readonly csvParser: CsvParserService,
    private readonly pdfParser: PdfParserService,
  ) {}

  /**
   * Parse email content and extract transactions
   */
  async parse(email: ResendEmailContent): Promise<ParseResult> {
    const results: ParseResult[] = [];

    // Strategy 1: Parse email body for transaction alerts
    if (email.text || email.html) {
      try {
        const bodyResult = await this.parseEmailBody(
          email.subject,
          email.text || this.stripHtml(email.html),
        );
        if (bodyResult.transactions.length > 0) {
          results.push(bodyResult);
        }
      } catch (error) {
        this.logger.warn(
          `Email body parsing failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // Strategy 2: Parse attachments
    for (const attachment of email.attachments || []) {
      try {
        const attachmentResult = await this.parseAttachment(attachment);
        if (attachmentResult && attachmentResult.transactions.length > 0) {
          results.push(attachmentResult);
        }
      } catch (error) {
        this.logger.warn(
          `Attachment parsing failed (${attachment.filename}): ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // Combine results
    if (results.length === 0) {
      return {
        transactions: [],
        bankName: this.detectBankFromEmail(email),
        accountNumber: null,
        currency: 'NGN',
      };
    }

    // Merge all results
    const allTransactions: RawParsedTransaction[] = [];
    let bankName: string | null = null;
    let currency: Currency = 'NGN';

    for (const result of results) {
      allTransactions.push(...result.transactions);
      if (result.bankName && !bankName) {
        bankName = result.bankName;
      }
      if (result.currency !== 'NGN') {
        currency = result.currency;
      }
    }

    this.logger.log(
      `Parsed ${allTransactions.length} transactions from email (${results.length} sources)`,
    );

    return {
      transactions: allTransactions,
      bankName,
      accountNumber: null,
      currency,
    };
  }

  /**
   * Parse email body using Claude
   */
  private async parseEmailBody(
    subject: string,
    body: string,
  ): Promise<ParseResult> {
    if (!this.anthropicService.isAvailable()) {
      throw new ImportParseException('AI service not available');
    }

    // Check if this looks like a bank alert
    if (!this.looksLikeBankAlert(subject, body)) {
      return {
        transactions: [],
        bankName: null,
        accountNumber: null,
        currency: 'NGN',
      };
    }

    const prompt = EMAIL_PARSING_PROMPT(subject, body);

    const response = await this.anthropicService.generateMessage(
      [{ role: 'user', content: prompt }],
      {
        maxTokens: PARSING_MAX_TOKENS,
        systemPrompt: EMAIL_ALERT_SYSTEM_PROMPT,
        timeoutMs: PARSING_TIMEOUT_MS,
      },
    );

    const parsed = this.parseClaudeResponse(response.content);

    return {
      transactions: this.validateTransactions(parsed.transactions),
      bankName: parsed.bankName,
      accountNumber: parsed.accountNumber,
      currency: this.normalizeCurrency(parsed.currency),
    };
  }

  /**
   * Parse email attachment (PDF or CSV)
   */
  private async parseAttachment(attachment: {
    filename: string;
    content_type: string;
    content: string;
  }): Promise<ParseResult | null> {
    const buffer = Buffer.from(attachment.content, 'base64');
    const mimeType = attachment.content_type.toLowerCase();
    const filename = attachment.filename.toLowerCase();

    // CSV attachment
    if (mimeType.includes('csv') || filename.endsWith('.csv')) {
      const csvContent = buffer.toString('utf-8');
      return this.csvParser.parse(csvContent);
    }

    // PDF attachment
    if (mimeType.includes('pdf') || filename.endsWith('.pdf')) {
      return this.pdfParser.parse(buffer);
    }

    // Unsupported attachment type
    this.logger.debug(`Skipping unsupported attachment: ${attachment.filename}`);
    return null;
  }

  /**
   * Check if email content looks like a bank alert
   */
  private looksLikeBankAlert(subject: string, body: string): boolean {
    const alertPatterns = [
      /debit\s*alert/i,
      /credit\s*alert/i,
      /transaction\s*alert/i,
      /account\s*notification/i,
      /payment\s*notification/i,
      /transfer\s*notification/i,
      /withdrawal/i,
      /deposit/i,
      /NGN\s*[\d,]+/i,
      /₦[\d,]+/i,
      /\d+\.\d{2}\s*(?:debited|credited)/i,
    ];

    const text = `${subject} ${body}`;
    return alertPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Detect bank from email sender/content
   */
  private detectBankFromEmail(email: ResendEmailContent): string | null {
    const text = `${email.from} ${email.subject} ${email.text || ''}`.toLowerCase();

    const bankPatterns: Record<string, RegExp> = {
      GTBank: /gtbank|guaranty\s*trust/i,
      'Access Bank': /access\s*bank|accessbank/i,
      'First Bank': /first\s*bank|firstbank/i,
      'Zenith Bank': /zenith/i,
      UBA: /uba|united\s*bank\s*for\s*africa/i,
      Kuda: /kuda/i,
      Opay: /opay/i,
      Moniepoint: /moniepoint/i,
    };

    for (const [bank, pattern] of Object.entries(bankPatterns)) {
      if (pattern.test(text)) {
        return bank;
      }
    }

    return null;
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parse Claude response JSON
   */
  private parseClaudeResponse(content: string): ClaudeEmailResponse {
    let jsonStr = content;

    // Remove markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Find JSON object
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        transactions: parsed.transactions || [],
        bankName: parsed.bankName || null,
        accountNumber: parsed.accountNumber || null,
        currency: parsed.currency || 'NGN',
      };
    } catch {
      this.logger.warn(`Failed to parse Claude response: ${content.substring(0, 200)}`);
      return {
        transactions: [],
        bankName: null,
        accountNumber: null,
        currency: 'NGN',
      };
    }
  }

  /**
   * Validate parsed transactions
   */
  private validateTransactions(
    transactions: ClaudeEmailResponse['transactions'],
  ): RawParsedTransaction[] {
    const valid: RawParsedTransaction[] = [];

    for (const txn of transactions) {
      if (!txn.date || !this.isValidDate(txn.date)) continue;
      if (typeof txn.amount !== 'number' || txn.amount === 0) continue;

      let amount = txn.amount;
      if (txn.type === 'debit' && amount > 0) {
        amount = -amount;
      } else if (txn.type === 'credit' && amount < 0) {
        amount = Math.abs(amount);
      }

      valid.push({
        date: txn.date,
        amount,
        description: txn.description || null,
        merchant: txn.merchant || null,
        isRecurring: txn.isRecurring || false,
        type: amount < 0 ? 'debit' : 'credit',
        reference: txn.reference,
      });
    }

    return valid;
  }

  /**
   * Validate date format
   */
  private isValidDate(dateStr: string): boolean {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  /**
   * Normalize currency string
   */
  private normalizeCurrency(currency: string): Currency {
    const normalized = currency?.toUpperCase();

    const currencyMap: Record<string, Currency> = {
      NGN: 'NGN',
      NAIRA: 'NGN',
      GHS: 'GHS',
      KES: 'KES',
      ZAR: 'ZAR',
      EGP: 'EGP',
      USD: 'USD',
    };

    return currencyMap[normalized] || 'NGN';
  }
}
