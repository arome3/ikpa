/**
 * Opik Module
 *
 * Provides distributed tracing for all AI agents in IKPA.
 *
 * The @Global() decorator makes OpikService available in all modules
 * without needing to import OpikModule in each feature module.
 * This follows the same pattern as PrismaModule.
 *
 * Includes G-Eval Metrics submodule for evaluating AI responses:
 * - InterventionSuccessMetric: Binary (0/1) - Did user save instead of spend?
 * - ToneEmpathyMetric: G-Eval (1-5) - Is response empathetic and supportive?
 * - CulturalSensitivityMetric: G-Eval (1-5) - Is advice culturally appropriate?
 * - FinancialSafetyMetric: Guardrail (0/1) - Is advice financially safe?
 * - StakeEffectivenessMetric: Weighted (0-1) - How effective was the stake?
 *
 * @example
 * ```typescript
 * // In app.module.ts
 * import { OpikModule } from './modules/ai/opik';
 *
 * @Module({
 *   imports: [OpikModule],
 * })
 * export class AppModule {}
 *
 * // In any service
 * import { OpikService } from './modules/ai/opik';
 * import { MetricsService } from './modules/ai/opik/metrics';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(
 *     private readonly opikService: OpikService,
 *     private readonly metricsService: MetricsService,
 *   ) {}
 *
 *   async handleRequest(userId: string) {
 *     const trace = this.opikService.createAgentTrace({
 *       agentName: 'my_agent',
 *       userId,
 *       input: { action: 'process' },
 *     });
 *
 *     // Evaluate response
 *     const result = await this.metricsService.evaluate(
 *       { input: userInput, output: '' },
 *       response,
 *       { metrics: 'all' },
 *       trace
 *     );
 *   }
 * }
 * ```
 *
 * @see OpikService for detailed API documentation
 * @see MetricsService for evaluation API documentation
 */

import { Global, Module } from '@nestjs/common';
import { OpikService } from './opik.service';
import { MetricsModule } from './metrics';
// import { OptimizerModule } from './optimizer'; // Temporarily disabled

@Global()
@Module({
  imports: [MetricsModule], // OptimizerModule temporarily disabled
  providers: [OpikService],
  exports: [OpikService, MetricsModule],
})
export class OpikModule {}
