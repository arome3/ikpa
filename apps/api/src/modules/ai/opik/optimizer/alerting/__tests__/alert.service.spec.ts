/**
 * Alert Service Unit Tests
 *
 * Tests cover:
 * - Rate limiting works correctly (11th alert in 1 minute is blocked)
 * - Old entries are cleaned up properly
 * - Different signatures have independent limits
 * - Memory leak fix verification
 * - OnModuleDestroy cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AlertService } from '../alert.service';
import {
  AlertPayload,
  AlertSeverity,
  OptimizationExperimentType,
} from '../alert.types';

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    // Create a mock ConfigService
    // Enable console logging so we have at least one available channel
    const mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          ALERT_CONSOLE_LOGGING: 'true', // Enable console logging for tests
          ALERT_MIN_SEVERITY: 'info',
          NODE_ENV: 'test',
        };
        return config[key];
      }),
    };

    // Instantiate service directly with mock
    service = new AlertService(mockConfigService as any);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  const createTestPayload = (
    overrides: Partial<AlertPayload> = {},
  ): AlertPayload => ({
    severity: 'error' as AlertSeverity,
    title: 'Test Alert',
    message: 'This is a test alert',
    timestamp: new Date(),
    ...overrides,
  });

  describe('Rate Limiting', () => {
    it('should allow first 10 alerts within 1 minute for the same signature', async () => {
      const payload = createTestPayload();

      // Send 10 alerts - all should succeed
      for (let i = 0; i < 10; i++) {
        const result = await service.sendAlert(payload);
        expect(result.success).toBe(true);
        expect(
          result.channelResults.some((r) => r.channel === 'rate_limiter'),
        ).toBe(false);
      }

      // Verify we recorded all 10 alerts
      const count = service.getAlertCountForSignature('error', 'Test Alert');
      expect(count).toBe(10);
    });

    it('should block the 11th alert within 1 minute (rate limited)', async () => {
      const payload = createTestPayload();

      // Send 10 alerts
      for (let i = 0; i < 10; i++) {
        await service.sendAlert(payload);
      }

      // 11th alert should be rate limited
      const result = await service.sendAlert(payload);
      expect(result.success).toBe(false);
      expect(
        result.channelResults.some(
          (r) => r.channel === 'rate_limiter' && r.error === 'Rate limited',
        ),
      ).toBe(true);
    });

    it('should have independent rate limits for different signatures', async () => {
      const payload1 = createTestPayload({ title: 'Alert Type A' });
      const payload2 = createTestPayload({ title: 'Alert Type B' });
      const payload3 = createTestPayload({
        title: 'Alert Type A',
        experimentType: 'FRAMING' as OptimizationExperimentType,
      });

      // Send 10 alerts for signature 1
      for (let i = 0; i < 10; i++) {
        await service.sendAlert(payload1);
      }

      // Signature 1 should be rate limited
      const result1 = await service.sendAlert(payload1);
      expect(result1.success).toBe(false);

      // Signature 2 should still work (different title)
      const result2 = await service.sendAlert(payload2);
      expect(result2.success).toBe(true);

      // Signature 3 should still work (different experiment type)
      const result3 = await service.sendAlert(payload3);
      expect(result3.success).toBe(true);
    });

    it('should track alerts per severity+title+experimentType combination', async () => {
      const payloadError = createTestPayload({
        severity: 'error',
        title: 'Same Title',
      });
      const payloadWarning = createTestPayload({
        severity: 'warning',
        title: 'Same Title',
      });

      // Send 10 error alerts
      for (let i = 0; i < 10; i++) {
        await service.sendAlert(payloadError);
      }

      // Error alerts should be rate limited
      const errorResult = await service.sendAlert(payloadError);
      expect(errorResult.success).toBe(false);

      // Warning alerts with same title should still work (different signature)
      const warningResult = await service.sendAlert(payloadWarning);
      expect(warningResult.success).toBe(true);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not grow map unbounded with unique timestamps', async () => {
      // This test verifies the memory leak fix
      // Previously, each alert had a unique key due to timestamp in key
      const payload = createTestPayload();

      // Send many alerts
      for (let i = 0; i < 20; i++) {
        await service.sendAlert(payload);
      }

      // Map should have only 1 entry (one signature)
      // not 20 entries (as it would with timestamp in key)
      expect(service.getAlertHistorySize()).toBe(1);
    });

    it('should have bounded map size with multiple signatures', async () => {
      // Send alerts with 5 different signatures
      for (let i = 0; i < 5; i++) {
        const payload = createTestPayload({ title: `Alert Type ${i}` });
        for (let j = 0; j < 3; j++) {
          await service.sendAlert(payload);
        }
      }

      // Should have exactly 5 entries (one per unique signature)
      expect(service.getAlertHistorySize()).toBe(5);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old entries when cleanupRateLimiter is called', async () => {
      const payload = createTestPayload();

      // Send some alerts
      for (let i = 0; i < 5; i++) {
        await service.sendAlert(payload);
      }

      expect(service.getAlertHistorySize()).toBe(1);
      expect(service.getAlertCountForSignature('error', 'Test Alert')).toBe(5);

      // First, verify cleanup doesn't remove recent entries
      service.cleanupRateLimiter();
      expect(service.getAlertHistorySize()).toBe(1);
    });

    it('should remove signatures with no recent timestamps during cleanup', async () => {
      vi.useFakeTimers();

      const payload = createTestPayload();
      await service.sendAlert(payload);

      expect(service.getAlertHistorySize()).toBe(1);

      // Advance time past the rate limit window (1 minute + buffer)
      vi.advanceTimersByTime(70000);

      // Run cleanup
      service.cleanupRateLimiter();

      // Entry should be removed
      expect(service.getAlertHistorySize()).toBe(0);
    });

    it('should clear all history on module destroy', async () => {
      const payload = createTestPayload();
      await service.sendAlert(payload);

      expect(service.getAlertHistorySize()).toBe(1);

      service.onModuleDestroy();

      expect(service.getAlertHistorySize()).toBe(0);
    });
  });

  describe('Sliding Window Behavior', () => {
    it('should use sliding window - old alerts expire, new ones allowed', async () => {
      vi.useFakeTimers();

      const payload = createTestPayload();

      // Send 10 alerts
      for (let i = 0; i < 10; i++) {
        await service.sendAlert(payload);
      }

      // 11th should be rate limited
      let result = await service.sendAlert(payload);
      expect(result.success).toBe(false);

      // Advance time past window (1 minute + buffer)
      vi.advanceTimersByTime(61000);

      // Now alert should work again
      result = await service.sendAlert(payload);
      expect(result.success).toBe(true);
    });

    it('should properly clean old timestamps inline during rate limit check', async () => {
      vi.useFakeTimers();

      const payload = createTestPayload();

      // Send 5 alerts
      for (let i = 0; i < 5; i++) {
        await service.sendAlert(payload);
      }

      // Advance time past window
      vi.advanceTimersByTime(61000);

      // Send 5 more alerts
      for (let i = 0; i < 5; i++) {
        await service.sendAlert(payload);
      }

      // Should have only 5 recent alerts (old ones cleaned during rate limit check)
      expect(service.getAlertCountForSignature('error', 'Test Alert')).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty alert history gracefully', async () => {
      const payload = createTestPayload();

      // First alert should always succeed
      const result = await service.sendAlert(payload);
      expect(result.success).toBe(true);
    });

    it('should handle rapid successive alerts sequentially', async () => {
      const payload = createTestPayload();

      // Send alerts sequentially but rapidly
      const results: Array<{ success: boolean }> = [];
      for (let i = 0; i < 15; i++) {
        const result = await service.sendAlert(payload);
        results.push(result);
      }

      // First 10 should succeed, rest should be rate limited
      const successCount = results.filter((r) => r.success).length;
      const rateLimitedCount = results.filter((r) => !r.success).length;

      expect(successCount).toBe(10);
      expect(rateLimitedCount).toBe(5);
    });

    it('should handle cleanup with no entries gracefully', () => {
      expect(service.getAlertHistorySize()).toBe(0);

      // Should not throw
      expect(() => service.cleanupRateLimiter()).not.toThrow();

      expect(service.getAlertHistorySize()).toBe(0);
    });

    it('should handle getAlertCountForSignature for non-existent signature', () => {
      const count = service.getAlertCountForSignature(
        'critical',
        'NonExistent',
        'GEPA',
      );
      expect(count).toBe(0);
    });
  });

  describe('Convenience Methods', () => {
    it('should rate limit sendOptimizationFailure correctly', async () => {
      // Send 10 optimization failures
      for (let i = 0; i < 10; i++) {
        await service.sendOptimizationFailure(
          `exp-${i}`,
          'FRAMING',
          new Error('Test error'),
        );
      }

      // 11th should be rate limited
      const result = await service.sendOptimizationFailure(
        'exp-11',
        'FRAMING',
        new Error('Test error'),
      );

      expect(result.success).toBe(false);
    });

    it('should rate limit sendWarning correctly', async () => {
      for (let i = 0; i < 10; i++) {
        await service.sendWarning('Test Warning', 'Warning message');
      }

      const result = await service.sendWarning('Test Warning', 'Warning message');
      expect(result.success).toBe(false);
    });

    it('should rate limit sendCritical correctly', async () => {
      for (let i = 0; i < 10; i++) {
        await service.sendCritical('Test Critical', 'Critical message');
      }

      const result = await service.sendCritical(
        'Test Critical',
        'Critical message',
      );
      expect(result.success).toBe(false);
    });
  });
});
