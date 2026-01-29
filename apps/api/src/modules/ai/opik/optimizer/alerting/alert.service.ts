/**
 * Alert Service for Optimization Failure Notifications
 *
 * Provides alerting capabilities for optimization experiment failures.
 * Supports multiple channels (Slack webhook, console logging) with
 * graceful degradation when channels are unavailable.
 *
 * Key Features:
 * - Multi-channel alert delivery (Slack, console)
 * - Graceful degradation when webhooks not configured
 * - Environment-aware configuration
 * - Convenience methods for common alert types
 * - Rate limiting to prevent alert storms
 *
 * @example
 * ```typescript
 * // Send a general alert
 * await alertService.sendAlert({
 *   severity: 'error',
 *   title: 'Optimization Failed',
 *   message: 'Framing experiment abc-123 failed',
 *   timestamp: new Date(),
 * });
 *
 * // Use convenience method for optimization failures
 * await alertService.sendOptimizationFailure(
 *   'abc-123',
 *   'FRAMING',
 *   new Error('Division by zero'),
 * );
 * ```
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AlertPayload,
  AlertChannel,
  AlertResult,
  AlertServiceConfig,
  AlertSeverity,
  OptimizationExperimentType,
} from './alert.types';

/**
 * Slack webhook channel implementation
 */
class SlackChannel implements AlertChannel {
  readonly name = 'slack';
  private readonly webhookUrl: string | undefined;
  private readonly logger = new Logger(SlackChannel.name);

  constructor(webhookUrl: string | undefined) {
    this.webhookUrl = webhookUrl;
  }

  isAvailable(): boolean {
    return !!this.webhookUrl && this.webhookUrl.startsWith('https://');
  }

  async send(payload: AlertPayload): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const slackPayload = this.formatSlackMessage(payload);

      const response = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      });

      if (!response.ok) {
        this.logger.error(
          `Slack webhook failed: ${response.status} ${response.statusText}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send Slack alert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  private formatSlackMessage(payload: AlertPayload): Record<string, unknown> {
    const severityEmoji = {
      info: ':information_source:',
      warning: ':warning:',
      error: ':x:',
      critical: ':rotating_light:',
    };

    const severityColor = {
      info: '#36a64f',
      warning: '#ffcc00',
      error: '#ff6600',
      critical: '#ff0000',
    };

    const fields: Array<{ title: string; value: string; short: boolean }> = [];

    if (payload.experimentId) {
      fields.push({
        title: 'Experiment ID',
        value: payload.experimentId,
        short: true,
      });
    }

    if (payload.experimentType) {
      fields.push({
        title: 'Experiment Type',
        value: payload.experimentType,
        short: true,
      });
    }

    if (payload.error) {
      fields.push({
        title: 'Error',
        value: `\`${payload.error}\``,
        short: false,
      });
    }

    fields.push({
      title: 'Timestamp',
      value: payload.timestamp.toISOString(),
      short: true,
    });

    // Add metadata fields
    if (payload.metadata) {
      for (const [key, value] of Object.entries(payload.metadata)) {
        fields.push({
          title: key,
          value: String(value),
          short: true,
        });
      }
    }

    const blocks: unknown[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji[payload.severity]} ${payload.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: payload.message,
        },
      },
    ];

    // Add stack trace as a collapsible code block if present
    if (payload.stackTrace) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n\`\`\`${payload.stackTrace.slice(0, 2000)}\`\`\``,
        },
      });
    }

    return {
      attachments: [
        {
          color: severityColor[payload.severity],
          fields,
        },
      ],
      blocks,
    };
  }
}

/**
 * Console logging channel implementation
 */
class ConsoleChannel implements AlertChannel {
  readonly name = 'console';
  private readonly logger = new Logger('AlertService');
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  async send(payload: AlertPayload): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    const logMethod = {
      info: 'log',
      warning: 'warn',
      error: 'error',
      critical: 'error',
    }[payload.severity] as 'log' | 'warn' | 'error';

    const logMessage = [
      `[ALERT] ${payload.severity.toUpperCase()}: ${payload.title}`,
      `Message: ${payload.message}`,
      payload.experimentId ? `Experiment ID: ${payload.experimentId}` : null,
      payload.experimentType ? `Experiment Type: ${payload.experimentType}` : null,
      payload.error ? `Error: ${payload.error}` : null,
      payload.stackTrace ? `Stack Trace:\n${payload.stackTrace}` : null,
      `Timestamp: ${payload.timestamp.toISOString()}`,
      payload.metadata ? `Metadata: ${JSON.stringify(payload.metadata)}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    this.logger[logMethod](logMessage);

    return true;
  }
}

@Injectable()
export class AlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertService.name);
  private readonly channels: AlertChannel[] = [];
  private config: AlertServiceConfig;

  // Rate limiting: track recent alerts to prevent storms
  // Key = alert signature (severity:title:experimentType)
  // Value = array of timestamps when alerts were sent
  private alertHistory: Map<string, number[]> = new Map();
  private readonly rateLimitWindowMs = 60000; // 1 minute
  private readonly maxAlertsPerWindow = 10;
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly configService: ConfigService) {
    // Initialize config with defaults
    this.config = {
      slackWebhookUrl: undefined,
      enableConsoleLogging: true,
      minimumSeverity: 'warning',
      includeStackTrace: false,
      environment: 'development',
      serviceName: 'optimizer',
    };
  }

  onModuleInit(): void {
    // Load configuration from environment
    this.config = {
      slackWebhookUrl: this.configService.get<string>('SLACK_WEBHOOK_URL'),
      enableConsoleLogging:
        this.configService.get<string>('ALERT_CONSOLE_LOGGING') !== 'false',
      minimumSeverity:
        (this.configService.get<string>('ALERT_MIN_SEVERITY') as AlertSeverity) ||
        'warning',
      includeStackTrace:
        this.configService.get<string>('NODE_ENV') !== 'production' ||
        this.configService.get<string>('ALERT_INCLUDE_STACK_TRACE') === 'true',
      environment:
        this.configService.get<string>('NODE_ENV') || 'development',
      serviceName:
        this.configService.get<string>('SERVICE_NAME') || 'optimizer',
    };

    // Initialize channels
    this.channels.push(new SlackChannel(this.config.slackWebhookUrl));
    this.channels.push(new ConsoleChannel(this.config.enableConsoleLogging));

    // Log initialization status
    const availableChannels = this.channels
      .filter((c) => c.isAvailable())
      .map((c) => c.name);

    this.logger.log(
      `AlertService initialized with channels: ${availableChannels.join(', ') || 'none'}`,
    );

    if (!this.config.slackWebhookUrl) {
      this.logger.warn(
        'SLACK_WEBHOOK_URL not configured - Slack alerts disabled',
      );
    }

    // Start periodic cleanup of stale rate limiter entries
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupRateLimiter();
    }, this.cleanupIntervalMs);
  }

  /**
   * Clean up when the module is destroyed
   */
  onModuleDestroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.alertHistory.clear();
  }

  /**
   * Send an alert through all available channels
   */
  async sendAlert(payload: AlertPayload): Promise<AlertResult> {
    // Check rate limiting
    if (this.isRateLimited(payload)) {
      this.logger.warn(
        `Alert rate limited: ${payload.title} (${payload.severity})`,
      );
      return {
        success: false,
        channelResults: [
          {
            channel: 'rate_limiter',
            success: false,
            error: 'Rate limited',
          },
        ],
        payload,
      };
    }

    // Check minimum severity
    if (!this.meetsMinimumSeverity(payload.severity)) {
      return {
        success: true,
        channelResults: [],
        payload,
      };
    }

    // Enrich payload with service context
    const enrichedPayload: AlertPayload = {
      ...payload,
      metadata: {
        ...payload.metadata,
        environment: this.config.environment,
        serviceName: this.config.serviceName,
      },
      // Strip stack trace in production unless explicitly enabled
      stackTrace: this.config.includeStackTrace ? payload.stackTrace : undefined,
    };

    // Send through all available channels
    const channelResults: AlertResult['channelResults'] = [];

    for (const channel of this.channels) {
      if (!channel.isAvailable()) {
        continue;
      }

      try {
        const success = await channel.send(enrichedPayload);
        channelResults.push({
          channel: channel.name,
          success,
        });
      } catch (error) {
        channelResults.push({
          channel: channel.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Record alert for rate limiting
    this.recordAlert(payload);

    const success = channelResults.some((r) => r.success);

    if (!success && channelResults.length > 0) {
      this.logger.error(
        `Failed to send alert through any channel: ${payload.title}`,
      );
    }

    return {
      success,
      channelResults,
      payload: enrichedPayload,
    };
  }

  /**
   * Convenience method for sending optimization failure alerts
   */
  async sendOptimizationFailure(
    experimentId: string,
    experimentType: OptimizationExperimentType,
    error: Error | string,
    metadata?: Record<string, unknown>,
  ): Promise<AlertResult> {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;

    const typeNames: Record<OptimizationExperimentType, string> = {
      FRAMING: 'Framing Optimizer',
      EVOLUTIONARY: 'Letter Optimizer',
      GEPA: 'Tool Optimizer',
    };

    return this.sendAlert({
      severity: 'error',
      title: `${typeNames[experimentType]} Experiment Failed`,
      message: `Optimization experiment ${experimentId} failed during execution. ` +
        `The experiment has been marked as FAILED in the database.`,
      experimentId,
      experimentType,
      error: errorMessage,
      stackTrace,
      timestamp: new Date(),
      metadata,
    });
  }

  /**
   * Send a warning alert (non-critical issues)
   */
  async sendWarning(
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<AlertResult> {
    return this.sendAlert({
      severity: 'warning',
      title,
      message,
      timestamp: new Date(),
      metadata,
    });
  }

  /**
   * Send a critical alert (requires immediate attention)
   */
  async sendCritical(
    title: string,
    message: string,
    error?: Error | string,
    metadata?: Record<string, unknown>,
  ): Promise<AlertResult> {
    const errorMessage =
      error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;

    return this.sendAlert({
      severity: 'critical',
      title,
      message,
      error: errorMessage,
      stackTrace,
      timestamp: new Date(),
      metadata,
    });
  }

  /**
   * Generate a unique signature for an alert type
   * This groups similar alerts together for rate limiting purposes
   */
  private getAlertSignature(payload: AlertPayload): string {
    return `${payload.severity}:${payload.title}:${payload.experimentType || 'general'}`;
  }

  /**
   * Check if an alert should be rate limited
   * Uses sliding window rate limiting per unique alert signature
   */
  private isRateLimited(payload: AlertPayload): boolean {
    const signature = this.getAlertSignature(payload);
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;

    // Get existing timestamps for this signature
    const timestamps = this.alertHistory.get(signature);

    if (!timestamps || timestamps.length === 0) {
      return false;
    }

    // Filter to only timestamps within the current window
    const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

    // Update the stored timestamps (cleanup old ones inline)
    if (recentTimestamps.length !== timestamps.length) {
      if (recentTimestamps.length === 0) {
        this.alertHistory.delete(signature);
      } else {
        this.alertHistory.set(signature, recentTimestamps);
      }
    }

    return recentTimestamps.length >= this.maxAlertsPerWindow;
  }

  /**
   * Record an alert for rate limiting purposes
   */
  private recordAlert(payload: AlertPayload): void {
    const signature = this.getAlertSignature(payload);
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;

    // Get existing timestamps or create new array
    const timestamps = this.alertHistory.get(signature) || [];

    // Filter out old timestamps and add new one
    const recentTimestamps = timestamps.filter((ts) => ts > windowStart);
    recentTimestamps.push(now);

    this.alertHistory.set(signature, recentTimestamps);
  }

  /**
   * Clean up stale entries from the rate limiter
   * Removes signatures that have no timestamps within the current window
   */
  cleanupRateLimiter(): void {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;
    let removedCount = 0;

    for (const [signature, timestamps] of this.alertHistory.entries()) {
      // Filter to only timestamps within the current window
      const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

      if (recentTimestamps.length === 0) {
        // No recent timestamps, remove the entry entirely
        this.alertHistory.delete(signature);
        removedCount++;
      } else if (recentTimestamps.length !== timestamps.length) {
        // Some old timestamps removed, update the entry
        this.alertHistory.set(signature, recentTimestamps);
      }
    }

    if (removedCount > 0) {
      this.logger.debug(
        `Rate limiter cleanup: removed ${removedCount} stale entries`,
      );
    }
  }

  /**
   * Get the current size of the alert history map (for monitoring/testing)
   */
  getAlertHistorySize(): number {
    return this.alertHistory.size;
  }

  /**
   * Get the current alert count for a specific signature (for testing)
   */
  getAlertCountForSignature(
    severity: string,
    title: string,
    experimentType?: string,
  ): number {
    const signature = `${severity}:${title}:${experimentType || 'general'}`;
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;
    const timestamps = this.alertHistory.get(signature) || [];
    return timestamps.filter((ts) => ts > windowStart).length;
  }

  /**
   * Check if severity meets minimum threshold
   */
  private meetsMinimumSeverity(severity: AlertSeverity): boolean {
    const severityOrder: AlertSeverity[] = [
      'info',
      'warning',
      'error',
      'critical',
    ];
    const minIndex = severityOrder.indexOf(this.config.minimumSeverity);
    const currentIndex = severityOrder.indexOf(severity);
    return currentIndex >= minIndex;
  }

  /**
   * Get the current configuration (for testing/debugging)
   */
  getConfig(): Readonly<AlertServiceConfig> {
    return { ...this.config };
  }

  /**
   * Get available channel names
   */
  getAvailableChannels(): string[] {
    return this.channels.filter((c) => c.isAvailable()).map((c) => c.name);
  }
}
