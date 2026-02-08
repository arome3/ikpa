/**
 * Online Evaluation Helper
 *
 * Fire-and-forget evaluation for production agent responses.
 * Attaches LLM-as-judge scores to existing Opik traces so every
 * AI response gets quality-scored in real-time.
 *
 * This creates a continuous quality signal visible in the Opik dashboard
 * and the app's analytics page, without ever blocking the user-facing response.
 */

import { Logger } from '@nestjs/common';
import { MetricsService, EvaluationOptions } from './metrics.service';
import { DatasetItem } from './interfaces';
import { TrackedTrace } from '../interfaces';

const logger = new Logger('OnlineEval');

/**
 * Run LLM-as-judge evaluation asynchronously — never blocks the response.
 *
 * @param metricsService - MetricsService instance for running evaluations
 * @param trace - Opik trace to attach feedback to (null = skip)
 * @param datasetItem - Input context for evaluation
 * @param llmOutput - The LLM response to evaluate
 * @param metrics - Which metrics to run (metric names or 'all')
 */
export function fireAndForgetEval(
  metricsService: MetricsService,
  trace: TrackedTrace | null,
  datasetItem: DatasetItem,
  llmOutput: string,
  metrics?: string[] | 'all',
): void {
  if (!trace || !llmOutput) return;

  const options: EvaluationOptions = {
    metrics: metrics || 'all',
    createSpans: true,
    addFeedback: true,
  };

  metricsService
    .evaluate(datasetItem, llmOutput, options, trace)
    .catch((err) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`Online eval failed: ${msg}`);
    });
}
