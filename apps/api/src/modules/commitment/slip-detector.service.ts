/**
 * Slip Detector Service
 *
 * Proactive AI intervention *before* a commitment fails.
 * Scans ACTIVE contracts, computes drift scores, and generates
 * personalized nudges from the user's "future self" when risk is detected.
 *
 * Drift signals:
 * 1. Progress gap — (expected linear progress) - (actual goal progress)
 * 2. Deadline proximity — Days remaining < 30% of total duration
 * 3. Stake severity — Monetary stakes amplify urgency
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import { AnthropicService } from '../ai/anthropic/anthropic.service';
import { CommitmentStatus } from '@prisma/client';
import { differenceInDays } from 'date-fns';
import { SLIP_DETECTOR } from './constants/commitment.constants';
import {
  SlipRiskLevel,
  SlipDetectionResult,
  SlipDetectionScanResult,
} from './interfaces';
import { MetricsService, fireAndForgetEval } from '../ai/opik/metrics';

@Injectable()
export class SlipDetectorService {
  private readonly logger = new Logger(SlipDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly anthropicService: AnthropicService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Detect slips for all active contracts (or a specific user)
   */
  async detectSlips(userId?: string): Promise<SlipDetectionScanResult> {
    const where: Record<string, unknown> = {
      status: CommitmentStatus.ACTIVE,
    };
    if (userId) {
      where.userId = userId;
    }

    const contracts = await this.prisma.commitmentContract.findMany({
      where,
      include: {
        goal: {
          select: {
            id: true,
            name: true,
            targetAmount: true,
            currentAmount: true,
          },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    const results: SlipDetectionResult[] = [];
    const riskBreakdown: Record<SlipRiskLevel, number> = {
      none: 0,
      low: 0,
      medium: 0,
      high: 0,
    };
    let nudgesSent = 0;

    for (const contract of contracts) {
      try {
        const result = await this.analyzeContract(contract);
        results.push(result);
        riskBreakdown[result.riskLevel]++;

        if (result.riskLevel !== 'none' && !result.skipped) {
          nudgesSent++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `[slip-detector] Failed for contract ${contract.id}: ${msg}`,
        );
        results.push({
          contractId: contract.id,
          userId: contract.userId,
          goalName: contract.goal.name,
          riskLevel: 'none',
          progressGap: 0,
          daysRemaining: 0,
          stakeType: contract.stakeType,
          stakeAmount: contract.stakeAmount
            ? Number(contract.stakeAmount)
            : null,
          skipped: true,
          skipReason: msg,
        });
      }
    }

    return {
      scannedContracts: contracts.length,
      nudgesSent,
      riskBreakdown,
      results,
    };
  }

  /**
   * Analyze a single contract for drift
   */
  private async analyzeContract(contract: {
    id: string;
    userId: string;
    stakeType: string;
    stakeAmount: unknown;
    deadline: Date;
    createdAt: Date;
    lastSlipDetectedAt: Date | null;
    goal: {
      id: string;
      name: string;
      targetAmount: unknown;
      currentAmount: unknown;
    };
    user: { id: string; name: string };
  }): Promise<SlipDetectionResult> {
    const now = new Date();
    const totalDays = differenceInDays(contract.deadline, contract.createdAt);
    const daysSinceCreation = differenceInDays(now, contract.createdAt);
    const daysRemaining = differenceInDays(contract.deadline, now);

    const targetAmount = Number(contract.goal.targetAmount);
    const currentAmount = Number(contract.goal.currentAmount);

    // Compute progress gap
    const elapsedRatio =
      totalDays > 0 ? Math.min(1, daysSinceCreation / totalDays) : 1;
    const expectedProgress = elapsedRatio * targetAmount;
    const progressGap =
      targetAmount > 0
        ? Math.max(0, (expectedProgress - currentAmount) / targetAmount)
        : 0;

    // Assign risk level
    const riskLevel = this.computeRiskLevel(progressGap, daysRemaining);

    const result: SlipDetectionResult = {
      contractId: contract.id,
      userId: contract.userId,
      goalName: contract.goal.name,
      riskLevel,
      progressGap: Math.round(progressGap * 1000) / 10, // percentage with 1 decimal
      daysRemaining: Math.max(0, daysRemaining),
      stakeType: contract.stakeType,
      stakeAmount: contract.stakeAmount
        ? Number(contract.stakeAmount)
        : null,
    };

    // Only generate nudge for non-zero risk
    if (riskLevel === 'none') {
      return result;
    }

    // Check fatigue window
    if (contract.lastSlipDetectedAt) {
      const hoursSinceLastSlip =
        (now.getTime() - contract.lastSlipDetectedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSlip < SLIP_DETECTOR.FATIGUE_HOURS) {
        result.skipped = true;
        result.skipReason = `Last nudge was ${Math.round(hoursSinceLastSlip)}h ago (min ${SLIP_DETECTOR.FATIGUE_HOURS}h)`;
        return result;
      }
    }

    // Generate nudge and deliver
    const nudgeText = await this.generateNudge(
      contract.user.name,
      contract.goal.name,
      contract.stakeType,
      contract.stakeAmount ? Number(contract.stakeAmount) : null,
      progressGap,
      daysRemaining,
      riskLevel,
    );

    result.nudgeText = nudgeText;

    // Deliver the nudge
    await this.deliverNudge(
      contract.userId,
      contract.id,
      contract.goal.name,
      nudgeText,
      riskLevel,
    );

    return result;
  }

  /**
   * Compute risk level from progress gap and days remaining
   */
  private computeRiskLevel(
    progressGap: number,
    daysRemaining: number,
  ): SlipRiskLevel {
    // High risk: critically behind OR very close deadline with any gap
    if (
      progressGap > SLIP_DETECTOR.RISK_THRESHOLDS.MEDIUM ||
      (daysRemaining <= SLIP_DETECTOR.URGENT_DAYS && progressGap > 0.05)
    ) {
      return 'high';
    }

    // Medium risk: significantly behind
    if (progressGap > SLIP_DETECTOR.RISK_THRESHOLDS.LOW) {
      return 'medium';
    }

    // Low risk: slightly behind
    if (progressGap > 0.03) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Generate a personalized nudge using LLM (as user's "future self")
   */
  async generateNudge(
    userName: string,
    goalName: string,
    stakeType: string,
    stakeAmount: number | null,
    progressGap: number,
    daysRemaining: number,
    riskLevel: SlipRiskLevel,
  ): Promise<string> {
    const trace = this.opikService.createTrace({
      name: 'slip_detector_nudge',
      input: { userName, goalName, stakeType, progressGap, daysRemaining, riskLevel },
      metadata: { agent: 'slip_detector', version: '1.0' },
      tags: ['slip-detector', 'nudge', 'ai'],
    });

    try {
      const gapPercent = Math.round(progressGap * 100);
      const stakeInfo =
        stakeAmount && stakeType !== 'SOCIAL'
          ? `with a ${stakeType.replace('_', ' ').toLowerCase()} stake of $${stakeAmount}`
          : `with social accountability`;

      const prompt = [
        `You are ${userName}'s future self from the year 2045.`,
        `They committed to "${goalName}" ${stakeInfo}.`,
        `They're ${gapPercent}% behind their expected progress with ${daysRemaining} days left.`,
        `Risk level: ${riskLevel}.`,
        '',
        `Write a brief, empathetic nudge (2-3 sentences) as their future self.`,
        `Be encouraging, not shaming. Reference specific details naturally.`,
        riskLevel === 'high'
          ? `This is urgent — convey gentle urgency without panic.`
          : `Keep it warm and motivating.`,
      ].join('\n');

      const response = await this.anthropicService.generate(
        prompt,
        200,
        'You are a warm, wise future self writing brief motivational nudges about financial goals. Never shame or judge. Be specific and actionable.',
      );

      // Online evaluation: score the nudge with LLM-as-judge
      fireAndForgetEval(
        this.metricsService,
        trace,
        {
          input: `Slip detector nudge for "${goalName}" (${riskLevel} risk, ${Math.round(progressGap * 100)}% behind)`,
          output: '',
          context: { goalName, stakeType: stakeType?.toLowerCase() as 'social' | 'anti_charity' | 'loss_pool' | undefined, riskLevel },
        },
        response.content,
        ['ToneEmpathy', 'FinancialSafety', 'InterventionSuccess'],
      );

      if (trace) {
        this.opikService.endTrace(trace, {
          success: true,
          result: { nudgeLength: response.content.length },
        });
      }

      return response.content;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (trace) {
        this.opikService.endTrace(trace, { success: false, error: msg });
      }
      this.logger.warn(`[slip-detector] Nudge generation failed: ${msg}`);

      // Fallback nudge
      return riskLevel === 'high'
        ? `Hey ${userName}, your "${goalName}" goal needs attention — you're behind schedule with limited time left. A small step today can make a big difference.`
        : `Hey ${userName}, a gentle reminder about your "${goalName}" goal. You're a bit behind pace, but there's still time to catch up!`;
    }
  }

  /**
   * Deliver a nudge as a GpsNotification and update fatigue tracking
   */
  private async deliverNudge(
    userId: string,
    contractId: string,
    goalName: string,
    nudgeText: string,
    riskLevel: SlipRiskLevel,
  ): Promise<void> {
    const titleMap: Record<SlipRiskLevel, string> = {
      none: '',
      low: 'Gentle Reminder',
      medium: 'Your Future Self Checking In',
      high: 'Urgent: Your Goal Needs Attention',
    };

    // Create notification
    await this.prisma.gpsNotification.create({
      data: {
        userId,
        triggerType: 'SLIP_DETECTED',
        categoryId: contractId, // Reuse categoryId field to store contractId
        categoryName: goalName,
        title: titleMap[riskLevel],
        message: nudgeText,
        actionUrl: `/dashboard/commitments`,
        metadata: { riskLevel, contractId },
      },
    });

    // Update fatigue tracking
    await this.prisma.commitmentContract.update({
      where: { id: contractId },
      data: { lastSlipDetectedAt: new Date() },
    });

    this.logger.log(
      `[slip-detector] Nudge delivered for contract ${contractId} (${riskLevel})`,
    );
  }
}
