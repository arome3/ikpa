/**
 * Anthropic Service
 *
 * Reusable wrapper for Claude API interactions.
 * Features:
 * - Graceful degradation when API key is not configured
 * - Exponential backoff retry for transient failures
 * - Circuit breaker pattern for sustained failures
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_ANTHROPIC_MODEL } from '../constants';
import { AnthropicServiceUnavailableException } from '../exceptions';
import { TokenUsage } from '../interfaces';

// ==========================================
// RETRY CONFIGURATION
// ==========================================

/** Maximum number of retry attempts */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const RETRY_BASE_DELAY_MS = 1000;

/** Maximum delay between retries (ms) */
const MAX_RETRY_DELAY_MS = 10000;

/** Circuit breaker: failures before opening circuit */
const CIRCUIT_BREAKER_THRESHOLD = 5;

/** Circuit breaker: time to wait before half-open (ms) */
const CIRCUIT_BREAKER_RESET_MS = 60000;

/** Default timeout for API calls (ms) - 90 seconds for letter generation */
const DEFAULT_API_TIMEOUT_MS = 90000;

// ==========================================
// TYPES
// ==========================================

/**
 * Message role for Anthropic API
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Input message for Anthropic API
 */
export interface AnthropicMessage {
  role: MessageRole;
  content: string;
}

/**
 * Response from Anthropic API
 */
export interface AnthropicResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  stopReason: string | null;
}

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open';

@Injectable()
export class AnthropicService implements OnModuleInit {
  private readonly logger = new Logger(AnthropicService.name);
  private client: Anthropic | null = null;
  private model: string = DEFAULT_ANTHROPIC_MODEL;
  private isEnabled = false;

  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize Anthropic client on module startup
   */
  onModuleInit(): void {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured. Future Self letter generation will be unavailable.',
      );
      return;
    }

    try {
      this.client = new Anthropic({ apiKey });
      this.model = this.configService.get<string>(
        'ANTHROPIC_MODEL',
        DEFAULT_ANTHROPIC_MODEL,
      );
      this.isEnabled = true;
      this.logger.log(`Anthropic client initialized with model: ${this.model}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize Anthropic client: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if the Anthropic service is available
   */
  isAvailable(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Get the configured model name
   */
  getModel(): string {
    return this.model;
  }

  // ==========================================
  // CIRCUIT BREAKER LOGIC
  // ==========================================

  /**
   * Check if circuit breaker allows requests
   */
  private isCircuitOpen(): boolean {
    if (this.circuitState === 'closed') {
      return false;
    }

    if (this.circuitState === 'open') {
      // Check if enough time has passed to try again (half-open)
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= CIRCUIT_BREAKER_RESET_MS) {
        this.circuitState = 'half-open';
        this.logger.log('Circuit breaker entering half-open state');
        return false;
      }
      return true;
    }

    // Half-open: allow one request through
    return false;
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    if (this.circuitState === 'half-open') {
      this.circuitState = 'closed';
      this.failureCount = 0;
      this.logger.log('Circuit breaker closed after successful request');
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === 'half-open') {
      this.circuitState = 'open';
      this.logger.warn('Circuit breaker opened after half-open failure');
    } else if (
      this.circuitState === 'closed' &&
      this.failureCount >= CIRCUIT_BREAKER_THRESHOLD
    ) {
      this.circuitState = 'open';
      this.logger.warn(
        `Circuit breaker opened after ${this.failureCount} consecutive failures`,
      );
    }
  }

  // ==========================================
  // RETRY LOGIC
  // ==========================================

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Anthropic.APIError) {
      // Retry on rate limits, server errors, and timeouts
      const retryableStatuses = [429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.status);
    }

    // Retry on network errors and timeouts
    if (error instanceof Error) {
      const retryablePatterns = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'timed out', // Our timeout wrapper
        'timeout',
        'socket hang up',
      ];
      return retryablePatterns.some((pattern) =>
        error.message.toLowerCase().includes(pattern.toLowerCase()),
      );
    }

    return false;
  }

  /**
   * Calculate delay for exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, ...
    const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 500;
    return Math.min(delay + jitter, MAX_RETRY_DELAY_MS);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wrap a promise with a timeout
   *
   * @param promise - The promise to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @param operation - Name of the operation for error messages
   * @returns The promise result or throws on timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  /**
   * Generate a message using Claude with retry and circuit breaker
   *
   * @param messages - Array of messages for the conversation
   * @param maxTokens - Maximum tokens in the response
   * @param systemPrompt - Optional system prompt
   * @returns The response from Claude
   * @throws AnthropicServiceUnavailableException if service is not available
   */
  async generateMessage(
    messages: AnthropicMessage[],
    maxTokens: number,
    systemPrompt?: string,
  ): Promise<AnthropicResponse> {
    if (!this.isAvailable()) {
      throw new AnthropicServiceUnavailableException();
    }

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      this.logger.warn('Circuit breaker is open, rejecting request');
      throw new AnthropicServiceUnavailableException();
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Wrap API call with timeout to prevent hanging requests
        const response = await this.withTimeout(
          this.client!.messages.create({
            model: this.model,
            max_tokens: maxTokens,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            ...(systemPrompt && { system: systemPrompt }),
          }),
          DEFAULT_API_TIMEOUT_MS,
          'Anthropic API call',
        );

        // Extract text content from response
        const textContent = response.content.find((c) => c.type === 'text');
        const content = textContent?.type === 'text' ? textContent.text : '';

        // Record success for circuit breaker
        this.recordSuccess();

        return {
          content,
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
          model: response.model,
          stopReason: response.stop_reason,
        };
      } catch (error) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === MAX_RETRIES) {
          this.logger.error(
            `Anthropic API error (attempt ${attempt}/${MAX_RETRIES}, non-retryable): ${errorMessage}`,
          );
          this.recordFailure();
          break;
        }

        // Calculate backoff delay
        const delay = this.getRetryDelay(attempt);
        this.logger.warn(
          `Anthropic API error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms: ${errorMessage}`,
        );

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    if (lastError instanceof Anthropic.APIError) {
      if (lastError.status === 429) {
        throw new AnthropicServiceUnavailableException();
      }
    }

    throw lastError;
  }

  /**
   * Simple helper for single-turn generation
   */
  async generate(
    prompt: string,
    maxTokens: number,
    systemPrompt?: string,
  ): Promise<AnthropicResponse> {
    return this.generateMessage(
      [{ role: 'user', content: prompt }],
      maxTokens,
      systemPrompt,
    );
  }

  /**
   * Get circuit breaker status (for health checks)
   */
  getCircuitStatus(): { state: CircuitState; failureCount: number } {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
    };
  }
}
