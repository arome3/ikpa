/**
 * Circuit Breaker Service
 *
 * Implements the circuit breaker pattern to prevent cascade failures
 * when the Anthropic API is slow or failing during evolutionary optimization.
 *
 * Risk mitigation:
 * Without circuit breaker: 10 individuals x 5 generations x 2 dataset items x 60s = 100+ minutes
 * With circuit breaker: Fails fast after threshold, prevents resource exhaustion
 *
 * State Machine:
 * - CLOSED -> OPEN: After failureThreshold consecutive failures
 * - OPEN -> HALF_OPEN: After resetTimeout milliseconds
 * - HALF_OPEN -> CLOSED: After successThreshold consecutive successes
 * - HALF_OPEN -> OPEN: On any failure
 *
 * @example
 * ```typescript
 * // Execute operation with circuit breaker protection
 * const result = await circuitBreaker.execute(
 *   'crossover',
 *   () => llmCrossover(prompt1, prompt2),
 *   () => simpleCrossover(prompt1, prompt2), // fallback
 * );
 *
 * // Check health
 * const health = circuitBreaker.getHealth();
 * ```
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CircuitState,
  CircuitOperationType,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitStateTransition,
  CircuitBreakerResult,
  CircuitBreakerHealth,
  CircuitBreakerMetrics,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker.types';

/**
 * Internal tracking for execution metrics
 */
interface ExecutionMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  rejectedRequests: number;
  totalExecutionTimeMs: number;
}

@Injectable()
export class CircuitBreakerService implements OnModuleInit {
  private readonly logger = new Logger(CircuitBreakerService.name);

  /** Per-operation circuit state */
  private readonly states: Map<CircuitOperationType, CircuitBreakerState> =
    new Map();

  /** Per-operation execution metrics */
  private readonly metrics: Map<CircuitOperationType, ExecutionMetrics> =
    new Map();

  /** Current configuration */
  private config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG;

  /** Supported operation types */
  private readonly operationTypes: CircuitOperationType[] = [
    'crossover',
    'mutation',
    'evaluation',
    'variant_generation',
  ];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    // Load configuration from environment
    this.config = {
      failureThreshold:
        this.configService.get<number>('CIRCUIT_BREAKER_FAILURE_THRESHOLD') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
      successThreshold:
        this.configService.get<number>('CIRCUIT_BREAKER_SUCCESS_THRESHOLD') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold,
      timeout:
        this.configService.get<number>('CIRCUIT_BREAKER_TIMEOUT_MS') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.timeout,
      resetTimeout:
        this.configService.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT_MS') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeout,
      halfOpenMaxCalls:
        this.configService.get<number>('CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenMaxCalls,
    };

    // Initialize state for each operation type
    for (const operationType of this.operationTypes) {
      this.initializeState(operationType);
    }

    this.logger.log(
      `CircuitBreakerService initialized with config: ` +
        `failureThreshold=${this.config.failureThreshold}, ` +
        `successThreshold=${this.config.successThreshold}, ` +
        `timeout=${this.config.timeout}ms, ` +
        `resetTimeout=${this.config.resetTimeout}ms`,
    );
  }

  /**
   * Execute an operation with circuit breaker protection
   *
   * @param operationType - Type of operation (crossover, mutation, etc.)
   * @param operation - The async operation to execute
   * @param fallback - Fallback function to call when circuit is open
   * @returns Result with data or fallback, plus metadata
   */
  async execute<T>(
    operationType: CircuitOperationType,
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>,
  ): Promise<CircuitBreakerResult<T>> {
    const startTime = Date.now();
    const state = this.getOrCreateState(operationType);
    const metrics = this.getOrCreateMetrics(operationType);

    metrics.totalRequests++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    this.checkResetTimeout(operationType);

    const currentState = state.state;

    // If circuit is OPEN, fail fast with fallback
    if (currentState === CircuitState.OPEN) {
      metrics.rejectedRequests++;
      metrics.fallbackRequests++;

      this.logger.debug(
        `Circuit OPEN for ${operationType}, using fallback`,
      );

      const fallbackResult = await this.executeFallback(fallback);
      const executionTimeMs = Date.now() - startTime;
      metrics.totalExecutionTimeMs += executionTimeMs;

      return {
        success: true,
        data: fallbackResult,
        usedFallback: true,
        circuitState: currentState,
        executionTimeMs,
      };
    }

    // Execute the operation with timeout
    try {
      const data = await this.executeWithTimeout(operation, this.config.timeout);
      const executionTimeMs = Date.now() - startTime;
      metrics.totalExecutionTimeMs += executionTimeMs;

      // Record success
      this.recordSuccess(operationType);
      metrics.successfulRequests++;

      return {
        success: true,
        data,
        usedFallback: false,
        circuitState: currentState,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      metrics.totalExecutionTimeMs += executionTimeMs;

      // Record failure
      this.recordFailure(operationType, error as Error);
      metrics.failedRequests++;

      // Use fallback
      metrics.fallbackRequests++;

      this.logger.warn(
        `Operation ${operationType} failed: ${(error as Error).message}, using fallback`,
      );

      try {
        const fallbackResult = await this.executeFallback(fallback);

        return {
          success: true,
          data: fallbackResult,
          error: error as Error,
          usedFallback: true,
          circuitState: state.state, // May have changed after recording failure
          executionTimeMs,
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: error as Error,
          usedFallback: true,
          circuitState: state.state,
          executionTimeMs,
        };
      }
    }
  }

  /**
   * Get current state for an operation type
   */
  getState(operationType: CircuitOperationType): CircuitState {
    this.checkResetTimeout(operationType);
    return this.getOrCreateState(operationType).state;
  }

  /**
   * Get full state details for an operation type
   */
  getStateDetails(operationType: CircuitOperationType): CircuitBreakerState {
    this.checkResetTimeout(operationType);
    return { ...this.getOrCreateState(operationType) };
  }

  /**
   * Get health check information for all circuits
   */
  getHealth(): CircuitBreakerHealth {
    // Check reset timeouts for all operations
    for (const operationType of this.operationTypes) {
      this.checkResetTimeout(operationType);
    }

    const operations = {} as CircuitBreakerHealth['operations'];

    for (const operationType of this.operationTypes) {
      const state = this.getOrCreateState(operationType);
      operations[operationType] = {
        state: state.state,
        failureCount: state.failureCount,
        successCount: state.successCount,
        totalFailures: state.totalFailures,
        totalSuccesses: state.totalSuccesses,
        tripCount: state.tripCount,
        lastStateChange: state.lastStateChange,
      };
    }

    // Healthy if no circuits are OPEN
    const healthy = !Object.values(operations).some(
      (op) => op.state === CircuitState.OPEN,
    );

    return {
      healthy,
      operations,
      config: { ...this.config },
    };
  }

  /**
   * Get metrics for a specific operation type
   */
  getMetrics(operationType: CircuitOperationType): CircuitBreakerMetrics {
    const metrics = this.getOrCreateMetrics(operationType);
    const state = this.getOrCreateState(operationType);

    return {
      operationType,
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      fallbackRequests: metrics.fallbackRequests,
      rejectedRequests: metrics.rejectedRequests,
      averageExecutionTimeMs:
        metrics.totalRequests > 0
          ? metrics.totalExecutionTimeMs / metrics.totalRequests
          : 0,
      currentState: state.state,
    };
  }

  /**
   * Get metrics for all operation types
   */
  getAllMetrics(): CircuitBreakerMetrics[] {
    return this.operationTypes.map((type) => this.getMetrics(type));
  }

  /**
   * Reset circuit for a specific operation type (for testing/recovery)
   */
  reset(operationType: CircuitOperationType): void {
    this.initializeState(operationType);
    this.initializeMetrics(operationType);

    this.logger.log(`Circuit breaker reset for operation: ${operationType}`);
  }

  /**
   * Reset all circuits (for testing/recovery)
   */
  resetAll(): void {
    for (const operationType of this.operationTypes) {
      this.reset(operationType);
    }

    this.logger.log('All circuit breakers reset');
  }

  /**
   * Force open a circuit (for testing/maintenance)
   */
  forceOpen(operationType: CircuitOperationType): void {
    const state = this.getOrCreateState(operationType);
    const previousState = state.state;

    state.state = CircuitState.OPEN;
    state.lastFailureTime = new Date();
    state.lastStateChange = new Date();

    this.logStateTransition({
      operationType,
      fromState: previousState,
      toState: CircuitState.OPEN,
      reason: 'Forced open by admin',
      timestamp: new Date(),
      failureCount: state.failureCount,
      successCount: state.successCount,
    });
  }

  /**
   * Force close a circuit (for testing/recovery)
   */
  forceClose(operationType: CircuitOperationType): void {
    const state = this.getOrCreateState(operationType);
    const previousState = state.state;

    state.state = CircuitState.CLOSED;
    state.failureCount = 0;
    state.successCount = 0;
    state.lastStateChange = new Date();

    this.logStateTransition({
      operationType,
      fromState: previousState,
      toState: CircuitState.CLOSED,
      reason: 'Forced closed by admin',
      timestamp: new Date(),
      failureCount: state.failureCount,
      successCount: state.successCount,
    });
  }

  /**
   * Check if circuit is allowing requests
   */
  isAllowingRequests(operationType: CircuitOperationType): boolean {
    this.checkResetTimeout(operationType);
    const state = this.getState(operationType);
    return state !== CircuitState.OPEN;
  }

  // ==========================================
  // Private Methods
  // ==========================================

  private initializeState(operationType: CircuitOperationType): void {
    this.states.set(operationType, {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastStateChange: new Date(),
      totalFailures: 0,
      totalSuccesses: 0,
      tripCount: 0,
    });
    this.initializeMetrics(operationType);
  }

  private initializeMetrics(operationType: CircuitOperationType): void {
    this.metrics.set(operationType, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbackRequests: 0,
      rejectedRequests: 0,
      totalExecutionTimeMs: 0,
    });
  }

  private getOrCreateState(
    operationType: CircuitOperationType,
  ): CircuitBreakerState {
    if (!this.states.has(operationType)) {
      this.initializeState(operationType);
    }
    return this.states.get(operationType)!;
  }

  private getOrCreateMetrics(
    operationType: CircuitOperationType,
  ): ExecutionMetrics {
    if (!this.metrics.has(operationType)) {
      this.initializeMetrics(operationType);
    }
    return this.metrics.get(operationType)!;
  }

  private recordSuccess(operationType: CircuitOperationType): void {
    const state = this.getOrCreateState(operationType);
    state.totalSuccesses++;

    if (state.state === CircuitState.HALF_OPEN) {
      state.successCount++;

      // Check if we should close the circuit
      if (state.successCount >= this.config.successThreshold) {
        this.transitionTo(operationType, CircuitState.CLOSED, 'Success threshold reached in HALF_OPEN');
      }
    } else if (state.state === CircuitState.CLOSED) {
      // Reset failure count on success in CLOSED state
      state.failureCount = 0;
    }
  }

  private recordFailure(
    operationType: CircuitOperationType,
    error: Error,
  ): void {
    const state = this.getOrCreateState(operationType);
    state.totalFailures++;
    state.failureCount++;
    state.lastFailureTime = new Date();

    if (state.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo(
        operationType,
        CircuitState.OPEN,
        `Failure in HALF_OPEN: ${error.message}`,
      );
    } else if (state.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (state.failureCount >= this.config.failureThreshold) {
        this.transitionTo(
          operationType,
          CircuitState.OPEN,
          `Failure threshold reached (${state.failureCount}/${this.config.failureThreshold}): ${error.message}`,
        );
      }
    }
  }

  private checkResetTimeout(operationType: CircuitOperationType): void {
    const state = this.getOrCreateState(operationType);

    if (
      state.state === CircuitState.OPEN &&
      state.lastFailureTime
    ) {
      const timeSinceFailure = Date.now() - state.lastFailureTime.getTime();

      if (timeSinceFailure >= this.config.resetTimeout) {
        this.transitionTo(
          operationType,
          CircuitState.HALF_OPEN,
          `Reset timeout elapsed (${timeSinceFailure}ms >= ${this.config.resetTimeout}ms)`,
        );
      }
    }
  }

  private transitionTo(
    operationType: CircuitOperationType,
    newState: CircuitState,
    reason: string,
  ): void {
    const state = this.getOrCreateState(operationType);
    const previousState = state.state;

    // Update state
    state.state = newState;
    state.lastStateChange = new Date();

    // Reset counters based on new state
    if (newState === CircuitState.CLOSED) {
      state.failureCount = 0;
      state.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      state.successCount = 0;
    } else if (newState === CircuitState.OPEN) {
      state.tripCount++;
      state.successCount = 0;
    }

    // Log transition
    this.logStateTransition({
      operationType,
      fromState: previousState,
      toState: newState,
      reason,
      timestamp: new Date(),
      failureCount: state.failureCount,
      successCount: state.successCount,
    });
  }

  private logStateTransition(transition: CircuitStateTransition): void {
    const logMessage =
      `Circuit breaker state transition [${transition.operationType}]: ` +
      `${transition.fromState} -> ${transition.toState} | ` +
      `Reason: ${transition.reason} | ` +
      `Failures: ${transition.failureCount}, Successes: ${transition.successCount}`;

    if (transition.toState === CircuitState.OPEN) {
      this.logger.warn(logMessage);
    } else {
      this.logger.log(logMessage);
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async executeFallback<T>(
    fallback: () => T | Promise<T>,
  ): Promise<T> {
    const result = fallback();
    if (result instanceof Promise) {
      return result;
    }
    return result;
  }
}
