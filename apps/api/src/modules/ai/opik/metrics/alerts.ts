/**
 * Webhook Alerts for Metrics
 *
 * Monitors metric failures and sends webhook alerts when thresholds are exceeded.
 * Implements sliding window error tracking and rate limiting.
 *
 * Features:
 * - Configurable error thresholds per metric
 * - Sliding window error counting
 * - Rate limiting (max 1 alert per minute per metric)
 * - Webhook delivery with retry logic
 *
 * @example
 * ```typescript
 * const manager = new AlertManager({
 *   defaultWebhookUrl: 'https://hooks.slack.com/...',
 * });
 *
 * // Configure alert for a metric
 * manager.configureAlert({
 *   metricName: 'FinancialSafety',
 *   threshold: 5, // 5 errors
 *   windowMs: 60000, // in 1 minute
 * });
 *
 * // Track errors (called by MetricsService)
 * manager.trackError('FinancialSafety', {
 *   traceId: 'trace-123',
 *   reason: 'Unsafe financial advice detected',
 * });
 * ```
 */

import { Logger } from '@nestjs/common';

/**
 * Alert configuration for a metric
 */
export interface AlertConfig {
  /** Name of the metric to monitor */
  metricName: string;

  /** Error count threshold to trigger alert */
  threshold: number;

  /** Time window in milliseconds for counting errors */
  windowMs: number;

  /** Optional custom webhook URL (overrides default) */
  webhookUrl?: string;

  /** Optional alert severity */
  severity?: 'low' | 'medium' | 'high' | 'critical';

  /** Optional custom message template */
  messageTemplate?: string;
}

/**
 * Error details for tracking
 */
export interface ErrorDetails {
  /** Trace ID for debugging */
  traceId?: string;

  /** Error reason/message */
  reason: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Alert payload sent to webhook
 */
export interface AlertPayload {
  /** Alert type identifier */
  type: 'metric_threshold_exceeded';

  /** Metric name that triggered the alert */
  metricName: string;

  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** Alert message */
  message: string;

  /** Error count in the window */
  errorCount: number;

  /** Configured threshold */
  threshold: number;

  /** Window duration in milliseconds */
  windowMs: number;

  /** Recent error details (last 5) */
  recentErrors: Array<{
    traceId?: string;
    reason: string;
    timestamp: string;
  }>;

  /** Alert timestamp */
  timestamp: string;

  /** Environment (from NODE_ENV) */
  environment: string;

  /** Service identifier */
  service: string;
}

/**
 * Internal error record for sliding window
 */
interface ErrorRecord {
  timestamp: Date;
  details: ErrorDetails;
}

/**
 * Alert manager options
 */
export interface AlertManagerOptions {
  /** Default webhook URL for all alerts */
  defaultWebhookUrl?: string;

  /** Minimum interval between alerts for same metric (ms) */
  rateLimitMs?: number;

  /** Service name for alert payloads */
  serviceName?: string;

  /** Custom fetch implementation (for testing) */
  fetchFn?: typeof fetch;
}

/**
 * Environment variable name for default webhook URL
 */
export const METRICS_ALERT_WEBHOOK_URL_ENV = 'METRICS_ALERT_WEBHOOK_URL';

/**
 * Default rate limit: 1 alert per minute per metric
 */
export const DEFAULT_RATE_LIMIT_MS = 60000;

/**
 * Maximum errors to keep in memory per metric
 */
const MAX_ERRORS_PER_METRIC = 1000;

/**
 * Alert Manager
 *
 * Tracks errors in sliding windows and fires webhook alerts when thresholds are exceeded.
 */
export class AlertManager {
  private readonly logger = new Logger(AlertManager.name);

  /** Alert configurations per metric */
  private readonly configs = new Map<string, AlertConfig>();

  /** Error records per metric (sliding window) */
  private readonly errors = new Map<string, ErrorRecord[]>();

  /** Last alert timestamp per metric (for rate limiting) */
  private readonly lastAlertTime = new Map<string, number>();

  /** Default webhook URL */
  private readonly defaultWebhookUrl: string | undefined;

  /** Rate limit interval */
  private readonly rateLimitMs: number;

  /** Service name */
  private readonly serviceName: string;

  /** Fetch function */
  private readonly fetchFn: typeof fetch;

  constructor(options: AlertManagerOptions = {}) {
    // Get default webhook URL from env or options
    this.defaultWebhookUrl =
      options.defaultWebhookUrl ?? process.env[METRICS_ALERT_WEBHOOK_URL_ENV];

    this.rateLimitMs = options.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;
    this.serviceName = options.serviceName ?? 'ikpa-metrics';
    this.fetchFn = options.fetchFn ?? globalThis.fetch;

    if (!this.defaultWebhookUrl) {
      this.logger.warn(
        `No default webhook URL configured. Set ${METRICS_ALERT_WEBHOOK_URL_ENV} environment variable.`,
      );
    }
  }

  /**
   * Configure alert for a metric
   *
   * @param config - Alert configuration
   */
  configureAlert(config: AlertConfig): void {
    this.validateConfig(config);
    this.configs.set(config.metricName, config);
    this.errors.set(config.metricName, []);

    this.logger.log(
      `Configured alert for "${config.metricName}": ` +
        `threshold=${config.threshold}, window=${config.windowMs}ms`,
    );
  }

  /**
   * Remove alert configuration for a metric
   *
   * @param metricName - Name of the metric
   * @returns true if config was removed
   */
  removeAlert(metricName: string): boolean {
    const removed = this.configs.delete(metricName);
    this.errors.delete(metricName);
    this.lastAlertTime.delete(metricName);

    if (removed) {
      this.logger.log(`Removed alert configuration for "${metricName}"`);
    }

    return removed;
  }

  /**
   * Get alert configuration for a metric
   *
   * @param metricName - Name of the metric
   * @returns Alert configuration or undefined
   */
  getAlert(metricName: string): AlertConfig | undefined {
    return this.configs.get(metricName);
  }

  /**
   * Get all alert configurations
   *
   * @returns Array of alert configurations
   */
  getAllAlerts(): AlertConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Track an error for a metric
   *
   * This method checks if threshold is exceeded and fires alert if needed.
   *
   * @param metricName - Name of the metric
   * @param details - Error details
   * @returns true if an alert was fired
   */
  async trackError(metricName: string, details: ErrorDetails): Promise<boolean> {
    const config = this.configs.get(metricName);
    if (!config) {
      // No alert configured for this metric, just log
      this.logger.debug(`No alert configured for metric "${metricName}", skipping`);
      return false;
    }

    // Add error to sliding window
    let errorRecords = this.errors.get(metricName);
    if (!errorRecords) {
      errorRecords = [];
      this.errors.set(metricName, errorRecords);
    }

    const now = Date.now();
    errorRecords.push({
      timestamp: new Date(now),
      details,
    });

    // Clean old errors outside window
    const windowStart = now - config.windowMs;
    const filteredErrors = errorRecords.filter(
      (e) => e.timestamp.getTime() > windowStart,
    );

    // Also limit memory usage
    const trimmedErrors =
      filteredErrors.length > MAX_ERRORS_PER_METRIC
        ? filteredErrors.slice(-MAX_ERRORS_PER_METRIC)
        : filteredErrors;

    this.errors.set(metricName, trimmedErrors);

    // Check threshold
    if (trimmedErrors.length >= config.threshold) {
      return this.maybeFireAlert(metricName, config, trimmedErrors);
    }

    return false;
  }

  /**
   * Get current error count for a metric
   *
   * @param metricName - Name of the metric
   * @returns Current error count in window, or 0 if not configured
   */
  getErrorCount(metricName: string): number {
    const config = this.configs.get(metricName);
    const errors = this.errors.get(metricName);

    if (!config || !errors) {
      return 0;
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;
    return errors.filter((e) => e.timestamp.getTime() > windowStart).length;
  }

  /**
   * Clear all errors for a metric
   *
   * @param metricName - Name of the metric
   */
  clearErrors(metricName: string): void {
    this.errors.set(metricName, []);
    this.logger.log(`Cleared errors for metric "${metricName}"`);
  }

  /**
   * Reset rate limit for a metric (useful for testing)
   *
   * @param metricName - Name of the metric
   */
  resetRateLimit(metricName: string): void {
    this.lastAlertTime.delete(metricName);
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  /**
   * Validate alert configuration
   */
  private validateConfig(config: AlertConfig): void {
    if (!config.metricName || config.metricName.trim() === '') {
      throw new Error('Metric name is required');
    }

    if (config.threshold <= 0) {
      throw new Error('Threshold must be positive');
    }

    if (config.windowMs <= 0) {
      throw new Error('Window must be positive');
    }
  }

  /**
   * Fire alert if not rate limited
   */
  private async maybeFireAlert(
    metricName: string,
    config: AlertConfig,
    errors: ErrorRecord[],
  ): Promise<boolean> {
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(metricName) ?? 0;

    // Check rate limit
    if (now - lastAlert < this.rateLimitMs) {
      this.logger.debug(
        `Alert rate limited for "${metricName}", last alert ${now - lastAlert}ms ago`,
      );
      return false;
    }

    // Fire alert
    const webhookUrl = config.webhookUrl ?? this.defaultWebhookUrl;
    if (!webhookUrl) {
      this.logger.error(
        `Cannot fire alert for "${metricName}": No webhook URL configured`,
      );
      return false;
    }

    // Update rate limit timestamp before firing (to prevent duplicate alerts)
    this.lastAlertTime.set(metricName, now);

    try {
      await this.fireWebhook(webhookUrl, metricName, config, errors);
      this.logger.warn(
        `Alert fired for "${metricName}": ${errors.length} errors in ${config.windowMs}ms window`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to fire webhook for "${metricName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Reset rate limit so we can retry
      this.lastAlertTime.set(metricName, lastAlert);
      return false;
    }
  }

  /**
   * Fire webhook with alert payload
   */
  private async fireWebhook(
    webhookUrl: string,
    metricName: string,
    config: AlertConfig,
    errors: ErrorRecord[],
  ): Promise<void> {
    const payload = this.buildPayload(metricName, config, errors);

    const response = await this.fetchFn(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Build alert payload
   */
  private buildPayload(
    metricName: string,
    config: AlertConfig,
    errors: ErrorRecord[],
  ): AlertPayload {
    const severity = config.severity ?? 'medium';
    const recentErrors = errors.slice(-5).map((e) => ({
      traceId: e.details.traceId,
      reason: e.details.reason,
      timestamp: e.timestamp.toISOString(),
    }));

    const message =
      config.messageTemplate ??
      `Metric "${metricName}" exceeded error threshold: ${errors.length}/${config.threshold} errors in ${config.windowMs}ms window`;

    return {
      type: 'metric_threshold_exceeded',
      metricName,
      severity,
      message,
      errorCount: errors.length,
      threshold: config.threshold,
      windowMs: config.windowMs,
      recentErrors,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? 'development',
      service: this.serviceName,
    };
  }
}
