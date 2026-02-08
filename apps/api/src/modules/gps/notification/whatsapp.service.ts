/**
 * WhatsApp Service
 *
 * Handles WhatsApp message delivery via Twilio.
 * Mirrors the EmailService pattern: graceful degradation when
 * credentials are missing, exponential backoff retry.
 *
 * @module WhatsAppService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';

/**
 * WhatsApp sending result
 */
export interface WhatsAppResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly client: Twilio.Twilio | null;
  private readonly fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn(
        'TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN not configured - WhatsApp messages will be logged only',
      );
      this.client = null;
    } else {
      this.client = Twilio(accountSid, authToken);
    }

    this.fromNumber =
      this.configService.get<string>('TWILIO_WHATSAPP_FROM') ||
      'whatsapp:+14155238886';
  }

  /**
   * Send a WhatsApp message
   *
   * @param to - Recipient phone number in E.164 format (e.g., +2348012345678)
   * @param body - Plain text message body
   * @returns Send result
   */
  async sendMessage(to: string, body: string): Promise<WhatsAppResult> {
    // Dev/log-only mode when Twilio is not configured
    if (!this.client) {
      this.logger.log(`[DEV] WhatsApp to ${to}: ${body.substring(0, 200)}...`);
      return { success: true, messageSid: 'dev-mode-' + Date.now() };
    }

    const maxRetries = 3;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const message = await this.client.messages.create({
          from: this.fromNumber,
          to: `whatsapp:${to}`,
          body,
        });

        if (attempt > 1) {
          this.logger.log(
            `WhatsApp to ${to} succeeded after ${attempt} attempts`,
          );
        } else {
          this.logger.debug(`WhatsApp sent to ${to}: ${message.sid}`);
        }

        return { success: true, messageSid: message.sid };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const isRetryable = this.isRetryableError(errorMessage);

        if (isRetryable && attempt < maxRetries) {
          lastError = errorMessage;
          const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          this.logger.warn(
            `WhatsApp to ${to} failed (attempt ${attempt}/${maxRetries}): ${errorMessage}. Retrying in ${delayMs}ms...`,
          );
          await this.delay(delayMs);
          continue;
        }

        this.logger.error(`Failed to send WhatsApp to ${to}: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    }

    // All retries exhausted
    this.logger.error(
      `Failed to send WhatsApp to ${to} after ${maxRetries} attempts: ${lastError}`,
    );
    return { success: false, error: lastError || 'Max retries exceeded' };
  }

  /**
   * Check if an error is retryable (transient failure)
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      'rate limit',
      'too many requests',
      'timeout',
      'temporarily unavailable',
      'service unavailable',
      '429',
      '502',
      '503',
      '504',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
    ];

    const lowerMessage = errorMessage.toLowerCase();
    return retryablePatterns.some((pattern) =>
      lowerMessage.includes(pattern.toLowerCase()),
    );
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
