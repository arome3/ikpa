/**
 * Anthropic Service Interfaces
 *
 * Type definitions for Claude API interactions.
 */

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
 * Token usage statistics from LLM calls
 */
export interface TokenUsage {
  /** Tokens in the prompt */
  promptTokens: number;
  /** Tokens in the response */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker status for health checks
 */
export interface CircuitBreakerStatus {
  state: CircuitState;
  failureCount: number;
}

/**
 * Options for generateMessage calls
 */
export interface GenerateMessageOptions {
  /** Maximum tokens in response */
  maxTokens: number;
  /** System prompt */
  systemPrompt?: string;
  /** Custom timeout in ms (overrides default) */
  timeoutMs?: number;
}
