/**
 * Span Interfaces for Opik Integration
 *
 * These interfaces define the contracts for creating and managing
 * spans within traces. Spans represent individual operations in a
 * cognitive chain (LLM calls, tool executions, data retrieval).
 */

import { LLMProvider, OpikSpan, OpikTrace, SpanType, TokenUsage } from './trace.interface';

/**
 * Input for creating an LLM span
 *
 * Use this for tracking AI model API calls (Claude, OpenAI, etc.)
 *
 * @example
 * ```typescript
 * const input: CreateLLMSpanInput = {
 *   trace: trackedTrace.trace,
 *   name: 'generate_framing',
 *   input: { prompt: 'Analyze subscriptions...', subscriptions: [...] },
 *   model: 'claude-sonnet-4-20250514',
 *   provider: 'anthropic',
 *   metadata: { temperature: 0.7 },
 * };
 * ```
 */
export interface CreateLLMSpanInput {
  /** The parent trace */
  trace: OpikTrace;

  /** Span name (e.g., 'generate_framing', 'analyze_sentiment') */
  name: string;

  /** Input to the LLM (prompt, messages, etc.) */
  input: Record<string, unknown>;

  /** LLM model identifier (e.g., 'claude-sonnet-4-20250514', 'gpt-4') */
  model: string;

  /** LLM provider */
  provider: LLMProvider;

  /** Optional metadata (e.g., temperature, max_tokens) */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a tool execution span
 *
 * Use this for tracking tool executions like calculations,
 * data processing, or business logic operations.
 *
 * @example
 * ```typescript
 * const input: CreateToolSpanInput = {
 *   trace: trackedTrace.trace,
 *   name: 'calculate_savings_potential',
 *   input: { subscriptions: [...], annualize: true },
 *   metadata: { algorithm: 'compound_interest' },
 * };
 * ```
 */
export interface CreateToolSpanInput {
  /** The parent trace */
  trace: OpikTrace;

  /** Span name (e.g., 'transaction_analysis', 'calculate_savings') */
  name: string;

  /** Input to the tool */
  input: Record<string, unknown>;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a retrieval span
 *
 * Use this for tracking data fetching operations like
 * database queries, API calls, or knowledge base searches.
 *
 * @example
 * ```typescript
 * const input: CreateRetrievalSpanInput = {
 *   trace: trackedTrace.trace,
 *   name: 'fetch_user_transactions',
 *   query: { userId: 'user-123', type: 'recurring', limit: 100 },
 *   metadata: { source: 'postgres', table: 'transactions' },
 * };
 * ```
 */
export interface CreateRetrievalSpanInput {
  /** The parent trace */
  trace: OpikTrace;

  /** Span name (e.g., 'fetch_user_transactions', 'search_knowledge_base') */
  name: string;

  /** Search query or retrieval parameters */
  query: Record<string, unknown>;

  /** Optional metadata (e.g., source, filters) */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a general span
 *
 * Use this for operations that don't fit LLM, tool, or retrieval categories.
 *
 * @example
 * ```typescript
 * const input: CreateGeneralSpanInput = {
 *   trace: trackedTrace.trace,
 *   name: 'await_user_decision',
 *   input: { options: ['keep', 'cancel', 'skip'] },
 * };
 * ```
 */
export interface CreateGeneralSpanInput {
  /** The parent trace */
  trace: OpikTrace;

  /** Span name */
  name: string;

  /** Input data */
  input: Record<string, unknown>;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Output for ending an LLM span
 *
 * @example
 * ```typescript
 * const output: EndLLMSpanOutput = {
 *   output: { response: 'Based on your spending patterns...', confidence: 0.95 },
 *   usage: { promptTokens: 150, completionTokens: 200, totalTokens: 350 },
 *   metadata: { finishReason: 'end_turn' },
 * };
 * ```
 */
export interface EndLLMSpanOutput {
  /** LLM response/output */
  output: Record<string, unknown>;

  /** Token usage statistics */
  usage?: TokenUsage;

  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Output for ending a tool/retrieval/general span
 *
 * @example
 * ```typescript
 * const output: EndSpanOutput = {
 *   output: { transactions: [...], count: 15 },
 *   metadata: { queryTimeMs: 45 },
 * };
 * ```
 */
export interface EndSpanOutput {
  /** Operation result */
  output: Record<string, unknown>;

  /** Optional metadata (e.g., duration, count) */
  metadata?: Record<string, unknown>;
}

/**
 * Span wrapper with timing information
 *
 * Wraps the raw Opik span with additional tracking information
 * for automatic duration calculation.
 */
export interface TrackedSpan {
  /** The underlying Opik span */
  span: OpikSpan;

  /** Unique span ID for correlation */
  spanId: string;

  /** Parent trace ID for correlation */
  traceId: string;

  /** Parent span ID (if nested) */
  parentSpanId?: string;

  /** Span name for reference */
  name: string;

  /** Span type */
  type: SpanType;

  /** Start timestamp for duration calculation */
  startedAt: Date;
}

/**
 * Input for creating a nested span within another span
 *
 * @example
 * ```typescript
 * const input: CreateNestedSpanInput = {
 *   parentSpan: parentTrackedSpan,
 *   name: 'nested_operation',
 *   type: 'tool',
 *   input: { data: 'value' },
 * };
 * ```
 */
export interface CreateNestedSpanInput {
  /** The parent span to nest under */
  parentSpan: TrackedSpan;

  /** Span name */
  name: string;

  /** Span type */
  type: SpanType;

  /** Input data */
  input: Record<string, unknown>;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}
