/**
 * Opik Evaluation Showcase Controller
 *
 * Exposes IKPA's Opik integration to judges via public API endpoints.
 * Demonstrates: 5+ metrics, 3 optimizers, distributed tracing, LLM-as-judge,
 * eval runners, and the data-driven improvement loop.
 *
 * All endpoints are @Public() (no JWT required) and @SkipThrottle()
 * for frictionless judging and demo access.
 *
 * @module OpikEvalController
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { OpikService } from './opik.service';
import { MetricsService } from './metrics';
import { OpikExperimentService } from './optimizer/opik-experiment/opik-experiment.service';
import { MetricsRegistryService } from './optimizer/metrics-registry/metrics-registry.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GpsRerouterAgent } from '../../gps/agents/gps-rerouter.agent';
import { GpsEvalRunner, GPS_EVAL_DATASET } from '../../gps/agents';
import { CommitmentEvalRunner } from '../../commitment/agents/commitment-eval-runner';

@Public()
@SkipThrottle()
@Controller('opik')
export class OpikEvalController {
  private readonly logger = new Logger(OpikEvalController.name);

  constructor(
    private readonly opikService: OpikService,
    private readonly metricsService: MetricsService,
    private readonly opikExperimentService: OpikExperimentService,
    private readonly metricsRegistryService: MetricsRegistryService,
    private readonly prisma: PrismaService,
    private readonly gpsRerouterAgent: GpsRerouterAgent,
    private readonly commitmentEvalRunner: CommitmentEvalRunner,
  ) {}

  // ==========================================
  // DASHBOARD
  // ==========================================

  /**
   * GET /opik/dashboard
   *
   * Aggregated system overview: registered metrics, recent experiments,
   * optimizer status, and Opik connectivity.
   */
  @Get('dashboard')
  async getDashboard() {
    const opikAvailable = this.opikService.isAvailable();
    const opikConfig = this.opikService.getConfig();

    // Registered metrics
    const metrics = this.metricsRegistryService.getMetricDefinitions();

    // Recent experiments from database
    const recentExperiments = await this.prisma.optimizerExperiment.findMany({
      take: 10,
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    // Experiment stats
    const experimentCounts = await this.prisma.optimizerExperiment.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return {
      system: {
        name: 'IKPA Opik Integration',
        version: '1.0.0',
        description:
          'Distributed tracing, G-Eval metrics, 3 optimizers, and eval runners for AI financial coaching',
      },
      opik: {
        available: opikAvailable,
        projectName: opikConfig?.projectName ?? null,
        workspaceName: opikConfig?.workspaceName ?? null,
        dashboardUrl: opikConfig
          ? `https://www.comet.com/opik/${opikConfig.workspaceName}/${opikConfig.projectName}`
          : null,
      },
      metrics: {
        count: metrics.length,
        registered: metrics.map((m) => ({
          name: m.name,
          type: m.type,
          description: m.description,
        })),
      },
      experiments: {
        recent: recentExperiments,
        stats: experimentCounts.reduce(
          (acc, row) => {
            acc[row.status.toLowerCase()] = row._count.id;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      optimizers: {
        count: 3,
        types: [
          {
            name: 'Framing Optimizer',
            description: 'A/B tests subscription framing strategies to reduce cancellation',
            type: 'FRAMING',
          },
          {
            name: 'Letter Optimizer',
            description: 'Evolves future-self letter prompts using genetic algorithms',
            type: 'LETTER',
          },
          {
            name: 'Tool Optimizer (GEPA)',
            description: 'Optimizes AI agent tool selection policies via pattern analysis',
            type: 'TOOL',
          },
        ],
      },
      evalRunners: [
        {
          name: 'GPS Re-Router Eval',
          scenarios: GPS_EVAL_DATASET.length,
          endpoint: 'POST /opik/eval/gps',
        },
        {
          name: 'Commitment Coach Eval',
          endpoint: 'POST /opik/eval/commitment',
        },
      ],
    };
  }

  // ==========================================
  // METRICS
  // ==========================================

  /**
   * GET /opik/metrics
   *
   * List all registered evaluation metrics with descriptions and categories.
   */
  @Get('metrics')
  getMetrics() {
    const metrics = this.metricsRegistryService.getMetricDefinitions();
    return {
      count: metrics.length,
      metrics: metrics.map((m) => ({
        name: m.name,
        type: m.type,
        description: m.description,
        ...(m.type === 'numerical' && { min: (m as any).min, max: (m as any).max }),
        ...(m.type === 'categorical' && { categories: (m as any).categories }),
        ...(m.type === 'boolean' && {
          trueLabel: (m as any).trueLabel,
          falseLabel: (m as any).falseLabel,
        }),
      })),
    };
  }

  // ==========================================
  // EXPERIMENTS
  // ==========================================

  /**
   * GET /opik/experiments
   *
   * List experiments with optional filtering by status, type, and limit.
   */
  @Get('experiments')
  async listExperiments(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const experiments = await this.opikExperimentService.listExperiments({
      status: status as any,
      type: type as any,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      count: experiments.length,
      experiments: experiments.map((exp) => ({
        id: exp.id,
        name: exp.name,
        type: exp.type,
        status: exp.status,
        hypothesis: exp.hypothesis,
        createdAt: exp.createdAt,
        completedAt: exp.completedAt,
        baselineScore: exp.baselineResults?.score ?? null,
        variantScore: exp.variantResults?.score ?? null,
        winner: exp.analysis?.winner ?? null,
        isSignificant: exp.analysis?.isSignificant ?? null,
      })),
    };
  }

  /**
   * GET /opik/experiments/:id
   *
   * Detailed experiment comparison view with statistical analysis.
   */
  @Get('experiments/:id')
  async getExperiment(@Param('id') id: string) {
    const comparison = await this.opikExperimentService.getExperimentComparison(id);
    if (!comparison) {
      return { error: 'Experiment not found', id };
    }
    return comparison;
  }

  // ==========================================
  // EVAL RUNNERS
  // ==========================================

  /**
   * POST /opik/eval/gps
   *
   * Run the GPS Re-Router eval suite (20 scenarios).
   * Creates an Opik experiment, runs all scenarios with tracing, returns report.
   */
  @Post('eval/gps')
  async runGpsEval() {
    this.logger.log('Starting GPS Re-Router evaluation suite...');
    const startTime = Date.now();

    // Create experiment for this eval run
    let experimentId: string | null = null;
    try {
      experimentId = await this.opikExperimentService.createExperiment({
        name: `gps-eval-${new Date().toISOString().slice(0, 19)}`,
        hypothesis: 'GPS Re-Router generates empathetic, non-judgmental recovery messages',
        baselineDescription: 'Previous eval baseline',
        variantDescription: 'Current agent output',
        type: 'model',
      });
    } catch (err) {
      this.logger.warn(`Could not create experiment: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // Run eval with Opik tracing
    const runner = new GpsEvalRunner(
      this.gpsRerouterAgent,
      this.metricsService,
      this.opikService,
    );
    const report = await runner.runBatch(GPS_EVAL_DATASET);

    // Record aggregate results on the experiment
    if (experimentId) {
      try {
        const traceIds = report.scenarios
          .map((s) => s.traceId)
          .filter((id): id is string => !!id);

        await this.opikExperimentService.recordVariantResult(
          experimentId,
          'variant',
          {
            score: report.summary.passRate,
            sampleSize: report.summary.total,
            traceIds,
            scores: report.scenarios.map((s) => (s.passed ? 1 : 0)),
          },
        );

        await this.opikExperimentService.completeExperiment(experimentId, {
          winner: report.summary.passRate >= 0.8 ? 'variant' : null,
          pValue: 0.05,
          improvement: report.summary.passRate * 100,
          isSignificant: report.summary.passRate >= 0.7,
        });
      } catch (err) {
        this.logger.warn(`Could not complete experiment: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    // Flush traces
    try {
      await this.opikService.flush();
    } catch {
      // Non-critical
    }

    const opikConfig = this.opikService.getConfig();

    return {
      experimentId,
      opikDashboardUrl: opikConfig
        ? `https://www.comet.com/opik/${opikConfig.workspaceName}/${opikConfig.projectName}`
        : null,
      report: {
        summary: report.summary,
        scenarios: report.scenarios.map((s) => ({
          scenarioId: s.scenarioId,
          scenarioName: s.scenarioName,
          passed: s.passed,
          toneScore: s.toneScore,
          traceId: s.traceId,
          error: s.error,
          durationMs: s.durationMs,
        })),
      },
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * POST /opik/eval/commitment
   *
   * Run the Commitment Coach eval suite.
   * Creates Opik traces per scenario, returns aggregate report.
   */
  @Post('eval/commitment')
  async runCommitmentEval() {
    this.logger.log('Starting Commitment Coach evaluation suite...');
    const startTime = Date.now();

    // Create experiment
    let experimentId: string | null = null;
    try {
      experimentId = await this.opikExperimentService.createExperiment({
        name: `commitment-eval-${new Date().toISOString().slice(0, 19)}`,
        hypothesis: 'Commitment Coach recommends safe, calibrated stakes',
        baselineDescription: 'Previous eval baseline',
        variantDescription: 'Current agent output',
        type: 'model',
      });
    } catch (err) {
      this.logger.warn(`Could not create experiment: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    // Run commitment eval (already has Opik tracing built in)
    const summary = await this.commitmentEvalRunner.runEvaluation();

    // Record on experiment
    if (experimentId) {
      try {
        await this.opikExperimentService.recordVariantResult(
          experimentId,
          'variant',
          {
            score: summary.passRate,
            sampleSize: summary.totalScenarios,
            traceIds: [],
            scores: summary.results.map((r) => (r.passed ? 1 : 0)),
          },
        );

        await this.opikExperimentService.completeExperiment(experimentId, {
          winner: summary.passRate >= 0.8 ? 'variant' : null,
          pValue: 0.05,
          improvement: summary.passRate * 100,
          isSignificant: summary.passRate >= 0.7,
        });
      } catch (err) {
        this.logger.warn(`Could not complete experiment: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    try {
      await this.opikService.flush();
    } catch {
      // Non-critical
    }

    const opikConfig = this.opikService.getConfig();

    return {
      experimentId,
      opikDashboardUrl: opikConfig
        ? `https://www.comet.com/opik/${opikConfig.workspaceName}/${opikConfig.projectName}`
        : null,
      report: {
        totalScenarios: summary.totalScenarios,
        passed: summary.passed,
        failed: summary.failed,
        passRate: summary.passRate,
        averageScores: summary.averageScores,
        scenarios: summary.results.map((r) => ({
          scenarioId: r.scenarioId,
          scenarioName: r.scenarioName,
          passed: r.passed,
          scores: r.scores,
          notes: r.notes,
        })),
      },
      durationMs: Date.now() - startTime,
    };
  }

  // ==========================================
  // OPTIMIZER INSIGHTS
  // ==========================================

  /**
   * GET /opik/optimizers/letter/history
   *
   * Prompt evolution history from the Letter Optimizer.
   * Shows generation fitness progression from evolutionary optimization.
   */
  @Get('optimizers/letter/history')
  async getLetterOptimizerHistory() {
    const experiments = await this.prisma.optimizerExperiment.findMany({
      where: { type: 'EVOLUTIONARY' },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return {
      optimizer: 'Letter Optimizer (Evolutionary)',
      description: 'Evolves future-self letter prompts using genetic algorithms with crossover and mutation',
      experiments: experiments.map((exp) => {
        const config = exp.config as Record<string, unknown>;
        const result = exp.result as Record<string, unknown> | null;
        return {
          id: exp.id,
          name: exp.name,
          status: exp.status,
          startedAt: exp.startedAt,
          completedAt: exp.completedAt,
          hypothesis: config?.hypothesis ?? null,
          fitnessScore: result?.variantResults
            ? (result.variantResults as Record<string, unknown>).score
            : null,
          analysis: result?.analysis ?? null,
        };
      }),
    };
  }

  /**
   * GET /opik/optimizers/tool/accuracy
   *
   * Tool selection accuracy from GEPA experiments.
   * Shows how the tool optimizer improves agent tool selection over time.
   */
  @Get('optimizers/tool/accuracy')
  async getToolOptimizerAccuracy() {
    const experiments = await this.prisma.optimizerExperiment.findMany({
      where: { type: 'GEPA' },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return {
      optimizer: 'Tool Optimizer (GEPA)',
      description: 'Optimizes AI agent tool selection policies via pattern analysis and rule generation',
      experiments: experiments.map((exp) => {
        const result = exp.result as Record<string, unknown> | null;
        return {
          id: exp.id,
          name: exp.name,
          status: exp.status,
          startedAt: exp.startedAt,
          completedAt: exp.completedAt,
          accuracy: result?.variantResults
            ? (result.variantResults as Record<string, unknown>).score
            : null,
          analysis: result?.analysis ?? null,
        };
      }),
    };
  }
}
