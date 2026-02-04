/**
 * Opik Module Barrel Export
 *
 * Re-exports all public APIs for convenient importing:
 *
 * ```typescript
 * import {
 *   OpikModule,
 *   OpikService,
 *   CreateTraceInput,
 *   TrackedSpan,
 *   OpikException,
 *   MetricsService,
 *   MetricResult,
 * } from '@/modules/ai/opik';
 * ```
 *
 * Or with relative imports:
 * ```typescript
 * import { OpikModule, OpikService } from './modules/ai/opik';
 * import { MetricsService } from './modules/ai/opik/metrics';
 * ```
 */

// Module
export * from './opik.module';

// Service
export * from './opik.service';

// Interfaces
export * from './interfaces';

// Exceptions
export * from './exceptions';

// Metrics (re-exported from submodule)
export * from './metrics';

// Optimizer (temporarily disabled due to TypeScript errors)
// TODO: Fix TypeScript errors in optimizer module
// export {
//   OptimizerModule,
//   OPTIMIZER_CONSTANTS,
//   FramingOptimizerService,
//   FramingOptimizerCronService,
//   CancellationRateMetric,
//   LetterOptimizerService,
//   LetterOptimizerCronService,
//   PopulationManager,
//   CrossoverMutationService,
//   ToolOptimizerService,
//   ToolOptimizerCronService,
//   PatternAnalyzer,
//   RuleGenerator,
//   AlertService,
//   AlertLevel,
//   AlertCategory,
//   MetricsRegistryService,
//   CircuitBreakerService,
//   CircuitState,
//   OpikDatasetService,
//   OpikExperimentService,
// } from './optimizer';
