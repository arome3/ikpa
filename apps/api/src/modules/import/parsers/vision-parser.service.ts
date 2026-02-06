/**
 * Vision Parser Service
 *
 * Uses Claude Vision API to extract transactions from banking screenshots.
 * Supports mobile banking app screenshots, receipts, and SMS alerts.
 *
 * Claude Vision achieves ~97% accuracy on receipts according to 2026 benchmarks.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { AnthropicService } from '../../ai/anthropic/anthropic.service';
import { VisionImage } from '../../ai/anthropic/interfaces';
import { RawParsedTransaction, ParseResult } from '../interfaces';
import { ImportVisionException } from '../exceptions';
import {
  SCREENSHOT_OCR_SYSTEM_PROMPT,
  SCREENSHOT_PARSING_PROMPT,
} from '../constants/prompts';
import { VISION_MAX_TOKENS, PARSING_TIMEOUT_MS } from '../constants';

/**
 * Expected JSON structure from Claude Vision
 */
interface ClaudeVisionResponse {
  transactions: Array<{
    date: string;
    amount: number;
    description: string | null;
    merchant: string | null;
    isRecurring: boolean;
    type: 'debit' | 'credit';
    confidence: number;
  }>;
  appName: string | null;
  currency: string;
  errors?: string[];
}

/**
 * Supported image MIME types
 */
type SupportedMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

@Injectable()
export class VisionParserService {
  private readonly logger = new Logger(VisionParserService.name);

  constructor(private readonly anthropicService: AnthropicService) {}

  /**
   * Parse screenshots and extract transactions
   */
  async parse(
    images: Array<{ buffer: Buffer; mimeType: string }>,
  ): Promise<ParseResult> {
    try {
      // Validate and convert images
      const visionImages = images.map((img, index) =>
        this.prepareImage(img.buffer, img.mimeType, index),
      );

      if (visionImages.length === 0) {
        throw new ImportVisionException('No valid images to process');
      }

      // Use Claude Vision to analyze images
      const parseResult = await this.analyzeWithVision(visionImages);

      return parseResult;
    } catch (error) {
      if (error instanceof ImportVisionException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Vision parsing failed: ${message}`);
      throw new ImportVisionException(message);
    }
  }

  /**
   * Prepare and validate an image for Vision API
   */
  private prepareImage(
    buffer: Buffer,
    mimeType: string,
    index: number,
  ): VisionImage {
    // Validate MIME type
    const supportedTypes: SupportedMimeType[] = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
    ];

    // Map common variations
    const mimeMapping: Record<string, SupportedMimeType> = {
      'image/png': 'image/png',
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg',
      'image/gif': 'image/gif',
      'image/webp': 'image/webp',
    };

    const normalizedMime = mimeMapping[mimeType.toLowerCase()];

    if (!normalizedMime || !supportedTypes.includes(normalizedMime)) {
      throw new ImportVisionException(
        `Image ${index + 1} has unsupported type: ${mimeType}. Supported: PNG, JPEG, GIF, WebP`,
      );
    }

    // Validate buffer is not empty
    if (!buffer || buffer.length === 0) {
      throw new ImportVisionException(`Image ${index + 1} is empty`);
    }

    // Validate buffer size (max 20MB per Claude docs)
    const maxSize = 20 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new ImportVisionException(
        `Image ${index + 1} is too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB). Maximum: 20MB`,
      );
    }

    return {
      data: buffer,
      mimeType: normalizedMime,
    };
  }

  /**
   * Use Claude Vision API to analyze screenshots
   */
  private async analyzeWithVision(images: VisionImage[]): Promise<ParseResult> {
    if (!this.anthropicService.isAvailable()) {
      throw new ImportVisionException(
        'AI service is not available. Please try again later.',
      );
    }

    try {
      const prompt = SCREENSHOT_PARSING_PROMPT(images.length);

      const response = await this.anthropicService.generateWithVision(
        prompt,
        images,
        {
          maxTokens: VISION_MAX_TOKENS,
          systemPrompt: SCREENSHOT_OCR_SYSTEM_PROMPT,
          timeoutMs: PARSING_TIMEOUT_MS,
        },
      );

      // Parse Claude's JSON response
      const parsed = this.parseVisionResponse(response.content);

      // Log any OCR errors
      if (parsed.errors && parsed.errors.length > 0) {
        this.logger.warn(`Vision OCR warnings: ${parsed.errors.join(', ')}`);
      }

      // Validate and transform transactions
      const transactions = this.validateTransactions(parsed.transactions);

      this.logger.log(
        `Vision parsed ${transactions.length} transactions from ${images.length} images`,
      );

      return {
        transactions,
        bankName: parsed.appName,
        accountNumber: null,
        currency: this.normalizeCurrency(parsed.currency),
        errors: parsed.errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Claude Vision parsing failed: ${message}`);
      throw new ImportVisionException(`AI vision parsing failed: ${message}`);
    }
  }

  /**
   * Parse and validate Claude Vision's JSON response
   */
  private parseVisionResponse(content: string): ClaudeVisionResponse {
    // Extract JSON from response
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
        appName: parsed.appName || null,
        currency: parsed.currency || 'NGN',
        errors: parsed.errors || [],
      };
    } catch (error) {
      this.logger.error(`Failed to parse Vision response as JSON: ${content.substring(0, 500)}`);
      throw new ImportVisionException(
        'AI returned invalid response format. Please try again with clearer screenshots.',
      );
    }
  }

  /**
   * Validate and clean up parsed transactions
   */
  private validateTransactions(
    transactions: ClaudeVisionResponse['transactions'],
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

      // Skip low-confidence transactions
      const confidence = txn.confidence ?? 0.5;
      if (confidence < 0.3) {
        this.logger.debug(`Skipping low-confidence transaction: ${confidence}`);
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
        confidence,
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
