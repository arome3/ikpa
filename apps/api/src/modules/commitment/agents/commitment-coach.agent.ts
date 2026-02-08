/**
 * Commitment Coach Agent
 *
 * AI-powered agent that helps users choose optimal stake configurations
 * through conversational negotiation. Uses tool_use to gather financial
 * context and generate personalized recommendations.
 *
 * Architecture follows GpsRerouterAgent pattern:
 * 1. Receives goal context + user message
 * 2. Claude calls tools to gather financial data
 * 3. Claude generates recommendation with reasoning
 * 4. Multi-turn negotiation via Redis-cached sessions
 * 5. Full Opik tracing for observability
 */

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicService } from '../../ai/anthropic/anthropic.service';
import { ToolUseMessage } from '../../ai/anthropic/interfaces';
import { OpikService } from '../../ai/opik/opik.service';
import { TrackedTrace, TrackedSpan } from '../../ai/opik/interfaces';
import { RedisService } from '../../../redis';
import {
  COMMITMENT_COACH_SYSTEM_PROMPT,
  COMMITMENT_COACH_TOOLS,
  buildNegotiationInitialMessage,
  buildUserFollowUpMessage,
} from './commitment-coach.prompt';
import { COMMITMENT_FEEDBACK_METRICS } from '../constants/eval.constants';

/** Maximum agentic turns per API call */
const MAX_AGENT_TURNS = 6;

/** Max tokens for Claude's response */
const AGENT_MAX_TOKENS = 1024;

/** Timeout for agent API calls */
const AGENT_TIMEOUT_MS = 30_000;

/** Session TTL in Redis (30 minutes) */
const SESSION_TTL_SECONDS = 1800;

/** Redis key prefix for negotiation sessions */
const SESSION_PREFIX = 'commitment:negotiate:';

interface NegotiationSession {
  sessionId: string;
  userId: string;
  goalId: string;
  goalName: string;
  goalAmount: number;
  currency: string;
  messages: ToolUseMessage[];
  recommendation?: {
    stakeType: string;
    stakeAmount: number | null;
    reasoning: string;
  };
  isComplete: boolean;
  createdAt: string;
}

export interface NegotiationResponse {
  sessionId: string;
  message: string;
  recommendation?: {
    stakeType: string;
    stakeAmount: number;
    reasoning: string;
  };
  isComplete: boolean;
}

@Injectable()
export class CommitmentCoachAgent {
  private readonly logger = new Logger(CommitmentCoachAgent.name);

  constructor(
    private readonly anthropicService: AnthropicService,
    private readonly opikService: OpikService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Start a new negotiation session
   */
  async startNegotiation(userId: string, goalId: string): Promise<NegotiationResponse> {
    // Get goal details
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true, name: true, targetAmount: true, currentAmount: true, targetDate: true },
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    const sessionId = randomUUID();
    const currency = 'USD'; // Default, could be fetched from user profile

    // Create session
    const session: NegotiationSession = {
      sessionId,
      userId,
      goalId,
      goalName: goal.name,
      goalAmount: Number(goal.targetAmount),
      currency,
      messages: [],
      isComplete: false,
      createdAt: new Date().toISOString(),
    };

    // Run agent
    const result = await this.runAgentLoop(session, buildNegotiationInitialMessage(
      goal.name,
      Number(goal.targetAmount),
      currency,
    ));

    // Save session to Redis
    await this.saveSession(session);

    return result;
  }

  /**
   * Continue an existing negotiation
   */
  async continueNegotiation(userId: string, sessionId: string, userMessage: string): Promise<NegotiationResponse> {
    const session = await this.loadSession(sessionId);

    if (!session) {
      throw new Error('Negotiation session not found or expired');
    }

    if (session.userId !== userId) {
      throw new Error('Session does not belong to this user');
    }

    if (session.isComplete) {
      return {
        sessionId,
        message: 'This negotiation is already complete. You can create your commitment now.',
        recommendation: session.recommendation as NegotiationResponse['recommendation'],
        isComplete: true,
      };
    }

    // Run agent with user follow-up
    const result = await this.runAgentLoop(session, buildUserFollowUpMessage(userMessage));

    // Save updated session
    await this.saveSession(session);

    return result;
  }

  /**
   * Core agentic loop
   */
  private async runAgentLoop(session: NegotiationSession, userMessage: string): Promise<NegotiationResponse> {
    // Create Opik trace
    let trace: TrackedTrace | null = null;
    try {
      trace = this.opikService.createTrace({
        name: 'commitment_coach_agent_trace',
        input: { userId: session.userId, goalId: session.goalId, sessionId: session.sessionId },
        metadata: { agent: 'commitment_coach', version: '1.0', model: this.anthropicService.getModel() },
        tags: ['commitment-coach', 'agent', 'tool-use', 'negotiation'],
      });
    } catch {
      this.logger.warn('Failed to create Opik trace');
    }

    try {
      // Add user message to conversation
      session.messages.push({ role: 'user', content: userMessage });

      let turnCount = 0;
      let finalText: string | null = null;
      let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      while (turnCount < MAX_AGENT_TURNS) {
        turnCount++;

        const llmSpan = this.safeCreateLLMSpan(trace, `llm_turn_${turnCount}`, { turnCount });

        const response = await this.anthropicService.generateWithTools(session.messages, {
          maxTokens: AGENT_MAX_TOKENS,
          systemPrompt: COMMITMENT_COACH_SYSTEM_PROMPT,
          timeoutMs: AGENT_TIMEOUT_MS,
          tools: COMMITMENT_COACH_TOOLS,
        });

        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
        totalUsage.totalTokens += response.usage.totalTokens;

        this.safeEndLLMSpan(llmSpan, {
          output: { stopReason: response.stopReason, contentBlocks: response.content.length },
          usage: response.usage,
          metadata: {},
        });

        // If done, extract text
        if (response.stopReason !== 'tool_use') {
          const textBlock = response.content.find(
            (block): block is Anthropic.TextBlock => block.type === 'text',
          );
          finalText = textBlock?.text || null;
          break;
        }

        // Process tool calls
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );

        session.messages.push({
          role: 'assistant',
          content: response.content as Anthropic.ContentBlockParam[],
        });

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
              session.userId,
              toolUse.name,
              toolUse.input as Record<string, unknown>,
              session.goalId,
            );
          } catch (error) {
            isError = true;
            toolResult = { error: error instanceof Error ? error.message : 'Tool execution failed' };
            this.logger.warn(`Tool ${toolUse.name} failed: ${error instanceof Error ? error.message : 'Unknown'}`);
          }

          this.safeEndSpan(toolSpan, { output: { result: toolResult, isError }, metadata: {} });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult),
            is_error: isError,
          });
        }

        session.messages.push({ role: 'user', content: toolResults });
      }

      if (!finalText) {
        throw new Error('Agent did not produce a final response');
      }

      const parsed = this.parseResponse(finalText);

      // Update session
      if (parsed.recommendation) {
        session.recommendation = parsed.recommendation;
      }
      session.isComplete = parsed.isComplete;

      // Add assistant response to conversation history
      session.messages.push({ role: 'assistant', content: finalText });

      // Validate financial safety
      if (parsed.recommendation?.stakeAmount) {
        const safetyCheck = await this.validateFinancialSafety(session.userId, parsed.recommendation.stakeAmount);
        if (!safetyCheck.safe) {
          parsed.message += ` (Note: ${safetyCheck.reason})`;
          parsed.recommendation.stakeAmount = safetyCheck.adjustedAmount ?? parsed.recommendation.stakeAmount;
        }
      }

      // Opik feedback
      this.safeEndTrace(trace, {
        success: true,
        result: {
          agentTurns: turnCount,
          totalTokens: totalUsage.totalTokens,
          hasRecommendation: !!parsed.recommendation,
          isComplete: parsed.isComplete,
        },
      });

      // Send rich Opik feedback for Best Use of Opik prize
      if (trace) {
        try {
          // Recommendation quality: 1 if we have a recommendation, 0 if fallback
          this.opikService.addFeedback({
            traceId: trace.traceId,
            name: COMMITMENT_FEEDBACK_METRICS.RECOMMENDATION_QUALITY,
            value: parsed.recommendation ? 1 : 0,
            category: 'quality',
            comment: parsed.recommendation
              ? `Recommended ${parsed.recommendation.stakeType} stake`
              : 'No recommendation produced',
            source: 'agent',
          });

          // Negotiation effectiveness: ideal is 3-5 tool calls
          const effScore = turnCount >= 2 && turnCount <= 5 ? 1 : turnCount > 5 ? 0.5 : 0.3;
          this.opikService.addFeedback({
            traceId: trace.traceId,
            name: COMMITMENT_FEEDBACK_METRICS.NEGOTIATION_EFFECTIVENESS,
            value: effScore,
            category: 'performance',
            comment: `${turnCount} agent turns`,
            source: 'agent',
          });

          // Financial safety: stake within 10% income cap
          if (parsed.recommendation?.stakeAmount) {
            const safetyResult = await this.validateFinancialSafety(session.userId, parsed.recommendation.stakeAmount);
            this.opikService.addFeedback({
              traceId: trace.traceId,
              name: COMMITMENT_FEEDBACK_METRICS.FINANCIAL_SAFETY,
              value: safetyResult.safe ? 1 : 0,
              category: 'safety',
              comment: safetyResult.safe ? 'Within income cap' : safetyResult.reason || 'Exceeds cap',
              source: 'agent',
            });
          }
        } catch { /* best effort — Opik feedback is non-critical */ }
      }

      this.logger.log(
        `[startNegotiation] Agent completed in ${turnCount} turns, ${totalUsage.totalTokens} tokens`,
      );

      return {
        sessionId: session.sessionId,
        message: parsed.message,
        recommendation: parsed.recommendation,
        isComplete: parsed.isComplete,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.safeEndTrace(trace, { success: false, error: errorMessage });
      this.logger.error(`[runAgentLoop] Failed: ${errorMessage}`);

      // Graceful degradation: return default SOCIAL recommendation
      return {
        sessionId: session.sessionId,
        message: "I'd recommend starting with a Social stake — it's the most popular choice and uses peer accountability to keep you on track.",
        recommendation: {
          stakeType: 'SOCIAL',
          stakeAmount: 0,
          reasoning: 'Default recommendation (AI coach temporarily unavailable)',
        },
        isComplete: false,
      };
    }
  }

  // ==========================================
  // TOOL EXECUTION
  // ==========================================

  private async executeTool(
    userId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    defaultGoalId: string,
  ): Promise<unknown> {
    switch (toolName) {
      case 'get_financial_summary': {
        const incomes = await this.prisma.incomeSource.findMany({
          where: { userId, isActive: true },
          select: { amount: true },
        });
        const totalIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

        const expenses = await this.prisma.expense.findMany({
          where: { userId, date: { gte: new Date(Date.now() - 30 * 86400000) } },
          select: { amount: true },
        });
        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

        const savings = await this.prisma.savingsAccount.findMany({
          where: { userId },
          select: { balance: true },
        });
        const totalSavings = savings.reduce((sum, s) => sum + Number(s.balance), 0);

        const debts = await this.prisma.debt.findMany({
          where: { userId },
          select: { remainingBalance: true, minimumPayment: true },
        });
        const totalDebt = debts.reduce((sum, d) => sum + Number(d.remainingBalance), 0);
        const debtPayments = debts.reduce((sum, d) => sum + Number(d.minimumPayment), 0);

        const discretionary = Math.max(0, totalIncome - totalExpenses - debtPayments);

        return {
          monthlyIncome: totalIncome,
          monthlyExpenses: totalExpenses,
          totalSavings,
          totalDebt,
          discretionaryIncome: discretionary,
          savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) + '%' : '0%',
        };
      }

      case 'calculate_optimal_stake': {
        const incomes = await this.prisma.incomeSource.findMany({
          where: { userId, isActive: true },
          select: { amount: true },
        });
        const monthlyIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

        const expenses = await this.prisma.expense.findMany({
          where: { userId, date: { gte: new Date(Date.now() - 30 * 86400000) } },
          select: { amount: true },
        });
        const monthlyExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

        const discretionary = Math.max(0, monthlyIncome - monthlyExpenses);
        const safetyCapAmount = monthlyIncome * 0.10; // 10% of income cap
        const suggestedLow = Math.round(discretionary * 0.05);
        const suggestedHigh = Math.round(discretionary * 0.15);
        const recommended = Math.min(Math.round(discretionary * 0.10), safetyCapAmount);

        return {
          suggestedLow,
          suggestedHigh,
          recommended,
          safetyCapAmount: Math.round(safetyCapAmount),
          discretionaryIncome: Math.round(discretionary),
          reasoning: discretionary < 5000
            ? 'Low discretionary income — recommend SOCIAL stake (no money at risk)'
            : `Healthy discretionary income. Recommended stake: 10% = ${recommended.toLocaleString()}`,
        };
      }

      case 'check_goal_progress': {
        const gpGoalId = (toolInput.goal_id as string) || defaultGoalId;
        const goal = await this.prisma.goal.findFirst({
          where: { id: gpGoalId, userId },
          select: { id: true, name: true, targetAmount: true, currentAmount: true, targetDate: true, status: true, category: true },
        });
        if (!goal) return { error: 'Goal not found' };

        const progress = Number(goal.targetAmount) > 0
          ? (Number(goal.currentAmount) / Number(goal.targetAmount) * 100)
          : 0;
        const daysRemaining = goal.targetDate
          ? Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000))
          : null;

        return {
          name: goal.name,
          category: goal.category,
          target: Number(goal.targetAmount),
          current: Number(goal.currentAmount),
          progress: Math.round(progress * 10) / 10,
          daysRemaining,
          status: goal.status,
        };
      }

      case 'get_commitment_history': {
        const contracts = await this.prisma.commitmentContract.findMany({
          where: { userId },
          select: { stakeType: true, stakeAmount: true, status: true },
        });

        const byType: Record<string, { total: number; succeeded: number; avgStake: number[] }> = {};
        for (const c of contracts) {
          if (!byType[c.stakeType]) byType[c.stakeType] = { total: 0, succeeded: 0, avgStake: [] };
          byType[c.stakeType].total++;
          if (c.status === 'SUCCEEDED') byType[c.stakeType].succeeded++;
          if (c.stakeAmount) byType[c.stakeType].avgStake.push(Number(c.stakeAmount));
        }

        const metrics = Object.entries(byType).map(([type, data]) => ({
          stakeType: type,
          totalContracts: data.total,
          successRate: data.total > 0 ? (data.succeeded / data.total * 100).toFixed(0) + '%' : 'N/A',
          averageStake: data.avgStake.length > 0
            ? Math.round(data.avgStake.reduce((a, b) => a + b, 0) / data.avgStake.length)
            : null,
        }));

        return {
          totalContracts: contracts.length,
          byStakeType: metrics,
          hasHistory: contracts.length > 0,
        };
      }

      case 'assess_risk_profile': {
        // Analyze behavioral signals for risk tolerance
        const contracts = await this.prisma.commitmentContract.findMany({
          where: { userId },
          select: { status: true, stakeType: true, stakeAmount: true },
        });

        const incomes = await this.prisma.incomeSource.findMany({
          where: { userId },
          select: { isActive: true },
        });

        const failedCount = contracts.filter(c => c.status === 'FAILED').length;
        const succeededCount = contracts.filter(c => c.status === 'SUCCEEDED').length;
        const hasUsedMonetaryStakes = contracts.some(c => c.stakeType !== 'SOCIAL' && c.stakeAmount);

        // Simple risk score: 1-5 (1 = very risk averse, 5 = high risk tolerance)
        let riskScore = 3; // neutral default
        if (failedCount > succeededCount) riskScore -= 1;
        if (hasUsedMonetaryStakes && succeededCount > 0) riskScore += 1;
        if (incomes.filter(i => i.isActive).length > 1) riskScore += 0.5; // multiple income streams
        riskScore = Math.max(1, Math.min(5, riskScore));

        return {
          riskScore: Math.round(riskScore * 10) / 10,
          signals: {
            hasCommitmentHistory: contracts.length > 0,
            pastSuccessRate: contracts.length > 0
              ? Math.round(succeededCount / contracts.length * 100) + '%'
              : 'N/A',
            hasUsedMonetaryStakes,
            incomeStreams: incomes.filter(i => i.isActive).length,
          },
          recommendation: riskScore <= 2
            ? 'Low risk tolerance — recommend SOCIAL stakes'
            : riskScore <= 3.5
              ? 'Moderate risk tolerance — SOCIAL or small LOSS_POOL stakes'
              : 'Higher risk tolerance — consider ANTI_CHARITY for maximum motivation',
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ==========================================
  // RESPONSE PARSING
  // ==========================================

  private parseResponse(text: string): NegotiationResponse & { recommendation?: NegotiationResponse['recommendation'] } {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        sessionId: '',
        message: String(parsed.message || 'Here is my recommendation.'),
        recommendation: parsed.recommendation ? {
          stakeType: String(parsed.recommendation.stakeType || 'SOCIAL'),
          stakeAmount: parsed.recommendation.stakeAmount ? Number(parsed.recommendation.stakeAmount) : 0,
          reasoning: String(parsed.recommendation.reasoning || ''),
        } : undefined,
        isComplete: Boolean(parsed.isComplete),
      };
    } catch {
      // Fallback: use text as message
      return {
        sessionId: '',
        message: text.slice(0, 500),
        isComplete: false,
      };
    }
  }

  // ==========================================
  // FINANCIAL SAFETY VALIDATION
  // ==========================================

  private async validateFinancialSafety(
    userId: string,
    stakeAmount: number,
  ): Promise<{ safe: boolean; reason?: string; adjustedAmount?: number }> {
    const incomes = await this.prisma.incomeSource.findMany({
      where: { userId, isActive: true },
      select: { amount: true },
    });
    const monthlyIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);

    const cap = monthlyIncome * 0.10;
    if (stakeAmount > cap && cap > 0) {
      return {
        safe: false,
        reason: `Stake capped at 10% of monthly income (${Math.round(cap).toLocaleString()})`,
        adjustedAmount: Math.round(cap),
      };
    }

    return { safe: true };
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  private async saveSession(session: NegotiationSession): Promise<void> {
    try {
      // Trim messages to keep session size manageable (last 20 messages)
      const trimmedSession = {
        ...session,
        messages: session.messages.slice(-20),
      };
      await this.redisService.set(
        `${SESSION_PREFIX}${session.sessionId}`,
        trimmedSession,
        SESSION_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(`Failed to save session: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async loadSession(sessionId: string): Promise<NegotiationSession | null> {
    try {
      const data = await this.redisService.get<NegotiationSession>(`${SESSION_PREFIX}${sessionId}`);
      return data || null;
    } catch {
      return null;
    }
  }

  // ==========================================
  // SAFE TRACING HELPERS
  // ==========================================

  private safeCreateToolSpan(trace: TrackedTrace | null, name: string, input: Record<string, unknown>): TrackedSpan | null {
    if (!trace?.trace) return null;
    try {
      return this.opikService.createToolSpan({ trace: trace.trace, name, input, metadata: {} });
    } catch { return null; }
  }

  private safeCreateLLMSpan(trace: TrackedTrace | null, name: string, input: Record<string, unknown>): TrackedSpan | null {
    if (!trace?.trace) return null;
    try {
      return this.opikService.createLLMSpan({
        trace: trace.trace, name, model: this.anthropicService.getModel(), provider: 'anthropic', input, metadata: {},
      });
    } catch { return null; }
  }

  private safeEndSpan(span: TrackedSpan | null, result: { output: Record<string, unknown>; metadata: Record<string, unknown> }): void {
    if (!span) return;
    try { this.opikService.endSpan(span, result); } catch { /* continue */ }
  }

  private safeEndLLMSpan(span: TrackedSpan | null, result: { output: Record<string, unknown>; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; metadata: Record<string, unknown> }): void {
    if (!span) return;
    try { this.opikService.endLLMSpan(span, result); } catch { /* continue */ }
  }

  private safeEndTrace(trace: TrackedTrace | null, result: { success: boolean; result?: Record<string, unknown>; error?: string }): void {
    if (!trace) return;
    try { this.opikService.endTrace(trace, result); } catch { /* continue */ }
  }
}
