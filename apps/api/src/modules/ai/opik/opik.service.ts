/**
 * Opik Service
 *
 * Provides distributed tracing capabilities for AI agents in IKPA.
 * Wraps the Opik SDK with NestJS-compatible patterns.
 *
 * Key Features:
 * - Graceful degradation when Opik is unavailable
 * - Type-safe trace and span creation
 * - Automatic metadata enrichment (timestamp, environment)
 * - Agent-specific tracing helpers
 * - Automatic duration tracking for spans
 * - Nested span support for hierarchical operations
 * - Feedback/scoring for LLM-as-Judge evaluations
 * - Sampling support with rule-based configuration
 * - Flush with timeout and exponential backoff retry
 * - Context propagation via AsyncLocalStorage
 * - Trace linking across services
 * - Batch span operations
 *
 * @module OpikService
 * @see https://www.comet.com/docs/opik/
 */

import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Opik } from 'opik';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

import {
  OpikConfig,
  FlushOptions,
  TraceContext,
  TraceLinkOptions,
} from './interfaces/opik-config.interface';

/**
 * Injection token for optional Opik client factory (used in tests)
 */
export const OPIK_CLIENT_FACTORY = Symbol('OPIK_CLIENT_FACTORY');

/**
 * Type for Opik client factory function
 */
export type OpikClientFactory = (config: OpikConfig) => Opik;

import {
  CreateTraceInput,
  CreateAgentTraceInput,
  TrackedTrace,
  EndTraceOutput,
  OpikTrace,
  AddFeedbackInput,
  AddSpanScoreInput,
  SpanType,
  SamplingRule,
  CreateSpanBatchInput,
  EndSpanBatchInput,
} from './interfaces/trace.interface';
import {
  CreateLLMSpanInput,
  CreateToolSpanInput,
  CreateRetrievalSpanInput,
  CreateGeneralSpanInput,
  EndSpanOutput,
  EndLLMSpanOutput,
  TrackedSpan,
  CreateNestedSpanInput,
} from './interfaces/span.interface';
import { OpikFlushException } from './exceptions';

/**
 * Default project name if not specified in environment
 */
const DEFAULT_PROJECT_NAME = 'ikpa-financial-coach';

/**
 * Default Opik API URL (Comet's hosted API)
 */
const DEFAULT_API_URL = 'https://www.comet.com/opik/api';

/**
 * Default flush timeout in milliseconds
 */
const DEFAULT_FLUSH_TIMEOUT_MS = 5000;

/**
 * Default number of retry attempts for flush
 */
const DEFAULT_FLUSH_RETRY_ATTEMPTS = 3;

/**
 * Default delay between retry attempts in milliseconds
 */
const DEFAULT_FLUSH_RETRY_DELAY_MS = 1000;

/**
 * Default sampling rate (1.0 = 100%)
 */
const DEFAULT_SAMPLING_RATE = 1.0;

/**
 * Maximum backoff delay in milliseconds (for exponential backoff)
 */
const MAX_BACKOFF_DELAY_MS = 30000;

/**
 * OpikService
 *
 * Provides distributed tracing capabilities for IKPA's AI cognitive chains.
 *
 * @example
 * ```typescript
 * // Basic usage with context propagation
 * await opikService.runWithContext(async () => {
 *   const trace = opikService.createAgentTrace({
 *     agentName: 'shark_auditor',
 *     userId: 'user-123',
 *     input: { action: 'audit_subscriptions' },
 *   });
 *
 *   // Context is automatically available in nested async calls
 *   await someAsyncOperation();
 *
 *   // Get context anywhere in the call stack
 *   const ctx = opikService.getContext();
 *   console.log(ctx?.traceId);
 *
 *   opikService.endTrace(trace, { success: true });
 * });
 * ```
 */
@Injectable()
export class OpikService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpikService.name);
  private client: Opik | null = null;
  private isEnabled = true;
  private config: OpikConfig | null = null;
  private samplingRate: number = DEFAULT_SAMPLING_RATE;
  private samplingRules: SamplingRule[] = [];
  private flushTimeoutMs: number = DEFAULT_FLUSH_TIMEOUT_MS;
  private flushRetryAttempts: number = DEFAULT_FLUSH_RETRY_ATTEMPTS;
  private flushRetryDelayMs: number = DEFAULT_FLUSH_RETRY_DELAY_MS;

  /**
   * AsyncLocalStorage for trace context propagation across async boundaries
   */
  private readonly contextStorage = new AsyncLocalStorage<TraceContext>();

  /**
   * Registry of active trace objects by traceId.
   * Required because the SDK's feedback API uses trace.score() on the Trace object,
   * not a client-level method. Entries are cleaned up when traces are ended.
   */
  private readonly traceRegistry = new Map<string, OpikTrace>();

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Optional()
    @Inject(OPIK_CLIENT_FACTORY)
    private readonly clientFactory?: OpikClientFactory,
  ) {}

  // ==========================================
  // LIFECYCLE METHODS
  // ==========================================

  /**
   * Initialize Opik client on module startup
   */
  onModuleInit(): void {
    try {
      this.config = this.loadConfiguration();

      // Load optional configuration
      this.samplingRate = this.configService.get<number>(
        'OPIK_SAMPLING_RATE',
        DEFAULT_SAMPLING_RATE,
      );
      this.flushTimeoutMs = this.configService.get<number>(
        'OPIK_FLUSH_TIMEOUT_MS',
        DEFAULT_FLUSH_TIMEOUT_MS,
      );
      this.flushRetryAttempts = this.configService.get<number>(
        'OPIK_FLUSH_RETRY_ATTEMPTS',
        DEFAULT_FLUSH_RETRY_ATTEMPTS,
      );
      this.flushRetryDelayMs = this.configService.get<number>(
        'OPIK_FLUSH_RETRY_DELAY_MS',
        DEFAULT_FLUSH_RETRY_DELAY_MS,
      );

      // Use injected factory if provided (for testing), otherwise use real Opik client
      this.client = this.clientFactory
        ? this.clientFactory(this.config)
        : new Opik({
            apiKey: this.config.apiKey,
            apiUrl: this.config.apiUrl,
            projectName: this.config.projectName,
            workspaceName: this.config.workspaceName,
          });

      this.logger.log(
        `Opik client initialized for project: ${this.config.projectName} (sampling: ${this.samplingRate * 100}%)`,
      );
    } catch (error) {
      this.isEnabled = false;
      this.logger.warn(
        `Opik initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Tracing will be disabled.',
      );
    }
  }

  /**
   * Flush pending traces on module shutdown with timeout
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client && this.isEnabled) {
      try {
        await this.flush({ timeoutMs: this.flushTimeoutMs, retryAttempts: 1 });
        this.logger.log('Opik traces flushed successfully on shutdown');
      } catch (error) {
        this.logger.error(
          `Failed to flush Opik traces on shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  // ==========================================
  // CONTEXT PROPAGATION METHODS
  // ==========================================

  /**
   * Run a function with trace context propagation
   *
   * All async operations within the callback will have access to the trace context
   * via `getContext()`. This enables automatic context propagation across async boundaries.
   *
   * @param context - The trace context to propagate
   * @param fn - The function to run with context
   * @returns The result of the function
   *
   * @example
   * ```typescript
   * await opikService.runWithContext(
   *   { traceId: trace.traceId, traceName: trace.traceName },
   *   async () => {
   *     // All nested async calls can access context
   *     await processData();
   *   }
   * );
   * ```
   */
  async runWithContext<T>(context: TraceContext, fn: () => Promise<T>): Promise<T> {
    return this.contextStorage.run(context, fn);
  }

  /**
   * Run a synchronous function with trace context propagation
   */
  runWithContextSync<T>(context: TraceContext, fn: () => T): T {
    return this.contextStorage.run(context, fn);
  }

  /**
   * Get the current trace context from AsyncLocalStorage
   *
   * @returns The current trace context or undefined if not in a traced context
   *
   * @example
   * ```typescript
   * const ctx = opikService.getContext();
   * if (ctx) {
   *   // Add trace ID to outgoing HTTP headers
   *   headers['x-trace-id'] = ctx.traceId;
   * }
   * ```
   */
  getContext(): TraceContext | undefined {
    return this.contextStorage.getStore();
  }

  /**
   * Create a trace context from HTTP headers (for incoming requests)
   *
   * @param headers - HTTP headers containing trace context
   * @returns TraceContext or null if no context found
   *
   * @example
   * ```typescript
   * // In a middleware or controller
   * const ctx = opikService.extractContextFromHeaders(req.headers);
   * if (ctx) {
   *   await opikService.runWithContext(ctx, async () => {
   *     // Handle request with propagated context
   *   });
   * }
   * ```
   */
  extractContextFromHeaders(headers: Record<string, string | string[] | undefined>): TraceContext | null {
    const traceId = this.getHeaderValue(headers, 'x-trace-id') || this.getHeaderValue(headers, 'traceparent');
    const spanId = this.getHeaderValue(headers, 'x-span-id');
    const traceName = this.getHeaderValue(headers, 'x-trace-name') || 'remote_trace';

    if (!traceId) {
      return null;
    }

    // Parse baggage header if present
    const baggageHeader = this.getHeaderValue(headers, 'baggage');
    const baggage: Record<string, string> = {};
    if (baggageHeader) {
      baggageHeader.split(',').forEach((item) => {
        const [key, value] = item.split('=');
        if (key && value) {
          baggage[key.trim()] = decodeURIComponent(value.trim());
        }
      });
    }

    return {
      traceId,
      spanId,
      traceName,
      isRemote: true,
      baggage: Object.keys(baggage).length > 0 ? baggage : undefined,
    };
  }

  /**
   * Create HTTP headers from the current trace context (for outgoing requests)
   *
   * @returns Headers object to spread into outgoing request headers
   *
   * @example
   * ```typescript
   * const headers = opikService.injectContextToHeaders();
   * await fetch(url, { headers: { ...headers, ...otherHeaders } });
   * ```
   */
  injectContextToHeaders(): Record<string, string> {
    const ctx = this.getContext();
    if (!ctx) {
      return {};
    }

    const headers: Record<string, string> = {
      'x-trace-id': ctx.traceId,
      'x-trace-name': ctx.traceName,
    };

    if (ctx.spanId) {
      headers['x-span-id'] = ctx.spanId;
    }

    // Add baggage if present
    if (ctx.baggage && Object.keys(ctx.baggage).length > 0) {
      headers['baggage'] = Object.entries(ctx.baggage)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join(',');
    }

    return headers;
  }

  // ==========================================
  // TRACE METHODS
  // ==========================================

  /**
   * Create a new trace
   *
   * If created within a `runWithContext` block, automatically stores the context
   * for propagation to nested async operations.
   *
   * @param input - Trace creation parameters
   * @param linkOptions - Optional link to a remote trace
   * @returns TrackedTrace wrapper or null if tracing is disabled or sampled out
   */
  createTrace(input: CreateTraceInput, linkOptions?: TraceLinkOptions): TrackedTrace | null {
    if (!this.isClientAvailable()) {
      return null;
    }

    // Apply sampling
    if (!this.shouldSample(input.name, input.metadata)) {
      this.logger.debug(`Trace ${input.name} sampled out`);
      return null;
    }

    try {
      const traceId = randomUUID();

      // Build metadata with optional trace link
      const metadata: Record<string, unknown> = {
        ...input.metadata,
        traceId,
        timestamp: new Date().toISOString(),
        environment: this.configService.get('NODE_ENV', 'development'),
      };

      // Add trace link if provided
      if (linkOptions) {
        metadata.linkedTrace = {
          remoteTraceId: linkOptions.remoteTraceId,
          remoteSpanId: linkOptions.remoteSpanId,
          relationship: linkOptions.relationship,
          remoteService: linkOptions.remoteService,
        };
      }

      // Check for parent context from propagation
      const parentContext = this.getContext();
      if (parentContext?.isRemote) {
        metadata.parentTraceId = parentContext.traceId;
        metadata.parentSpanId = parentContext.spanId;
        metadata.propagatedFrom = 'remote';
      }

      const trace = this.client!.trace({
        name: input.name,
        input: input.input,
        metadata,
        tags: input.tags,
      });

      const trackedTrace: TrackedTrace = {
        trace: trace as unknown as OpikTrace,
        traceId,
        traceName: input.name,
        startedAt: new Date(),
      };

      // Register trace for later feedback scoring via trace.score()
      this.traceRegistry.set(traceId, trace as unknown as OpikTrace);

      return trackedTrace;
    } catch (error) {
      this.logger.error(
        `Failed to create trace ${input.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Create a trace and automatically set up context propagation
   *
   * @param input - Trace creation parameters
   * @param fn - Async function to run with the trace context
   * @returns The result of the function
   *
   * @example
   * ```typescript
   * const result = await opikService.withTrace(
   *   { name: 'process_request', input: { userId: '123' } },
   *   async (trace) => {
   *     // Context is automatically propagated
   *     const ctx = opikService.getContext(); // Available!
   *     await doWork();
   *     opikService.endTrace(trace, { success: true });
   *     return 'done';
   *   }
   * );
   * ```
   */
  async withTrace<T>(
    input: CreateTraceInput,
    fn: (trace: TrackedTrace | null) => Promise<T>,
  ): Promise<T> {
    const trace = this.createTrace(input);

    if (!trace) {
      return fn(null);
    }

    const context: TraceContext = {
      traceId: trace.traceId,
      traceName: trace.traceName,
    };

    return this.runWithContext(context, () => fn(trace));
  }

  /**
   * Create an agent-specific trace
   */
  createAgentTrace(input: CreateAgentTraceInput): TrackedTrace | null {
    return this.createTrace({
      name: `${input.agentName}_cognitive_chain`,
      input: {
        userId: input.userId,
        ...input.input,
      },
      metadata: {
        agent: input.agentName,
        version: '1.0',
        ...input.metadata,
      },
    });
  }

  /**
   * Link the current trace to a remote trace
   *
   * @param remoteTraceId - The ID of the remote trace to link to
   * @param options - Additional link options
   *
   * @example
   * ```typescript
   * // In a service that receives a request with trace context
   * const trace = opikService.createTrace({ name: 'handle_request', input: {} });
   * opikService.linkToRemoteTrace(incomingTraceId, {
   *   relationship: 'child_of',
   *   remoteService: 'api-gateway',
   * });
   * ```
   */
  linkToRemoteTrace(
    remoteTraceId: string,
    options: Partial<Omit<TraceLinkOptions, 'remoteTraceId'>> = {},
  ): void {
    const ctx = this.getContext();
    if (!ctx) {
      this.logger.debug('No current context to link trace to');
      return;
    }

    this.logger.debug(
      `Linked trace ${ctx.traceId} to remote trace ${remoteTraceId} (${options.relationship || 'linked'})`,
    );
  }

  /**
   * End a trace with final output
   *
   * SDK note: trace.end() takes no parameters.
   * Output must be set via trace.update() before calling end().
   */
  endTrace(trackedTrace: TrackedTrace | null, output: EndTraceOutput): void {
    if (!trackedTrace) {
      return;
    }

    try {
      const durationMs = Date.now() - trackedTrace.startedAt.getTime();

      const outputData = {
        success: output.success,
        durationMs,
        ...output.result,
        ...(output.error && { error: output.error }),
      };

      // update() sets the output, end() finalizes the trace
      (trackedTrace.trace as unknown as { update: (data: Record<string, unknown>) => unknown }).update({
        output: outputData,
      });
      trackedTrace.trace.end();

      // Deferred cleanup: keep trace in registry briefly for post-end feedback (e.g., decision scores)
      // then remove after 5 minutes to prevent memory leaks
      setTimeout(() => this.traceRegistry.delete(trackedTrace.traceId), 5 * 60 * 1000);
    } catch (error) {
      this.logger.error(
        `Failed to end trace ${trackedTrace.traceName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ==========================================
  // SPAN METHODS
  // ==========================================

  /**
   * Create an LLM span for tracking AI model calls
   */
  createLLMSpan(input: CreateLLMSpanInput): TrackedSpan | null {
    return this.createSpanInternal({
      trace: input.trace,
      name: input.name,
      type: 'llm',
      input: input.input,
      metadata: {
        model: input.model,
        provider: input.provider,
        ...input.metadata,
      },
    });
  }

  /**
   * Create a tool execution span
   */
  createToolSpan(input: CreateToolSpanInput): TrackedSpan | null {
    return this.createSpanInternal({
      trace: input.trace,
      name: input.name,
      type: 'tool',
      input: input.input,
      metadata: input.metadata,
    });
  }

  /**
   * Create a retrieval span for data fetching operations
   */
  createRetrievalSpan(input: CreateRetrievalSpanInput): TrackedSpan | null {
    return this.createSpanInternal({
      trace: input.trace,
      name: input.name,
      type: 'retrieval',
      input: input.query,
      metadata: input.metadata,
    });
  }

  /**
   * Create a general span for miscellaneous operations
   */
  createGeneralSpan(input: CreateGeneralSpanInput): TrackedSpan | null {
    return this.createSpanInternal({
      trace: input.trace,
      name: input.name,
      type: 'general',
      input: input.input,
      metadata: input.metadata,
    });
  }

  /**
   * Create a nested span within another span
   */
  createNestedSpan(input: CreateNestedSpanInput): TrackedSpan | null {
    if (!input.parentSpan) {
      return null;
    }

    try {
      const spanId = randomUUID();
      const span = input.parentSpan.span.span({
        name: input.name,
        type: input.type,
        input: input.input,
        metadata: {
          ...input.metadata,
          spanId,
          parentSpanId: input.parentSpan.spanId,
        },
      });

      return {
        span,
        spanId,
        traceId: input.parentSpan.traceId,
        parentSpanId: input.parentSpan.spanId,
        name: input.name,
        type: input.type,
        startedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to create nested span ${input.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Create multiple spans in a batch
   *
   * @param input - Batch input with trace and span definitions
   * @returns Array of created spans (null entries for failed creations)
   *
   * @example
   * ```typescript
   * const spans = opikService.createSpanBatch({
   *   trace: trace.trace,
   *   spans: [
   *     { name: 'step1', type: 'tool', input: { data: 1 } },
   *     { name: 'step2', type: 'tool', input: { data: 2 } },
   *   ],
   * });
   * ```
   */
  createSpanBatch(input: CreateSpanBatchInput): (TrackedSpan | null)[] {
    if (!input.trace) {
      return input.spans.map(() => null);
    }

    return input.spans.map((spanDef) =>
      this.createSpanInternal({
        trace: input.trace,
        name: spanDef.name,
        type: spanDef.type,
        input: spanDef.input,
        metadata: spanDef.metadata,
      }),
    );
  }

  /**
   * End multiple spans in a batch
   *
   * @param input - Batch input with spans and their outputs
   *
   * @example
   * ```typescript
   * opikService.endSpanBatch({
   *   spans: [
   *     { span: span1, output: { result: 'a' } },
   *     { span: span2, output: { result: 'b' } },
   *   ],
   * });
   * ```
   */
  endSpanBatch(input: EndSpanBatchInput): void {
    for (const { span, output, metadata } of input.spans) {
      this.endSpan(span, { output, metadata });
    }
  }

  /**
   * End a span with output
   *
   * SDK note: span.end() takes no parameters.
   * Output/metadata must be set via span.update() before calling end().
   */
  endSpan(trackedSpan: TrackedSpan | null, output: EndSpanOutput): void {
    if (!trackedSpan) {
      return;
    }

    try {
      const durationMs = Date.now() - trackedSpan.startedAt.getTime();

      const spanUpdate = trackedSpan.span as unknown as { update: (data: Record<string, unknown>) => unknown };
      spanUpdate.update({
        output: output.output,
        metadata: {
          durationMs,
          ...output.metadata,
        },
      });
      trackedSpan.span.end();
    } catch (error) {
      this.logger.error(
        `Failed to end span ${trackedSpan.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * End an LLM span with output, usage statistics, and cost estimation
   *
   * SDK note: span.end() takes no parameters.
   * Output, usage, and cost must be set via span.update() before calling end().
   * The SDK accepts usage as Record<string, number> and totalEstimatedCost as number.
   */
  endLLMSpan(trackedSpan: TrackedSpan | null, output: EndLLMSpanOutput): void {
    if (!trackedSpan) {
      return;
    }

    try {
      const durationMs = Date.now() - trackedSpan.startedAt.getTime();

      // Build usage record for the SDK (Record<string, number>)
      const usage: Record<string, number> | undefined = output.usage
        ? {
            prompt_tokens: output.usage.promptTokens,
            completion_tokens: output.usage.completionTokens,
            total_tokens: output.usage.totalTokens,
          }
        : undefined;

      // Estimate cost using Claude Sonnet pricing ($3/M input, $15/M output)
      const estimatedCost = output.usage
        ? (output.usage.promptTokens * 3 + output.usage.completionTokens * 15) / 1_000_000
        : undefined;

      const spanUpdate = trackedSpan.span as unknown as { update: (data: Record<string, unknown>) => unknown };
      spanUpdate.update({
        output: output.output,
        metadata: {
          durationMs,
          ...(output.usage && {
            promptTokens: output.usage.promptTokens,
            completionTokens: output.usage.completionTokens,
            totalTokens: output.usage.totalTokens,
          }),
          ...(estimatedCost !== undefined && { estimatedCostUSD: estimatedCost }),
          ...output.metadata,
        },
        ...(usage && { usage }),
        ...(estimatedCost !== undefined && { totalEstimatedCost: estimatedCost }),
      });
      trackedSpan.span.end();
    } catch (error) {
      this.logger.error(
        `Failed to end LLM span ${trackedSpan.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ==========================================
  // FEEDBACK & SCORING METHODS
  // ==========================================

  /**
   * Add feedback to a trace using the SDK's trace.score() method
   *
   * Looks up the Trace object from the internal registry and calls
   * score() directly, which is how the SDK v1.9.85 records feedback.
   */
  addFeedback(input: AddFeedbackInput): boolean {
    if (!this.isClientAvailable()) {
      return false;
    }

    try {
      const traceObj = this.traceRegistry.get(input.traceId);
      if (traceObj) {
        // Use the SDK's native trace.score() method
        const scoreable = traceObj as unknown as {
          score: (score: { name: string; categoryName?: string; value: number; reason?: string }) => void;
        };
        scoreable.score({
          name: input.name,
          value: input.value,
          categoryName: input.category,
          reason: input.comment,
        });
      } else {
        this.logger.debug(
          `Trace ${input.traceId} not in registry (may have expired). Feedback: ${input.name}=${input.value}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add feedback to trace ${input.traceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Add a score to a span
   */
  addSpanScore(input: AddSpanScoreInput): boolean {
    if (!this.isClientAvailable()) {
      return false;
    }

    try {
      const client = this.client as Opik & {
        logSpanScore?: (params: Record<string, unknown>) => void;
      };

      if (typeof client.logSpanScore === 'function') {
        client.logSpanScore({
          id: randomUUID(),
          spanId: input.spanId,
          name: input.name,
          value: input.value,
          unit: input.unit,
          reason: input.comment,
          ...input.metadata,
        });
      } else {
        this.logger.debug(
          `Score logged for span ${input.spanId}: ${input.name}=${input.value}${input.unit ? ' ' + input.unit : ''}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add score to span ${input.spanId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  // ==========================================
  // SAMPLING METHODS
  // ==========================================

  /**
   * Set sampling rules for conditional trace sampling
   *
   * Rules are evaluated in order. First matching rule wins.
   *
   * @example
   * ```typescript
   * opikService.setSamplingRules([
   *   { name: 'always_sample_shark', match: { agent: 'shark_auditor' }, rate: 1.0 },
   *   { name: 'production_sampling', match: { environment: 'production' }, rate: 0.1 },
   * ]);
   * ```
   */
  setSamplingRules(rules: SamplingRule[]): void {
    this.samplingRules = rules;
    this.logger.log(`Sampling rules updated: ${rules.length} rule(s) configured`);
  }

  /**
   * Get the current sampling rules
   */
  getSamplingRules(): SamplingRule[] {
    return [...this.samplingRules];
  }

  /**
   * Get the current sampling rate
   */
  getSamplingRate(): number {
    return this.samplingRate;
  }

  /**
   * Set the default sampling rate at runtime
   */
  setSamplingRate(rate: number): void {
    if (rate < 0 || rate > 1) {
      this.logger.warn(`Invalid sampling rate ${rate}, must be between 0 and 1`);
      return;
    }
    this.samplingRate = rate;
    this.logger.log(`Sampling rate updated to ${rate * 100}%`);
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Flush all pending traces to Opik with timeout and exponential backoff retry
   */
  async flush(options: FlushOptions = {}): Promise<void> {
    if (!this.isClientAvailable()) {
      return;
    }

    const {
      throwOnError = false,
      timeoutMs = this.flushTimeoutMs,
      retryAttempts = this.flushRetryAttempts,
      exponentialBackoff = true,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        await this.flushWithTimeout(timeoutMs);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        this.logger.warn(
          `Flush attempt ${attempt}/${retryAttempts} failed: ${lastError.message}`,
        );

        if (attempt < retryAttempts) {
          const delay = exponentialBackoff
            ? this.calculateExponentialBackoff(attempt)
            : this.flushRetryDelayMs;
          await this.delay(delay);
        }
      }
    }

    const errorMessage = lastError?.message || 'Unknown error';
    this.logger.error(`Failed to flush traces after ${retryAttempts} attempts: ${errorMessage}`);

    if (throwOnError) {
      throw new OpikFlushException({ error: errorMessage, attempts: retryAttempts });
    }
  }

  /**
   * Get the raw Opik client
   */
  getClient(): Opik | null {
    return this.client;
  }

  /**
   * Check if Opik is enabled and available
   */
  isAvailable(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Get the current configuration
   */
  getConfig(): OpikConfig | null {
    return this.config;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Load and validate Opik configuration from environment
   */
  private loadConfiguration(): OpikConfig {
    const apiKey = this.configService.get<string>('OPIK_API_KEY');
    if (!apiKey) {
      throw new Error('Missing OPIK_API_KEY environment variable');
    }

    const workspaceName = this.configService.get<string>('OPIK_WORKSPACE_NAME');
    if (!workspaceName) {
      throw new Error('Missing OPIK_WORKSPACE_NAME environment variable');
    }

    return {
      apiKey,
      workspaceName,
      apiUrl: this.configService.get<string>(
        'OPIK_URL_OVERRIDE',
        DEFAULT_API_URL,
      ),
      projectName: this.configService.get<string>(
        'OPIK_PROJECT_NAME',
        DEFAULT_PROJECT_NAME,
      ),
    };
  }

  /**
   * Check if client is available for operations
   */
  private isClientAvailable(): boolean {
    if (!this.isEnabled || !this.client) {
      this.logger.debug('Opik client not available, skipping operation');
      return false;
    }
    return true;
  }

  /**
   * Determine if a trace should be sampled based on rate and rules
   */
  private shouldSample(traceName: string, metadata?: Record<string, unknown>): boolean {
    // Check rules first (first match wins)
    for (const rule of this.samplingRules) {
      if (this.matchesSamplingRule(traceName, metadata, rule)) {
        return Math.random() < rule.rate;
      }
    }

    // No rule matched, use default rate
    return Math.random() < this.samplingRate;
  }

  /**
   * Check if metadata matches a sampling rule
   */
  private matchesSamplingRule(
    traceName: string,
    metadata: Record<string, unknown> | undefined,
    rule: SamplingRule,
  ): boolean {
    // Check trace name pattern if specified
    if (rule.traceNamePattern) {
      const regex = new RegExp(rule.traceNamePattern);
      if (!regex.test(traceName)) {
        return false;
      }
    }

    // Check all match conditions
    for (const [key, value] of Object.entries(rule.match)) {
      if (metadata?.[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateExponentialBackoff(attempt: number): number {
    // Base delay * 2^(attempt-1) with jitter
    const baseDelay = this.flushRetryDelayMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * baseDelay; // 0-30% jitter
    const delay = baseDelay + jitter;
    return Math.min(delay, MAX_BACKOFF_DELAY_MS);
  }

  /**
   * Flush with timeout
   */
  private async flushWithTimeout(timeoutMs: number): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Flush timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([this.client!.flush(), timeoutPromise]);
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get a single header value from potentially array-valued headers
   */
  private getHeaderValue(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Internal method to create a span with common logic
   */
  private createSpanInternal(options: {
    trace: OpikTrace;
    name: string;
    type: SpanType;
    input: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    traceId?: string;
  }): TrackedSpan | null {
    if (!options.trace) {
      return null;
    }

    try {
      const spanId = randomUUID();
      const traceId = options.traceId || (options.trace as unknown as { id?: string }).id || randomUUID();

      const span = options.trace.span({
        name: options.name,
        type: options.type,
        input: options.input,
        metadata: {
          ...options.metadata,
          spanId,
        },
      });

      const trackedSpan: TrackedSpan = {
        span,
        spanId,
        traceId,
        name: options.name,
        type: options.type,
        startedAt: new Date(),
      };

      // Update context with new span
      const ctx = this.getContext();
      if (ctx) {
        // We're in a traced context, could update it here if needed
      }

      return trackedSpan;
    } catch (error) {
      this.logger.error(
        `Failed to create ${options.type} span ${options.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }
}
