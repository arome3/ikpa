/**
 * Future Self Agent
 *
 * Core business logic for the Future Self Simulator feature.
 * Bridges temporal disconnect through personalized "Letters from 2045"
 * and dual-path financial visualizations.
 *
 * Based on MIT Media Lab research showing 16% increase in savings
 * after future self interaction.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OpikService } from '../../ai/opik/opik.service';
import { TrackedTrace, TrackedSpan } from '../../ai/opik/interfaces';
import { MetricsService } from '../../ai/opik/metrics';
import { SimulationEngineCalculator } from '../../finance/calculators';
import {
  SimulationInput,
  ECONOMIC_DEFAULTS,
  TimeHorizon,
} from '../../finance/interfaces';
import { GoalStatus } from '@prisma/client';
import { AnthropicService } from '../../ai/anthropic';
import { ContentModerationService } from '../services/content-moderation.service';
import {
  FutureSimulation,
  LetterFromFuture,
  TimelineProjection,
  UserContext,
  ToneEvaluationResult,
  ProjectedNetWorthByHorizon,
} from '../interfaces';
import {
  FutureSelfUserNotFoundException,
  InsufficientUserDataException,
  LetterGenerationException,
  FutureSelfSimulationException,
} from '../exceptions';
import {
  buildLetterPrompt,
  LETTER_SYSTEM_PROMPT,
} from '../prompts/future-self.prompt';
import {
  FUTURE_AGE,
  LETTER_MAX_TOKENS,
  TRACE_FUTURE_SELF_SIMULATION,
  TRACE_FUTURE_SELF_LETTER,
  SPAN_GET_USER_CONTEXT,
  SPAN_RUN_SIMULATION,
  SPAN_GENERATE_LETTER,
  SPAN_EVALUATE_TONE,
  SPAN_CONTENT_MODERATION,
  FEEDBACK_TONE_EMPATHY,
} from '../constants';

@Injectable()
export class FutureSelfAgent {
  private readonly logger = new Logger(FutureSelfAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly simulationEngine: SimulationEngineCalculator,
    private readonly anthropicService: AnthropicService,
    private readonly contentModeration: ContentModerationService,
    private readonly metricsService: MetricsService,
  ) {}

  // ==========================================
  // PUBLIC METHODS
  // ==========================================

  /**
   * Generate a dual-path simulation for the user
   *
   * Compares "current behavior" vs "optimized IKPA path" using
   * Monte Carlo simulation with 10,000 iterations.
   *
   * @param userId - The user's ID
   * @returns Dual-path simulation results
   */
  async generateSimulation(userId: string): Promise<FutureSimulation> {
    // Create Opik trace with error protection
    let trace: TrackedTrace | null = null;
    try {
      trace = this.opikService.createTrace({
        name: TRACE_FUTURE_SELF_SIMULATION,
        input: { userId },
        metadata: {
          agent: 'future_self',
          version: '1.0',
        },
        tags: ['future-self', 'simulation'],
      });
    } catch (traceError) {
      this.logger.warn(
        `Failed to create Opik trace: ${traceError instanceof Error ? traceError.message : 'Unknown error'}`,
      );
    }

    try {
      // Span 1: Get user data (with error protection)
      let userDataSpan: TrackedSpan | null = null;
      try {
        if (trace?.trace) {
          userDataSpan = this.opikService.createToolSpan({
            trace: trace.trace,
            name: 'get_user_data',
            input: { userId },
            metadata: {},
          });
        }
      } catch {
        // Span creation failed, continue without tracing
      }

      const userData = await this.getUserFinancialData(userId);

      try {
        if (userDataSpan) {
          this.opikService.endSpan(userDataSpan, {
            output: {
              hasData: true,
              savingsRate: userData.currentSavingsRate,
            },
            metadata: {},
          });
        }
      } catch {
        // Span ending failed, continue
      }

      // Span 2: Run simulation (with error protection)
      let simSpan: TrackedSpan | null = null;
      try {
        if (trace?.trace) {
          simSpan = this.opikService.createToolSpan({
            trace: trace.trace,
            name: SPAN_RUN_SIMULATION,
            input: {
              savingsRate: userData.currentSavingsRate,
              hasGoals: userData.goals.length > 0,
            },
            metadata: {},
          });
        }
      } catch {
        // Span creation failed, continue without tracing
      }

      const simulationOutput = await this.simulationEngine.runDualPathSimulation(
        userId,
        this.buildSimulationInput(userData),
        userData.currency,
      );

      try {
        if (simSpan) {
          this.opikService.endSpan(simSpan, {
            output: {
              currentProbability: simulationOutput.currentPath.probability,
              optimizedProbability: simulationOutput.optimizedPath.probability,
              requiredSavingsRate: simulationOutput.optimizedPath.requiredSavingsRate,
            },
            metadata: {},
          });
        }
      } catch {
        // Span ending failed, continue
      }

      // Transform to FutureSimulation format
      const result: FutureSimulation = {
        currentBehavior: {
          savingsRate: userData.currentSavingsRate,
          projectedNetWorth: simulationOutput.currentPath.projectedNetWorth as ProjectedNetWorthByHorizon,
        },
        withIKPA: {
          savingsRate: simulationOutput.optimizedPath.requiredSavingsRate,
          projectedNetWorth: simulationOutput.optimizedPath.projectedNetWorth as ProjectedNetWorthByHorizon,
        },
        difference_20yr: simulationOutput.wealthDifference['20yr'],
      };

      // End trace with success (with error protection)
      try {
        if (trace) {
          this.opikService.endTrace(trace, {
            success: true,
            result: {
              difference20yr: result.difference_20yr,
              currentProbability: simulationOutput.currentPath.probability,
              optimizedProbability: simulationOutput.optimizedPath.probability,
            },
          });
        }
      } catch {
        // Trace ending failed, continue
      }

      this.logger.log(
        `Simulation generated for user ${userId}: difference=${result.difference_20yr}`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      try {
        if (trace) {
          this.opikService.endTrace(trace, {
            success: false,
            error: errorMessage,
          });
        }
      } catch {
        // Trace ending failed, continue
      }

      this.logger.error(`Simulation failed for user ${userId}: ${errorMessage}`);

      if (
        error instanceof FutureSelfUserNotFoundException ||
        error instanceof InsufficientUserDataException
      ) {
        throw error;
      }

      throw new FutureSelfSimulationException(errorMessage, { userId });
    }
  }

  /**
   * Generate a personalized letter from the user's future self
   *
   * @param userId - The user's ID
   * @returns The letter with simulation data
   */
  async generateLetter(userId: string): Promise<LetterFromFuture> {
    // Create Opik trace with error protection
    let trace: TrackedTrace | null = null;
    try {
      trace = this.opikService.createTrace({
        name: TRACE_FUTURE_SELF_LETTER,
        input: { userId },
        metadata: {
          agent: 'future_self',
          version: '1.0',
          model: this.anthropicService.getModel(),
          provider: 'anthropic',
        },
        tags: ['future-self', 'letter', 'llm'],
      });
    } catch (traceError) {
      this.logger.warn(
        `Failed to create Opik trace: ${traceError instanceof Error ? traceError.message : 'Unknown error'}`,
      );
    }

    try {
      // Span 1: Get user context (with error protection)
      const contextSpan = this.safeCreateToolSpan(trace, SPAN_GET_USER_CONTEXT, { userId });

      const userContext = await this.getUserContext(userId);

      // Validate user age is less than future age
      if (userContext.age >= FUTURE_AGE) {
        throw new InsufficientUserDataException([
          `User age (${userContext.age}) must be less than future self age (${FUTURE_AGE})`,
        ]);
      }

      this.safeEndSpan(contextSpan, {
        output: {
          hasContext: true,
          age: userContext.age,
          city: userContext.city,
          goalsCount: userContext.goals.length,
        },
        metadata: {},
      });

      // Span 2: Run simulation (with error protection)
      const simSpan = this.safeCreateToolSpan(trace, SPAN_RUN_SIMULATION, {
        savingsRate: userContext.currentSavingsRate,
      });

      const simulation = await this.generateSimulation(userId);

      this.safeEndSpan(simSpan, {
        output: { difference20yr: simulation.difference_20yr },
        metadata: {},
      });

      // Span 3: Generate letter with LLM (with error protection)
      const llmSpan = this.safeCreateLLMSpan(trace, SPAN_GENERATE_LETTER, {
        promptType: 'letter_generation',
        userName: userContext.name,
        userAge: userContext.age,
      });

      const prompt = buildLetterPrompt(userContext, simulation);
      const response = await this.anthropicService.generate(
        prompt,
        LETTER_MAX_TOKENS,
        LETTER_SYSTEM_PROMPT,
      );

      this.safeEndLLMSpan(llmSpan, {
        output: {
          letterLength: response.content.length,
          stopReason: response.stopReason,
        },
        usage: response.usage,
        metadata: {},
      });

      // Span 4: Content moderation check (with error protection)
      const moderationSpan = this.safeCreateToolSpan(trace, SPAN_CONTENT_MODERATION, {
        letterLength: response.content.length,
      });

      const moderationResult = this.contentModeration.moderate(response.content);

      this.safeEndSpan(moderationSpan, {
        output: {
          passed: moderationResult.passed,
          severity: moderationResult.severity,
          flagCount: moderationResult.flags.length,
        },
        metadata: { flags: moderationResult.flags },
      });

      // If moderation fails, throw an error
      if (!moderationResult.passed) {
        this.logger.error(
          `Content moderation failed for user ${userId}: ${moderationResult.flags.join(', ')}`,
        );
        throw new LetterGenerationException(
          'Generated content failed safety checks. Please try again.',
          { userId, flags: moderationResult.flags },
        );
      }

      // Span 4.5: Financial safety guardrail check (with error protection)
      const safetySpan = this.safeCreateToolSpan(trace, 'eval_financial_safety', {
        letterLength: response.content.length,
      });

      try {
        const safetyResult = await this.metricsService.checkSafety(response.content);

        this.safeEndSpan(safetySpan, {
          output: {
            score: safetyResult.score,
            reason: safetyResult.reason,
            blocked: safetyResult.score === 0,
          },
          metadata: safetyResult.metadata ?? {},
        });

        // If financial safety check fails (score 0), block the response
        if (safetyResult.score === 0) {
          this.logger.error(
            `Financial safety check failed for user ${userId}: ${safetyResult.reason}`,
          );
          throw new LetterGenerationException(
            'Generated content contains potentially unsafe financial advice. Please try again.',
            { userId, reason: safetyResult.reason },
          );
        }
      } catch (safetyError) {
        // If it's our own LetterGenerationException, rethrow it
        if (safetyError instanceof LetterGenerationException) {
          throw safetyError;
        }
        // Otherwise log and continue - don't block on safety check errors
        this.logger.warn(
          `Financial safety check failed: ${safetyError instanceof Error ? safetyError.message : 'Unknown error'}`,
        );
        this.safeEndSpan(safetySpan, {
          output: { error: 'Safety check error' },
          metadata: {},
        });
      }

      // Span 5: Evaluate tone empathy (with error protection)
      const toneSpan = this.safeCreateLLMSpan(trace, SPAN_EVALUATE_TONE, {
        evaluationType: 'tone_empathy',
      });

      let toneScore = 3; // Default if evaluation fails
      try {
        const toneResult = await this.evaluateToneEmpathy(response.content);
        toneScore = toneResult.score;

        this.safeEndLLMSpan(toneSpan, {
          output: {
            score: toneResult.score,
            reasoning: toneResult.reasoning,
          },
          metadata: {},
        });

        // Add feedback score to trace (with error protection)
        if (trace) {
          try {
            this.opikService.addFeedback({
              traceId: trace.traceId,
              name: FEEDBACK_TONE_EMPATHY,
              value: toneScore,
              category: 'quality',
              comment: toneResult.reasoning,
              source: 'llm-as-judge',
            });
          } catch {
            // Feedback addition failed, continue
          }
        }
      } catch (evalError) {
        this.logger.warn(
          `Tone evaluation failed: ${evalError instanceof Error ? evalError.message : 'Unknown error'}`,
        );
        this.safeEndLLMSpan(toneSpan, {
          output: { error: 'Evaluation failed' },
          metadata: {},
        });
      }

      // Build result with toneScore and tokenUsage for persistence
      const result: LetterFromFuture = {
        content: response.content,
        generatedAt: new Date(),
        simulationData: simulation,
        userAge: userContext.age,
        futureAge: FUTURE_AGE,
        toneScore,
        tokenUsage: response.usage,
      };

      // End trace with success (with error protection)
      this.safeEndTrace(trace, {
        success: true,
        result: {
          letterLength: result.content.length,
          toneScore,
          userAge: result.userAge,
          futureAge: result.futureAge,
        },
      });

      this.logger.log(
        `Letter generated for user ${userId}: length=${result.content.length}, toneScore=${toneScore}`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.safeEndTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(`Letter generation failed for user ${userId}: ${errorMessage}`);

      if (
        error instanceof FutureSelfUserNotFoundException ||
        error instanceof InsufficientUserDataException ||
        error instanceof LetterGenerationException
      ) {
        throw error;
      }

      throw new LetterGenerationException(errorMessage, { userId });
    }
  }

  /**
   * Get timeline projection at a specific year horizon
   *
   * @param userId - The user's ID
   * @param years - Number of years to project
   * @returns Timeline projection with current vs optimized paths
   */
  async getTimeline(userId: string, years: number): Promise<TimelineProjection> {
    const simulation = await this.generateSimulation(userId);
    const horizonKey = this.getHorizonKey(years);

    return {
      currentPath: simulation.currentBehavior.projectedNetWorth[horizonKey],
      optimizedPath: simulation.withIKPA.projectedNetWorth[horizonKey],
      difference:
        simulation.withIKPA.projectedNetWorth[horizonKey] -
        simulation.currentBehavior.projectedNetWorth[horizonKey],
      years,
    };
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  /**
   * Evaluate tone empathy using MetricsService G-Eval
   *
   * Delegates to MetricsService which handles caching, LLM calls,
   * and graceful degradation.
   */
  private async evaluateToneEmpathy(letter: string): Promise<ToneEvaluationResult> {
    const result = await this.metricsService.evaluateTone(
      { input: '', output: '' }, // Context not needed for letter evaluation
      letter,
    );

    return {
      score: result.score,
      reasoning: result.reason,
    };
  }

  /**
   * Get user financial data for simulation
   */
  private async getUserFinancialData(userId: string): Promise<{
    currentSavingsRate: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    currentNetWorth: number;
    goals: { name: string; amount: number; deadline: Date }[];
    currency: string;
    country: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        goals: {
          where: { status: GoalStatus.ACTIVE },
          orderBy: { priority: 'asc' },
          take: 5,
        },
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new FutureSelfUserNotFoundException(userId);
    }

    // Get latest financial snapshot
    const snapshot = user.snapshots[0];
    if (!snapshot) {
      throw new InsufficientUserDataException(['financial snapshot']);
    }

    // Calculate current savings rate from snapshot
    const monthlyIncome = Number(snapshot.totalIncome);
    const monthlyExpenses = Number(snapshot.totalExpenses);
    const currentNetWorth = Number(snapshot.netWorth);

    if (monthlyIncome <= 0) {
      throw new InsufficientUserDataException(['monthly income']);
    }

    const currentSavingsRate = Math.max(
      0,
      Math.min(1, (monthlyIncome - monthlyExpenses) / monthlyIncome),
    );

    // Map goals - targetDate can be null, default to 5 years from now
    const defaultDeadline = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000);
    const goals = user.goals.map((g) => ({
      name: g.name,
      amount: Number(g.targetAmount),
      deadline: g.targetDate ?? defaultDeadline,
    }));

    // Use default goal if none defined
    if (goals.length === 0) {
      const defaultGoalAmount = monthlyIncome * 12 * 10; // 10 years of income
      goals.push({
        name: 'Financial Freedom',
        amount: defaultGoalAmount,
        deadline: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
      });
      this.logger.debug(
        `User ${userId} has no active goals - using synthetic "Financial Freedom" goal (₦${defaultGoalAmount.toLocaleString()})`,
      );
    }

    return {
      currentSavingsRate,
      monthlyIncome,
      monthlyExpenses,
      currentNetWorth,
      goals,
      currency: user.currency || 'NGN',
      country: user.country || 'NIGERIA',
    };
  }

  /**
   * Get full user context for letter personalization
   */
  async getUserContext(userId: string): Promise<UserContext> {
    // Get comprehensive user data for enrichment
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        goals: {
          where: { status: GoalStatus.ACTIVE },
          orderBy: { priority: 'asc' },
          take: 5,
        },
        snapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        debts: {
          where: { isActive: true },
          take: 5,
        },
        familySupport: {
          where: { isActive: true },
          take: 5,
        },
      },
    });

    if (!user) {
      throw new FutureSelfUserNotFoundException(userId);
    }

    const snapshot = user.snapshots[0];
    if (!snapshot) {
      throw new InsufficientUserDataException(['financial snapshot']);
    }

    const monthlyIncome = Number(snapshot.totalIncome);
    const monthlyExpenses = Number(snapshot.totalExpenses);
    const currentNetWorth = Number(snapshot.netWorth);

    if (monthlyIncome <= 0) {
      throw new InsufficientUserDataException(['monthly income']);
    }

    const currentSavingsRate = Math.max(
      0,
      Math.min(1, (monthlyIncome - monthlyExpenses) / monthlyIncome),
    );

    // Calculate age from birthDate
    const birthDate = user.dateOfBirth;
    let age = 30; // Default age
    if (birthDate) {
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Extract first name from full name
    const firstName = user.name?.split(' ')[0] || 'Friend';

    // City is derived from country since schema doesn't have city field
    const cityByCountry: Record<string, string> = {
      NIGERIA: 'Lagos',
      GHANA: 'Accra',
      KENYA: 'Nairobi',
      SOUTH_AFRICA: 'Johannesburg',
      EGYPT: 'Cairo',
    };

    // Enrich context with recent decisions and struggles
    // Use null coalescing to handle potentially null/undefined arrays
    const { recentDecisions, struggles } = await this.enrichUserContext(
      userId,
      user.debts ?? [],
      user.familySupport ?? [],
      monthlyIncome,
    );

    return {
      name: firstName,
      age,
      city: cityByCountry[user.country] || 'your city',
      goals: (user.goals ?? []).map((g) => ({
        name: g.name,
        amount: Number(g.targetAmount),
        deadline: g.targetDate ?? new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
      })),
      currentSavingsRate,
      monthlyIncome,
      currentNetWorth,
      currency: user.currency || 'NGN',
      recentDecisions,
      struggles,
    };
  }

  /**
   * Enrich user context with recent decisions and struggles
   * Analyzes recent activity to personalize the letter
   *
   * Uses Promise.all to batch database queries for better performance
   */
  private async enrichUserContext(
    userId: string,
    debts: { name: string; type: string; remainingBalance: unknown }[],
    familySupport: { name: string; relationship: string; amount: unknown; frequency: string }[],
    monthlyIncome: number,
  ): Promise<{ recentDecisions: string[]; struggles: string[] }> {
    const recentDecisions: string[] = [];
    const struggles: string[] = [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const largeExpenseThreshold = monthlyIncome * 0.05;

    // Batch all database queries in parallel for performance
    const [recentExpenses, cancelledSubs, recentContributions, expenseAggregate] =
      await Promise.all([
        // Query 1: Recent large expenses
        this.prisma.expense.findMany({
          where: {
            userId,
            date: { gte: thirtyDaysAgo },
            amount: { gte: largeExpenseThreshold },
          },
          orderBy: { amount: 'desc' },
          take: 3,
          include: { category: true },
        }),

        // Query 2: Subscription cancellations (Shark Auditor decisions)
        this.prisma.swipeDecision.findMany({
          where: {
            subscription: { userId },
            action: 'CANCEL',
            decidedAt: { gte: thirtyDaysAgo },
          },
          include: { subscription: true },
          take: 2,
        }),

        // Query 3: Goal contributions
        this.prisma.goalContribution.findMany({
          where: {
            goal: { userId },
            date: { gte: thirtyDaysAgo },
          },
          include: { goal: true },
          orderBy: { amount: 'desc' },
          take: 2,
        }),

        // Query 4: Monthly expenses aggregate for savings rate calculation
        this.prisma.expense.aggregate({
          where: {
            userId,
            date: { gte: thirtyDaysAgo },
          },
          _sum: { amount: true },
        }),
      ]);

    // Process recent expenses as decisions
    for (const expense of recentExpenses) {
      const amount = Number(expense.amount);
      const description = expense.description || expense.merchant || expense.category.name;
      recentDecisions.push(
        `Spent ₦${amount.toLocaleString()} on ${description}`,
      );
    }

    // Process subscription cancellations
    for (const swipe of cancelledSubs) {
      recentDecisions.push(
        `Cancelled ${swipe.subscription.name} subscription (saving ₦${Number(swipe.subscription.monthlyCost).toLocaleString()}/month)`,
      );
    }

    // Process goal contributions
    for (const contrib of recentContributions) {
      recentDecisions.push(
        `Saved ₦${Number(contrib.amount).toLocaleString()} towards "${contrib.goal.name}"`,
      );
    }

    // Identify struggles from debts
    for (const debt of debts) {
      const balance = Number(debt.remainingBalance);
      if (balance > monthlyIncome * 2) {
        struggles.push(
          `${debt.name} debt of ₦${balance.toLocaleString()}`,
        );
      }
    }

    // Identify struggles from family support obligations
    const totalFamilySupport = familySupport.reduce((sum, fs) => {
      return sum + Number(fs.amount);
    }, 0);

    if (totalFamilySupport > monthlyIncome * 0.2) {
      const names = familySupport.map((fs) => fs.name).join(', ');
      struggles.push(
        `Supporting family (${names}) with ₦${totalFamilySupport.toLocaleString()}/month`,
      );
    }

    // Check if savings rate is below recommended
    const monthlyExpenses = Number(expenseAggregate._sum.amount) || 0;
    const savingsRate = (monthlyIncome - monthlyExpenses) / monthlyIncome;
    if (savingsRate < 0.15) {
      struggles.push(
        `Low savings rate (${(savingsRate * 100).toFixed(0)}% vs recommended 15%)`,
      );
    }

    return {
      recentDecisions: recentDecisions.slice(0, 3), // Limit to 3 most impactful
      struggles: struggles.slice(0, 3), // Limit to 3 main struggles
    };
  }

  /**
   * Build simulation input from user data
   */
  private buildSimulationInput(userData: {
    currentSavingsRate: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    currentNetWorth: number;
    goals: { name: string; amount: number; deadline: Date }[];
    country: string;
  }): SimulationInput {
    const economicDefaults =
      ECONOMIC_DEFAULTS[userData.country] || ECONOMIC_DEFAULTS.DEFAULT;

    const primaryGoal = userData.goals[0];

    return {
      currentSavingsRate: userData.currentSavingsRate,
      monthlyIncome: userData.monthlyIncome,
      monthlyExpenses: userData.monthlyExpenses,
      currentNetWorth: userData.currentNetWorth,
      goalAmount: primaryGoal?.amount || userData.monthlyIncome * 12 * 10,
      goalDeadline: primaryGoal?.deadline || new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      goals: userData.goals.map((g, idx) => ({
        id: `goal-${idx}`,
        name: g.name,
        amount: g.amount,
        deadline: g.deadline,
        priority: idx + 1,
      })),
      expectedReturnRate: economicDefaults.expectedReturn,
      inflationRate: economicDefaults.inflationRate,
      incomeGrowthRate: economicDefaults.incomeGrowthRate,
    };
  }

  /**
   * Convert years to time horizon key
   *
   * Maps arbitrary year values to supported time horizons:
   * - ≤ 0.5 years → '6mo'
   * - ≤ 1 year → '1yr'
   * - ≤ 5 years → '5yr'
   * - ≤ 10 years → '10yr'
   * - > 10 years → '20yr'
   *
   * @param years - Number of years (can be fractional)
   * @returns The closest supported time horizon key
   */
  private getHorizonKey(years: number): TimeHorizon {
    if (years <= 0.5) return '6mo';
    if (years <= 1) return '1yr';
    if (years <= 5) return '5yr';
    if (years <= 10) return '10yr';
    return '20yr';
  }

  // ==========================================
  // SAFE TRACING HELPERS
  // ==========================================

  /**
   * Safely create a tool span with error protection
   * Returns null if trace is not available or creation fails
   */
  private safeCreateToolSpan(
    trace: TrackedTrace | null,
    name: string,
    input: Record<string, unknown>,
  ): TrackedSpan | null {
    if (!trace?.trace) return null;
    try {
      return this.opikService.createToolSpan({
        trace: trace.trace,
        name,
        input,
        metadata: {},
      });
    } catch {
      return null;
    }
  }

  /**
   * Safely create an LLM span with error protection
   * Returns null if trace is not available or creation fails
   */
  private safeCreateLLMSpan(
    trace: TrackedTrace | null,
    name: string,
    input: Record<string, unknown>,
  ): TrackedSpan | null {
    if (!trace?.trace) return null;
    try {
      return this.opikService.createLLMSpan({
        trace: trace.trace,
        name,
        model: this.anthropicService.getModel(),
        provider: 'anthropic',
        input,
        metadata: {},
      });
    } catch {
      return null;
    }
  }

  /**
   * Safely end a span with error protection
   */
  private safeEndSpan(
    span: TrackedSpan | null,
    result: { output: Record<string, unknown>; metadata: Record<string, unknown> },
  ): void {
    if (!span) return;
    try {
      this.opikService.endSpan(span, result);
    } catch {
      // Span ending failed, continue
    }
  }

  /**
   * Safely end an LLM span with error protection
   */
  private safeEndLLMSpan(
    span: TrackedSpan | null,
    result: {
      output: Record<string, unknown>;
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      metadata: Record<string, unknown>;
    },
  ): void {
    if (!span) return;
    try {
      this.opikService.endLLMSpan(span, result);
    } catch {
      // Span ending failed, continue
    }
  }

  /**
   * Safely end a trace with error protection
   */
  private safeEndTrace(
    trace: TrackedTrace | null,
    result: { success: boolean; result?: Record<string, unknown>; error?: string },
  ): void {
    if (!trace) return;
    try {
      this.opikService.endTrace(trace, result);
    } catch {
      // Trace ending failed, continue
    }
  }
}
