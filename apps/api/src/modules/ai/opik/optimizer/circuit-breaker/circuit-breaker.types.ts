/**
 * Circuit Breaker Types
 *
 * Type definitions for the circuit breaker pattern implementation.
 * Prevents cascade failures when LLM API is slow or failing.
 */

/**
 * Circuit breaker states
 *
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Failure threshold exceeded, requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */
export enum CircuitState {
  /** Normal operation - requests flow through */
  CLOSED = 'CLOSED',
  /** Circuit tripped - fail fast, return fallback */
  OPEN = 'OPEN',
  /** Testing recovery - allow limited requests */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Supported operation types for circuit breaker
 */
export type CircuitOperationType =
  | 'crossover'
  | 'mutation'
  | 'evaluation'
  | 'variant_generation';

/**
 * Configuration for circuit breaker behavior
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures to trip circuit (default: 5) */
  failureThreshold: number;

  /** Number of consecutive successes in HALF_OPEN to close circuit (default: 2) */
  successThreshold: number;

  /** Timeout per LLM call in milliseconds (default: 30000) */
  timeout: number;

  /** Time in ms before transitioning from OPEN to HALF_OPEN (default: 60000) */
  resetTimeout: number;

  /** Maximum concurrent calls allowed in HALF_OPEN state (default: 1) */
  halfOpenMaxCalls?: number;
}

/**
 * Internal state tracking for a single operation type
 */
export interface CircuitBreakerState {
  /** Current circuit state */
  state: CircuitState;

  /** Count of consecutive failures */
  failureCount: number;

  /** Count of consecutive successes (used in HALF_OPEN) */
  successCount: number;

  /** Timestamp when circuit was opened */
  lastFailureTime?: Date;

  /** Timestamp of last state transition */
  lastStateChange: Date;

  /** Total failures since service start */
  totalFailures: number;

  /** Total successes since service start */
  totalSuccesses: number;

  /** Number of times circuit has opened */
  tripCount: number;
}

/**
 * State transition event for logging
 */
export interface CircuitStateTransition {
  /** Operation type this transition is for */
  operationType: CircuitOperationType;

  /** Previous state */
  fromState: CircuitState;

  /** New state */
  toState: CircuitState;

  /** Reason for transition */
  reason: string;

  /** Timestamp of transition */
  timestamp: Date;

  /** Current failure count */
  failureCount: number;

  /** Current success count */
  successCount: number;
}

/**
 * Result of executing an operation through circuit breaker
 */
export interface CircuitBreakerResult<T> {
  /** Whether operation succeeded */
  success: boolean;

  /** Result data if successful */
  data?: T;

  /** Error if failed */
  error?: Error;

  /** Whether fallback was used */
  usedFallback: boolean;

  /** Circuit state when request was made */
  circuitState: CircuitState;

  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Health check response for circuit breaker
 */
export interface CircuitBreakerHealth {
  /** Overall health status */
  healthy: boolean;

  /** Per-operation state information */
  operations: Record<
    CircuitOperationType,
    {
      state: CircuitState;
      failureCount: number;
      successCount: number;
      totalFailures: number;
      totalSuccesses: number;
      tripCount: number;
      lastStateChange: Date;
    }
  >;

  /** Current configuration */
  config: CircuitBreakerConfig;
}

/**
 * Metrics for circuit breaker monitoring
 */
export interface CircuitBreakerMetrics {
  /** Operation type */
  operationType: CircuitOperationType;

  /** Total number of requests */
  totalRequests: number;

  /** Number of successful requests */
  successfulRequests: number;

  /** Number of failed requests */
  failedRequests: number;

  /** Number of requests that used fallback */
  fallbackRequests: number;

  /** Number of requests rejected due to open circuit */
  rejectedRequests: number;

  /** Average execution time in milliseconds */
  averageExecutionTimeMs: number;

  /** Current circuit state */
  currentState: CircuitState;
}

/**
 * Default configuration values
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  resetTimeout: 60000, // 60 seconds
  halfOpenMaxCalls: 1,
};
