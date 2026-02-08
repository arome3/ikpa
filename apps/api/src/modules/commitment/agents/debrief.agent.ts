/**
 * Debrief Agent
 *
 * Generates empathetic post-failure analysis and concrete next-step suggestions.
 * Uses Anthropic tool_use to gather context, then produces structured debrief.
 */

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicService } from '../../ai/anthropic/anthropic.service';
import { OpikService } from '../../ai/opik/opik.service';
import { CommitmentStatus } from '@prisma/client';
import { DEBRIEF_SYSTEM_PROMPT, DEBRIEF_TOOLS } from './debrief.prompt';

const MAX_AGENT_TURNS = 5;
const AGENT_MAX_TOKENS = 2048;
const AGENT_TIMEOUT_MS = 30_000;

interface DebriefResult {
  analysis: string;
  keyInsights: string[];
  suggestedStakeType?: string;
  suggestedStakeAmount?: number;
  suggestedDeadlineDays?: number;
}

@Injectable()
export class DebriefAgent {
  private readonly logger = new Logger(DebriefAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropicService: AnthropicService,
    private readonly opikService: OpikService,
  ) {}

  /**
   * Generate a debrief for a failed commitment
   */
  async generateDebrief(userId: string, contractId: string): Promise<DebriefResult> {
    const trace = this.opikService.createTrace({
      name: 'commitment_debrief_generate',
      input: { userId, contractId },
      metadata: { operation: 'generateDebrief' },
      tags: ['commitment', 'debrief', 'ai'],
    });

    try {
      // Build initial message
      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: `Generate a post-failure debrief for contract ${contractId} belonging to user ${userId}. Use the tools to gather context first, then provide your analysis.`,
        },
      ];

      let result: DebriefResult | null = null;

      // Agentic loop
      for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
        const response = await this.anthropicService.generateWithTools(
          messages as Anthropic.MessageParam[],
          {
            maxTokens: AGENT_MAX_TOKENS,
            systemPrompt: DEBRIEF_SYSTEM_PROMPT,
            tools: DEBRIEF_TOOLS,
            timeoutMs: AGENT_TIMEOUT_MS,
          },
        );

        // Check if we need to process tool calls
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );

        if (toolUseBlocks.length > 0) {
          // Process tool calls
          messages.push({
            role: 'assistant',
            content: response.content as Anthropic.ContentBlockParam[],
          });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUseBlocks) {
            const toolResult = await this.executeTool(toolUse.name, toolUse.input as Record<string, string>, userId);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(toolResult),
            });
          }

          messages.push({ role: 'user', content: toolResults });
        } else {
          // No tool calls — extract final text
          const textBlock = response.content.find(
            (block): block is Anthropic.TextBlock => block.type === 'text',
          );

          if (textBlock) {
            try {
              // Try to parse JSON from the response
              const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                result = {
                  analysis: parsed.analysis || textBlock.text,
                  keyInsights: parsed.keyInsights || [],
                  suggestedStakeType: parsed.suggestedStakeType,
                  suggestedStakeAmount: parsed.suggestedStakeAmount,
                  suggestedDeadlineDays: parsed.suggestedDeadlineDays,
                };
              } else {
                result = {
                  analysis: textBlock.text,
                  keyInsights: [],
                };
              }
            } catch {
              result = {
                analysis: textBlock.text,
                keyInsights: [],
              };
            }
          }
          break;
        }

        if (response.stopReason === 'end_turn') break;
      }

      if (!result) {
        result = {
          analysis: 'We were unable to generate a detailed debrief at this time. Consider adjusting your goal amount or timeline for your next attempt.',
          keyInsights: ['Consider a longer timeline', 'Try a smaller goal amount', 'Use social accountability for support'],
        };
      }

      // Save to database
      await this.prisma.commitmentDebrief.upsert({
        where: { contractId },
        create: {
          contractId,
          userId,
          analysis: result.analysis,
          suggestedStakeType: result.suggestedStakeType,
          suggestedStakeAmount: result.suggestedStakeAmount,
          suggestedDeadlineDays: result.suggestedDeadlineDays,
          keyInsights: result.keyInsights,
        },
        update: {
          analysis: result.analysis,
          suggestedStakeType: result.suggestedStakeType,
          suggestedStakeAmount: result.suggestedStakeAmount,
          suggestedDeadlineDays: result.suggestedDeadlineDays,
          keyInsights: result.keyInsights,
        },
      });

      if (trace) {
        this.opikService.endTrace(trace, { success: true, result: { hasInsights: result.keyInsights.length > 0 } });

        // Add quality feedback
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'DEBRIEF_QUALITY',
          value: result.keyInsights.length >= 3 ? 1 : 0.5,
          category: 'quality',
          comment: `Generated ${result.keyInsights.length} insights`,
          source: 'system',
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (trace) {
        this.opikService.endTrace(trace, { success: false, error: errorMessage });
      }
      this.logger.error(`[generateDebrief] Failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(
    toolName: string,
    input: Record<string, string>,
    userId: string,
  ): Promise<unknown> {
    switch (toolName) {
      case 'get_failed_contract_details': {
        const contract = await this.prisma.commitmentContract.findUnique({
          where: { id: input.contractId },
          include: {
            goal: { select: { name: true, targetAmount: true, currentAmount: true, category: true } },
          },
        });
        if (!contract) return { error: 'Contract not found' };
        return {
          goalName: contract.goal.name,
          goalCategory: contract.goal.category,
          targetAmount: Number(contract.goal.targetAmount),
          currentAmount: Number(contract.goal.currentAmount),
          achievementPercentage: contract.achievementPercentage ? Number(contract.achievementPercentage) : null,
          achievementTier: contract.achievementTier,
          stakeType: contract.stakeType,
          stakeAmount: contract.stakeAmount ? Number(contract.stakeAmount) : null,
          deadline: contract.deadline.toISOString(),
          createdAt: contract.createdAt.toISOString(),
          daysAllotted: Math.round((contract.deadline.getTime() - contract.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        };
      }

      case 'get_financial_changes': {
        // Get current financial state
        const [incomes, debts, savings] = await Promise.all([
          this.prisma.incomeSource.findMany({
            where: { userId, isActive: true },
            select: { amount: true, type: true, frequency: true },
          }),
          this.prisma.debt.findMany({
            where: { userId, isActive: true },
            select: { remainingBalance: true, type: true },
          }),
          this.prisma.savingsAccount.findMany({
            where: { userId, isActive: true },
            select: { balance: true, type: true },
          }),
        ]);

        const totalMonthlyIncome = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
        const totalDebt = debts.reduce((sum, d) => sum + Number(d.remainingBalance), 0);
        const totalSavings = savings.reduce((sum, s) => sum + Number(s.balance), 0);

        return {
          currentMonthlyIncome: totalMonthlyIncome,
          incomeSourceCount: incomes.length,
          totalDebt,
          debtCount: debts.length,
          totalSavings,
          savingsAccountCount: savings.length,
          netWorth: totalSavings - totalDebt,
        };
      }

      case 'get_commitment_history': {
        const history = await this.prisma.commitmentContract.findMany({
          where: { userId },
          select: {
            stakeType: true,
            status: true,
            stakeAmount: true,
            achievementTier: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        const totalCommitments = history.length;
        const succeeded = history.filter(h => h.status === CommitmentStatus.SUCCEEDED).length;
        const failed = history.filter(h => h.status === CommitmentStatus.FAILED).length;

        return {
          totalCommitments,
          succeeded,
          failed,
          successRate: totalCommitments > 0 ? Math.round((succeeded / totalCommitments) * 100) : 0,
          recentContracts: history.map(h => ({
            stakeType: h.stakeType,
            status: h.status,
            stakeAmount: h.stakeAmount ? Number(h.stakeAmount) : null,
            achievementTier: h.achievementTier,
            date: h.createdAt.toISOString(),
          })),
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }
}
