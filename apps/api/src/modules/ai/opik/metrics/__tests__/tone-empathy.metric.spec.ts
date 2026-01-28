/**
 * ToneEmpathyMetric Unit Tests
 *
 * Tests cover:
 * - Banned word detection (fast path)
 * - Pre-compiled regex patterns for performance
 * - LLM evaluation when no banned words
 * - Circuit breaker check before LLM calls
 * - Graceful degradation when AI unavailable
 * - Score validation (1-5 range)
 * - Parse error handling
 * - Metadata in results
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneEmpathyMetric } from '../tone-empathy.metric';
import { AnthropicService } from '../../../anthropic';
import { DatasetItem } from '../interfaces';
import { BANNED_SHAME_WORDS } from '../metrics.constants';
import { resetGlobalMetricsCache } from '../local-cache';

describe('ToneEmpathyMetric', () => {
  let metric: ToneEmpathyMetric;
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
    metric = new ToneEmpathyMetric(anthropicService as AnthropicService);
  });

  describe('metric metadata', () => {
    it('should have correct name', () => {
      expect(metric.name).toBe('ToneEmpathy');
    });

    it('should have correct scale', () => {
      expect(metric.scale).toBe(5);
    });

    it('should have correct description', () => {
      expect(metric.description).toBe(
        'Evaluates empathy and supportiveness of AI responses',
      );
    });
  });

  describe('banned word detection', () => {
    const bannedWordsTestCases = [
      { word: 'failed', text: 'You failed at budgeting.' },
      { word: 'failure', text: 'This is a failure on your part.' },
      { word: 'mistake', text: 'That was a big mistake.' },
      { word: 'wrong', text: 'You are doing it wrong.' },
      { word: 'bad', text: 'You made a bad decision.' },
      { word: 'problem', text: 'You have a spending problem.' },
      { word: 'loser', text: "Don't be a loser." },
      { word: 'weak', text: 'Your willpower is weak.' },
      { word: 'pathetic', text: 'That effort was pathetic.' },
      { word: 'lazy', text: "You're being lazy with your budget." },
    ];

    it.each(bannedWordsTestCases)(
      'should return score 1 when text contains "$word"',
      async ({ word, text }) => {
        const datasetItem: DatasetItem = { input: 'I overspent', output: '' };

        const result = await metric.score(datasetItem, text);

        expect(result.score).toBe(1);
        expect(result.reason).toContain('banned shame word');
        expect(result.reason).toContain(word);
        expect(result.metadata?.bannedWord).toBe(word);
        expect(result.metadata?.fastPath).toBe(true);
        // Should NOT call LLM
        expect(mockGenerate).not.toHaveBeenCalled();
      },
    );

    it('should detect banned words case-insensitively', async () => {
      const datasetItem: DatasetItem = { input: 'I overspent', output: '' };

      const result = await metric.score(datasetItem, 'You FAILED at this.');

      expect(result.score).toBe(1);
      expect(result.reason).toContain('failed');
    });

    it('should detect banned word in middle of sentence', async () => {
      const datasetItem: DatasetItem = { input: 'I overspent', output: '' };

      const result = await metric.score(
        datasetItem,
        "Your approach, while creative, was ultimately a failure to plan properly.",
      );

      expect(result.score).toBe(1);
      expect(result.reason).toContain('failure');
    });

    it('should use pre-compiled regex patterns for all banned words', () => {
      // Access the private bannedWordPatterns via type assertion
      const patterns = (metric as unknown as { bannedWordPatterns: Map<string, RegExp> })
        .bannedWordPatterns;

      // Verify all banned words have pre-compiled patterns
      expect(patterns.size).toBe(BANNED_SHAME_WORDS.length);

      for (const word of BANNED_SHAME_WORDS) {
        expect(patterns.has(word)).toBe(true);
        const pattern = patterns.get(word);
        expect(pattern).toBeInstanceOf(RegExp);
        // Verify pattern is case-insensitive
        expect(pattern?.flags).toContain('i');
      }
    });

    it('should pre-compile patterns at construction time, not on each call', async () => {
      // Get reference to patterns before any calls
      const patternsBefore = (metric as unknown as { bannedWordPatterns: Map<string, RegExp> })
        .bannedWordPatterns;

      // Make multiple calls
      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      await metric.score(datasetItem, 'You failed.');
      await metric.score(datasetItem, 'You made a mistake.');
      await metric.score(datasetItem, 'That was wrong.');

      // Get reference to patterns after calls
      const patternsAfter = (metric as unknown as { bannedWordPatterns: Map<string, RegExp> })
        .bannedWordPatterns;

      // Should be the exact same Map instance (not recreated)
      expect(patternsBefore).toBe(patternsAfter);
    });
  });

  describe('LLM evaluation', () => {
    it('should call LLM when no banned words found', async () => {
      const datasetItem: DatasetItem = { input: 'I overspent this month', output: '' };
      const goodResponse = "Let's recalculate your route. Small detours happen to everyone.";

      mockGenerate.mockResolvedValue({
        content: JSON.stringify({ score: 5, reason: 'Very empathetic' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await metric.score(datasetItem, goodResponse);

      expect(mockGenerate).toHaveBeenCalled();
      expect(result.score).toBe(5);
      expect(result.reason).toBe('Very empathetic');
      expect(result.metadata?.model).toBe('claude-sonnet-4-20250514');
    });

    it('should validate score is within 1-5 range', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      // LLM returns score outside range
      mockGenerate.mockResolvedValue({
        content: JSON.stringify({ score: 10, reason: 'Very high' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await metric.score(datasetItem, 'Good response');

      // Should cap at 5
      expect(result.score).toBe(5);
    });

    it('should handle score below range', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      mockGenerate.mockResolvedValue({
        content: JSON.stringify({ score: -1, reason: 'Too low' }),
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await metric.score(datasetItem, 'Response');

      // Should floor at 1
      expect(result.score).toBe(1);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      mockGenerate.mockResolvedValue({
        content: 'This is not valid JSON',
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await metric.score(datasetItem, 'Response');

      // Should return default score
      expect(result.score).toBe(3);
      expect(result.reason).toContain('Failed to parse');
    });

    it('should extract JSON from markdown-wrapped response', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      mockGenerate.mockResolvedValue({
        content: 'Here is the evaluation:\n```json\n{"score": 4, "reason": "Good"}\n```',
        model: 'claude-sonnet-4-20250514',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await metric.score(datasetItem, 'Response');

      expect(result.score).toBe(4);
      expect(result.reason).toBe('Good');
    });
  });

  describe('circuit breaker and graceful degradation', () => {
    it('should check circuit breaker before making LLM calls', async () => {
      mockIsAvailable.mockReturnValue(false);

      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const result = await metric.score(datasetItem, 'Response without banned words');

      // Should return default without calling LLM
      expect(result.score).toBe(3);
      expect(result.reason).toBe('AI service unavailable for evaluation');
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it('should return default score when AI service unavailable', async () => {
      mockIsAvailable.mockReturnValue(false);

      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const result = await metric.score(datasetItem, 'Response');

      expect(result.score).toBe(3); // Default/neutral score
      expect(result.reason).toBe('AI service unavailable for evaluation');
      expect(result.metadata?.isDefault).toBe(true);
    });

    it('should skip circuit breaker check for banned word fast path', async () => {
      // Even if service is unavailable, banned words should still return score 1
      mockIsAvailable.mockReturnValue(false);

      const datasetItem: DatasetItem = { input: 'Test', output: '' };
      const result = await metric.score(datasetItem, 'You failed at this.');

      // Banned word detection works without checking service availability
      expect(result.score).toBe(1);
      expect(result.reason).toContain('banned shame word');
      expect(result.metadata?.fastPath).toBe(true);
      // Service availability check should not be needed for fast path
      // (the check happens after banned word check in the flow)
    });

    it('should handle API errors gracefully', async () => {
      const datasetItem: DatasetItem = { input: 'Test', output: '' };

      mockGenerate.mockRejectedValue(new Error('API timeout'));

      const result = await metric.score(datasetItem, 'Response');

      expect(result.score).toBe(3);
      expect(result.reason).toContain('Evaluation failed');
      expect(result.reason).toContain('API timeout');
      expect(result.metadata?.error).toBe(true);
    });
  });
});
