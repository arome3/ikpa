/**
 * Metrics Registry Barrel Export
 *
 * Re-exports all public APIs for the Opik metrics registration system.
 *
 * @example
 * ```typescript
 * import {
 *   MetricsRegistryService,
 *   IKPAMetricDefinition,
 *   METRIC_NAME_TONE_EMPATHY,
 *   TONE_EMPATHY_METRIC,
 * } from '@/modules/ai/opik/optimizer/metrics-registry';
 * ```
 */

// Service
export { MetricsRegistryService } from './metrics-registry.service';

// Interfaces
export type {
  IMetricsRegistry,
  IKPAMetricDefinition,
  NumericalMetricDefinition,
  CategoricalMetricDefinition,
  BooleanMetricDefinition,
  MetricDefinition,
  MetricRegistrationResult,
  MetricsRegistryConfig,
  OpikMetricType,
} from './metrics-registry.interface';

// Constants - Metric names
export {
  METRIC_NAME_TONE_EMPATHY,
  METRIC_NAME_CANCELLATION_RATE,
  METRIC_NAME_TOOL_POLICY_ACCURACY,
  METRIC_NAME_GENERATION_FITNESS,
  METRIC_NAME_INTERVENTION_SUCCESS,
  METRIC_NAME_CULTURAL_SENSITIVITY,
  METRIC_NAME_FINANCIAL_SAFETY,
  METRIC_NAME_STAKE_EFFECTIVENESS,
} from './metrics-registry.constants';

// Constants - Metric definitions
export {
  TONE_EMPATHY_METRIC,
  CANCELLATION_RATE_METRIC,
  TOOL_POLICY_ACCURACY_METRIC,
  GENERATION_FITNESS_METRIC,
  INTERVENTION_SUCCESS_METRIC,
  CULTURAL_SENSITIVITY_METRIC,
  FINANCIAL_SAFETY_METRIC,
  STAKE_EFFECTIVENESS_METRIC,
  ALL_IKPA_METRICS,
  METRIC_CATEGORIES,
} from './metrics-registry.constants';
