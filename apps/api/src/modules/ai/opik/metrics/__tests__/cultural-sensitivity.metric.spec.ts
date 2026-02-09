/**
 * CulturalSensitivityMetric Unit Tests
 *
 * Tests cover:
 * - LLM evaluation for cultural appropriateness
 * - Context building (country, culture, currency)
 * - Circuit breaker check before LLM calls
 * - Graceful degradation when AI unavailable
 * - Score validation (1-5 range)
 * - Parse error handling
 * - Metadata in results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CulturalSensitivityMetric } from '../cultural-sensitivity.metric';
import { AnthropicService } from '../../../anthropic';
import { DatasetItem } from '../interfaces';
import { resetGlobalMetricsCache } from '../local-cache';

describe('CulturalSensitivityMetric', () => {
  let metric: CulturalSensitivityMetric;
  let anthropicService: Partial<AnthropicService>;

  const mockGenerate = vi.fn();
  const mockIsAvailable = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global local cache to prevent test pollution
    resetGlobalMetricsCache();
    mockIsAvailable.mockReturnValue(true);

    anthropicService = {
      isAvailable: mockIsAvailable,
      generate: mockGenerate,
    };

    // Create metric directly with mocked service
    metric = new CulturalSensitivityMetric(anthropicService as AnthropicService);
  });

  describe('metric metadata', () => {
    it('should have correct name', () => {
      expect(metric.name).toBe('CulturalSensitivity');
    });

    it('should have correct scale', () => {
      expect(metric.scale).toBe(5);
    });

    it('should have correct description', () => {
      expect(metric.description).toBe('Evaluates cultural appropriateness for users');
    });
  });

  describe('LLM evaluation', () => {
    it('should call LLM with context information', async () => {
      const datasetItem: DatasetItem = {
        input: 'I send money to my family monthly',
        output: '',
        context: {
          country: 'US',
          culture: 'diverse',
          currency: 'USD',
        },
      };

      mockGenerate.mockResolvedValue({
        content: JSON.stringify({
          score: 5,
          reason: 'Excellent sensitivity to personal values and family obligations',
        }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
      });

      const result = await metric.score(
        datasetItem,
        'Supporting your family is important. Let\'s budget it as a priority.',
      );

      expect(mockGenerate).toHaveBeenCalled();
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs).toContain('Country: US');
      expect(callArgs).toContain('Cultural context: diverse');
      expect(callArgs).toContain('Currency: USD');

      expect(result.score).toBe(5);
      expect(result.reason).toBe('Excellent sensitivity to personal values and family obligations');
    });

    it('should handle missing context gracefully', async () => {
      const datasetItem: DatasetItem = {
        input: 'I send money to my family',
        output: '',
      };

      mockGenerate.mockResolvedValue({
        content: JSON.stringify({ score: 4, reason: 'Good cultural awareness' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 150, completionTokens: 50, totalTokens: 200 },
      });

      const result = await metric.score(datasetItem, 'Response');

      expect(mockGenerate).toHaveBeenCalled();
      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs).toContain('No specific context provided');

      expect(result.score).toBe(4);
    });

    it('should validate score is within 1-5 range', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      mockGenerate.mockResolvedValue({
        content: JSON.stringify({ score: 7, reason: 'Too high' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await metric.score(datasetItem, 'Response');

      expect(result.score).toBe(5); // Capped at 5
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      mockGenerate.mockResolvedValue({
        content: 'Invalid JSON response',
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await metric.score(datasetItem, 'Response');

      expect(result.score).toBe(3); // Default score
      expect(result.reason).toContain('Failed to parse');
    });

    it('should include additional context fields', async () => {
      const datasetItem: DatasetItem = {
        input: 'Test',
        output: '',
        context: {
          country: 'US',
          customField: 'custom value',
        },
      };

      mockGenerate.mockResolvedValue({
        content: JSON.stringify({ score: 4, reason: 'Good' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await metric.score(datasetItem, 'Response');

      const callArgs = mockGenerate.mock.calls[0][0];
      expect(callArgs).toContain('Country: US');
      expect(callArgs).toContain('customField:');
    });
  });

  describe('circuit breaker and graceful degradation', () => {
    it('should check circuit breaker before making LLM calls', async () => {
      mockIsAvailable.mockReturnValue(false);

      const datasetItem: DatasetItem = {
        input: 'I send money to family',
        output: '',
        context: { country: 'US' },
      };
      const result = await metric.score(datasetItem, 'Supporting your family is a priority.');

      // Should return default without calling LLM
      expect(result.score).toBe(3);
      expect(result.reason).toBe('AI service unavailable for evaluation');
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it('should return default score when AI service unavailable', async () => {
      mockIsAvailable.mockReturnValue(false);

      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const result = await metric.score(datasetItem, 'Response');

      expect(result.score).toBe(3);
      expect(result.reason).toBe('AI service unavailable for evaluation');
      expect(result.metadata?.isDefault).toBe(true);
    });

    it('should call isAvailable before each LLM evaluation', async () => {
      // First call - service available
      mockIsAvailable.mockReturnValue(true);
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({ score: 4, reason: 'Good' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      await metric.score(datasetItem, 'Response 1');

      expect(mockIsAvailable).toHaveBeenCalledTimes(1);
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Second call - service now unavailable (circuit breaker open)
      mockIsAvailable.mockReturnValue(false);
      const result = await metric.score(datasetItem, 'Response 2');

      expect(mockIsAvailable).toHaveBeenCalledTimes(2);
      // Should NOT call generate again due to circuit breaker
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(result.score).toBe(3);
      expect(result.metadata?.isDefault).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      mockGenerate.mockRejectedValue(new Error('Network error'));

      const result = await metric.score(datasetItem, 'Response');

      expect(result.score).toBe(3);
      expect(result.reason).toContain('Evaluation failed');
      expect(result.reason).toContain('Network error');
      expect(result.metadata?.error).toBe(true);
    });
  });
});
