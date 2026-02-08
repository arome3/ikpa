/**
 * Anthropic Service Interfaces
 *
 * Type definitions for Claude API interactions.
 */

import Anthropic from '@anthropic-ai/sdk';

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

/**
 * Image input for Vision API
 */
export interface VisionImage {
  /** Image data as Buffer */
  data: Buffer;
  /** MIME type (e.g., 'image/png', 'image/jpeg') */
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

/**
 * Options for generateWithVision calls
 */
export interface GenerateVisionOptions {
  /** Maximum tokens in response */
  maxTokens: number;
  /** System prompt */
  systemPrompt?: string;
  /** Custom timeout in ms (overrides default) */
  timeoutMs?: number;
}

/**
 * Content block types for multi-modal messages
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: ImageSource };

/**
 * Image source for Anthropic API
 */
export interface ImageSource {
  type: 'base64';
  media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
  data: string; // Base64 encoded
}

/**
 * Multi-modal message with text and images
 */
export interface AnthropicVisionMessage {
  role: MessageRole;
  content: ContentBlock[];
}

/**
 * Response from Anthropic API with raw content blocks (for tool_use)
 *
 * Unlike AnthropicResponse which extracts text, this preserves the
 * full content array so callers can process tool_use blocks in an
 * agentic loop.
 */
export interface ToolUseResponse {
  /** Raw content blocks — may contain text and/or tool_use blocks */
  content: Anthropic.ContentBlock[];
  /** Token usage for this turn */
  usage: TokenUsage;
  /** Model that generated the response */
  model: string;
  /** Stop reason — 'tool_use' means Claude wants to call tools, 'end_turn' means done */
  stopReason: string | null;
}

/**
 * Message content for tool_use conversations
 * Supports string content, content blocks, and tool_result arrays
 */
export type ToolUseMessageContent =
  | string
  | Anthropic.ContentBlockParam[];

/**
 * Message format for tool_use conversations
 */
export interface ToolUseMessage {
  role: MessageRole;
  content: ToolUseMessageContent;
}

/**
 * Options for generateWithTools calls
 */
export interface GenerateWithToolsOptions {
  /** Maximum tokens in response */
  maxTokens: number;
  /** System prompt */
  systemPrompt?: string;
  /** Custom timeout in ms (overrides default) */
  timeoutMs?: number;
  /** Tool definitions for Claude */
  tools: Anthropic.Tool[];
}
