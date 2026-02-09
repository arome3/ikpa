/**
 * Metrics Module
 *
 * Provides G-Eval metrics for evaluating IKPA AI agent responses.
 * Integrates with Opik for dashboard visibility and prompt optimization.
 *
 * Available Metrics:
 * - InterventionSuccessMetric: Binary (0/1) - Did user save instead of spend?
 * - ToneEmpathyMetric: G-Eval (1-5) - Is response empathetic and supportive?
 * - CulturalSensitivityMetric: G-Eval (1-5) - Is advice personally sensitive and appropriate?
 * - FinancialSafetyMetric: Guardrail (0/1) - Is advice financially safe?
 * - StakeEffectivenessMetric: Weighted (0-1) - How effective was the stake?
 *
 * @example
 * ```typescript
 * // In a service
 * import { MetricsService } from '@/modules/ai/opik/metrics';
 *
 * @Injectable()
 * export class MyAgent {
 *   constructor(private readonly metricsService: MetricsService) {}
 *
 *   async evaluateResponse(input: string, output: string) {
 *     const result = await this.metricsService.evaluate(
 *       { input, output: '' },
 *       output,
 *       { metrics: ['ToneEmpathy', 'FinancialSafety'] }
 *     );
 *
 *     if (!result.success) {
 *       throw new Error(`Response blocked: ${result.blockedReason}`);
 *     }
 *
 *     return result.aggregated.averageScore;
 *   }
 * }
 * ```
 */

import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { InterventionSuccessMetric } from './intervention-success.metric';
import { ToneEmpathyMetric } from './tone-empathy.metric';
import { CulturalSensitivityMetric } from './cultural-sensitivity.metric';
import { FinancialSafetyMetric } from './financial-safety.metric';
import { StakeEffectivenessMetric } from './stake-effectiveness.metric';

@Module({
  providers: [
    // Orchestrating service
    MetricsService,
    // Individual metrics
    InterventionSuccessMetric,
    ToneEmpathyMetric,
    CulturalSensitivityMetric,
    FinancialSafetyMetric,
    StakeEffectivenessMetric,
  ],
  exports: [
    // Export service for orchestrated evaluation
    MetricsService,
    // Export individual metrics for direct use
    InterventionSuccessMetric,
    ToneEmpathyMetric,
    CulturalSensitivityMetric,
    FinancialSafetyMetric,
    StakeEffectivenessMetric,
  ],
})
export class MetricsModule {}
