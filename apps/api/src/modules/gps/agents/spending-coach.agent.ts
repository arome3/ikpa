/**
 * Spending Coach Agent
 *
 * When a user creates an expense, this agent analyzes it against
 * their budget/goals and returns a short, non-judgmental "nudge".
 * Full Opik tracing for observability.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicService } from '../../ai/anthropic/anthropic.service';
import { OpikService } from '../../ai/opik/opik.service';
import { MetricsService } from '../../ai/opik/metrics';
import { BudgetService } from '../budget.service';

export interface SpendingNudgeResult {
  nudge: string;
  severity: 'info' | 'warning' | 'critical';
  traceId?: string;
}

const NUDGE_MAX_TOKENS = 256;

const SPENDING_COACH_SYSTEM_PROMPT = `You are a friendly, non-judgmental AI spending coach for a personal finance app used by young Africans.

When the user logs an expense, you provide a SHORT (1-2 sentences max) nudge that is:
- Compassionate and never shaming
- Contextual — references their budget progress or goal
- Actionable when possible (suggest alternatives, not restrictions)
- Uses Nigerian/African cultural context when appropriate

IMPORTANT:
- Never use words like "wasteful", "irresponsible", "terrible", "bad"
- Respond with JSON only: {"nudge": "...", "severity": "info|warning|critical"}
- severity: "info" = within budget, "warning" = approaching limit (80%+), "critical" = over budget
- Keep it under 120 characters for the nudge text`;

@Injectable()
export class SpendingCoachAgent {
  private readonly logger = new Logger(SpendingCoachAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropicService: AnthropicService,
    private readonly opikService: OpikService,
    private readonly metricsService: MetricsService,
    private readonly budgetService: BudgetService,
  ) {}

  /**
   * Analyze an expense and return a personalized nudge.
   * Fire-and-forget — never blocks expense creation.
   */
  async analyzeExpense(
    userId: string,
    expenseId: string,
    categoryName: string,
    categoryId: string,
    amount: number,
    description?: string,
  ): Promise<SpendingNudgeResult | null> {
    let trace = null;
    try {
      trace = this.opikService.createTrace({
        name: 'spending_coach',
        input: { userId, expenseId, categoryName, amount },
        tags: ['spending-coach', 'hackathon'],
      });
    } catch {
      // Tracing failure shouldn't block
    }

    try {
      // Gather context
      const contextSpan = trace
        ? this.opikService.createToolSpan({
            trace: trace.trace,
            name: 'gather_context',
            input: { userId, categoryId },
          })
        : null;

      const [budgetInfo, activeGoals, monthSpending] = await Promise.all([
        this.getBudgetContext(userId, categoryId).catch(() => null),
        this.getActiveGoals(userId).catch(() => []),
        this.getMonthSpending(userId).catch(() => 0),
      ]);

      if (contextSpan) {
        try {
          this.opikService.endSpan(contextSpan, {
            output: { budgetInfo, goalCount: activeGoals.length, monthSpending },
            metadata: {},
          });
        } catch {}
      }

      // Build prompt — map Decimal to number for goals
      const mappedGoals = activeGoals.map((g) => ({
        name: g.name,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount),
      }));
      const userMessage = this.buildPrompt(
        categoryName,
        amount,
        description,
        budgetInfo,
        mappedGoals,
        monthSpending,
      );

      // Call Claude
      const llmSpan = trace
        ? this.opikService.createLLMSpan({
            trace: trace.trace,
            name: 'generate_nudge',
            input: { prompt: userMessage },
            model: 'claude-sonnet',
            provider: 'anthropic',
          })
        : null;

      const response = await this.anthropicService.generateMessage(
        [{ role: 'user', content: userMessage }],
        {
          systemPrompt: SPENDING_COACH_SYSTEM_PROMPT,
          maxTokens: NUDGE_MAX_TOKENS,
          timeoutMs: 15_000,
        },
      );

      if (llmSpan) {
        try {
          this.opikService.endSpan(llmSpan, {
            output: { response: response.content },
            metadata: { usage: response.usage },
          });
        } catch {}
      }

      // Parse response
      const parsed = this.parseNudge(response.content);

      // Store nudge in DB
      await this.prisma.spendingNudge.create({
        data: {
          userId,
          expenseId,
          nudge: parsed.nudge,
          severity: parsed.severity,
          traceId: trace?.traceId ?? null,
        },
      });

      // Run metrics evaluation (fire-and-forget)
      this.evaluateNudge(parsed.nudge, trace).catch(() => {});

      if (trace) {
        try {
          this.opikService.endTrace(trace, {
            success: true,
            result: parsed,
          });
        } catch {}
      }

      return {
        ...parsed,
        traceId: trace?.traceId,
      };
    } catch (error) {
      this.logger.warn(
        `[analyzeExpense] Failed for expense ${expenseId}: ${error}`,
      );

      if (trace) {
        try {
          this.opikService.endTrace(trace, {
            success: false,
            error: String(error),
          });
        } catch {}
      }

      return null;
    }
  }

  private buildPrompt(
    categoryName: string,
    amount: number,
    description: string | undefined,
    budgetInfo: { budgeted: number; spent: number; percentUsed: number } | null,
    activeGoals: { name: string; targetAmount: number; currentAmount: number }[],
    monthSpending: number,
  ): string {
    let prompt = `The user just spent ₦${amount.toLocaleString()} on "${categoryName}"`;
    if (description) prompt += ` (${description})`;
    prompt += '.\n\n';

    if (budgetInfo) {
      prompt += `Budget context: ₦${budgetInfo.spent.toLocaleString()} of ₦${budgetInfo.budgeted.toLocaleString()} spent this month (${budgetInfo.percentUsed.toFixed(0)}%).\n`;
    }

    if (activeGoals.length > 0) {
      const goal = activeGoals[0];
      const progress = goal.targetAmount > 0
        ? ((goal.currentAmount / goal.targetAmount) * 100).toFixed(0)
        : '0';
      prompt += `Active goal: "${goal.name}" — ${progress}% complete.\n`;
    }

    prompt += `Total monthly spending so far: ₦${monthSpending.toLocaleString()}.\n`;
    prompt += '\nProvide your nudge as JSON.';

    return prompt;
  }

  private parseNudge(content: string): { nudge: string; severity: 'info' | 'warning' | 'critical' } {
    try {
      // Extract JSON from response (may have markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          nudge: String(parsed.nudge || 'Keep tracking your spending!').slice(0, 200),
          severity: ['info', 'warning', 'critical'].includes(parsed.severity)
            ? parsed.severity
            : 'info',
        };
      }
    } catch {}

    return {
      nudge: content.slice(0, 200) || 'Keep tracking your spending!',
      severity: 'info',
    };
  }

  private async getBudgetContext(
    userId: string,
    categoryId: string,
  ): Promise<{ budgeted: number; spent: number; percentUsed: number } | null> {
    const budget = await this.budgetService.getBudgetByCategoryId(userId, categoryId);
    if (!budget) return null;

    const spent = await this.budgetService.getSpent(userId, categoryId, budget.period);
    const budgeted = Number(budget.amount);
    return {
      budgeted,
      spent,
      percentUsed: budgeted > 0 ? (spent / budgeted) * 100 : 0,
    };
  }

  private async getActiveGoals(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { name: true, targetAmount: true, currentAmount: true },
      take: 3,
    });
  }

  private async getMonthSpending(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await this.prisma.expense.aggregate({
      where: {
        userId,
        date: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }

  private async evaluateNudge(nudge: string, trace: any): Promise<void> {
    try {
      const datasetItem = { input: nudge, output: nudge };
      const options = { metrics: ['tone_empathy', 'financial_safety'] };
      await this.metricsService.evaluate(datasetItem, nudge, options, trace ?? undefined);
    } catch {
      // Evaluation failure shouldn't block
    }
  }
}
