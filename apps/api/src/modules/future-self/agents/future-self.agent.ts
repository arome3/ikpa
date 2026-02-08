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
import { RedisService } from '../../../redis/redis.service';
import { OpikService } from '../../ai/opik/opik.service';
import { TrackedTrace, TrackedSpan } from '../../ai/opik/interfaces';
import { MetricsService, fireAndForgetEval } from '../../ai/opik/metrics';
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
  buildRegretLetterPrompt,
  LETTER_SYSTEM_PROMPT,
  LetterMode,
} from '../prompts/future-self.prompt';
import {
  buildConversationPrompt,
  CONVERSATION_SYSTEM_PROMPT,
} from '../prompts/conversation.prompt';
import {
  FUTURE_AGE,
  LETTER_MAX_TOKENS,
  TRACE_FUTURE_SELF_SIMULATION,
  SPAN_GET_USER_CONTEXT,
  SPAN_RUN_SIMULATION,
  SPAN_GENERATE_LETTER,
  SPAN_EVALUATE_TONE,
  SPAN_CONTENT_MODERATION,
  SPAN_LOAD_CONVERSATION_CONTEXT,
  SPAN_GENERATE_RESPONSE,
  SPAN_MODERATE_RESPONSE,
  SPAN_FETCH_EXPENSES,
  SPAN_FETCH_SUBSCRIPTIONS,
  SPAN_FETCH_CONTRIBUTIONS,
  SPAN_FETCH_EXPENSE_AGGREGATE,
  SPAN_FETCH_GPS_RECOVERY,
  FEEDBACK_TONE_EMPATHY,
  FEEDBACK_LETTER_QUALITY_COMPOSITE,
  FEEDBACK_CULTURAL_SENSITIVITY,
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
    private readonly redisService: RedisService,
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
  async generateSimulation(userId: string, parentTrace?: TrackedTrace | null): Promise<FutureSimulation> {
    // When called from generateLetter, parentTrace is provided and spans nest under it.
    // When called standalone (from controller), we create our own trace.
    const isNestedCall = !!parentTrace;
    let trace: TrackedTrace | null = parentTrace ?? null;

    if (!isNestedCall) {
      trace = this.safeCreateTrace(
        TRACE_FUTURE_SELF_SIMULATION,
        { userId },
        ['future-self', 'simulation', 'monte-carlo'],
      );
    }

    try {
      // Span 1: Get user data
      const userDataSpan = this.safeCreateToolSpan(trace, 'get_user_data', { userId });

      const userData = await this.getUserFinancialData(userId);

      this.safeEndSpan(userDataSpan, {
        output: {
          hasData: true,
          savingsRate: userData.currentSavingsRate,
        },
        metadata: {},
      });

      // Span 2: Run Monte Carlo simulation
      const simSpan = this.safeCreateToolSpan(trace, SPAN_RUN_SIMULATION, {
        savingsRate: userData.currentSavingsRate,
        hasGoals: userData.goals.length > 0,
      });

      const simulationOutput = await this.simulationEngine.runDualPathSimulation(
        userId,
        this.buildSimulationInput(userData),
        userData.currency,
      );

      this.safeEndSpan(simSpan, {
        output: {
          currentProbability: simulationOutput.currentPath.probability,
          optimizedProbability: simulationOutput.optimizedPath.probability,
          requiredSavingsRate: simulationOutput.optimizedPath.requiredSavingsRate,
        },
        metadata: {},
      });

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

      // Only end trace if we created it (standalone call)
      if (!isNestedCall) {
        this.safeEndTrace(trace, {
          success: true,
          result: {
            difference20yr: result.difference_20yr,
            currentProbability: simulationOutput.currentPath.probability,
            optimizedProbability: simulationOutput.optimizedPath.probability,
          },
        });
      }

      this.logger.log(
        `Simulation generated for user ${userId}: difference=${result.difference_20yr}`,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (!isNestedCall) {
        this.safeEndTrace(trace, { success: false, error: errorMessage });
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
  async generateLetter(userId: string, mode: LetterMode = 'gratitude'): Promise<LetterFromFuture> {
    // Create agent-specific Opik trace
    const trace = this.safeCreateAgentTrace(userId, {
      mode,
      model: this.anthropicService.getModel(),
      provider: 'anthropic',
      letterMode: mode,
    }, ['future-self', 'letter', 'generation', mode === 'regret' ? 'regret-mode' : 'gratitude-mode']);

    try {
      // Span 1: Get user context (trace passed for retrieval span tracking)
      const contextSpan = this.safeCreateToolSpan(trace, SPAN_GET_USER_CONTEXT, { userId });

      const userContext = await this.getUserContext(userId, trace);

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

      // Spans 2-3: Run simulation (nested under this trace — no separate trace created)
      const simulation = await this.generateSimulation(userId, trace);

      // Span 4: Generate letter with LLM
      const llmSpan = this.safeCreateLLMSpan(trace, SPAN_GENERATE_LETTER, {
        promptType: 'letter_generation',
        letterMode: mode,
        userName: userContext.name,
        userAge: userContext.age,
      });

      const prompt = mode === 'regret'
        ? buildRegretLetterPrompt(userContext, simulation)
        : buildLetterPrompt(userContext, simulation);
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

      let safetyScore = 1; // Default: passed (normalized to 0-1 for composite)
      try {
        const safetyResult = await this.metricsService.checkSafety(response.content);
        safetyScore = safetyResult.score > 0 ? 1 : 0;

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

      // Span 7: Evaluate cultural sensitivity
      let culturalScore = 3; // Default if evaluation fails
      try {
        const culturalResult = await this.metricsService.evaluateCultural(
          { input: '', output: '' },
          response.content,
        );
        culturalScore = culturalResult.score;

        if (trace) {
          this.opikService.addFeedback({
            traceId: trace.traceId,
            name: FEEDBACK_CULTURAL_SENSITIVITY,
            value: culturalScore,
            category: 'quality',
            comment: culturalResult.reason,
            source: 'llm-as-judge',
          });
        }
      } catch (culturalError) {
        this.logger.warn(
          `Cultural sensitivity evaluation failed: ${culturalError instanceof Error ? culturalError.message : 'Unknown error'}`,
        );
      }

      // Compute and record composite quality score
      // Weights: Tone (35%), Safety (25%), Cultural (10%), Engagement (15%), Commitment (15%)
      // Engagement and commitment are 0 at generation time, updated later by the service
      if (trace) {
        try {
          const toneNormalized = toneScore / 5; // Normalize 1-5 to 0-1
          const culturalNormalized = culturalScore / 5; // Normalize 1-5 to 0-1
          const compositeScore = (toneNormalized * 0.35) + (safetyScore * 0.25) + (culturalNormalized * 0.10);
          // Note: engagement (0.15) and commitment (0.15) added later when user interacts

          this.opikService.addFeedback({
            traceId: trace.traceId,
            name: FEEDBACK_LETTER_QUALITY_COMPOSITE,
            value: Math.round(compositeScore * 100) / 100,
            category: 'quality',
            comment: `Partial composite: tone=${toneScore}/5 (${(toneNormalized * 0.35).toFixed(2)}), safety=${safetyScore} (${(safetyScore * 0.25).toFixed(2)}), cultural=${culturalScore}/5 (${(culturalNormalized * 0.10).toFixed(2)}). Engagement+commitment added on interaction.`,
            source: 'system',
          });
        } catch {
          // Composite feedback failed, continue
        }
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

  /**
   * Generate a conversational response from the user's future self
   *
   * @param userId - The user's ID
   * @param letterContent - The letter that started the conversation
   * @param message - The user's new message
   * @param history - Previous conversation messages
   * @returns The moderated response from the future self
   */
  async generateConversationResponse(
    userId: string,
    letterContent: string,
    message: string,
    history: { role: string; content: string }[],
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    // Create agent-specific Opik trace for conversation
    const trace = this.safeCreateAgentTrace(userId, {
      messageLength: message.length,
      traceType: 'conversation',
    }, ['future-self', 'conversation', 'chat']);

    try {
      // Span 1: Load context
      const ctxSpan = this.safeCreateToolSpan(trace, SPAN_LOAD_CONVERSATION_CONTEXT, {
        userId,
        historyLength: history.length,
      });

      // Build simulation summary
      let simulationSummary = 'Simulation data unavailable.';
      try {
        const simulation = await this.generateSimulation(userId);
        const currency = 'NGN';
        simulationSummary = `Current path 20yr: ${simulation.currentBehavior.projectedNetWorth['20yr'].toLocaleString()} ${currency}. Optimized path 20yr: ${simulation.withIKPA.projectedNetWorth['20yr'].toLocaleString()} ${currency}. Difference: ${simulation.difference_20yr.toLocaleString()} ${currency}.`;
      } catch {
        // Continue with unavailable summary
      }

      this.safeEndSpan(ctxSpan, {
        output: { hasSimulation: simulationSummary !== 'Simulation data unavailable.' },
        metadata: {},
      });

      // Span 2: Generate response
      const genSpan = this.safeCreateLLMSpan(trace, SPAN_GENERATE_RESPONSE, {
        messageLength: message.length,
        historyLength: history.length,
      });

      const prompt = buildConversationPrompt(
        letterContent,
        history,
        message,
        simulationSummary,
      );

      const response = await this.anthropicService.generate(
        prompt,
        500, // Shorter max tokens for conversation
        CONVERSATION_SYSTEM_PROMPT,
      );

      this.safeEndLLMSpan(genSpan, {
        output: { responseLength: response.content.length },
        usage: response.usage,
        metadata: {},
      });

      // Span 3: Moderate response
      const modSpan = this.safeCreateToolSpan(trace, SPAN_MODERATE_RESPONSE, {
        responseLength: response.content.length,
      });

      const moderationResult = this.contentModeration.moderate(response.content);

      this.safeEndSpan(modSpan, {
        output: { passed: moderationResult.passed, flagCount: moderationResult.flags.length },
        metadata: {},
      });

      if (!moderationResult.passed) {
        this.logger.warn(`Conversation moderation failed for user ${userId}`);
        // Return safe fallback instead of throwing
        this.safeEndTrace(trace, { success: false, error: 'Content moderation failed' });
        return {
          content: "I want to be thoughtful with my response. Could you rephrase your question?",
          usage: response.usage,
        };
      }

      // Online evaluation: score the conversation response
      fireAndForgetEval(
        this.metricsService,
        trace,
        {
          input: message,
          output: '',
          context: { traceType: 'conversation', historyLength: history.length },
        },
        response.content,
        ['ToneEmpathy', 'CulturalSensitivity', 'FinancialSafety'],
      );

      this.safeEndTrace(trace, { success: true, result: { responseLength: response.content.length } });

      return {
        content: response.content,
        usage: response.usage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.safeEndTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
  }

  /**
   * Generate a weekly financial debrief letter
   *
   * Aggregates the user's past 7 days of financial activity and generates
   * a personalized summary letter from their future self.
   *
   * @param userId - The user's ID
   * @param weeklyData - Pre-aggregated weekly financial data
   * @returns The debrief letter content and metadata
   */
  async generateWeeklyDebrief(
    userId: string,
    weeklyData: {
      totalExpenses: number;
      topCategories: Array<{ name: string; amount: number }>;
      budgetAdherence: number; // 0-100%
      goalProgressDelta: number; // Amount saved toward goals
      streakDays: number;
      currency: string;
      userName: string;
    },
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    const trace = this.safeCreateAgentTrace(userId, {
      traceType: 'weekly_debrief',
      model: this.anthropicService.getModel(),
    }, ['future-self', 'weekly-debrief', 'llm']);

    try {
      // Build the debrief prompt
      const topCats = weeklyData.topCategories
        .slice(0, 3)
        .map(c => `${c.name}: ${this.formatCurrencySimple(c.amount, weeklyData.currency)}`)
        .join(', ');

      const prompt = [
        `Write a warm, concise weekly financial debrief for ${weeklyData.userName}.`,
        `This is a letter from their future self (year 2045) reviewing the past 7 days.`,
        '',
        `Weekly summary:`,
        `- Total spending: ${this.formatCurrencySimple(weeklyData.totalExpenses, weeklyData.currency)}`,
        `- Top categories: ${topCats || 'No expenses recorded'}`,
        `- Budget adherence: ${weeklyData.budgetAdherence}%`,
        `- Saved toward goals: ${this.formatCurrencySimple(weeklyData.goalProgressDelta, weeklyData.currency)}`,
        weeklyData.streakDays > 0 ? `- Current micro-commitment streak: ${weeklyData.streakDays} days` : '',
        '',
        `Guidelines:`,
        `- Start with "Dear ${weeklyData.userName}," and sign as "Your Future Self"`,
        `- Highlight 1-2 positive behaviors and 1 actionable tip`,
        `- If budget adherence is above 80%, celebrate it. If below 60%, gently encourage.`,
        `- Keep it under 300 words. Be warm, personal, non-judgmental.`,
        `- Reference specific categories where possible.`,
      ].filter(Boolean).join('\n');

      const llmSpan = this.safeCreateLLMSpan(trace, 'generate_weekly_debrief', {
        promptType: 'weekly_debrief',
        userName: weeklyData.userName,
        budgetAdherence: weeklyData.budgetAdherence,
      });

      const response = await this.anthropicService.generate(
        prompt,
        800,
        'You are the user\'s wise, loving future self from the year 2045. You write weekly financial check-in letters. Be warm, specific, and action-oriented. Never give specific investment advice. Use the user\'s local currency naturally.',
      );

      this.safeEndLLMSpan(llmSpan, {
        output: { responseLength: response.content.length },
        usage: response.usage,
        metadata: {},
      });

      // Online evaluation: score the weekly debrief
      fireAndForgetEval(
        this.metricsService,
        trace,
        {
          input: `Weekly debrief for ${weeklyData.userName}, adherence: ${weeklyData.budgetAdherence}%`,
          output: '',
          context: { traceType: 'weekly_debrief', budgetAdherence: weeklyData.budgetAdherence },
        },
        response.content,
        ['ToneEmpathy', 'CulturalSensitivity', 'FinancialSafety'],
      );

      this.safeEndTrace(trace, {
        success: true,
        result: { letterLength: response.content.length },
      });

      return {
        content: response.content,
        usage: response.usage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.safeEndTrace(trace, { success: false, error: errorMessage });
      throw error;
    }
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
  async getUserContext(userId: string, trace: TrackedTrace | null = null): Promise<UserContext> {
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
      // Guard against implausible ages (bad data entry or form defaults)
      if (age < 13 || age > 100) {
        age = 30;
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
      trace,
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
    trace: TrackedTrace | null = null,
  ): Promise<{ recentDecisions: string[]; struggles: string[] }> {
    const recentDecisions: string[] = [];
    const struggles: string[] = [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const largeExpenseThreshold = monthlyIncome * 0.05;

    // Create retrieval spans for all parallel DB queries
    const expenseSpan = this.safeCreateRetrievalSpan(trace, SPAN_FETCH_EXPENSES, { userId, since: thirtyDaysAgo.toISOString() });
    const subsSpan = this.safeCreateRetrievalSpan(trace, SPAN_FETCH_SUBSCRIPTIONS, { userId, since: thirtyDaysAgo.toISOString() });
    const contribSpan = this.safeCreateRetrievalSpan(trace, SPAN_FETCH_CONTRIBUTIONS, { userId, since: thirtyDaysAgo.toISOString() });
    const aggregateSpan = this.safeCreateRetrievalSpan(trace, SPAN_FETCH_EXPENSE_AGGREGATE, { userId, since: thirtyDaysAgo.toISOString() });

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

    // End retrieval spans with result counts
    this.safeEndSpan(expenseSpan, { output: { count: recentExpenses.length }, metadata: {} });
    this.safeEndSpan(subsSpan, { output: { count: cancelledSubs.length }, metadata: {} });
    this.safeEndSpan(contribSpan, { output: { count: recentContributions.length }, metadata: {} });
    this.safeEndSpan(aggregateSpan, { output: { totalExpenses: Number(expenseAggregate._sum.amount) || 0 }, metadata: {} });

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

    // Check for recent GPS recovery context (cross-agent coordination)
    const gpsSpan = this.safeCreateRetrievalSpan(trace, SPAN_FETCH_GPS_RECOVERY, { userId });
    try {
      const cacheKey = `gps_recovery_context:${userId}`;
      const recoveryContext = await this.redisService.get<{
        pathName: string;
        actionMessage: string;
      }>(cacheKey);
      if (recoveryContext) {
        recentDecisions.push(
          `Chose "${recoveryContext.pathName}" recovery path after budget overspend (${recoveryContext.actionMessage})`,
        );
        // Clear so it's only used once
        await this.redisService.del(cacheKey);
      }
      this.safeEndSpan(gpsSpan, { output: { found: !!recoveryContext }, metadata: {} });
    } catch {
      this.safeEndSpan(gpsSpan, { output: { found: false, error: true }, metadata: {} });
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

  /**
   * Simple currency formatter for debrief prompts
   */
  private formatCurrencySimple(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
      NGN: '\u20A6', GHS: 'GH\u20B5', KES: 'KSh', ZAR: 'R', USD: '$', GBP: '\u00A3',
    };
    return `${symbols[currency] || currency}${amount.toLocaleString()}`;
  }

  // ==========================================
  // SAFE TRACING HELPERS
  // ==========================================

  /**
   * Safely create a trace with error protection
   */
  private safeCreateTrace(
    name: string,
    input: Record<string, unknown>,
    tags: string[] = ['future-self', 'llm'],
  ): TrackedTrace | null {
    try {
      return this.opikService.createTrace({
        name,
        input,
        metadata: { agent: 'future_self', version: '1.0' },
        tags,
      });
    } catch {
      return null;
    }
  }

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

  /**
   * Safely create an agent-specific trace
   * Uses createAgentTrace for agent identification + naming convention
   */
  private safeCreateAgentTrace(
    userId: string,
    metadata: Record<string, unknown>,
    tags: string[] = ['future-self', 'llm'],
  ): TrackedTrace | null {
    try {
      // Use createAgentTrace for agent-specific naming and metadata
      const trace = this.opikService.createAgentTrace({
        agentName: 'future_self',
        userId,
        input: { userId, ...metadata },
        metadata: { version: '1.0', ...metadata },
      });
      // Enhance with tags via the underlying trace object
      if (trace?.trace) {
        try {
          (trace.trace as unknown as { update(opts: { tags: string[] }): void }).update({ tags });
        } catch {
          // Tag update not supported, continue without tags
        }
      }
      return trace;
    } catch {
      return null;
    }
  }

  /**
   * Safely create a retrieval span for database/cache queries
   */
  private safeCreateRetrievalSpan(
    trace: TrackedTrace | null,
    name: string,
    query: Record<string, unknown>,
  ): TrackedSpan | null {
    if (!trace?.trace) return null;
    try {
      return this.opikService.createRetrievalSpan({
        trace: trace.trace,
        name,
        query,
        metadata: {},
      });
    } catch {
      return null;
    }
  }
}
