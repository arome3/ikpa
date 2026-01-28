/**
 * Alert Manager Unit Tests
 *
 * Tests cover:
 * - Alert configuration
 * - Error tracking in sliding windows
 * - Threshold detection
 * - Webhook firing
 * - Rate limiting
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AlertManager,
  AlertConfig,
  AlertPayload,
  METRICS_ALERT_WEBHOOK_URL_ENV,
  DEFAULT_RATE_LIMIT_MS,
} from '../alerts';

describe('AlertManager', () => {
  let manager: AlertManager;
  let mockFetch: ReturnType<typeof vi.fn>;

  const validConfig: AlertConfig = {
    metricName: 'FinancialSafety',
    threshold: 5,
    windowMs: 60000, // 1 minute
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    manager = new AlertManager({
      defaultWebhookUrl: 'https://hooks.example.com/webhook',
      rateLimitMs: 100, // Short rate limit for tests
      serviceName: 'test-service',
      fetchFn: mockFetch as typeof fetch,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('configureAlert()', () => {
    it('should configure a valid alert', () => {
      manager.configureAlert(validConfig);

      const alert = manager.getAlert('FinancialSafety');
      expect(alert).toBeDefined();
      expect(alert?.threshold).toBe(5);
      expect(alert?.windowMs).toBe(60000);
    });

    it('should update existing alert configuration', () => {
      manager.configureAlert(validConfig);
      manager.configureAlert({ ...validConfig, threshold: 10 });

      const alert = manager.getAlert('FinancialSafety');
      expect(alert?.threshold).toBe(10);
    });

    it('should throw if metric name is empty', () => {
      expect(() =>
        manager.configureAlert({ ...validConfig, metricName: '' }),
      ).toThrow('Metric name is required');
    });

    it('should throw if threshold is not positive', () => {
      expect(() =>
        manager.configureAlert({ ...validConfig, threshold: 0 }),
      ).toThrow('Threshold must be positive');
    });

    it('should throw if window is not positive', () => {
      expect(() =>
        manager.configureAlert({ ...validConfig, windowMs: 0 }),
      ).toThrow('Window must be positive');
    });

    it('should accept optional severity', () => {
      manager.configureAlert({ ...validConfig, severity: 'critical' });

      const alert = manager.getAlert('FinancialSafety');
      expect(alert?.severity).toBe('critical');
    });

    it('should accept custom webhook URL', () => {
      manager.configureAlert({
        ...validConfig,
        webhookUrl: 'https://custom.webhook.com',
      });

      const alert = manager.getAlert('FinancialSafety');
      expect(alert?.webhookUrl).toBe('https://custom.webhook.com');
    });
  });

  describe('removeAlert()', () => {
    it('should remove an existing alert', () => {
      manager.configureAlert(validConfig);

      const result = manager.removeAlert('FinancialSafety');

      expect(result).toBe(true);
      expect(manager.getAlert('FinancialSafety')).toBeUndefined();
    });

    it('should return false for non-existent alert', () => {
      const result = manager.removeAlert('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getAllAlerts()', () => {
    it('should return all configured alerts', () => {
      manager.configureAlert(validConfig);
      manager.configureAlert({
        metricName: 'ToneEmpathy',
        threshold: 10,
        windowMs: 120000,
      });

      const alerts = manager.getAllAlerts();

      expect(alerts).toHaveLength(2);
      expect(alerts.map((a) => a.metricName)).toContain('FinancialSafety');
      expect(alerts.map((a) => a.metricName)).toContain('ToneEmpathy');
    });

    it('should return empty array when no alerts', () => {
      expect(manager.getAllAlerts()).toHaveLength(0);
    });
  });

  describe('trackError()', () => {
    it('should not track if no alert configured', async () => {
      const result = await manager.trackError('unconfigured', {
        reason: 'Test error',
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should track error and not fire alert below threshold', async () => {
      manager.configureAlert(validConfig);

      // Track errors below threshold
      for (let i = 0; i < 4; i++) {
        const result = await manager.trackError('FinancialSafety', {
          reason: `Error ${i}`,
        });
        expect(result).toBe(false);
      }

      expect(mockFetch).not.toHaveBeenCalled();
      expect(manager.getErrorCount('FinancialSafety')).toBe(4);
    });

    it('should fire alert when threshold exceeded', async () => {
      manager.configureAlert(validConfig);

      // Track errors up to threshold
      for (let i = 0; i < 4; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }

      // This one should trigger alert
      const result = await manager.trackError('FinancialSafety', {
        reason: 'Error 5',
        traceId: 'trace-123',
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify payload
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://hooks.example.com/webhook');
      expect(options.method).toBe('POST');

      const payload: AlertPayload = JSON.parse(options.body);
      expect(payload.type).toBe('metric_threshold_exceeded');
      expect(payload.metricName).toBe('FinancialSafety');
      expect(payload.errorCount).toBe(5);
      expect(payload.threshold).toBe(5);
      expect(payload.service).toBe('test-service');
    });

    it('should include recent errors in payload', async () => {
      manager.configureAlert(validConfig);

      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', {
          reason: `Error ${i}`,
          traceId: `trace-${i}`,
        });
      }

      const [, options] = mockFetch.mock.calls[0];
      const payload: AlertPayload = JSON.parse(options.body);

      expect(payload.recentErrors).toHaveLength(5);
      expect(payload.recentErrors[4].traceId).toBe('trace-4');
    });

    it('should respect rate limiting', async () => {
      manager.configureAlert(validConfig);

      // First batch triggers alert
      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second batch should be rate limited (within 100ms)
      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i + 5}` });
      }
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should fire alert after rate limit expires', async () => {
      vi.useFakeTimers();
      manager.configureAlert(validConfig);

      // First batch triggers alert
      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time past rate limit
      vi.advanceTimersByTime(150);

      // Second batch should trigger another alert
      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i + 5}` });
      }
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use custom webhook URL if configured', async () => {
      manager.configureAlert({
        ...validConfig,
        webhookUrl: 'https://custom.webhook.com/alert',
      });

      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://custom.webhook.com/alert');
    });

    it('should handle webhook failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      manager.configureAlert(validConfig);

      for (let i = 0; i < 5; i++) {
        const result = await manager.trackError('FinancialSafety', {
          reason: `Error ${i}`,
        });

        // Last one triggers alert but it fails
        if (i === 4) {
          expect(result).toBe(false);
        }
      }
    });

    it('should handle webhook non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      manager.configureAlert(validConfig);

      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }

      // Alert attempted but failed
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should clean old errors from sliding window', async () => {
      vi.useFakeTimers();
      manager.configureAlert({
        metricName: 'FinancialSafety',
        threshold: 5,
        windowMs: 1000, // 1 second window
      });

      // Track 3 errors
      for (let i = 0; i < 3; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }
      expect(manager.getErrorCount('FinancialSafety')).toBe(3);

      // Advance past window
      vi.advanceTimersByTime(1500);

      // Track more errors - old ones should be cleaned
      await manager.trackError('FinancialSafety', { reason: 'New error' });
      expect(manager.getErrorCount('FinancialSafety')).toBe(1);
    });

    it('should use custom severity in payload', async () => {
      manager.configureAlert({
        ...validConfig,
        severity: 'critical',
      });

      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }

      const [, options] = mockFetch.mock.calls[0];
      const payload: AlertPayload = JSON.parse(options.body);
      expect(payload.severity).toBe('critical');
    });

    it('should use custom message template', async () => {
      manager.configureAlert({
        ...validConfig,
        messageTemplate: 'Custom alert message for FinancialSafety metric',
      });

      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }

      const [, options] = mockFetch.mock.calls[0];
      const payload: AlertPayload = JSON.parse(options.body);
      expect(payload.message).toBe('Custom alert message for FinancialSafety metric');
    });
  });

  describe('getErrorCount()', () => {
    it('should return 0 for unconfigured metric', () => {
      expect(manager.getErrorCount('unconfigured')).toBe(0);
    });

    it('should return current error count in window', () => {
      manager.configureAlert(validConfig);

      manager.trackError('FinancialSafety', { reason: 'Error 1' });
      manager.trackError('FinancialSafety', { reason: 'Error 2' });

      expect(manager.getErrorCount('FinancialSafety')).toBe(2);
    });
  });

  describe('clearErrors()', () => {
    it('should clear all errors for a metric', async () => {
      manager.configureAlert(validConfig);

      for (let i = 0; i < 3; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }

      manager.clearErrors('FinancialSafety');

      expect(manager.getErrorCount('FinancialSafety')).toBe(0);
    });
  });

  describe('resetRateLimit()', () => {
    it('should allow alert to fire immediately after reset', async () => {
      manager.configureAlert(validConfig);

      // First batch triggers alert
      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i}` });
      }
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Reset rate limit
      manager.resetRateLimit('FinancialSafety');

      // Clear errors and add new ones
      manager.clearErrors('FinancialSafety');
      for (let i = 0; i < 5; i++) {
        await manager.trackError('FinancialSafety', { reason: `Error ${i + 5}` });
      }

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('environment variable handling', () => {
    it('should use env var when no URL provided', () => {
      const originalEnv = process.env[METRICS_ALERT_WEBHOOK_URL_ENV];
      process.env[METRICS_ALERT_WEBHOOK_URL_ENV] = 'https://env.webhook.com';

      const envManager = new AlertManager({
        rateLimitMs: 100,
        fetchFn: mockFetch as typeof fetch,
      });

      // Verify it reads from env
      expect((envManager as any).defaultWebhookUrl).toBe('https://env.webhook.com');

      // Restore
      if (originalEnv !== undefined) {
        process.env[METRICS_ALERT_WEBHOOK_URL_ENV] = originalEnv;
      } else {
        delete process.env[METRICS_ALERT_WEBHOOK_URL_ENV];
      }
    });
  });

  describe('default rate limit', () => {
    it('should be 60 seconds', () => {
      expect(DEFAULT_RATE_LIMIT_MS).toBe(60000);
    });
  });
});
