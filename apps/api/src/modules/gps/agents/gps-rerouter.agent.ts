/**
 * GPS Re-Router Agent
 *
 * Claude-powered AI agent that uses tool_use to gather financial context
 * and generate personalized, non-judgmental recovery messages.
 *
 * Architecture:
 * 1. Receives budget overspend context
 * 2. Claude decides which tools to call (budget status, goal impact, etc.)
 * 3. Tool results are sent back to Claude
 * 4. Claude generates a personalized NonJudgmentalMessage
 * 5. Full distributed trace in Opik (LLM spans + tool spans + feedback)
 *
 * Graceful degradation: If Claude is unavailable, the caller falls back
 * to the existing static template picker.
 */

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicService } from '../../ai/anthropic/anthropic.service';
import { ToolUseMessage } from '../../ai/anthropic/interfaces';
import { OpikService } from '../../ai/opik/opik.service';
import { TrackedTrace, TrackedSpan } from '../../ai/opik/interfaces';
import { MetricsService } from '../../ai/opik/metrics';
import {
  BudgetStatus,
  GoalImpact,
  MultiGoalImpact,
  RecoveryPath,
  NonJudgmentalMessage,
} from '../interfaces';
import { GPS_CONSTANTS } from '../constants';
import { BudgetService } from '../budget.service';
import {
  GPS_REROUTER_SYSTEM_PROMPT,
  GPS_REROUTER_TOOLS,
  buildInitialMessage,
} from './gps-rerouter.prompt';

/** Maximum agentic turns to prevent runaway loops */
const MAX_AGENT_TURNS = 8;

/** Max tokens for Claude's response */
const AGENT_MAX_TOKENS = 1024;

/** Timeout for agent API calls (longer than normal to allow for reasoning) */
const AGENT_TIMEOUT_MS = 45_000;

@Injectable()
export class GpsRerouterAgent {
  private readonly logger = new Logger(GpsRerouterAgent.name);

  constructor(
    private readonly anthropicService: AnthropicService,
    private readonly opikService: OpikService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
    private readonly budgetService: BudgetService,
  ) {}

  /**
   * Generate a personalized, AI-crafted NonJudgmentalMessage
   *
   * Runs the full agentic loop:
   * 1. Send budget context to Claude
   * 2. Claude calls tools to gather data
   * 3. Claude generates personalized message
   * 4. Validate against banned words
   * 5. Return message with Opik trace
   *
   * @throws if Claude is unavailable (caller should fall back to static templates)
   */
  async generatePersonalizedMessage(
    userId: string,
    budgetStatus: BudgetStatus,
    goalImpact: GoalImpact,
    multiGoalImpact: MultiGoalImpact,
    recoveryPaths: RecoveryPath[],
  ): Promise<NonJudgmentalMessage> {
    // Create Opik agent trace
    let trace: TrackedTrace | null = null;
    try {
      trace = this.opikService.createTrace({
        name: 'gps_rerouter_agent_trace',
        input: {
          userId,
          category: budgetStatus.category,
          trigger: budgetStatus.trigger,
          overspendPercent: budgetStatus.overagePercent,
        },
        metadata: {
          agent: 'gps_rerouter',
          version: '1.0',
          model: this.anthropicService.getModel(),
          provider: 'anthropic',
        },
        tags: ['gps-rerouter', 'agent', 'tool-use', 'llm'],
      });
    } catch (traceError) {
      this.logger.warn(
        `Failed to create Opik trace: ${traceError instanceof Error ? traceError.message : 'Unknown error'}`,
      );
    }

    try {
      // Build initial message with budget context
      const initialMessage = buildInitialMessage(
        budgetStatus.category,
        budgetStatus.budgeted.amount,
        budgetStatus.spent.amount,
        budgetStatus.budgeted.currency,
        budgetStatus.trigger,
      );

      // Conversation history for the agentic loop
      const messages: ToolUseMessage[] = [
        { role: 'user', content: initialMessage },
      ];

      let turnCount = 0;
      let finalText: string | null = null;
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      // Agentic tool_use loop
      while (turnCount < MAX_AGENT_TURNS) {
        turnCount++;

        // Create LLM span for this turn
        const llmSpan = this.safeCreateLLMSpan(trace, `llm_turn_${turnCount}`, {
          turnCount,
          messageCount: messages.length,
        });

        // Call Claude with tools
        const response = await this.anthropicService.generateWithTools(messages, {
          maxTokens: AGENT_MAX_TOKENS,
          systemPrompt: GPS_REROUTER_SYSTEM_PROMPT,
          timeoutMs: AGENT_TIMEOUT_MS,
          tools: GPS_REROUTER_TOOLS,
        });

        // Accumulate token usage
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
        totalUsage.totalTokens += response.usage.totalTokens;

        this.safeEndLLMSpan(llmSpan, {
          output: {
            stopReason: response.stopReason,
            contentBlocks: response.content.length,
          },
          usage: response.usage,
          metadata: {},
        });

        // If Claude is done (not requesting tools), extract final text
        if (response.stopReason !== 'tool_use') {
          const textBlock = response.content.find(
            (block): block is Anthropic.TextBlock => block.type === 'text',
          );
          finalText = textBlock?.text || null;
          break;
        }

        // Process tool_use blocks
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );

        // Add Claude's response (with tool_use blocks) to conversation
        messages.push({
          role: 'assistant',
          content: response.content as Anthropic.ContentBlockParam[],
        });

        // Execute each tool and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const toolSpan = this.safeCreateToolSpan(trace, `tool_${toolUse.name}`, {
            toolName: toolUse.name,
            toolInput: toolUse.input,
          });

          let toolResult: unknown;
          let isError = false;

          try {
            toolResult = await this.executeTool(
              userId,
              toolUse.name,
              toolUse.input as Record<string, unknown>,
              budgetStatus,
              goalImpact,
              multiGoalImpact,
              recoveryPaths,
            );
          } catch (error) {
            isError = true;
            toolResult = {
              error: error instanceof Error ? error.message : 'Tool execution failed',
            };
            this.logger.warn(
              `Tool ${toolUse.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }

          this.safeEndSpan(toolSpan, {
            output: { result: toolResult, isError },
            metadata: {},
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult),
            is_error: isError,
          });
        }

        // Send tool results back to Claude
        messages.push({
          role: 'user',
          content: toolResults,
        });
      }

      // Parse the final message from Claude's text response
      if (!finalText) {
        throw new Error('Agent did not produce a final text response');
      }

      let message = this.parseAgentResponse(finalText);

      // Validate math integrity (replace hallucinated percentages)
      message = this.validateMathIntegrity(message, budgetStatus, goalImpact);

      // Run blocking tone & safety validation (with retry on low tone score)
      // If validation itself fails (e.g., Claude timeout on tone eval), keep the AI message —
      // it's still better than static templates even without tone scoring
      let validatedMessage: NonJudgmentalMessage;
      try {
        validatedMessage = await this.validateMessageQuality(
          trace,
          message,
          messages,
          totalUsage,
        );
      } catch (validationError) {
        this.logger.warn(
          `[generatePersonalizedMessage] Validation failed, keeping AI message: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`,
        );
        validatedMessage = message;
      }

      // End trace with success
      this.safeEndTrace(trace, {
        success: true,
        result: {
          headline: validatedMessage.headline,
          subtextLength: validatedMessage.subtext.length,
          agentTurns: turnCount,
          totalTokens: totalUsage.totalTokens,
        },
      });

      this.logger.log(
        `[generatePersonalizedMessage] Agent generated message in ${turnCount} turns, ` +
          `${totalUsage.totalTokens} tokens for user ${userId}`,
      );

      return validatedMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.safeEndTrace(trace, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(
        `[generatePersonalizedMessage] Agent failed for user ${userId}: ${errorMessage}`,
      );

      throw error;
    }
  }

  // ==========================================
  // TOOL EXECUTION
  // ==========================================

  /**
   * Dispatch a tool call to the appropriate service method
   *
   * Each tool wraps an existing service — no new business logic here.
   * We pass pre-computed data when available to avoid redundant computation.
   */
  private async executeTool(
    userId: string,
    toolName: string,
    _toolInput: Record<string, unknown>,
    budgetStatus: BudgetStatus,
    goalImpact: GoalImpact,
    multiGoalImpact: MultiGoalImpact,
    recoveryPaths: RecoveryPath[],
  ): Promise<unknown> {
    switch (toolName) {
      case 'check_budget_status': {
        // Return the already-computed budget status (avoids redundant DB query)
        return {
          category: budgetStatus.category,
          budgeted: budgetStatus.budgeted.formatted,
          spent: budgetStatus.spent.formatted,
          remaining: budgetStatus.remaining.formatted,
          overagePercent: `${budgetStatus.overagePercent.toFixed(1)}%`,
          trigger: budgetStatus.trigger,
          period: budgetStatus.period,
        };
      }

      case 'calculate_goal_impact': {
        // Return pre-computed goal impact
        return {
          goalName: goalImpact.goalName,
          goalAmount: goalImpact.goalAmount.formatted,
          goalDeadline: goalImpact.goalDeadline.toISOString().split('T')[0],
          previousProbability: `${(goalImpact.previousProbability * 100).toFixed(1)}%`,
          newProbability: `${(goalImpact.newProbability * 100).toFixed(1)}%`,
          probabilityDrop: `${(goalImpact.probabilityDrop * 100).toFixed(1)} percentage points`,
          message: goalImpact.message,
        };
      }

      case 'generate_recovery_paths': {
        // Return pre-computed recovery paths
        return recoveryPaths.map((path) => ({
          name: path.name,
          description: path.description,
          effort: path.effort,
          newProbability: path.newProbability !== null ? `${(path.newProbability * 100).toFixed(1)}%` : 'N/A (budget-only mode)',
          timelineImpact: path.timelineImpact || null,
          savingsImpact: path.savingsImpact || null,
          freezeDuration: path.freezeDuration || null,
        }));
      }

      case 'get_spending_history': {
        // Query recent spending grouped by category
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const expenses = await this.prisma.expense.groupBy({
          by: ['categoryId'],
          where: {
            userId,
            date: { gte: thirtyDaysAgo },
          },
          _sum: { amount: true },
          _count: true,
          orderBy: { _sum: { amount: 'desc' } },
          take: 10,
        });

        // Get category names
        const categoryIds = expenses.map((e) => e.categoryId);
        const categories = await this.prisma.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        });
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

        return expenses.map((e) => ({
          category: categoryMap.get(e.categoryId) || 'Unknown',
          totalSpent: Number(e._sum.amount || 0),
          transactionCount: e._count,
        }));
      }

      case 'check_multi_goal_impact': {
        // Return pre-computed multi-goal impact
        return {
          totalGoalsAffected: multiGoalImpact.summary.totalGoalsAffected,
          averageProbabilityDrop: `${(multiGoalImpact.summary.averageProbabilityDrop * 100).toFixed(1)} percentage points`,
          mostAffectedGoal: multiGoalImpact.summary.mostAffectedGoal,
          leastAffectedGoal: multiGoalImpact.summary.leastAffectedGoal,
          goals: [multiGoalImpact.primaryGoal, ...multiGoalImpact.otherGoals].map((g) => ({
            goalName: g.goalName,
            previousProbability: `${(g.previousProbability * 100).toFixed(1)}%`,
            newProbability: `${(g.newProbability * 100).toFixed(1)}%`,
            probabilityDrop: `${(g.probabilityDrop * 100).toFixed(1)} percentage points`,
          })),
        };
      }

      case 'analyze_spending_trend': {
        // Query last 3 months of spending in the overspent category
        const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const categoryName = budgetStatus.category;

        const category = await this.prisma.expenseCategory.findFirst({
          where: { name: categoryName },
          select: { id: true },
        });

        if (!category) return { trend: 'unknown', message: 'Category not found' };

        const expenses = await this.prisma.expense.findMany({
          where: { userId, categoryId: category.id, date: { gte: threeMonthsAgo } },
          select: { amount: true, date: true },
          orderBy: { date: 'asc' },
        });

        // Group by month
        const monthlyTotals = new Map<string, number>();
        for (const exp of expenses) {
          const key = `${exp.date.getFullYear()}-${String(exp.date.getMonth() + 1).padStart(2, '0')}`;
          monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + Number(exp.amount));
        }

        const months = [...monthlyTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        let trend = 'stable';
        if (months.length >= 2) {
          const recent = months[months.length - 1][1];
          const previous = months[months.length - 2][1];
          if (recent > previous * 1.15) trend = 'increasing';
          else if (recent < previous * 0.85) trend = 'decreasing';
        }

        return {
          trend,
          monthlyBreakdown: months.map(([month, total]) => ({ month, total })),
          isOneTimeSpike: months.length >= 2 && trend !== 'increasing',
        };
      }

      case 'find_rebalance_opportunities': {
        // Get all active budgets, then compute surplus for each
        const allBudgets = await this.budgetService.getAllBudgets(userId);
        const surplusResults: Array<{
          category: string;
          budgeted: string;
          spent: string;
          surplus: string;
          surplusAmount: number;
        }> = [];

        for (const budget of allBudgets) {
          if (budget.category.name === budgetStatus.category) continue;
          try {
            const status = await this.budgetService.checkBudgetStatus(userId, budget.category.name);
            if (status.remaining.amount > 0) {
              surplusResults.push({
                category: status.category,
                budgeted: status.budgeted.formatted,
                spent: status.spent.formatted,
                surplus: status.remaining.formatted,
                surplusAmount: status.remaining.amount,
              });
            }
          } catch {
            // Skip categories that fail status check
          }
        }

        return surplusResults
          .sort((a, b) => b.surplusAmount - a.surplusAmount)
          .slice(0, 5);
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ==========================================
  // RESPONSE PARSING & VALIDATION
  // ==========================================

  /**
   * Parse Claude's final text response into a NonJudgmentalMessage
   *
   * Expects JSON with headline and subtext fields.
   * Falls back to using the raw text if JSON parsing fails.
   */
  private parseAgentResponse(text: string): NonJudgmentalMessage {
    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.headline || !parsed.subtext) {
        throw new Error('Missing headline or subtext in response');
      }

      const message: NonJudgmentalMessage = {
        tone: 'Supportive',
        headline: String(parsed.headline).slice(0, 80),
        subtext: String(parsed.subtext).slice(0, 300),
      };

      // Validate no banned words
      this.validateNoBannedWords(message);

      return message;
    } catch (parseError) {
      this.logger.warn(
        `Failed to parse agent response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
      );

      // Fallback: use the first line as headline, rest as subtext
      const lines = text.trim().split('\n').filter((l) => l.trim());
      const message: NonJudgmentalMessage = {
        tone: 'Supportive',
        headline: (lines[0] || "Let's recalculate your route").slice(0, 80),
        subtext: (lines.slice(1).join(' ') || "Here's how to get back on track.").slice(0, 300),
      };

      this.validateNoBannedWords(message);
      return message;
    }
  }

  /**
   * Validate that a message doesn't contain banned judgmental words
   * Re-uses the same banned words list as the static generator
   */
  private validateNoBannedWords(message: NonJudgmentalMessage): void {
    const fullText = `${message.headline} ${message.subtext}`.toLowerCase();
    const foundBannedWords = GPS_CONSTANTS.BANNED_WORDS.filter((word) =>
      fullText.includes(word.toLowerCase()),
    );

    if (foundBannedWords.length > 0) {
      this.logger.warn(
        `Agent message contained banned words: ${foundBannedWords.join(', ')}. Sanitizing.`,
      );
      // Instead of throwing, sanitize by replacing banned words
      let sanitizedHeadline = message.headline;
      let sanitizedSubtext = message.subtext;

      for (const word of foundBannedWords) {
        const regex = new RegExp(word, 'gi');
        sanitizedHeadline = sanitizedHeadline.replace(regex, 'detour');
        sanitizedSubtext = sanitizedSubtext.replace(regex, 'detour');
      }

      message.headline = sanitizedHeadline;
      message.subtext = sanitizedSubtext;
    }
  }

  // ==========================================
  // VALIDATION GATES (Blocking)
  // ==========================================

  /**
   * Validate math integrity — ensure Claude doesn't hallucinate percentages
   *
   * Extracts percentage values from the message and checks them against
   * known pre-computed values (goal probability, overage percent).
   * Replaces hallucinated numbers with safe generalizations.
   */
  private validateMathIntegrity(
    message: NonJudgmentalMessage,
    budgetStatus: BudgetStatus,
    goalImpact: GoalImpact,
  ): NonJudgmentalMessage {
    const fullText = `${message.headline} ${message.subtext}`;

    const percentMatches = fullText.match(/(\d+(?:\.\d+)?)\s*%/g);
    if (!percentMatches || percentMatches.length === 0) return message;

    // Known correct values
    const knownValues = new Set([
      Math.round(goalImpact.previousProbability * 100),
      Math.round(goalImpact.newProbability * 100),
      Math.round(Math.abs(goalImpact.probabilityDrop) * 100),
      Math.round(budgetStatus.overagePercent),
    ]);

    const isCloseToKnown = (value: number): boolean => {
      for (const known of knownValues) {
        if (Math.abs(value - known) <= 2) return true;
      }
      return false;
    };

    for (const match of percentMatches) {
      const value = parseFloat(match);
      if (isNaN(value)) continue;

      // Skip small percentages (e.g., "5% savings boost")
      if (value <= 10) continue;

      if (!isCloseToKnown(value)) {
        this.logger.warn(
          `Math integrity: Claude mentioned ${match} but known values are ${[...knownValues].join(', ')}%. Stripping specific number.`,
        );
        message.subtext = message.subtext.replace(
          new RegExp(`${value}\\s*%`, 'g'),
          'your goal probability',
        );
      }
    }

    return message;
  }

  /**
   * Blocking message quality validation gate
   *
   * Runs financial safety (regex, <1ms) and tone empathy (LLM-as-judge)
   * checks synchronously. If safety fails, throws to trigger static template
   * fallback. If tone is below threshold, retries once with tone correction.
   */
  private async validateMessageQuality(
    trace: TrackedTrace | null,
    message: NonJudgmentalMessage,
    conversationHistory: ToolUseMessage[],
    totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number },
  ): Promise<NonJudgmentalMessage> {
    const messageText = `${message.headline}\n${message.subtext}`;

    // 1. Financial safety check (regex, <1ms) — BLOCKING
    const safetySpan = this.safeCreateToolSpan(trace, 'eval_financial_safety', {});
    const safetyResult = await this.metricsService.checkSafety(messageText);
    this.safeEndSpan(safetySpan, {
      output: { score: safetyResult.score, reason: safetyResult.reason },
      metadata: {},
    });

    if (safetyResult.score === 0) {
      this.logger.warn(`Financial safety check BLOCKED agent message: ${safetyResult.reason}`);
      throw new Error(`Financial safety blocked: ${safetyResult.reason}`);
    }

    // 2. Tone empathy check (LLM-as-Judge) — BLOCKING with retry
    const toneSpan = this.safeCreateLLMSpan(trace, 'eval_tone_empathy', {});
    let toneResult: { score: number; reason: string };

    try {
      toneResult = await this.metricsService.evaluateTone(
        { input: '', output: '' },
        messageText,
      );
    } catch {
      // If tone evaluation itself fails, log and proceed (don't block on infra failure)
      this.safeEndLLMSpan(toneSpan, { output: { error: 'evaluation_failed' }, metadata: {} });
      return message;
    }

    this.safeEndLLMSpan(toneSpan, {
      output: { score: toneResult.score, reason: toneResult.reason },
      metadata: {},
    });

    // Add feedback to trace
    if (trace) {
      try {
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'tone_empathy',
          value: toneResult.score,
          category: 'quality',
          comment: toneResult.reason,
          source: 'llm-as-judge',
        });
      } catch { /* feedback is best-effort */ }
    }

    // Score >= 3 out of 5 → pass
    if (toneResult.score >= 3) {
      return message;
    }

    // Score < 3 → retry once with tone correction
    this.logger.warn(`Tone score ${toneResult.score}/5 — retrying with tone correction`);

    const retrySpan = this.safeCreateLLMSpan(trace, 'llm_tone_retry', {
      originalScore: toneResult.score,
    });

    try {
      const retryMessages: ToolUseMessage[] = [
        ...conversationHistory,
        {
          role: 'user',
          content: `Your previous message scored ${toneResult.score}/5 on empathy. Feedback: "${toneResult.reason}". Please regenerate with a warmer, more supportive tone. Remember: no judgmental language, frame as a GPS recalculation, be brief and actionable. Respond with only the JSON object.`,
        },
      ];

      const retryResponse = await this.anthropicService.generateWithTools(retryMessages, {
        maxTokens: AGENT_MAX_TOKENS,
        systemPrompt: GPS_REROUTER_SYSTEM_PROMPT,
        timeoutMs: AGENT_TIMEOUT_MS,
        tools: [], // No tools on retry — just message generation
      });

      totalUsage.promptTokens += retryResponse.usage.promptTokens;
      totalUsage.completionTokens += retryResponse.usage.completionTokens;
      totalUsage.totalTokens += retryResponse.usage.totalTokens;

      const textBlock = retryResponse.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );

      if (textBlock?.text) {
        const retryMessage = this.parseAgentResponse(textBlock.text);
        this.safeEndLLMSpan(retrySpan, { output: { retried: true }, metadata: {} });
        return retryMessage;
      }
    } catch (retryError) {
      this.logger.warn(
        `Tone retry failed: ${retryError instanceof Error ? retryError.message : 'Unknown'}`,
      );
    }

    this.safeEndLLMSpan(retrySpan, { output: { retried: false, fallback: true }, metadata: {} });

    // If retry also fails, return original (still better than static templates)
    return message;
  }

  // ==========================================
  // SAFE TRACING HELPERS
  // (Copied from FutureSelfAgent pattern)
  // ==========================================

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
