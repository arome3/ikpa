/**
 * Optimizer Module Barrel Export
 *
 * Re-exports all public APIs for the Opik optimization system.
 *
 * @example
 * ```typescript
 * import {
 *   OptimizerModule,
 *   FramingOptimizerService,
 *   LetterOptimizerService,
 *   ToolOptimizerService,
 *   FramingExperimentResult,
 *   EvolutionResult,
 *   OptimizedToolPolicy,
 * } from '@/modules/ai/opik/optimizer';
 * ```
 */

// Module
export * from './optimizer.module';

// Constants
export * from './optimizer.constants';

// Types
export * from './optimizer.types';

// Interfaces
export * from './interfaces';

// Framing Optimizer
export { FramingOptimizerService } from './framing/framing-optimizer.service';
export { FramingOptimizerCronService } from './framing/framing-optimizer.cron';
export { CancellationRateMetric } from './framing/cancellation-rate.metric';

// Letter Optimizer
export { LetterOptimizerService } from './letter/letter-optimizer.service';
export { LetterOptimizerCronService } from './letter/letter-optimizer.cron';
export { PopulationManager } from './letter/population-manager';
export { CrossoverMutationService } from './letter/crossover-mutation.service';

// Tool Optimizer
export { ToolOptimizerService } from './tool/tool-optimizer.service';
export { ToolOptimizerCronService } from './tool/tool-optimizer.cron';
export { PatternAnalyzer } from './tool/pattern-analyzer';
export { RuleGenerator } from './tool/rule-generator';

// Alerting
export * from './alerting';

// Metrics Registry
export * from './metrics-registry';

// Circuit Breaker
export * from './circuit-breaker';

// Opik Dataset Service
export * from './opik-dataset';

// Opik Experiment Service
export * from './opik-experiment';
