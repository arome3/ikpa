/**
 * Metrics Registry Interfaces
 *
 * Type definitions for custom metric registration with Opik.
 * These metrics define scoring dimensions visible in the Opik UI.
 */

/**
 * Metric type classification for Opik feedback definitions
 */
export type OpikMetricType = 'numerical' | 'categorical' | 'boolean';

/**
 * Base metric definition for all IKPA metrics
 */
export interface MetricDefinition {
  /** Unique identifier for the metric */
  id?: string;
  /** Metric name (must be unique within workspace) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Type of metric */
  type: OpikMetricType;
}

/**
 * Numerical metric definition with min/max bounds
 */
export interface NumericalMetricDefinition extends MetricDefinition {
  type: 'numerical';
  /** Minimum value for the metric */
  min: number;
  /** Maximum value for the metric */
  max: number;
  /** Optional unit label (e.g., "points", "%") */
  unit?: string;
}

/**
 * Categorical metric definition with named categories
 */
export interface CategoricalMetricDefinition extends MetricDefinition {
  type: 'categorical';
  /** Map of category names to numeric values */
  categories: Record<string, number>;
}

/**
 * Boolean metric definition with true/false labels
 */
export interface BooleanMetricDefinition extends MetricDefinition {
  type: 'boolean';
  /** Label for true/positive value */
  trueLabel: string;
  /** Label for false/negative value */
  falseLabel: string;
}

/**
 * Union type for all metric definitions
 */
export type IKPAMetricDefinition =
  | NumericalMetricDefinition
  | CategoricalMetricDefinition
  | BooleanMetricDefinition;

/**
 * Result of metric registration attempt
 */
export interface MetricRegistrationResult {
  /** Metric name */
  name: string;
  /** Whether registration succeeded */
  success: boolean;
  /** Error message if registration failed */
  error?: string;
  /** Whether metric already existed */
  alreadyExists?: boolean;
}

/**
 * Metrics registry configuration
 */
export interface MetricsRegistryConfig {
  /** Whether to skip registration if metric already exists */
  skipExisting?: boolean;
  /** Whether to update existing metrics with new definitions */
  updateExisting?: boolean;
  /** Project name for metrics (optional, uses default if not specified) */
  projectName?: string;
}

/**
 * Interface for the metrics registry service
 */
export interface IMetricsRegistry {
  /**
   * Register all IKPA metrics with Opik
   * @param config - Registration configuration
   * @returns Results for each metric registration
   */
  registerMetrics(config?: MetricsRegistryConfig): Promise<MetricRegistrationResult[]>;

  /**
   * Get all registered metric definitions
   * @returns Array of metric definitions
   */
  getMetricDefinitions(): IKPAMetricDefinition[];

  /**
   * Check if a metric is registered
   * @param name - Metric name
   * @returns True if registered
   */
  isMetricRegistered(name: string): Promise<boolean>;

  /**
   * Get a metric definition by name
   * @param name - Metric name
   * @returns Metric definition or undefined
   */
  getMetricDefinition(name: string): IKPAMetricDefinition | undefined;
}
