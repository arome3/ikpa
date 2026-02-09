/**
 * Cultural Sensitivity Metric
 *
 * G-Eval metric (1-5 scale) that evaluates the cultural appropriateness
 * and personal sensitivity of financial advice.
 *
 * Features:
 * - LLM evaluation for nuanced cultural assessment
 * - Graceful degradation when AI service unavailable
 * - Rate limiting via semaphore to prevent API overload
 * - Retry with exponential backoff for transient failures
 * - Single-flight pattern to prevent cache stampede
 * - Input validation and sanitization
 * - Local cache fallback when Redis is unavailable
 * - Auto-versioned cache key from criteria hash
 *
 * Key evaluation points:
 * - Respects personal values and family relationships
 * - Avoids judgmental language about financial decisions
 * - Non-shaming about family support or financial obligations
 * - Understands diverse financial contexts and priorities
 * - Frames family support positively, not as a problem
 *
 * Scoring:
 * - 1: Dismissive of personal values, treats family support as problem
 * - 2: Neutral but lacks sensitivity
 * - 3: Somewhat sensitive to personal context
 * - 4: Good sensitivity with minor gaps
 * - 5: Excellent understanding of financial context
 *
 * @example
 * ```typescript
 * const metric = new CulturalSensitivityMetric(anthropicService);
 *
 * // Insensitive
 * const result = await metric.score(
 *   { input: 'I send money to my family monthly', output: '', context: {} },
 *   'You need to stop this unnecessary expense and set boundaries.'
 * );
 * // result: { score: 1, reason: 'Treats family support as unnecessary expense' }
 *
 * // Sensitive
 * const result = await metric.score(
 *   { input: 'I send money to my family monthly', output: '', context: {} },
 *   'Supporting your family is important. Let\'s budget it as a priority.'
 * );
 * // result: { score: 5, reason: 'Excellent respect for personal values...' }
 * ```
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { GEvalMetric, parseEvaluationResponse } from './base.metric';
import { DatasetItem, MetricResult } from './interfaces';
import { AnthropicService } from '../../anthropic';
import { RedisService } from '../../../../redis/redis.service';
import {
  METRIC_CULTURAL_SENSITIVITY,
  EVALUATION_TIMEOUT_MS,
  EVALUATION_MAX_TOKENS,
  GEVAL_DEFAULT_SCORE,
  METRICS_CACHE_TTL_SECONDS,
  METRICS_LOCAL_CACHE_TTL_SECONDS,
  CACHE_KEY_CULTURAL_SENSITIVITY,
} from './metrics.constants';
import { llmSemaphore, withRetry, validateAndSanitizeInput, singleFlight } from './metrics.utils';
import { getGlobalMetricsCache } from './local-cache';

@Injectable()
export class CulturalSensitivityMetric extends GEvalMetric {
  private readonly logger = new Logger(CulturalSensitivityMetric.name);

  readonly name = METRIC_CULTURAL_SENSITIVITY;
  readonly description = 'Evaluates cultural appropriateness for users';
  readonly scale = 5;

  /**
   * Cache version derived from hash of evaluation criteria
   * Auto-invalidates cache when criteria change
   */
  private readonly criteriaVersion: string;

  private readonly evaluationCriteria = `
Evaluate the sensitivity and appropriateness of this financial advice on a scale of 1-5.

CRITERIA:
1. Does it respect personal values and family relationships?
2. Does it avoid judgmental language about financial decisions?
3. Is it non-shaming about family support or financial obligations?
4. Does it frame family support positively, not as a burden?
5. Does it understand diverse financial contexts and priorities?

SCORING:
1 = Dismissive of personal values, treats family support as problem
2 = Neutral but lacks sensitivity
3 = Somewhat sensitive to personal context
4 = Good sensitivity with minor gaps
5 = Excellent understanding of financial context

POSITIVE INDICATORS:
- Respecting family support as a valid priority
- Non-judgmental about financial transfers to family
- Understanding of extended family responsibilities
- Recognition of diverse savings practices
- Compassionate framing of financial obligations
- Acknowledging that financial success includes caring for others
- Offering to help plan for obligations rather than eliminate them

NEGATIVE INDICATORS:
- Treating family support as "unnecessary expense"
- "You need to set boundaries" (in family context)
- Shaming language about financial choices
- Assumptions about "correct" savings rates without context
- Suggesting to cut off family support
- Ignoring personal obligations as valid financial commitments
- Treating community contributions as wasteful

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
    // Generate criteria version hash for automatic cache invalidation
    this.criteriaVersion = this.generateCriteriaVersion();
  }

  /**
   * Generate a version hash from the evaluation criteria
   * This ensures cache auto-invalidates when criteria change
   */
  private generateCriteriaVersion(): string {
    return createHash('sha256').update(this.evaluationCriteria).digest('hex').slice(0, 8); // 8 chars is enough for version differentiation
  }

  /**
   * Evaluate cultural sensitivity of an LLM response
   *
   * @param datasetItem - User input and cultural context
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

    // Step 2: Check if AI service is available
    if (!this.anthropicService.isAvailable()) {
      this.logger.warn('Anthropic service unavailable, returning default score');
      return this.getDefaultResult('AI service unavailable for evaluation');
    }

    // Step 3: Build context string from available data
    const contextInfo = this.buildContextInfo(datasetItem);

    // Step 4: Generate cache key from content hash (includes criteria version)
    const cacheKey = this.generateCacheKey(sanitizedInput, sanitizedOutput, contextInfo);

    // Step 5: Check cache first (Redis primary, local fallback)
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      this.logger.debug(`Cache hit for cultural sensitivity evaluation`);
      return { ...cachedResult, metadata: { ...cachedResult.metadata, cached: true } };
    }

    // Step 6: Use single-flight pattern to prevent duplicate LLM calls
    return singleFlight(cacheKey, () =>
      this.evaluateWithLLM(
        sanitizedInput,
        sanitizedOutput,
        contextInfo,
        cacheKey,
        datasetItem.context,
      ),
    );
  }

  /**
   * Perform LLM evaluation with rate limiting and retry
   */
  private async evaluateWithLLM(
    input: string,
    output: string,
    contextInfo: string,
    cacheKey: string,
    originalContext?: Record<string, unknown>,
  ): Promise<MetricResult> {
    try {
      // Use semaphore to limit concurrent LLM calls
      const metricResult = await llmSemaphore.withPermit(async () => {
        // Use retry logic with exponential backoff
        return withRetry(
          async () => {
            const prompt = `
${this.evaluationCriteria}

USER CONTEXT:
${contextInfo}

USER INPUT:
${input}

AI RESPONSE TO EVALUATE:
${output}

Evaluate the response and return JSON:
`;

            const response = await this.anthropicService.generate(
              prompt,
              EVALUATION_MAX_TOKENS,
              'You are a cultural sensitivity evaluator specializing in financial contexts. Return only valid JSON.',
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
                context: originalContext,
              },
            };
          },
          {
            onRetry: (attempt, error) => {
              this.logger.warn(
                `Cultural sensitivity LLM retry ${attempt}: ${error instanceof Error ? error.message : 'Unknown'}`,
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
        `Failed to evaluate cultural sensitivity: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Build context information string from dataset item
   */
  private buildContextInfo(datasetItem: DatasetItem): string {
    const context = datasetItem.context || {};
    const parts: string[] = [];

    if (context.country) {
      parts.push(`Country: ${context.country}`);
    }
    if (context.culture) {
      parts.push(`Cultural context: ${context.culture}`);
    }
    if (context.currency) {
      parts.push(`Currency: ${context.currency}`);
    }

    // Include any other relevant context
    const knownKeys = [
      'country',
      'culture',
      'currency',
      'userAction',
      'stakeType',
      'goalCompleted',
    ];
    for (const [key, value] of Object.entries(context)) {
      if (!knownKeys.includes(key) && value !== undefined) {
        parts.push(`${key}: ${JSON.stringify(value)}`);
      }
    }

    return parts.length > 0 ? parts.join('\n') : 'No specific context provided';
  }

  // ==========================================
  // CACHING HELPERS
  // ==========================================

  /**
   * Generate a deterministic cache key from content
   * Includes context info since cultural sensitivity depends on it
   * Includes criteria version hash for automatic invalidation when criteria change
   */
  private generateCacheKey(input: string, output: string, contextInfo: string): string {
    const contentHash = createHash('sha256')
      .update(`${input}|${output}|${contextInfo}`)
      .digest('hex')
      .slice(0, 32); // Use 32 chars (128 bits) to reduce collision risk
    return `${CACHE_KEY_CULTURAL_SENSITIVITY}:${this.criteriaVersion}:${contentHash}`;
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
        this.logger.debug(`Cached cultural sensitivity evaluation result to Redis`);
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
