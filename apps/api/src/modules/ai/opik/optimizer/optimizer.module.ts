/**
 * Optimizer Module
 *
 * Provides advanced optimization capabilities using Opik for evolution:
 * - FramingOptimizer: A/B testing for Shark Auditor subscription framing
 * - LetterOptimizer: Evolutionary optimization for Future Self letters
 * - ToolOptimizer: GEPA-based optimization for GPS Re-Router tool selection
 * - DatasetService: Database-backed evaluation datasets for all optimizers
 * - OpikDatasetService: Syncs datasets to Opik for visibility in UI
 * - AlertService: Alerting for optimization failures
 * - MetricsRegistryService: Custom metric registration with Opik
 * - CircuitBreakerService: Prevents cascade failures during LLM API issues
 * - OpikExperimentService: A/B comparison UI integration via Opik traces
 *
 * @example
 * ```typescript
 * // Import the module
 * import { OptimizerModule } from './optimizer';
 *
 * @Module({
 *   imports: [OptimizerModule],
 * })
 * export class MyModule {}
 *
 * // Inject services
 * constructor(
 *   private readonly framingOptimizer: FramingOptimizerService,
 *   private readonly letterOptimizer: LetterOptimizerService,
 *   private readonly toolOptimizer: ToolOptimizerService,
 *   private readonly datasetService: DatasetService,
 *   private readonly opikDatasetService: OpikDatasetService,
 *   private readonly alertService: AlertService,
 *   private readonly metricsRegistry: MetricsRegistryService,
 *   private readonly circuitBreaker: CircuitBreakerService,
 *   private readonly opikExperimentService: OpikExperimentService,
 * ) {}
 * ```
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Dataset Service
import { DatasetService } from './dataset';

// Opik Dataset Service
import { OpikDatasetService, OpikDatasetListener } from './opik-dataset';

// Opik Experiment Service
import { OpikExperimentService } from './opik-experiment';

// Framing Optimizer
import { FramingOptimizerService } from './framing/framing-optimizer.service';
import { FramingOptimizerCronService } from './framing/framing-optimizer.cron';
import { CancellationRateMetric } from './framing/cancellation-rate.metric';

// Letter Optimizer
import { LetterOptimizerService } from './letter/letter-optimizer.service';
import { LetterOptimizerCronService } from './letter/letter-optimizer.cron';
import { PopulationManager } from './letter/population-manager';
import { CrossoverMutationService } from './letter/crossover-mutation.service';

// Tool Optimizer
import { ToolOptimizerService } from './tool/tool-optimizer.service';
import { ToolOptimizerCronService } from './tool/tool-optimizer.cron';
import { PatternAnalyzer } from './tool/pattern-analyzer';
import { RuleGenerator } from './tool/rule-generator';

// Alerting
import { AlertService } from './alerting/alert.service';

// Metrics Registry
import { MetricsRegistryService } from './metrics-registry';

// Circuit Breaker
import { CircuitBreakerService } from './circuit-breaker';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [
    // Circuit Breaker (must be before services that depend on it)
    CircuitBreakerService,

    // Opik Experiment Service (must be before optimizers that depend on it)
    OpikExperimentService,

    // Dataset Service (shared by all optimizers)
    DatasetService,

    // Opik Dataset Service and Listener (syncs datasets to Opik)
    OpikDatasetService,
    OpikDatasetListener,

    // Framing Optimizer
    CancellationRateMetric,
    FramingOptimizerService,
    FramingOptimizerCronService,

    // Letter Optimizer
    PopulationManager,
    CrossoverMutationService,
    LetterOptimizerService,
    LetterOptimizerCronService,

    // Tool Optimizer
    PatternAnalyzer,
    RuleGenerator,
    ToolOptimizerService,
    ToolOptimizerCronService,

    // Alerting
    AlertService,

    // Metrics Registry
    MetricsRegistryService,
  ],
  exports: [
    // Export main services
    FramingOptimizerService,
    LetterOptimizerService,
    ToolOptimizerService,

    // Export dataset services
    DatasetService,
    OpikDatasetService,

    // Export metrics
    CancellationRateMetric,

    // Export cron services for health checks
    FramingOptimizerCronService,
    LetterOptimizerCronService,
    ToolOptimizerCronService,

    // Export alerting
    AlertService,

    // Export metrics registry
    MetricsRegistryService,

    // Export circuit breaker for health checks
    CircuitBreakerService,

    // Export Opik experiment service
    OpikExperimentService,
  ],
})
export class OptimizerModule {}
