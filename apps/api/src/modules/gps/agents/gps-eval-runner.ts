/**
 * GPS Re-Router Evaluation Runner
 *
 * Batch evaluation runner for the GPS Re-Router agent.
 * Runs all scenarios from the evaluation dataset, scores them
 * with MetricsService, and checks structural expected traits.
 *
 * Usage (manual script or test):
 * ```typescript
 * const runner = new GpsEvalRunner(agent, metricsService);
 * const report = await runner.runBatch(GPS_EVAL_DATASET);
 * console.log(report.summary);
 * ```
 */

import { Logger } from '@nestjs/common';
import { GpsRerouterAgent } from './gps-rerouter.agent';
import { MetricsService } from '../../ai/opik/metrics';
import { OpikService } from '../../ai/opik/opik.service';
import { GpsEvalScenario, GPS_EVAL_DATASET } from './gps-eval-dataset';
import {
  BudgetStatus,
  GoalImpact,
  MultiGoalImpact,
  RecoveryPath,
  NonJudgmentalMessage,
} from '../interfaces';
import { createMonetaryValue } from '../../../common/utils';

/** Result for a single evaluation scenario */
export interface EvalScenarioResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  message: NonJudgmentalMessage | null;
  toneScore: number | null;
  toneReason: string | null;
  traitChecks: {
    mentionsCategoryName: { expected: boolean; actual: boolean; passed: boolean };
    mentionsGoalName: { expected: boolean; actual: boolean; passed: boolean };
    usesGpsMetaphor: { expected: boolean; actual: boolean; passed: boolean };
    toneMinScore: { expected: number; actual: number | null; passed: boolean };
  };
  error: string | null;
  durationMs: number;
  traceId?: string;
}

/** Aggregated report for all scenarios */
export interface EvalReport {
  scenarios: EvalScenarioResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgToneScore: number;
    failedScenarios: string[];
    durationMs: number;
  };
}

/** GPS metaphor keywords to check for */
const GPS_METAPHOR_WORDS = [
  'route', 'recalculate', 'recalculating', 'path', 'detour',
  'destination', 'gps', 'navigate', 'track', 'direction',
  'reroute', 'rerouting', 'compass', 'map',
];

export class GpsEvalRunner {
  private readonly logger = new Logger(GpsEvalRunner.name);

  constructor(
    private readonly agent: GpsRerouterAgent,
    private readonly metricsService: MetricsService,
    private readonly opikService?: OpikService,
  ) {}

  /**
   * Run all scenarios from the evaluation dataset
   */
  async runBatch(
    scenarios: GpsEvalScenario[] = GPS_EVAL_DATASET,
  ): Promise<EvalReport> {
    const startTime = Date.now();
    const results: EvalScenarioResult[] = [];

    for (const scenario of scenarios) {
      this.logger.log(`Running scenario: ${scenario.id} — ${scenario.name}`);
      const result = await this.runScenario(scenario);
      results.push(result);

      const status = result.passed ? 'PASS' : 'FAIL';
      this.logger.log(
        `  ${status} — tone: ${result.toneScore ?? 'N/A'}/5, error: ${result.error ?? 'none'}`,
      );
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const toneScores = results
      .map(r => r.toneScore)
      .filter((s): s is number => s !== null);

    const summary = {
      total: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? passed / results.length : 0,
      avgToneScore: toneScores.length > 0
        ? toneScores.reduce((a, b) => a + b, 0) / toneScores.length
        : 0,
      failedScenarios: results.filter(r => !r.passed).map(r => r.scenarioId),
      durationMs: Date.now() - startTime,
    };

    this.logger.log(
      `\nEval complete: ${passed}/${results.length} passed (${(summary.passRate * 100).toFixed(1)}%), ` +
      `avg tone: ${summary.avgToneScore.toFixed(2)}/5, ` +
      `duration: ${(summary.durationMs / 1000).toFixed(1)}s`,
    );

    return { scenarios: results, summary };
  }

  /**
   * Run a single evaluation scenario
   */
  private async runScenario(scenario: GpsEvalScenario): Promise<EvalScenarioResult> {
    const startTime = Date.now();

    // Create Opik trace for this scenario (if OpikService is available)
    const trace = this.opikService?.createTrace({
      name: 'gps_eval_scenario',
      input: {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        category: scenario.input.category,
        trigger: scenario.input.trigger,
      },
      metadata: { evalRun: true, dataset: 'gps-rerouter-v1' },
      tags: ['eval', 'gps-rerouter', scenario.input.trigger],
    });

    // Build mock data from scenario input
    const { budgetStatus, goalImpact, multiGoalImpact, recoveryPaths } =
      this.buildMockData(scenario);

    let message: NonJudgmentalMessage | null = null;
    let toneScore: number | null = null;
    let toneReason: string | null = null;
    let error: string | null = null;

    try {
      // Generate message via the agent
      message = await this.agent.generatePersonalizedMessage(
        'eval-user-id', // Synthetic user ID
        budgetStatus,
        goalImpact,
        multiGoalImpact,
        recoveryPaths,
      );

      // Evaluate tone with MetricsService
      const messageText = `${message.headline}\n${message.subtext}`;
      try {
        const toneResult = await this.metricsService.evaluateTone(
          { input: '', output: '' },
          messageText,
        );
        toneScore = toneResult.score;
        toneReason = toneResult.reason;
      } catch (evalError) {
        toneReason = `Tone evaluation failed: ${evalError instanceof Error ? evalError.message : 'Unknown'}`;
      }
    } catch (agentError) {
      error = agentError instanceof Error ? agentError.message : 'Agent failed';
    }

    // Check structural traits
    const traitChecks = this.checkTraits(message, scenario, toneScore);

    const passed = error === null
      && traitChecks.mentionsCategoryName.passed
      && traitChecks.mentionsGoalName.passed
      && traitChecks.usesGpsMetaphor.passed
      && traitChecks.toneMinScore.passed;

    // Add Opik feedback scores and end trace
    if (trace && this.opikService) {
      this.opikService.addFeedback({
        traceId: trace.traceId,
        name: 'ToneEmpathy',
        value: toneScore ?? 0,
        category: 'quality',
        comment: toneReason ?? undefined,
      });
      this.opikService.addFeedback({
        traceId: trace.traceId,
        name: 'EvalPassFail',
        value: passed ? 1 : 0,
        category: 'quality',
        comment: error ?? (passed ? 'All checks passed' : 'Trait check failed'),
      });
      this.opikService.endTrace(trace, {
        success: passed,
        result: {
          toneScore,
          passed,
          traitChecks,
          ...(message && { headline: message.headline }),
        },
      });
    }

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed,
      message,
      toneScore,
      toneReason,
      traitChecks,
      error,
      durationMs: Date.now() - startTime,
      traceId: trace?.traceId,
    };
  }

  /**
   * Check expected traits against the generated message
   */
  private checkTraits(
    message: NonJudgmentalMessage | null,
    scenario: GpsEvalScenario,
    toneScore: number | null,
  ) {
    const fullText = message
      ? `${message.headline} ${message.subtext}`.toLowerCase()
      : '';

    const mentionsCategoryName = fullText.includes(
      scenario.input.category.toLowerCase(),
    );
    const mentionsGoalName = fullText.includes(
      scenario.input.goalName.toLowerCase(),
    );
    const usesGpsMetaphor = GPS_METAPHOR_WORDS.some(word =>
      fullText.includes(word),
    );

    return {
      mentionsCategoryName: {
        expected: scenario.expectedTraits.mentionsCategoryName,
        actual: mentionsCategoryName,
        passed: !scenario.expectedTraits.mentionsCategoryName || mentionsCategoryName,
      },
      mentionsGoalName: {
        expected: scenario.expectedTraits.mentionsGoalName,
        actual: mentionsGoalName,
        passed: !scenario.expectedTraits.mentionsGoalName || mentionsGoalName,
      },
      usesGpsMetaphor: {
        expected: scenario.expectedTraits.usesGpsMetaphor,
        actual: usesGpsMetaphor,
        passed: !scenario.expectedTraits.usesGpsMetaphor || usesGpsMetaphor,
      },
      toneMinScore: {
        expected: scenario.expectedTraits.toneMinScore,
        actual: toneScore,
        passed: toneScore === null || toneScore >= scenario.expectedTraits.toneMinScore,
      },
    };
  }

  /**
   * Build mock BudgetStatus, GoalImpact, MultiGoalImpact, and RecoveryPaths
   * from a scenario's input parameters
   */
  private buildMockData(scenario: GpsEvalScenario): {
    budgetStatus: BudgetStatus;
    goalImpact: GoalImpact;
    multiGoalImpact: MultiGoalImpact;
    recoveryPaths: RecoveryPath[];
  } {
    const { input } = scenario;
    const overspendPercent = input.budgeted > 0
      ? Math.max(0, (input.spent / input.budgeted - 1) * 100)
      : 0;

    const budgetStatus: BudgetStatus = {
      category: input.category,
      categoryId: 'eval-category-id',
      budgeted: createMonetaryValue(input.budgeted, input.currency),
      spent: createMonetaryValue(input.spent, input.currency),
      remaining: createMonetaryValue(
        Math.max(0, input.budgeted - input.spent),
        input.currency,
      ),
      overagePercent: overspendPercent,
      trigger: input.trigger,
      period: 'MONTHLY',
    };

    const goalImpact: GoalImpact = {
      goalId: 'eval-goal-id',
      goalName: input.goalName,
      goalAmount: createMonetaryValue(input.goalAmount, input.currency),
      goalDeadline: new Date(input.goalDeadline),
      previousProbability: input.previousProbability,
      newProbability: input.newProbability,
      probabilityDrop: input.newProbability - input.previousProbability,
      message: `Goal probability changed from ${(input.previousProbability * 100).toFixed(0)}% to ${(input.newProbability * 100).toFixed(0)}%`,
    };

    const multiGoalImpact: MultiGoalImpact = {
      primaryGoal: goalImpact,
      otherGoals: [],
      summary: {
        totalGoalsAffected: 1,
        averageProbabilityDrop: goalImpact.probabilityDrop,
        mostAffectedGoal: input.goalName,
        leastAffectedGoal: input.goalName,
      },
    };

    const recoveryPaths: RecoveryPath[] = [
      {
        id: 'time_adjustment',
        name: 'Timeline Flex',
        description: 'Extend your deadline by 2 weeks',
        newProbability: Math.min(1, input.newProbability + 0.08),
        effort: 'Low',
        timelineImpact: '+2 weeks',
      },
      {
        id: 'rate_adjustment',
        name: 'Savings Boost',
        description: 'Increase savings rate by 5% for 4 weeks',
        newProbability: Math.min(1, input.newProbability + 0.12),
        effort: 'Medium',
        savingsImpact: '+5% for 4 weeks',
      },
      {
        id: 'category_freeze',
        name: 'Category Pause',
        description: `Pause ${input.category} spending for 2 weeks`,
        newProbability: Math.min(1, input.newProbability + 0.15),
        effort: 'High',
        freezeDuration: '2 weeks',
      },
    ];

    return { budgetStatus, goalImpact, multiGoalImpact, recoveryPaths };
  }
}
