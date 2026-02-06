/**
 * Trace Interfaces for Opik Integration
 *
 * These interfaces define the contracts for creating and managing
 * distributed traces across IKPA's AI agents.
 */

/**
 * Span types supported by Opik
 *
 * @description
 * - `llm`: For LLM API calls (Claude, OpenAI, etc.)
 * - `tool`: For tool executions (calculations, data processing)
 * - `retrieval`: For data fetching operations (database, API calls)
 * - `general`: For other operations that don't fit the above categories
 */
export type SpanType = 'llm' | 'tool' | 'retrieval' | 'general';

/**
 * LLM Provider identifiers
 */
export type LLMProvider = 'anthropic' | 'openai' | 'cohere' | 'google' | 'custom';

/**
 * Token usage tracking for LLM calls
 *
 * Used to track token consumption for cost analysis and optimization.
 */
export interface TokenUsage {
  /** Number of tokens in the prompt/input */
  promptTokens: number;

  /** Number of tokens in the completion/output */
  completionTokens: number;

  /** Total tokens used (prompt + completion) */
  totalTokens: number;
}

/**
 * Input for creating a new trace
 *
 * @example
 * ```typescript
 * const input: CreateTraceInput = {
 *   name: 'shark_audit_cognitive_chain',
 *   input: { userId: 'user-123', action: 'audit' },
 *   metadata: { agent: 'shark_auditor', version: '1.0' },
 *   tags: ['production', 'financial-coach'],
 * };
 * ```
 */
export interface CreateTraceInput {
  /** Unique name for the trace (e.g., 'shark_audit_cognitive_chain') */
  name: string;

  /** Input data that initiated this trace */
  input: Record<string, unknown>;

  /** Optional metadata to attach to the trace */
  metadata?: Record<string, unknown>;

  /** Optional tags for filtering traces in the dashboard */
  tags?: string[];
}

/**
 * Input for creating an agent-specific trace
 *
 * Automatically generates trace name following the pattern: `{agentName}_cognitive_chain`
 *
 * @example
 * ```typescript
 * const input: CreateAgentTraceInput = {
 *   agentName: 'shark_auditor',
 *   userId: 'user-123',
 *   input: { action: 'audit_subscriptions' },
 *   metadata: { triggerSource: 'scheduled' },
 * };
 * // Creates trace named: 'shark_auditor_cognitive_chain'
 * ```
 */
export interface CreateAgentTraceInput {
  /** Agent name (e.g., 'shark_auditor', 'cashflow_guardian', 'nudge_agent') */
  agentName: string;

  /** User ID for the trace */
  userId: string;

  /** Input data that initiated this trace */
  input: Record<string, unknown>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Opik Trace type from the SDK
 *
 * This is the raw trace object returned by Opik client.trace()
 * We define it here to avoid tight coupling with the Opik SDK types.
 */
export interface OpikTrace {
  /** Unique trace ID */
  id?: string;

  /** Create a child span within this trace */
  span(options: {
    name: string;
    type?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): OpikSpan;

  /** End the trace with final output */
  end(options?: { output?: Record<string, unknown> }): void;
}

/**
 * Opik Span type from the SDK
 *
 * This is the raw span object returned by trace.span()
 */
export interface OpikSpan {
  /** Unique span ID */
  id?: string;

  /** Create a nested child span within this span */
  span(options: {
    name: string;
    type?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): OpikSpan;

  /** End the span with output and metadata */
  end(options?: {
    output?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): void;
}

/**
 * Trace wrapper with helper properties
 *
 * Wraps the raw Opik trace with additional tracking information
 * for duration calculation and reference.
 */
export interface TrackedTrace {
  /** The underlying Opik trace instance */
  trace: OpikTrace;

  /** Unique trace ID for correlation */
  traceId: string;

  /** Trace name for reference */
  traceName: string;

  /** Start timestamp for duration tracking */
  startedAt: Date;
}

/**
 * Output for ending a trace
 *
 * @example
 * ```typescript
 * // Success case
 * const output: EndTraceOutput = {
 *   success: true,
 *   result: { subscriptionsReviewed: 5, potentialSavings: 15000 },
 * };
 *
 * // Error case
 * const output: EndTraceOutput = {
 *   success: false,
 *   error: 'Failed to fetch user transactions',
 * };
 * ```
 */
export interface EndTraceOutput {
  /** Whether the traced operation was successful */
  success: boolean;

  /** Result data from the operation (if successful) */
  result?: Record<string, unknown>;

  /** Error message if operation failed */
  error?: string;
}

// ==========================================
// FEEDBACK & SCORING INTERFACES
// ==========================================

/**
 * Feedback category types for LLM-as-Judge evaluations
 */
export type FeedbackCategory =
  | 'quality'
  | 'relevance'
  | 'accuracy'
  | 'helpfulness'
  | 'safety'
  | 'coherence'
  | 'evolution'
  | 'adaptive'
  | 'performance'
  | 'engagement'
  | 'custom';

/**
 * Input for adding feedback to a trace
 *
 * Used for LLM-as-Judge evaluation metrics.
 *
 * @example
 * ```typescript
 * const feedback: AddFeedbackInput = {
 *   traceId: 'trace-123',
 *   name: 'response_quality',
 *   value: 0.85,
 *   category: 'quality',
 *   comment: 'Response was accurate and well-structured',
 *   source: 'llm_judge',
 * };
 * ```
 */
export interface AddFeedbackInput {
  /** The trace ID to add feedback to */
  traceId: string;

  /** Feedback metric name (e.g., 'response_quality', 'factual_accuracy') */
  name: string;

  /** Score value (typically 0-1 for normalized scores) */
  value: number;

  /** Category of feedback */
  category?: FeedbackCategory;

  /** Optional comment explaining the score */
  comment?: string;

  /** Source of feedback (e.g., 'llm_judge', 'human', 'automated') */
  source?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Input for adding a score to a span
 *
 * @example
 * ```typescript
 * const score: AddSpanScoreInput = {
 *   spanId: 'span-456',
 *   name: 'latency',
 *   value: 1.5,
 *   unit: 'seconds',
 * };
 * ```
 */
export interface AddSpanScoreInput {
  /** The span ID to add score to */
  spanId: string;

  /** Score/metric name */
  name: string;

  /** Score value */
  value: number;

  /** Optional unit of measurement */
  unit?: string;

  /** Optional comment */
  comment?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Sampling configuration for traces
 *
 * @example
 * ```typescript
 * const sampling: SamplingConfig = {
 *   enabled: true,
 *   rate: 0.1, // Sample 10% of traces
 *   rules: [
 *     { match: { agent: 'shark_auditor' }, rate: 1.0 }, // Always sample shark_auditor
 *     { match: { environment: 'production' }, rate: 0.05 }, // 5% in production
 *   ],
 * };
 * ```
 */
export interface SamplingConfig {
  /** Whether sampling is enabled */
  enabled: boolean;

  /** Default sampling rate (0-1, where 1 = 100%) */
  rate: number;

  /** Optional rules for conditional sampling (evaluated in order, first match wins) */
  rules?: SamplingRule[];
}

/**
 * A single sampling rule for conditional sampling
 *
 * Rules are evaluated in order. The first matching rule determines the sampling rate.
 * If no rules match, the default rate is used.
 */
export interface SamplingRule {
  /** Human-readable name for the rule */
  name?: string;

  /** Metadata fields to match (all must match for rule to apply) */
  match: Record<string, unknown>;

  /** Sampling rate for matching traces (0-1) */
  rate: number;

  /** Optional: only apply this rule for specific trace names (regex pattern) */
  traceNamePattern?: string;
}

/**
 * Input for creating multiple spans in a batch
 *
 * @example
 * ```typescript
 * const spans = opikService.createSpanBatch({
 *   trace: trackedTrace.trace,
 *   spans: [
 *     { name: 'fetch_data', type: 'retrieval', input: { query: '...' } },
 *     { name: 'process_data', type: 'tool', input: { data: '...' } },
 *   ],
 * });
 * ```
 */
export interface CreateSpanBatchInput {
  /** The parent trace */
  trace: OpikTrace;

  /** Array of spans to create */
  spans: Array<{
    /** Span name */
    name: string;

    /** Span type */
    type: SpanType;

    /** Input data */
    input: Record<string, unknown>;

    /** Optional metadata */
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Input for ending multiple spans in a batch
 */
export interface EndSpanBatchInput {
  /** Array of spans with their outputs */
  spans: Array<{
    /** The span to end */
    span: import('./span.interface').TrackedSpan;

    /** Output data */
    output: Record<string, unknown>;

    /** Optional metadata */
    metadata?: Record<string, unknown>;
  }>;
}
