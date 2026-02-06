/**
 * PDF Parser Service
 *
 * Parses bank statement PDFs using pdf-parse for text extraction
 * and Claude for intelligent transaction parsing.
 *
 * This hybrid approach combines:
 * 1. pdf-parse - Fast, reliable text extraction from PDFs
 * 2. Claude - Semantic understanding to extract structured transactions
 */

import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { Currency } from '@prisma/client';
import { AnthropicService } from '../../ai/anthropic/anthropic.service';
import { RawParsedTransaction, ParseResult } from '../interfaces';
import { ImportPdfParseException } from '../exceptions';
import { SupportedBank } from '../dto';
import {
  BANK_STATEMENT_SYSTEM_PROMPT,
  PDF_PARSING_PROMPT,
} from '../constants/prompts';
import { PARSING_MAX_TOKENS, PARSING_TIMEOUT_MS } from '../constants';

/**
 * Expected JSON structure from Claude
 */
interface ClaudeParseResponse {
  transactions: Array<{
    date: string;
    amount: number;
    description: string | null;
    merchant: string | null;
    isRecurring: boolean;
    type: 'debit' | 'credit';
  }>;
  bankName: string | null;
  accountNumber: string | null;
  currency: string;
  statementPeriod?: {
    start: string;
    end: string;
  };
}

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  constructor(private readonly anthropicService: AnthropicService) {}

  /**
   * Parse PDF file and extract transactions
   */
  async parse(
    pdfBuffer: Buffer,
    bankName?: SupportedBank,
  ): Promise<ParseResult> {
    try {
      // Step 1: Extract text from PDF
      const text = await this.extractTextFromPdf(pdfBuffer);

      if (!text || text.trim().length < 50) {
        throw new ImportPdfParseException(
          'PDF appears to be empty or contains no extractable text. The file may be scanned/image-based.',
        );
      }

      this.logger.debug(`Extracted ${text.length} characters from PDF`);

      // Step 2: Use Claude to parse transactions
      const parseResult = await this.parseWithClaude(text, bankName);

      return parseResult;
    } catch (error) {
      if (error instanceof ImportPdfParseException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`PDF parsing failed: ${message}`);
      throw new ImportPdfParseException(message);
    }
  }

  /**
   * Extract text from PDF using pdf-parse v2
   */
  private async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: pdfBuffer });
      const result = await parser.getText();

      // Combine text from all pages (limit to first 50 pages)
      const pagesToProcess = result.pages.slice(0, 50);
      const text = pagesToProcess
        .map((page) => page.text)
        .join('\n\n');

      // Clean up
      await parser.destroy();

      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ImportPdfParseException(`Failed to extract text from PDF: ${message}`);
    }
  }

  /**
   * Use Claude to intelligently parse transactions from text
   */
  private async parseWithClaude(
    text: string,
    bankName?: SupportedBank,
  ): Promise<ParseResult> {
    if (!this.anthropicService.isAvailable()) {
      throw new ImportPdfParseException(
        'AI service is not available. Please try again later.',
      );
    }

    try {
      // Truncate text if too long (Claude has context limits)
      const maxTextLength = 50000; // ~12k tokens
      const truncatedText = text.length > maxTextLength
        ? text.substring(0, maxTextLength) + '\n...[truncated]'
        : text;

      const prompt = PDF_PARSING_PROMPT(truncatedText, bankName);

      const response = await this.anthropicService.generateMessage(
        [{ role: 'user', content: prompt }],
        {
          maxTokens: PARSING_MAX_TOKENS,
          systemPrompt: BANK_STATEMENT_SYSTEM_PROMPT,
          timeoutMs: PARSING_TIMEOUT_MS,
        },
      );

      // Parse Claude's JSON response
      const parsed = this.parseClaudeResponse(response.content);

      // Validate and transform transactions
      const transactions = this.validateTransactions(parsed.transactions);

      this.logger.log(
        `Claude parsed ${transactions.length} transactions from PDF`,
      );

      return {
        transactions,
        bankName: parsed.bankName || (bankName as string) || null,
        accountNumber: parsed.accountNumber,
        currency: this.normalizeCurrency(parsed.currency),
        statementPeriod: parsed.statementPeriod,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Claude parsing failed: ${message}`);
      throw new ImportPdfParseException(`AI parsing failed: ${message}`);
    }
  }

  /**
   * Parse and validate Claude's JSON response
   */
  private parseClaudeResponse(content: string): ClaudeParseResponse {
    // Extract JSON from response (Claude might include markdown code blocks)
    let jsonStr = content;

    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object directly
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
        throw new Error('Missing or invalid transactions array');
      }

      return {
        transactions: parsed.transactions || [],
        bankName: parsed.bankName || null,
        accountNumber: parsed.accountNumber || null,
        currency: parsed.currency || 'NGN',
        statementPeriod: parsed.statementPeriod,
      };
    } catch (error) {
      this.logger.error(`Failed to parse Claude response as JSON: ${content.substring(0, 500)}`);
      throw new ImportPdfParseException(
        'AI returned invalid response format. Please try again.',
      );
    }
  }

  /**
   * Validate and clean up parsed transactions
   */
  private validateTransactions(
    transactions: ClaudeParseResponse['transactions'],
  ): RawParsedTransaction[] {
    const valid: RawParsedTransaction[] = [];

    for (const txn of transactions) {
      // Validate date
      if (!txn.date || !this.isValidDate(txn.date)) {
        this.logger.debug(`Skipping transaction with invalid date: ${txn.date}`);
        continue;
      }

      // Validate amount
      if (typeof txn.amount !== 'number' || txn.amount === 0) {
        this.logger.debug(`Skipping transaction with invalid amount: ${txn.amount}`);
        continue;
      }

      // Ensure debits are negative
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
      });
    }

    return valid;
  }

  /**
   * Check if date string is valid YYYY-MM-DD format
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
   * Normalize currency string to Currency enum
   */
  private normalizeCurrency(currency: string): Currency {
    const normalized = currency?.toUpperCase();

    const currencyMap: Record<string, Currency> = {
      NGN: 'NGN',
      NAIRA: 'NGN',
      '₦': 'NGN',
      GHS: 'USD',
      CEDI: 'USD',
      KES: 'USD',
      SHILLING: 'USD',
      ZAR: 'USD',
      RAND: 'USD',
      EGP: 'USD',
      USD: 'USD',
    };

    return currencyMap[normalized] || 'NGN';
  }
}
