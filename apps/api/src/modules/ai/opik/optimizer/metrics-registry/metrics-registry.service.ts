/**
 * Metrics Registry Service
 *
 * Registers custom IKPA metrics with Opik's Feedback Definitions API.
 * These metrics appear in the Opik UI for visualizing evaluation results.
 *
 * Features:
 * - Automatic registration on module initialization
 * - Idempotent registration (skips existing metrics)
 * - Graceful degradation when Opik is unavailable
 * - Retry with exponential backoff for transient failures
 * - Circuit breaker pattern to prevent cascading failures
 *
 * @example
 * ```typescript
 * // The service automatically registers metrics on init
 * const metricsRegistry = await moduleRef.get(MetricsRegistryService);
 *
 * // Manual registration if needed
 * const results = await metricsRegistry.registerMetrics();
 *
 * // Check if a metric is registered
 * const isRegistered = await metricsRegistry.isMetricRegistered('ToneEmpathy');
 *
 * // Get metric definition
 * const def = metricsRegistry.getMetricDefinition('CancellationRate');
 * ```
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Opik } from 'opik';

import { OpikService } from '../../opik.service';
import {
  IMetricsRegistry,
  MetricRegistrationResult,
  MetricsRegistryConfig,
  IKPAMetricDefinition,
  NumericalMetricDefinition,
  CategoricalMetricDefinition,
  BooleanMetricDefinition,
} from './metrics-registry.interface';
import { ALL_IKPA_METRICS } from './metrics-registry.constants';

/**
 * Default retry configuration for metric registration
 */
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_RETRY_MAX_DELAY_MS = 10000;

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000;

/**
 * Registration state for circuit breaker
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  isOpen: boolean;
}

@Injectable()
export class MetricsRegistryService implements IMetricsRegistry, OnModuleInit {
  private readonly logger = new Logger(MetricsRegistryService.name);
  private readonly metrics: Map<string, IKPAMetricDefinition> = new Map();
  private readonly registeredMetrics: Set<string> = new Set();
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
  };

  constructor(
    private readonly opikService: OpikService,
    private readonly configService: ConfigService,
  ) {
    // Initialize metrics map
    for (const metric of ALL_IKPA_METRICS) {
      this.metrics.set(metric.name, metric);
    }
  }

  /**
   * Register all metrics on module initialization
   */
  async onModuleInit(): Promise<void> {
    // Check if auto-registration is enabled
    const autoRegister = this.configService.get<boolean>(
      'OPIK_AUTO_REGISTER_METRICS',
      true,
    );

    if (!autoRegister) {
      this.logger.log('Auto-registration of Opik metrics is disabled');
      return;
    }

    try {
      const results = await this.registerMetrics({ skipExisting: true });
      const succeeded = results.filter((r) => r.success || r.alreadyExists).length;
      const failed = results.filter((r) => !r.success && !r.alreadyExists).length;

      if (failed === 0) {
        this.logger.log(
          `Opik metrics registered successfully: ${succeeded} metrics (${results.filter((r) => r.alreadyExists).length} already existed)`,
        );
      } else {
        this.logger.warn(
          `Opik metrics registration partial: ${succeeded} succeeded, ${failed} failed`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to register Opik metrics on init: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Metrics will be registered on-demand.',
      );
    }
  }

  /**
   * Register all IKPA metrics with Opik
   */
  async registerMetrics(
    config: MetricsRegistryConfig = {},
  ): Promise<MetricRegistrationResult[]> {
    const { skipExisting = true, updateExisting = false } = config;

    // Check if Opik is available
    if (!this.opikService.isAvailable()) {
      this.logger.warn('Opik service not available, skipping metric registration');
      return ALL_IKPA_METRICS.map((metric) => ({
        name: metric.name,
        success: false,
        error: 'Opik service not available',
      }));
    }

    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      this.logger.warn('Circuit breaker is open, skipping metric registration');
      return ALL_IKPA_METRICS.map((metric) => ({
        name: metric.name,
        success: false,
        error: 'Circuit breaker is open due to repeated failures',
      }));
    }

    const results: MetricRegistrationResult[] = [];

    for (const metric of ALL_IKPA_METRICS) {
      try {
        const result = await this.registerSingleMetric(metric, {
          skipExisting,
          updateExisting,
        });
        results.push(result);

        // Reset circuit breaker on success
        if (result.success) {
          this.resetCircuitBreaker();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.push({
          name: metric.name,
          success: false,
          error: errorMessage,
        });

        // Record failure for circuit breaker
        this.recordCircuitBreakerFailure();
      }
    }

    return results;
  }

  /**
   * Get all metric definitions
   */
  getMetricDefinitions(): IKPAMetricDefinition[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Check if a metric is registered
   */
  async isMetricRegistered(name: string): Promise<boolean> {
    // Check local cache first
    if (this.registeredMetrics.has(name)) {
      return true;
    }

    // Check with Opik API
    const client = this.opikService.getClient();
    if (!client) {
      return false;
    }

    try {
      const api = this.getOpikApi(client);
      if (!api) {
        return false;
      }

      const response = await api.feedbackDefinitions.findFeedbackDefinitions({
        name,
      });

      const exists =
        response.body?.content && response.body.content.length > 0;
      if (exists) {
        this.registeredMetrics.add(name);
      }
      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Get a metric definition by name
   */
  getMetricDefinition(name: string): IKPAMetricDefinition | undefined {
    return this.metrics.get(name);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Register a single metric with Opik
   */
  private async registerSingleMetric(
    metric: IKPAMetricDefinition,
    config: { skipExisting: boolean; updateExisting: boolean },
  ): Promise<MetricRegistrationResult> {
    const client = this.opikService.getClient();
    if (!client) {
      return {
        name: metric.name,
        success: false,
        error: 'Opik client not available',
      };
    }

    const api = this.getOpikApi(client);
    if (!api) {
      return {
        name: metric.name,
        success: false,
        error: 'Opik API not accessible',
      };
    }

    // Check if metric already exists
    if (config.skipExisting || config.updateExisting) {
      const exists = await this.isMetricRegistered(metric.name);
      if (exists && config.skipExisting && !config.updateExisting) {
        return {
          name: metric.name,
          success: true,
          alreadyExists: true,
        };
      }
    }

    // Build the feedback definition based on metric type
    const feedbackCreate = this.buildFeedbackCreate(metric);

    // Register with retry
    return this.withRetry(
      async () => {
        await api.feedbackDefinitions.createFeedbackDefinition(feedbackCreate);
        this.registeredMetrics.add(metric.name);
        return {
          name: metric.name,
          success: true,
        };
      },
      metric.name,
    );
  }

  /**
   * Build Opik FeedbackCreate object from metric definition
   */
  private buildFeedbackCreate(
    metric: IKPAMetricDefinition,
  ): {
    name: string;
    description?: string;
    type: 'numerical' | 'categorical' | 'boolean';
    details?: unknown;
  } {
    switch (metric.type) {
      case 'numerical': {
        const numMetric = metric as NumericalMetricDefinition;
        return {
          name: numMetric.name,
          description: numMetric.description,
          type: 'numerical',
          details: {
            min: numMetric.min,
            max: numMetric.max,
          },
        };
      }
      case 'categorical': {
        const catMetric = metric as CategoricalMetricDefinition;
        return {
          name: catMetric.name,
          description: catMetric.description,
          type: 'categorical',
          details: {
            categories: catMetric.categories,
          },
        };
      }
      case 'boolean': {
        const boolMetric = metric as BooleanMetricDefinition;
        return {
          name: boolMetric.name,
          description: boolMetric.description,
          type: 'boolean',
          details: {
            trueLabel: boolMetric.trueLabel,
            falseLabel: boolMetric.falseLabel,
          },
        };
      }
    }
  }

  /**
   * Get the Opik API client from the main client
   */
  private getOpikApi(
    client: Opik,
  ): { feedbackDefinitions: unknown } | null {
    // The Opik client exposes the API through the 'api' property
    const opikClient = client as unknown as {
      api?: {
        feedbackDefinitions?: {
          findFeedbackDefinitions: (
            request?: { name?: string },
          ) => Promise<{
            body?: { content?: unknown[] };
          }>;
          createFeedbackDefinition: (
            request: {
              name: string;
              description?: string;
              type: 'numerical' | 'categorical' | 'boolean';
              details?: unknown;
            },
          ) => Promise<void>;
        };
      };
    };

    if (opikClient.api?.feedbackDefinitions) {
      return opikClient.api as unknown as { feedbackDefinitions: unknown };
    }

    // For the standard Opik SDK, the API might be structured differently
    // Try to access it through potential alternative paths
    this.logger.debug('Standard API access not available, trying alternative paths');
    return null;
  }

  /**
   * Execute with retry and exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    metricName: string,
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = DEFAULT_RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Check if it's a "already exists" error (HTTP 409)
        if (this.isAlreadyExistsError(error)) {
          this.registeredMetrics.add(metricName);
          return {
            name: metricName,
            success: true,
            alreadyExists: true,
          } as unknown as T;
        }

        // Log and retry for transient errors
        if (attempt < DEFAULT_RETRY_ATTEMPTS) {
          this.logger.warn(
            `Metric registration attempt ${attempt}/${DEFAULT_RETRY_ATTEMPTS} failed for ${metricName}: ${lastError.message}. Retrying in ${delay}ms...`,
          );
          await this.delay(delay);
          delay = Math.min(delay * 2, DEFAULT_RETRY_MAX_DELAY_MS);
        }
      }
    }

    throw lastError || new Error('Unknown registration error');
  }

  /**
   * Check if error indicates metric already exists
   */
  private isAlreadyExistsError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('already exists') ||
        message.includes('conflict') ||
        message.includes('409') ||
        message.includes('duplicate')
      );
    }
    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // Check if enough time has passed to reset
    if (this.circuitBreaker.lastFailure) {
      const elapsed = Date.now() - this.circuitBreaker.lastFailure.getTime();
      if (elapsed >= CIRCUIT_BREAKER_RESET_MS) {
        this.resetCircuitBreaker();
        return false;
      }
    }

    return true;
  }

  /**
   * Record a failure for circuit breaker
   */
  private recordCircuitBreakerFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = new Date();

    if (this.circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      this.logger.warn(
        `Circuit breaker opened after ${this.circuitBreaker.failures} failures. ` +
          `Will retry after ${CIRCUIT_BREAKER_RESET_MS / 1000}s`,
      );
    }
  }

  /**
   * Reset circuit breaker state
   */
  private resetCircuitBreaker(): void {
    if (this.circuitBreaker.isOpen) {
      this.logger.log('Circuit breaker reset');
    }
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      isOpen: false,
    };
  }
}
