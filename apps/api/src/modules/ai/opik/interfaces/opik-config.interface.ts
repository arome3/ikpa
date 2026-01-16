/**
 * Opik Client Configuration Interface
 *
 * Defines the configuration options for initializing the Opik client.
 * All properties are derived from environment variables.
 */
export interface OpikConfig {
  /** Opik API key for authentication */
  apiKey: string;

  /** Opik API URL (defaults to Comet's hosted API) */
  apiUrl: string;

  /** Project name in Opik dashboard */
  projectName: string;

  /** Workspace name (required for Opik Cloud) */
  workspaceName: string;
}

/**
 * Opik Module Configuration Options
 *
 * Options for configuring the OpikModule behavior at runtime.
 */
export interface OpikModuleOptions {
  /** Whether to enable tracing (can be disabled in tests) */
  enabled?: boolean;

  /** Whether to flush traces synchronously on module destroy */
  flushOnDestroy?: boolean;

  /** Default metadata to attach to all traces */
  defaultMetadata?: Record<string, unknown>;

  /** Sampling rate (0-1, where 1 = 100%). Default: 1.0 */
  samplingRate?: number;

  /** Flush timeout in milliseconds. Default: 5000 */
  flushTimeoutMs?: number;

  /** Number of retry attempts for flush failures. Default: 3 */
  flushRetryAttempts?: number;

  /** Delay between retry attempts in milliseconds. Default: 1000 */
  flushRetryDelayMs?: number;
}

/**
 * Flush options for the flush method
 */
export interface FlushOptions {
  /** Whether to throw on error. Default: false */
  throwOnError?: boolean;

  /** Timeout in milliseconds. Default: uses module config */
  timeoutMs?: number;

  /** Number of retry attempts. Default: uses module config */
  retryAttempts?: number;

  /** Use exponential backoff for retries. Default: true */
  exponentialBackoff?: boolean;
}

/**
 * Trace context for propagation across async boundaries and services
 *
 * @example
 * ```typescript
 * // Get current context
 * const ctx = opikService.getContext();
 *
 * // Pass to another service via HTTP headers
 * headers['x-trace-id'] = ctx?.traceId;
 * headers['x-span-id'] = ctx?.spanId;
 * ```
 */
export interface TraceContext {
  /** Current trace ID */
  traceId: string;

  /** Current span ID (if within a span) */
  spanId?: string;

  /** Parent span ID (for nested spans) */
  parentSpanId?: string;

  /** Trace name for reference */
  traceName: string;

  /** Whether this context was propagated from another service */
  isRemote?: boolean;

  /** Baggage items for cross-service data */
  baggage?: Record<string, string>;
}

/**
 * Options for linking traces across services
 */
export interface TraceLinkOptions {
  /** The remote trace ID to link to */
  remoteTraceId: string;

  /** The remote span ID (optional) */
  remoteSpanId?: string;

  /** The relationship type */
  relationship: 'child_of' | 'follows_from' | 'linked';

  /** Service name where the remote trace originated */
  remoteService?: string;
}
