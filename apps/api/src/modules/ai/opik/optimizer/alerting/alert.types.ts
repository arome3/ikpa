/**
 * Alert Types for Optimization Failure Notifications
 *
 * Defines the interfaces for the alerting system used to notify
 * operations teams when optimization experiments fail.
 *
 * @example
 * ```typescript
 * const payload: AlertPayload = {
 *   severity: 'error',
 *   title: 'Optimization Experiment Failed',
 *   message: 'Framing optimizer failed during statistical analysis',
 *   experimentId: 'abc-123',
 *   experimentType: 'FRAMING',
 *   error: 'Division by zero in variance calculation',
 *   timestamp: new Date(),
 * };
 * ```
 */

/**
 * Severity levels for alerts
 *
 * - info: Informational messages, no action required
 * - warning: Potential issues that should be monitored
 * - error: Failures that need attention but are recoverable
 * - critical: System-wide failures requiring immediate attention
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Type of optimization experiment
 */
export type OptimizationExperimentType = 'FRAMING' | 'EVOLUTIONARY' | 'GEPA';

/**
 * Alert payload containing all information about an alert
 */
export interface AlertPayload {
  /** Severity level of the alert */
  severity: AlertSeverity;

  /** Short title summarizing the alert */
  title: string;

  /** Detailed message describing what happened */
  message: string;

  /** Unique identifier of the failed experiment (if applicable) */
  experimentId?: string;

  /** Type of optimization experiment (FRAMING, EVOLUTIONARY, GEPA) */
  experimentType?: OptimizationExperimentType;

  /** Error message from the caught exception */
  error?: string;

  /** Stack trace for debugging (only included in non-production) */
  stackTrace?: string;

  /** When the alert was generated */
  timestamp: Date;

  /** Additional context-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for alert channels
 *
 * Implement this interface to add new notification channels
 * (e.g., PagerDuty, email, SMS)
 */
export interface AlertChannel {
  /** Human-readable name of the channel */
  name: string;

  /**
   * Send an alert through this channel
   *
   * @param payload - The alert payload to send
   * @returns Promise resolving to true if send succeeded, false otherwise
   */
  send(payload: AlertPayload): Promise<boolean>;

  /**
   * Check if the channel is properly configured and available
   */
  isAvailable(): boolean;
}

/**
 * Result of sending an alert through one or more channels
 */
export interface AlertResult {
  /** Whether the alert was sent successfully through at least one channel */
  success: boolean;

  /** Results per channel */
  channelResults: Array<{
    channel: string;
    success: boolean;
    error?: string;
  }>;

  /** The original payload that was sent */
  payload: AlertPayload;
}

/**
 * Configuration for the alert service
 */
export interface AlertServiceConfig {
  /** Slack webhook URL for sending alerts */
  slackWebhookUrl?: string;

  /** Whether to log alerts to console (useful for development) */
  enableConsoleLogging: boolean;

  /** Minimum severity level to send alerts for */
  minimumSeverity: AlertSeverity;

  /** Whether to include stack traces in alerts */
  includeStackTrace: boolean;

  /** Application environment (for context in alerts) */
  environment: string;

  /** Service name to identify the source of alerts */
  serviceName: string;
}
