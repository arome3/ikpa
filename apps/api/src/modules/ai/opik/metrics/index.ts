/**
 * Metrics Module Barrel Export
 *
 * Re-exports all public APIs for convenient importing:
 *
 * ```typescript
 * import {
 *   MetricsModule,
 *   MetricsService,
 *   ToneEmpathyMetric,
 *   MetricResult,
 *   DatasetItem,
 *   ABTestManager,
 *   AlertManager,
 * } from '@/modules/ai/opik/metrics';
 * ```
 */

// Module
export * from './metrics.module';

// Service
export * from './metrics.service';

// Individual metrics
export * from './intervention-success.metric';
export * from './tone-empathy.metric';
export * from './cultural-sensitivity.metric';
export * from './financial-safety.metric';
export * from './stake-effectiveness.metric';

// Base classes
export * from './base.metric';

// Interfaces
export * from './interfaces';

// Constants
export * from './metrics.constants';

// Utilities (for advanced usage)
export {
  llmSemaphore,
  withRetry,
  validateAndSanitizeInput,
  singleFlight,
  getMetricsUtilStats,
  isRetryableError,
  calculateBackoffDelay,
  type UtilTraceContext,
  type RetryOptions,
  type SingleFlightOptions,
} from './metrics.utils';

// Observability (for monitoring and debugging)
export {
  MetricsObserver,
  MetricsObserverImpl,
  resetMetricsObserver,
  type MetricsSnapshot,
  type LatencyHistogram,
  type HistogramBucket,
  type ErrorStats,
  type ObserverTraceContext,
} from './metrics.observer';

// Local cache (for Redis fallback)
export {
  LocalCache,
  getGlobalMetricsCache,
  resetGlobalMetricsCache,
  type LocalCacheOptions,
  type LocalCacheStats,
} from './local-cache';

// A/B Testing
export {
  ABTestManager,
  type ABTestConfig,
  type ABTestVariant,
  type ABTestResult,
  type VariantStats,
  type ABTestComparisonStats,
} from './ab-testing';

// Webhook Alerts
export {
  AlertManager,
  METRICS_ALERT_WEBHOOK_URL_ENV,
  DEFAULT_RATE_LIMIT_MS,
  type AlertConfig,
  type ErrorDetails,
  type AlertPayload,
  type AlertManagerOptions,
} from './alerts';
