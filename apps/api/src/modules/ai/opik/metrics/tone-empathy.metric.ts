/**
 * Tone Empathy Metric
 *
 * G-Eval metric (1-5 scale) that evaluates the empathy and supportiveness
 * of AI responses using Claude as a judge.
 *
 * Features:
 * - Fast path: Banned words check returns score 1 immediately
 * - LLM evaluation for nuanced empathy assessment
 * - Graceful degradation when AI service unavailable
 * - Rate limiting via semaphore to prevent API overload
 * - Retry with exponential backoff for transient failures
 * - Single-flight pattern to prevent cache stampede
 * - Input validation and sanitization
 * - Local cache fallback when Redis is unavailable
 * - Auto-versioned cache key from criteria hash
 *
 * Scoring:
 * - 1: Harsh, judgmental, shaming language
 * - 2: Cold, clinical, lacks warmth
 * - 3: Neutral, neither supportive nor discouraging
 * - 4: Warm and supportive with minor issues
 * - 5: Exceptionally empathetic and encouraging
 *
 * @example
 * ```typescript
 * const metric = new ToneEmpathyMetric(anthropicService);
 *
 * // Contains banned word - auto score 1
 * const result = await metric.score(
 *   { input: 'I overspent', output: '' },
 *   'You failed at budgeting.'
 * );
 * // result: { score: 1, reason: 'Contains banned shame word: "failed"' }
 *
 * // Good empathetic response
 * const result = await metric.score(
 *   { input: 'I overspent', output: '' },
 *   "Let's recalculate your route. Small detours happen to everyone."
 * );
 * // result: { score: 5, reason: 'Exceptionally empathetic...' }
 * ```
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { GEvalMetric, parseEvaluationResponse } from './base.metric';
import { DatasetItem, MetricResult } from './interfaces';
import { AnthropicService } from '../../anthropic';
import { RedisService } from '../../../../redis/redis.service';
import {
  METRIC_TONE_EMPATHY,
  BANNED_SHAME_WORDS,
  EVALUATION_TIMEOUT_MS,
  EVALUATION_MAX_TOKENS,
  GEVAL_DEFAULT_SCORE,
  METRICS_CACHE_TTL_SECONDS,
  METRICS_LOCAL_CACHE_TTL_SECONDS,
  CACHE_KEY_TONE_EMPATHY,
} from './metrics.constants';
import {
  llmSemaphore,
  withRetry,
  validateAndSanitizeInput,
  singleFlight,
} from './metrics.utils';
import { getGlobalMetricsCache } from './local-cache';

@Injectable()
export class ToneEmpathyMetric extends GEvalMetric {
  private readonly logger = new Logger(ToneEmpathyMetric.name);

  readonly name = METRIC_TONE_EMPATHY;
  readonly description = 'Evaluates empathy and supportiveness of AI responses';
  readonly scale = 5;

  /**
   * Pre-compiled regex patterns for banned words
   * Compiled once at class initialization for performance
   */
  private readonly bannedWordPatterns: ReadonlyMap<string, RegExp>;

  /**
   * Cache version derived from hash of evaluation criteria
   * Auto-invalidates cache when criteria change
   */
  private readonly criteriaVersion: string;

  private readonly evaluationCriteria = `
Evaluate the empathy and supportiveness of the AI's response on a scale of 1-5.

CRITERIA:
1. Does it validate the user's feelings and situation?
2. Does it avoid shame, judgment, or lecturing?
3. Does it feel like a supportive friend, not a critical parent?
4. Does it acknowledge difficulty while providing hope?
5. Does it use encouraging language instead of commanding?

SCORING:
1 = Harsh, judgmental, shaming language
2 = Cold, clinical, lacks warmth
3 = Neutral, neither supportive nor discouraging
4 = Warm and supportive with minor issues
5 = Exceptionally empathetic and encouraging

BANNED WORDS (automatic score of 1 if present):
- "failed", "failure", "mistake", "wrong", "bad", "problem"
- "loser", "weak", "pathetic", "gave up"
- Any language that implies moral judgment

Return a JSON object with:
{
  "score": <1-5>,
  "reason": "<explanation>"
}

Return ONLY the JSON object, no other text.
`;

  constructor(
    private readonly anthropicService: AnthropicService,
    @Optional() private readonly redisService?: RedisService,
  ) {
    super();
    // Pre-compile banned word regex patterns for performance
    this.bannedWordPatterns = new Map(
      BANNED_SHAME_WORDS.map((word) => [word, new RegExp(`\\b${word}\\b`, 'i')]),
    );
    // Generate criteria version hash for automatic cache invalidation
    this.criteriaVersion = this.generateCriteriaVersion();
  }

  /**
   * Generate a version hash from the evaluation criteria
   * This ensures cache auto-invalidates when criteria change
   */
  private generateCriteriaVersion(): string {
    return createHash('sha256')
      .update(this.evaluationCriteria)
      .digest('hex')
      .slice(0, 8); // 8 chars is enough for version differentiation
  }

  /**
   * Evaluate tone empathy of an LLM response
   *
   * @param datasetItem - User input context
   * @param llmOutput - AI response to evaluate
   * @returns Score 1-5 with explanation
   */
  async score(datasetItem: DatasetItem, llmOutput: string): Promise<MetricResult> {
    // Step 1: Validate and sanitize inputs
    const validation = validateAndSanitizeInput(datasetItem.input, llmOutput);
    if (!validation.isValid) {
      this.logger.warn(`Input validation issues: ${validation.errors.join(', ')}`);
    }
    const sanitizedInput = validation.sanitizedInput;
    const sanitizedOutput = validation.sanitizedOutput;

    // Step 2: Fast path - Check for banned words (no LLM call needed)
    const bannedWordResult = this.checkBannedWords(sanitizedOutput);
    if (bannedWordResult) {
      return bannedWordResult;
    }

    // Step 3: Check if AI service is available
    if (!this.anthropicService.isAvailable()) {
      this.logger.warn('Anthropic service unavailable, returning default score');
      return this.getDefaultResult('AI service unavailable for evaluation');
    }

    // Step 4: Generate cache key from content hash (includes criteria version)
    const cacheKey = this.generateCacheKey(sanitizedInput, sanitizedOutput);

    // Step 5: Check cache first (Redis primary, local fallback)
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      this.logger.debug(`Cache hit for tone empathy evaluation`);
      return { ...cachedResult, metadata: { ...cachedResult.metadata, cached: true } };
    }

    // Step 6: Use single-flight pattern to prevent duplicate LLM calls
    return singleFlight(cacheKey, () =>
      this.evaluateWithLLM(sanitizedInput, sanitizedOutput, cacheKey),
    );
  }

  /**
   * Perform LLM evaluation with rate limiting and retry
   */
  private async evaluateWithLLM(
    input: string,
    output: string,
    cacheKey: string,
  ): Promise<MetricResult> {
    try {
      // Use semaphore to limit concurrent LLM calls
      const metricResult = await llmSemaphore.withPermit(async () => {
        // Use retry logic with exponential backoff
        return withRetry(
          async () => {
            const prompt = `
${this.evaluationCriteria}

USER INPUT:
${input}

AI RESPONSE TO EVALUATE:
${output}

Evaluate the response and return JSON:
`;

            const response = await this.anthropicService.generate(
              prompt,
              EVALUATION_MAX_TOKENS,
              'You are an empathy evaluator. Return only valid JSON.',
              EVALUATION_TIMEOUT_MS,
            );

            const result = parseEvaluationResponse(response.content, GEVAL_DEFAULT_SCORE);

            // Validate score is within scale
            const validatedScore = Math.max(1, Math.min(this.scale, Math.round(result.score)));

            return {
              score: validatedScore,
              reason: result.reason,
              metadata: {
                model: response.model,
                rawScore: result.score,
                tokenUsage: response.usage,
              },
            };
          },
          {
            onRetry: (attempt, error) => {
              this.logger.warn(
                `Tone empathy LLM retry ${attempt}: ${error instanceof Error ? error.message : 'Unknown'}`,
              );
            },
          },
        );
      });

      // Cache the result to both Redis and local cache (fire-and-forget)
      this.cacheResult(cacheKey, metricResult).catch((err) =>
        this.logger.warn(`Failed to cache: ${err instanceof Error ? err.message : 'Unknown'}`),
      );

      return metricResult;
    } catch (error) {
      this.logger.error(
        `Failed to evaluate tone empathy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        score: GEVAL_DEFAULT_SCORE,
        reason: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          error: true,
          errorType: error instanceof Error ? error.name : 'Unknown',
        },
      };
    }
  }

  /**
   * Check for banned shame words using pre-compiled regex patterns
   * Returns result if found, null otherwise
   */
  private checkBannedWords(text: string): MetricResult | null {
    // Use pre-compiled patterns from class initialization
    for (const [word, pattern] of this.bannedWordPatterns) {
      if (pattern.test(text)) {
        return {
          score: 1,
          reason: `Contains banned shame word: "${word}"`,
          metadata: {
            bannedWord: word,
            fastPath: true,
          },
        };
      }
    }

    return null;
  }

  // ==========================================
  // CACHING HELPERS
  // ==========================================

  /**
   * Generate a deterministic cache key from content
   * Includes criteria version hash for automatic invalidation when criteria change
   */
  private generateCacheKey(input: string, output: string): string {
    const contentHash = createHash('sha256')
      .update(`${input}|${output}`)
      .digest('hex')
      .slice(0, 32); // Use 32 chars (128 bits) to reduce collision risk
    return `${CACHE_KEY_TONE_EMPATHY}:${this.criteriaVersion}:${contentHash}`;
  }

  /**
   * Get cached evaluation result
   * Tries Redis first, falls back to local cache if Redis unavailable
   */
  private async getCachedResult(cacheKey: string): Promise<MetricResult | null> {
    // Try Redis first
    if (this.redisService?.isAvailable()) {
      try {
        const result = await this.redisService.get<MetricResult>(cacheKey);
        if (result) {
          return result;
        }
      } catch (error) {
        this.logger.warn(
          `Redis read failed, falling back to local cache: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // Fall back to local cache
    const localCache = getGlobalMetricsCache();
    const localResult = localCache.get<MetricResult>(cacheKey);
    if (localResult) {
      this.logger.debug('Using local cache fallback');
      return localResult;
    }

    return null;
  }

  /**
   * Cache evaluation result
   * Always writes to local cache as backup, also writes to Redis if available
   */
  private async cacheResult(cacheKey: string, result: MetricResult): Promise<void> {
    const localCache = getGlobalMetricsCache();

    // Always write to local cache as backup (with shorter TTL)
    localCache.set(cacheKey, result, METRICS_LOCAL_CACHE_TTL_SECONDS);

    // Try to write to Redis if available
    if (this.redisService?.isAvailable()) {
      try {
        await this.redisService.set(cacheKey, result, METRICS_CACHE_TTL_SECONDS);
        this.logger.debug(`Cached tone empathy evaluation result to Redis`);
      } catch (error) {
        this.logger.warn(
          `Failed to cache to Redis (local cache used): ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    } else {
      this.logger.debug(`Redis unavailable, cached to local cache only`);
    }
  }
}
