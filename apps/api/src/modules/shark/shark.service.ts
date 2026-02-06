/**
 * Shark Auditor Service
 *
 * Core business logic for the Shark Auditor subscription detection
 * and management system. Integrates with Opik for distributed tracing.
 *
 * @module SharkService
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  SubscriptionStatus,
  SwipeAction,
  Currency,
  Subscription as PrismaSubscription,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OpikService } from '../ai/opik/opik.service';
import type { TrackedTrace } from '../ai/opik/interfaces/trace.interface';
import { AnthropicService } from '../ai/anthropic/anthropic.service';
import type { AnthropicMessage } from '../ai/anthropic/interfaces/anthropic.interface';
import {
  SubscriptionDetectorCalculator,
  ZombieDetectorCalculator,
  AnnualizedFramingCalculator,
} from './calculators';
import {
  SubscriptionWithSwipe,
  SubscriptionListResult,
  SubscriptionQueryOptions,
  AuditResult,
  SwipeDecisionInput,
  SwipeDecisionResult,
  CancellationResult,
  DetectedSubscription,
  OverlapGroup,
  DecisionHistoryItem,
  DecisionHistoryResult,
  CancellationGuideResult,
  KeepRecommendationResult,
} from './interfaces';
import {
  SubscriptionNotFoundException,
  InsufficientExpenseDataException,
  AuditOperationException,
  SubscriptionCancellationException,
  SharkUserNotFoundException,
  DuplicateSwipeDecisionException,
} from './exceptions';

export type ChatMode = 'advisor' | 'roast' | 'supportive';

export interface SessionContext {
  cancelledNames: string[];
  cancelledTotal: number;
  keptNames: string[];
  remainingCount: number;
}

/**
 * Service for the Shark Auditor subscription management system
 *
 * Provides methods for:
 * - Detecting subscriptions from expense records
 * - Identifying zombie (unused) subscriptions
 * - Recording swipe decisions
 * - Processing cancellations
 * - Generating annualized cost framing
 *
 * All major operations are traced using Opik for observability.
 */
@Injectable()
export class SharkService {
  private readonly logger = new Logger(SharkService.name);

  /** In-memory map to correlate chat traces with later swipe decisions (userId:subscriptionId → traceId) */
  private readonly chatTraceMap = new Map<string, string>();

  /** Conversation-level trace map: one trace per subscription review, spans per message */
  private readonly conversationTraceMap = new Map<string, { trace: TrackedTrace; turnCount: number }>();

  /** In-memory cache for keep tips (subscriptionName:category → { data, expiresAt }) */
  private readonly keepTipsCache = new Map<string, { data: KeepRecommendationResult; expiresAt: number }>();
  private static readonly KEEP_TIPS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /** Latency SLO thresholds in ms — breaches get scored 0.0 in Opik for alerting */
  private static readonly LATENCY_SLO = {
    chat: 5000,           // 5s for interactive chat responses
    cancel_guide: 7000,   // 7s for one-shot guide generation
    keep_tips: 8000,      // 8s for one-shot tips generation
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
    private readonly anthropicService: AnthropicService,
    private readonly subscriptionDetector: SubscriptionDetectorCalculator,
    private readonly zombieDetector: ZombieDetectorCalculator,
    private readonly annualizedFraming: AnnualizedFramingCalculator,
  ) {}

  // ==========================================
  // SUBSCRIPTION RETRIEVAL
  // ==========================================

  /**
   * Get all subscriptions for a user with optional filtering
   *
   * @param userId - User ID
   * @param options - Filter and pagination options
   * @returns Subscriptions with framing, summary, and pagination
   */
  async getSubscriptions(
    userId: string,
    options: SubscriptionQueryOptions = {},
  ): Promise<SubscriptionListResult> {
    this.logger.debug(`Getting subscriptions for user ${userId}`);

    await this.validateUserExists(userId);

    const { status, limit = 20, offset = 0 } = options;

    // Build where clause for paginated results
    // Cancelled subscriptions have isActive=false, so adjust filter accordingly
    const paginatedWhere: Record<string, unknown> = { userId };

    if (status === SubscriptionStatus.CANCELLED) {
      paginatedWhere.isActive = false;
      paginatedWhere.status = SubscriptionStatus.CANCELLED;
    } else if (status === SubscriptionStatus.ZOMBIE) {
      // Zombie filter includes cancelled subscriptions that were zombies
      paginatedWhere.status = { in: [SubscriptionStatus.ZOMBIE, SubscriptionStatus.CANCELLED] };
    } else if (status) {
      paginatedWhere.isActive = true;
      paginatedWhere.status = status;
    }
    // When no status filter: show all (both active and cancelled)

    // Base where for summary (only active subscriptions for cost calculations)
    const summaryWhere = { userId, isActive: true };

    // Execute all queries in parallel to minimize latency
    const [subscriptions, total, summaryData, cancelledCount, user] = await Promise.all([
      // Paginated subscriptions with last swipe decision
      this.prisma.subscription.findMany({
        where: paginatedWhere,
        include: {
          swipeDecisions: {
            orderBy: { decidedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { detectedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      // Total count for pagination
      this.prisma.subscription.count({ where: paginatedWhere }),
      // Summary aggregation using groupBy for efficiency
      this.prisma.subscription.groupBy({
        by: ['status'],
        where: summaryWhere,
        _sum: { monthlyCost: true },
        _count: { id: true },
      }),
      // Cancelled count (separate since summaryWhere only covers active)
      this.prisma.subscription.count({
        where: { userId, isActive: false },
      }),
      // User currency
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { currency: true },
      }),
    ]);

    const currency = user?.currency || Currency.NGN;

    // Transform subscriptions with framing
    const subscriptionsWithFraming = subscriptions.map((sub) =>
      this.transformSubscription(sub, currency),
    );

    // Calculate summary from aggregated data
    const summary = this.calculateSummaryFromGroupBy(summaryData, currency, cancelledCount);

    return {
      subscriptions: subscriptionsWithFraming,
      summary,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + subscriptions.length < total,
      },
    };
  }

  /**
   * Get a single subscription by ID
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription ID
   * @returns Subscription with framing
   */
  async getSubscriptionById(
    userId: string,
    subscriptionId: string,
  ): Promise<SubscriptionWithSwipe> {
    this.logger.debug(`Getting subscription ${subscriptionId} for user ${userId}`);

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
      include: {
        swipeDecisions: {
          orderBy: { decidedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundException(subscriptionId);
    }

    const currency = await this.getUserCurrency(userId);
    return this.transformSubscription(subscription, currency);
  }

  // ==========================================
  // AUDIT OPERATIONS
  // ==========================================

  /**
   * Trigger a manual subscription audit
   *
   * Scans expense records to detect subscriptions using pattern matching
   * and analyzes usage to detect zombies.
   *
   * @param userId - User ID
   * @param force - Force re-scan even if recently audited
   * @returns Audit result summary
   */
  async triggerAudit(userId: string, force = false): Promise<AuditResult> {
    this.logger.log(`Triggering subscription audit for user ${userId}`);

    await this.validateUserExists(userId);

    // Create Opik trace for the audit
    const trace = this.opikService.createAgentTrace({
      agentName: 'shark_auditor',
      userId,
      input: { action: 'audit_subscriptions', force },
      metadata: { version: '1.0' },
    });

    try {
      const currency = await this.getUserCurrency(userId);

      // Step 1: Detect subscriptions from expenses
      const detectSpan = trace
        ? this.opikService.createToolSpan({
            trace: trace.trace,
            name: 'detect_subscriptions',
            input: { userId, force },
          })
        : null;

      const newlyDetected = await this.detectSubscriptions(userId);

      this.opikService.endSpan(detectSpan, {
        output: {
          detectedCount: newlyDetected,
          message: `Detected ${newlyDetected} new subscriptions`,
        },
      });

      // Step 2: Update zombie status
      const zombieSpan = trace
        ? this.opikService.createToolSpan({
            trace: trace.trace,
            name: 'analyze_zombies',
            input: { userId },
          })
        : null;

      const zombiesDetected = await this.updateZombieStatus(userId);

      this.opikService.endSpan(zombieSpan, {
        output: {
          zombiesDetected,
          message: `Detected ${zombiesDetected} zombie subscriptions`,
        },
      });

      // Step 3: Calculate summary
      const summarySpan = trace
        ? this.opikService.createToolSpan({
            trace: trace.trace,
            name: 'calculate_summary',
            input: { userId },
          })
        : null;

      const totalSubscriptions = await this.prisma.subscription.count({
        where: { userId, isActive: true },
      });

      const zombieSubscriptions = await this.prisma.subscription.findMany({
        where: { userId, isActive: true, status: SubscriptionStatus.ZOMBIE },
        select: { monthlyCost: true },
      });

      const potentialAnnualSavings = zombieSubscriptions.reduce(
        (total, sub) => total + Number(sub.monthlyCost) * 12,
        0,
      );

      this.opikService.endSpan(summarySpan, {
        output: {
          totalSubscriptions,
          potentialAnnualSavings,
          currency,
        },
      });

      const auditResult: AuditResult = {
        totalSubscriptions,
        newlyDetected,
        zombiesDetected,
        potentialAnnualSavings,
        currency,
        auditedAt: new Date(),
      };

      // Log audit metrics to Opik
      await this.logAuditMetrics(userId, trace?.traceId || '', auditResult);

      // End trace successfully
      this.opikService.endTrace(trace, {
        success: true,
        result: { ...auditResult, auditedAt: auditResult.auditedAt.toISOString() },
      });

      // Flush traces
      await this.opikService.flush();

      this.logger.log(
        `Audit complete for user ${userId}: ${totalSubscriptions} total, ` +
          `${newlyDetected} new, ${zombiesDetected} zombies`,
      );

      return auditResult;
    } catch (error) {
      // End trace with error
      this.opikService.endTrace(trace, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.opikService.flush();

      if (error instanceof InsufficientExpenseDataException) {
        throw error;
      }

      throw new AuditOperationException(
        error instanceof Error ? error.message : 'Unknown error',
        { userId },
      );
    }
  }

  /**
   * Detect subscriptions from expense records
   *
   * @param userId - User ID
   * @returns Number of newly detected subscriptions
   */
  private async detectSubscriptions(userId: string): Promise<number> {
    // Get recurring expenses from the last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        isRecurring: true,
        date: { gte: oneYearAgo },
      },
      select: {
        id: true,
        merchant: true,
        amount: true,
        currency: true,
        date: true,
        isRecurring: true,
      },
    });

    if (expenses.length < 2) {
      throw new InsufficientExpenseDataException(2);
    }

    // Convert to ExpenseForDetection format
    const expensesForDetection = expenses.map((e) => ({
      id: e.id,
      merchant: e.merchant,
      amount: Number(e.amount),
      currency: e.currency,
      date: e.date,
      isRecurring: e.isRecurring,
    }));

    // Detect subscriptions using calculator
    const detected = await this.subscriptionDetector.detect(
      userId,
      expensesForDetection,
    );

    // Get existing subscriptions with their current costs
    const existingSubscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      select: { id: true, merchantPattern: true, monthlyCost: true },
    });
    const existingPatternMap = new Map(
      existingSubscriptions.map((s) => [s.merchantPattern?.toLowerCase(), s]),
    );

    // Separate into new vs price-changed
    const newSubscriptions: DetectedSubscription[] = [];
    const priceChanges: { id: string; newCost: number; oldCost: number }[] = [];

    for (const d of detected) {
      const existing = existingPatternMap.get(d.merchantPattern.toLowerCase());
      if (!existing) {
        newSubscriptions.push(d);
      } else {
        // Check for price change
        const oldCost = Number(existing.monthlyCost);
        if (oldCost > 0 && Math.abs(d.monthlyCost - oldCost) / oldCost > 0.01) {
          priceChanges.push({
            id: existing.id,
            newCost: d.monthlyCost,
            oldCost,
          });
        }
      }
    }

    // Save new subscriptions
    if (newSubscriptions.length > 0) {
      await this.saveDetectedSubscriptions(userId, newSubscriptions);
    }

    // Update price changes
    if (priceChanges.length > 0) {
      await this.prisma.$transaction(
        priceChanges.map((pc) =>
          this.prisma.subscription.update({
            where: { id: pc.id },
            data: {
              previousMonthlyCost: pc.oldCost,
              monthlyCost: pc.newCost,
              annualCost: pc.newCost * 12,
              priceChangePercent: ((pc.newCost - pc.oldCost) / pc.oldCost) * 100,
            },
          }),
        ),
      );
    }

    return newSubscriptions.length;
  }

  /**
   * Save detected subscriptions to database
   */
  private async saveDetectedSubscriptions(
    userId: string,
    subscriptions: DetectedSubscription[],
  ): Promise<void> {
    const createData = subscriptions.map((sub) => ({
      userId,
      name: sub.name,
      merchantPattern: sub.merchantPattern,
      category: sub.category,
      monthlyCost: sub.monthlyCost,
      annualCost: sub.monthlyCost * 12,
      currency: sub.currency,
      status: SubscriptionStatus.UNKNOWN,
      firstChargeDate: sub.firstChargeDate,
      lastChargeDate: sub.lastChargeDate,
      chargeCount: sub.chargeCount,
    }));

    await this.prisma.subscription.createMany({
      data: createData,
      skipDuplicates: true, // Prevents race condition duplicates with unique constraint
    });
  }

  /**
   * Update zombie status for all subscriptions
   *
   * Uses batch updates within a transaction for better performance.
   * Respects user KEEP decisions - subscriptions marked as KEEP won't
   * be re-classified as zombies.
   *
   * @param userId - User ID
   * @returns Number of zombies detected
   */
  private async updateZombieStatus(userId: string): Promise<number> {
    // Get all active subscriptions with their last swipe decision
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        isActive: true,
        status: { not: SubscriptionStatus.CANCELLED },
      },
      include: {
        swipeDecisions: {
          orderBy: { decidedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (subscriptions.length === 0) {
      return 0;
    }

    // Filter out subscriptions that user explicitly marked as KEEP
    // UNLESS the reviewAfterDate has passed (re-review eligible)
    const now = new Date();
    const subscriptionsToAnalyze = subscriptions.filter((s) => {
      const lastDecision = s.swipeDecisions?.[0];
      if (lastDecision?.action !== SwipeAction.KEEP) return true;
      // Re-include if reviewAfterDate has passed
      if (lastDecision.reviewAfterDate && lastDecision.reviewAfterDate < now) return true;
      return false;
    });

    if (subscriptionsToAnalyze.length === 0) {
      this.logger.debug('All subscriptions marked as KEEP, skipping zombie analysis');
      return 0;
    }

    // Analyze for zombies
    const results = await this.zombieDetector.analyze(
      userId,
      subscriptionsToAnalyze.map((s) => ({
        ...s,
        monthlyCost: s.monthlyCost,
        annualCost: s.annualCost,
      })),
    );

    // Batch update statuses using transaction for atomicity and performance
    const updates = results
      .filter((r) => r.status !== SubscriptionStatus.CANCELLED)
      .map((result) => ({
        id: result.id,
        status: result.status,
      }));

    if (updates.length > 0) {
      await this.prisma.$transaction(
        updates.map((update) =>
          this.prisma.subscription.update({
            where: { id: update.id },
            data: { status: update.status },
          }),
        ),
      );
    }

    const zombieCount = results.filter(
      (r) => r.status === SubscriptionStatus.ZOMBIE,
    ).length;

    return zombieCount;
  }

  // ==========================================
  // SWIPE OPERATIONS
  // ==========================================

  /** Cooldown period for duplicate swipe decisions (5 minutes) */
  private readonly SWIPE_COOLDOWN_MS = 5 * 60 * 1000;

  /**
   * Record a swipe decision
   *
   * Includes validation for:
   * - Subscription existence and ownership
   * - Status transition validity (can't cancel already-cancelled)
   * - Duplicate decision prevention (5 minute cooldown)
   *
   * @param userId - User ID
   * @param decision - Swipe decision input
   * @returns Created swipe decision with message
   */
  async recordSwipeDecision(
    userId: string,
    decision: SwipeDecisionInput,
  ): Promise<SwipeDecisionResult> {
    this.logger.debug(
      `Recording swipe decision: ${decision.action} for subscription ${decision.subscriptionId}`,
    );

    // Verify subscription exists and belongs to user
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: decision.subscriptionId,
        userId,
      },
      include: {
        swipeDecisions: {
          orderBy: { decidedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundException(decision.subscriptionId);
    }

    // Validate status transition - can't cancel an already-cancelled subscription
    if (
      decision.action === SwipeAction.CANCEL &&
      subscription.status === SubscriptionStatus.CANCELLED
    ) {
      throw new SubscriptionCancellationException(
        decision.subscriptionId,
        'Subscription is already cancelled',
      );
    }

    // Check for duplicate decision within cooldown period
    const lastDecision = subscription.swipeDecisions?.[0];
    if (lastDecision) {
      const timeSinceLastDecision = Date.now() - lastDecision.decidedAt.getTime();
      if (timeSinceLastDecision < this.SWIPE_COOLDOWN_MS) {
        throw new DuplicateSwipeDecisionException(decision.subscriptionId);
      }
    }

    // Calculate reviewAfterDate for KEEP decisions (90 days from now)
    const reviewAfterDate =
      decision.action === SwipeAction.KEEP
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        : null;

    // Create swipe decision
    const swipeDecision = await this.prisma.swipeDecision.create({
      data: {
        subscriptionId: decision.subscriptionId,
        userId,
        action: decision.action,
        reviewAfterDate,
        decidedAt: new Date(),
      },
    });

    // Update subscription status based on action
    if (decision.action === SwipeAction.CANCEL) {
      await this.prisma.subscription.update({
        where: { id: decision.subscriptionId },
        data: { status: SubscriptionStatus.CANCELLED, isActive: false },
      });
    } else if (decision.action === SwipeAction.KEEP) {
      // Mark as ACTIVE to prevent future zombie classification
      // The KEEP decision is also recorded, which updateZombieStatus respects
      await this.prisma.subscription.update({
        where: { id: decision.subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE },
      });
    }

    // Attach feedback to the conversation trace and end it
    const chatTraceKey = `${userId}:${decision.subscriptionId}`;
    const chatTraceId = this.chatTraceMap.get(chatTraceKey);
    const convEntry = this.conversationTraceMap.get(chatTraceKey);
    if (chatTraceId) {
      this.opikService.addFeedback({
        traceId: chatTraceId,
        name: 'chat_decision',
        value: decision.action === SwipeAction.CANCEL ? 1.0 : decision.action === SwipeAction.KEEP ? 0.5 : 0.0,
        category: 'quality',
        comment: `User decided to ${decision.action} ${subscription.name}`,
        source: 'user_action',
      });
      // Record how many turns it took to reach a decision
      if (convEntry) {
        this.opikService.addFeedback({
          traceId: chatTraceId,
          name: 'chat_turns_to_decision',
          value: convEntry.turnCount,
          category: 'engagement',
          comment: `${convEntry.turnCount} turn(s) before ${decision.action}`,
        });
      }
    }
    // End the conversation-level trace now that a decision is made
    if (convEntry) {
      this.opikService.endTrace(convEntry.trace, {
        success: true,
        result: {
          decision: decision.action,
          subscriptionName: subscription.name,
          turnCount: convEntry.turnCount,
        },
      });
      this.conversationTraceMap.delete(chatTraceKey);
    }
    this.chatTraceMap.delete(chatTraceKey);
    this.opikService.flush().catch(() => {});

    // Generate appropriate message
    const message = this.getSwipeMessage(decision.action, subscription.name);

    return {
      id: swipeDecision.id,
      subscriptionId: decision.subscriptionId,
      action: decision.action,
      decidedAt: swipeDecision.decidedAt,
      message,
    };
  }

  // ==========================================
  // CANCELLATION OPERATIONS
  // ==========================================

  /**
   * Process subscription cancellation
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription to cancel
   * @param reason - Optional cancellation reason
   * @returns Cancellation result with savings info
   */
  async cancelSubscription(
    userId: string,
    subscriptionId: string,
    reason?: string,
  ): Promise<CancellationResult> {
    this.logger.log(`Processing cancellation for subscription ${subscriptionId}`);

    // Verify subscription exists and belongs to user
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundException(subscriptionId);
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new SubscriptionCancellationException(
        subscriptionId,
        'Subscription is already cancelled',
      );
    }

    // Use transaction for atomicity
    await this.prisma.$transaction([
      // Update subscription status
      this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          isActive: false,
        },
      }),
      // Record the cancellation decision with reason
      this.prisma.swipeDecision.create({
        data: {
          subscriptionId,
          userId,
          action: SwipeAction.CANCEL,
          reason: reason || null, // Store cancellation reason for analytics
          decidedAt: new Date(),
        },
      }),
    ]);

    const annualSavings = Number(subscription.annualCost);
    const currency = await this.getUserCurrency(userId);
    const formattedSavings = this.annualizedFraming.formatCurrency(
      annualSavings,
      currency,
    );

    this.logger.log(
      `Subscription ${subscriptionId} cancelled. Savings: ${formattedSavings}/year`,
    );

    return {
      subscriptionId,
      success: true,
      message: `Subscription marked as cancelled. Annual savings: ${formattedSavings}`,
      annualSavings,
      cancelledAt: new Date(),
    };
  }

  // ==========================================
  // CONVERSATIONAL REVIEW
  // ==========================================

  /**
   * Chat with AI about a subscription to determine keep/cancel
   *
   * Builds a dynamic system prompt with subscription data, sends the
   * full conversation history to Claude, and parses structured metadata
   * from the response.
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription to discuss
   * @param messages - Full conversation history (empty for opening message)
   * @returns AI reply with quick replies and decision metadata
   */
  async chatAboutSubscription(
    userId: string,
    subscriptionId: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    mode: ChatMode = 'advisor',
    sessionContext?: SessionContext,
  ): Promise<{
    reply: string;
    quickReplies?: string[];
    isDecisionPoint: boolean;
    recommendation?: 'KEEP' | 'CANCEL' | null;
  }> {
    // Verify ownership via existing method (throws if not found)
    const subscription = await this.getSubscriptionById(userId, subscriptionId);
    const currency = await this.getUserCurrency(userId);
    const currencySymbol = this.getCurrencySymbol(currency);
    const monthlyCost = Math.abs(Number(subscription.monthlyCost));
    const annualCost = Math.abs(Number(subscription.annualCost));

    // Gather financial context for richer AI advice
    const [userFinancialContext, overlaps] = await Promise.all([
      this.getUserFinancialContext(userId, currency),
      this.detectOverlaps(userId),
    ]);

    // Find overlaps for this subscription's category
    const categoryOverlap = overlaps.find(
      (o) => o.category === subscription.category,
    );

    const systemPrompt = this.buildChatSystemPrompt({
      name: subscription.name,
      category: subscription.category,
      currencySymbol,
      currency,
      monthlyCost,
      annualCost,
      lastUsageDate: subscription.lastUsageDate
        ? new Date(subscription.lastUsageDate).toLocaleDateString()
        : 'Unknown',
      firstChargeDate: subscription.firstChargeDate
        ? new Date(subscription.firstChargeDate).toLocaleDateString()
        : 'Unknown',
      lastChargeDate: subscription.lastChargeDate
        ? new Date(subscription.lastChargeDate).toLocaleDateString()
        : 'Unknown',
      chargeCount: subscription.chargeCount,
      context: subscription.framing?.context ?? '',
      priceChangePercent: (subscription as unknown as { priceChangePercent?: number }).priceChangePercent,
      mode,
      sessionContext,
      userFinancialContext,
      overlapWarning: categoryOverlap
        ? `User also pays for: ${categoryOverlap.subscriptions.map((s) => `${s.name} (${currencySymbol}${s.monthlyCost}/mo)`).join(', ')} — total ${currencySymbol}${categoryOverlap.combinedMonthlyCost}/mo for ${categoryOverlap.category.toLowerCase()} services`
        : undefined,
    });

    // Build message array — if empty, send initial prompt to get opening
    const anthropicMessages: AnthropicMessage[] =
      messages.length === 0
        ? [{ role: 'user' as const, content: 'Start the review for this subscription.' }]
        : messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Conversation-level tracing: one trace per subscription review, each message is a child LLM span
    const convKey = `${userId}:${subscriptionId}`;
    let convEntry = this.conversationTraceMap.get(convKey);
    if (!convEntry) {
      // First message in this conversation — create the conversation trace
      const newTrace = this.opikService.createAgentTrace({
        agentName: 'shark_chat',
        userId,
        input: {
          subscriptionId,
          subscriptionName: subscription.name,
          category: subscription.category,
          mode,
        },
        metadata: { feature: 'chat_conversation' },
      });
      if (newTrace) {
        convEntry = { trace: newTrace, turnCount: 0 };
        this.conversationTraceMap.set(convKey, convEntry);
        this.chatTraceMap.set(convKey, newTrace.traceId);
      }
    }

    const trace = convEntry?.trace ?? null;
    convEntry && convEntry.turnCount++;
    const turnNumber = convEntry?.turnCount ?? 1;

    const llmSpan = trace
      ? this.opikService.createLLMSpan({
          trace: trace.trace,
          name: `claude_chat_turn_${turnNumber}`,
          model: 'claude-sonnet',
          provider: 'anthropic',
          input: {
            systemPromptLength: systemPrompt.length,
            messageCount: anthropicMessages.length,
            mode,
            turnNumber,
          },
        })
      : null;

    const llmStartMs = Date.now();
    const response = await this.anthropicService.generateMessage(anthropicMessages, {
      maxTokens: 1024,
      systemPrompt,
      timeoutMs: 30000,
    });
    const llmDurationMs = Date.now() - llmStartMs;

    this.opikService.endLLMSpan(llmSpan, {
      output: { content: response.content.substring(0, 200) },
      usage: response.usage,
      metadata: { model: response.model, stopReason: response.stopReason, llmDurationMs, turnNumber },
    });

    // Latency SLO feedback — 1.0 = within SLO, 0.0 = breached
    if (trace) {
      this.opikService.addFeedback({
        traceId: trace.traceId,
        name: 'latency_slo',
        value: llmDurationMs <= SharkService.LATENCY_SLO.chat ? 1.0 : 0.0,
        category: 'performance',
        comment: `Chat turn ${turnNumber}: ${llmDurationMs}ms (SLO: ${SharkService.LATENCY_SLO.chat}ms)`,
      });
    }

    // Don't end the conversation trace here — it stays open until the user makes a decision
    this.opikService.flush().catch(() => {});

    return this.parseChatResponse(response.content);
  }

  /**
   * Build the Cleo-inspired system prompt for subscription chat
   * Enhanced with financial context, overlap awareness, session context, and personality modes
   */
  private buildChatSystemPrompt(data: {
    name: string;
    category: string;
    currencySymbol: string;
    currency: string;
    monthlyCost: number;
    annualCost: number;
    lastUsageDate: string;
    firstChargeDate: string;
    lastChargeDate: string;
    chargeCount: number;
    context: string;
    priceChangePercent?: number;
    mode?: ChatMode;
    sessionContext?: SessionContext;
    userFinancialContext?: {
      totalMonthlyCost: number;
      activeCount: number;
      monthlyIncome: number;
      subscriptionPctOfIncome: number;
    };
    overlapWarning?: string;
  }): string {
    const mode = data.mode ?? 'advisor';

    // Personality section based on mode
    const personalitySection = this.getPersonalityPrompt(mode);

    // Build optional context sections
    const sections: string[] = [];

    sections.push(`${personalitySection}

SUBSCRIPTION DATA:
- Name: ${data.name}
- Category: ${data.category}
- Monthly Cost: ${data.currencySymbol}${data.monthlyCost.toLocaleString()}
- Annual Cost: ${data.currencySymbol}${data.annualCost.toLocaleString()}
- Last Usage: ${data.lastUsageDate}
- Active Since: ${data.firstChargeDate}
- Last Charge: ${data.lastChargeDate}
- Times Charged: ${data.chargeCount}
- Context: ${data.context}`);

    // Price change alert
    if (data.priceChangePercent && Math.abs(data.priceChangePercent) >= 5) {
      sections.push(`
PRICE CHANGE ALERT: This subscription's cost changed by ${data.priceChangePercent > 0 ? '+' : ''}${data.priceChangePercent.toFixed(1)}% since the previous charge. Mention this to the user — price increases are a strong reason to reconsider.`);
    }

    // User financial context
    if (data.userFinancialContext) {
      const ctx = data.userFinancialContext;
      sections.push(`
USER FINANCIAL CONTEXT:
- Total monthly subscriptions: ${data.currencySymbol}${ctx.totalMonthlyCost.toLocaleString()}
- Subscriptions as % of income: ${ctx.subscriptionPctOfIncome.toFixed(1)}%
- Number of active subscriptions: ${ctx.activeCount}`);
    }

    // Session context
    if (data.sessionContext) {
      const sc = data.sessionContext;
      sections.push(`
SESSION CONTEXT (this review session):
- Already cancelled: ${sc.cancelledNames.length > 0 ? sc.cancelledNames.join(', ') : 'None yet'} (saving ${data.currencySymbol}${sc.cancelledTotal.toLocaleString()}/yr)
- Keeping: ${sc.keptNames.length > 0 ? sc.keptNames.join(', ') : 'None yet'}
- Remaining to review: ${sc.remainingCount}
Use this context to build momentum ("You've already saved $X by cancelling Y — let's keep going!").`);
    }

    // Overlap warning
    if (data.overlapWarning) {
      sections.push(`
OVERLAP ALERT: ${data.overlapWarning}
Mention this overlap — the user may not realize they're paying for multiple services in the same category. Ask which one they use more.`);
    }

    sections.push(`
CONVERSATION FLOW (follow this arc):
1. OPENING: Lead with the cost + a relatable comparison. Ask when they last used it.
2. VALUE CHECK: Calculate per-use cost if they give frequency. Ask if it's worth it.
3. ALTERNATIVES: Suggest 2-3 specific alternatives (free and paid) in this category. Be specific — name real products/services, not generic suggestions.
4. RECOMMENDATION: Give your clear take with the savings amount. Be direct.

RULES:
- Keep messages to 2-3 sentences max. Be punchy.
- Always use ${data.currency} currency symbol (${data.currencySymbol}) for amounts
- Always do the math for the user (per-use cost, annual total, savings)
- Aim for 3-5 total exchanges before recommending
- Respect the user's final choice — if they want to keep, validate that too
- When the user says "Start the review for this subscription." — this is the OPENING. Jump straight into your first message about the subscription cost.
- Use bullet points and numbered lists for alternatives and steps — the UI supports markdown rendering.

At the END of every message, append exactly this (hidden from user):
<!-- META: {"quickReplies": ["reply1", "reply2", "reply3"], "isDecisionPoint": false, "recommendation": null} -->

Set isDecisionPoint to true and recommendation to "KEEP" or "CANCEL" when you're ready to recommend (usually message 3-4). Quick replies should be short, natural responses (max 3, each under 30 chars).`);

    return sections.join('\n');
  }

  /**
   * Get personality prompt section based on chat mode
   */
  private getPersonalityPrompt(mode: ChatMode): string {
    switch (mode) {
      case 'roast':
        return `You are a brutally honest, hilarious financial advisor. Think Gordon Ramsay meets financial planning. You're SHOCKED by wasteful spending and not afraid to roast the user (with love).

YOUR PERSONALITY:
- Brutally honest with exaggerated shock at bad spending habits
- Use savage humor: "You're paying $15/mo for a gym you haven't visited since the Stone Age. Your couch cushions get more of a workout."
- Be dramatic about wasted money: "That's literally setting fire to $180 a year. I can smell the smoke from here."
- Still ultimately helpful — your roasts should lead to actionable advice
- If they decide to keep, roast them ONE more time then respect it with a reluctant "...fine"`;

      case 'supportive':
        return `You are an incredibly warm, gentle financial advisor. Think encouraging best friend who never pressures. Every decision is valid and you celebrate ALL choices.

YOUR PERSONALITY:
- Extra gentle and affirming — "Whatever you decide is totally fine!"
- Celebrate every step: "The fact that you're even reviewing this shows amazing financial awareness!"
- No pressure ever — present information without pushing toward cancel or keep
- Use encouraging phrases: "You're doing great", "That's a totally reasonable choice"
- Frame cancellation as empowerment, not deprivation: "You're choosing where YOUR money goes"
- If they keep, genuinely celebrate: "Love that you know what brings you value!"`;

      case 'advisor':
      default:
        return `You are a witty, sharp financial advisor — think of yourself as a friend who's great with money and not afraid to be direct. You're helping a user decide whether to keep or cancel a subscription.

YOUR PERSONALITY:
- Warm but direct — you give real talk, not corporate speak
- Use relatable comparisons ("that's 24 burritos", "2 months of Netflix")
- Light humor when appropriate ("your gym shoes miss you")
- Never mean or judgmental — you're on their side
- When recommending, be confident: "My take: cancel it" not "you might consider..."`;
    }
  }

  /**
   * Parse AI response, extracting META comment and stripping it from reply
   */
  private parseChatResponse(content: string): {
    reply: string;
    quickReplies?: string[];
    isDecisionPoint: boolean;
    recommendation?: 'KEEP' | 'CANCEL' | null;
  } {
    // Extract META comment
    const metaRegex = /<!--\s*META:\s*(\{[\s\S]*?\})\s*-->/;
    const match = content.match(metaRegex);

    let quickReplies: string[] | undefined;
    let isDecisionPoint = false;
    let recommendation: 'KEEP' | 'CANCEL' | null = null;

    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        quickReplies = Array.isArray(meta.quickReplies) ? meta.quickReplies : undefined;
        isDecisionPoint = Boolean(meta.isDecisionPoint);
        recommendation = meta.recommendation === 'KEEP' || meta.recommendation === 'CANCEL'
          ? meta.recommendation
          : null;
      } catch {
        this.logger.warn('Failed to parse META from chat response');
      }
    }

    // Strip META comment from visible reply
    const reply = content.replace(metaRegex, '').trim();

    return { reply, quickReplies, isDecisionPoint, recommendation };
  }

  /**
   * Get currency symbol for system prompt
   */
  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', EGP: 'E£', USD: '$',
      GBP: '£', EUR: '€',
    };
    return symbols[currency] || '$';
  }

  // ==========================================
  // OVERLAP DETECTION
  // ==========================================

  /**
   * Detect subscriptions in the same category (overlaps)
   *
   * Groups active subscriptions by category and returns groups
   * with 2+ subscriptions — indicating potential redundancy.
   *
   * @param userId - User ID
   * @returns Array of overlap groups
   */
  async detectOverlaps(userId: string): Promise<OverlapGroup[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        monthlyCost: true,
        currency: true,
      },
    });

    // Group by category
    const categoryMap = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const existing = categoryMap.get(sub.category) ?? [];
      existing.push(sub);
      categoryMap.set(sub.category, existing);
    }

    // Return groups with 2+ subscriptions
    const overlaps: OverlapGroup[] = [];
    for (const [category, subs] of categoryMap) {
      if (subs.length >= 2) {
        overlaps.push({
          category,
          subscriptions: subs.map((s) => ({
            id: s.id,
            name: s.name,
            monthlyCost: Number(s.monthlyCost),
          })),
          combinedMonthlyCost: subs.reduce((sum, s) => sum + Number(s.monthlyCost), 0),
        });
      }
    }

    return overlaps;
  }

  // ==========================================
  // CANCELLATION GUIDE
  // ==========================================

  /**
   * Generate AI-powered cancellation instructions for a subscription
   *
   * Uses Claude to generate step-by-step cancellation instructions
   * specific to the service, including direct URLs and timing tips.
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription to generate guide for
   * @returns Cancellation guide with steps
   */
  async generateCancellationGuide(
    userId: string,
    subscriptionId: string,
  ): Promise<CancellationGuideResult> {
    const subscription = await this.getSubscriptionById(userId, subscriptionId);

    const prompt = `Given the subscription "${subscription.name}" in category ${subscription.category}, provide step-by-step cancellation instructions.

Requirements:
1. Provide the direct URL to the cancellation page if known (for major services like Netflix, Spotify, etc.)
2. Format as numbered steps (1. Go to... 2. Click... etc.)
3. Include tips about:
   - Retention offers they might encounter (and whether to accept)
   - Best timing relative to billing cycle
   - Whether to download any data before cancelling
4. Keep each step concise and actionable
5. If this is a service you're unsure about, provide general cancellation steps

Respond in this exact JSON format:
{
  "steps": ["Step 1 text", "Step 2 text", ...],
  "directUrl": "https://..." or null,
  "tips": ["Tip 1", "Tip 2"],
  "estimatedTime": "2 minutes"
}`;

    // Create Opik trace for cancellation guide generation
    const trace = this.opikService.createAgentTrace({
      agentName: 'shark_cancel_guide',
      userId,
      input: { subscriptionId, subscriptionName: subscription.name },
      metadata: { feature: 'cancellation_guide' },
    });

    const llmSpan = trace
      ? this.opikService.createLLMSpan({
          trace: trace.trace,
          name: 'claude_cancel_guide',
          model: 'claude-sonnet',
          provider: 'anthropic',
          input: { subscriptionName: subscription.name, category: subscription.category },
        })
      : null;

    try {
      const llmStartMs = Date.now();
      const response = await this.anthropicService.generateMessage(
        [{ role: 'user' as const, content: prompt }],
        {
          maxTokens: 1024,
          systemPrompt: 'You are a helpful assistant that provides cancellation instructions for subscription services. Always respond with valid JSON only, no markdown code blocks.',
          timeoutMs: 15000,
        },
      );
      const llmDurationMs = Date.now() - llmStartMs;

      this.opikService.endLLMSpan(llmSpan, {
        output: { contentLength: response.content.length },
        usage: response.usage,
        metadata: { model: response.model, stopReason: response.stopReason, llmDurationMs },
      });

      // Parse JSON response
      const content = response.content.trim();
      // Strip markdown code blocks if present
      const jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      const guide = JSON.parse(jsonStr);

      // Record successful parse + latency SLO
      if (trace) {
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'guide_parse_success',
          value: 1.0,
          category: 'quality',
        });
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'latency_slo',
          value: llmDurationMs <= SharkService.LATENCY_SLO.cancel_guide ? 1.0 : 0.0,
          category: 'performance',
          comment: `Cancel guide LLM: ${llmDurationMs}ms (SLO: ${SharkService.LATENCY_SLO.cancel_guide}ms)`,
        });
        this.opikService.endTrace(trace, {
          success: true,
          result: { stepsCount: Array.isArray(guide.steps) ? guide.steps.length : 0, llmDurationMs },
        });
      }
      this.opikService.flush().catch(() => {});

      return {
        subscriptionId,
        subscriptionName: subscription.name,
        steps: Array.isArray(guide.steps) ? guide.steps : [],
        directUrl: guide.directUrl || null,
        tips: Array.isArray(guide.tips) ? guide.tips : [],
        estimatedTime: guide.estimatedTime || '5 minutes',
      };
    } catch (error) {
      this.logger.warn(`Failed to generate cancellation guide: ${error}`);

      // Record failed parse
      if (trace) {
        this.opikService.endLLMSpan(llmSpan, {
          output: { error: String(error) },
        });
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'guide_parse_success',
          value: 0.0,
          category: 'quality',
          comment: `Parse failed: ${error}`,
        });
        this.opikService.endTrace(trace, {
          success: false,
          error: String(error),
        });
      }
      this.opikService.flush().catch(() => {});

      // Fallback generic guide
      return {
        subscriptionId,
        subscriptionName: subscription.name,
        steps: [
          `Go to ${subscription.name}'s website or app`,
          'Navigate to Account Settings',
          'Look for "Subscription" or "Billing" section',
          'Click "Cancel Subscription" or "Cancel Plan"',
          'Follow the cancellation confirmation prompts',
          'Save or screenshot the cancellation confirmation',
        ],
        directUrl: null,
        tips: [
          'Cancel before your next billing date to avoid an extra charge',
          'Some services offer retention discounts — decide in advance if you want to accept',
          'Download any data or content you want to keep before cancelling',
        ],
        estimatedTime: '5 minutes',
      };
    }
  }

  // ==========================================
  // KEEP RECOMMENDATION
  // ==========================================

  /**
   * Generate AI-powered money-saving tips for a subscription the user keeps
   *
   * Provides 3-5 optimization tips specific to the subscription:
   * annual billing savings, cheaper tiers, shared plans, discounts, etc.
   *
   * @param userId - User ID
   * @param subscriptionId - Subscription to generate tips for
   * @returns Keep recommendation with optimization tips
   */
  async generateKeepRecommendation(
    userId: string,
    subscriptionId: string,
  ): Promise<KeepRecommendationResult> {
    const subscription = await this.getSubscriptionById(userId, subscriptionId);
    const currency = await this.getUserCurrency(userId);
    const currencySymbol = this.getCurrencySymbol(currency);
    const monthlyCost = Number(subscription.monthlyCost);
    const annualCost = Number(subscription.annualCost);

    // Check cache first — tips for the same subscription/category rarely change
    const cacheKey = `${subscription.name.toLowerCase()}:${subscription.category}`;
    const cached = this.keepTipsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`Keep tips cache hit for ${subscription.name}`);
      return { ...cached.data, subscriptionId };
    }
    // Evict expired entry
    if (cached) {
      this.keepTipsCache.delete(cacheKey);
    }

    const prompt = `The user is keeping their "${subscription.name}" subscription (${subscription.category} category, ${currencySymbol}${monthlyCost}/month = ${currencySymbol}${annualCost}/year in ${currency}).

Generate 3-5 specific, actionable tips to help them save money while keeping this subscription. Focus on:
1. Annual vs monthly billing savings (typically ~17% discount)
2. Cheaper plan tiers that might fit their needs
3. Family/shared/bundle plans
4. Student, employer, or loyalty discounts
5. Cashback credit cards or retention offers

For each tip, estimate the savings if possible (as a string like "~${currencySymbol}X/year" or null if unknown).
Include an actionUrl only if you know the exact URL for that service's pricing/plans page.

Respond in this exact JSON format:
{
  "tips": [
    {
      "title": "Short tip title",
      "description": "1-2 sentence actionable description",
      "estimatedSavings": "~${currencySymbol}X/year" or null,
      "actionUrl": "https://..." or null
    }
  ],
  "summary": "One sentence summarizing potential total savings"
}`;

    // Create Opik trace for keep tips generation
    const trace = this.opikService.createAgentTrace({
      agentName: 'shark_keep_tips',
      userId,
      input: { subscriptionId, subscriptionName: subscription.name },
      metadata: { feature: 'keep_tips' },
    });

    const llmSpan = trace
      ? this.opikService.createLLMSpan({
          trace: trace.trace,
          name: 'claude_keep_tips',
          model: 'claude-sonnet',
          provider: 'anthropic',
          input: { subscriptionName: subscription.name, category: subscription.category },
        })
      : null;

    try {
      const llmStartMs = Date.now();
      const response = await this.anthropicService.generateMessage(
        [{ role: 'user' as const, content: prompt }],
        {
          maxTokens: 1024,
          systemPrompt:
            'You are a savvy subscription optimization expert. Provide specific, realistic money-saving tips for subscription services. Always respond with valid JSON only, no markdown code blocks.',
          timeoutMs: 15000,
        },
      );
      const llmDurationMs = Date.now() - llmStartMs;

      this.opikService.endLLMSpan(llmSpan, {
        output: { contentLength: response.content.length },
        usage: response.usage,
        metadata: { model: response.model, stopReason: response.stopReason, llmDurationMs },
      });

      const content = response.content.trim();
      const jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      const parsed = JSON.parse(jsonStr);

      // Record successful parse + latency SLO
      if (trace) {
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'tips_parse_success',
          value: 1.0,
          category: 'quality',
        });
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'latency_slo',
          value: llmDurationMs <= SharkService.LATENCY_SLO.keep_tips ? 1.0 : 0.0,
          category: 'performance',
          comment: `Keep tips LLM: ${llmDurationMs}ms (SLO: ${SharkService.LATENCY_SLO.keep_tips}ms)`,
        });
        this.opikService.endTrace(trace, {
          success: true,
          result: { tipsCount: Array.isArray(parsed.tips) ? parsed.tips.length : 0, llmDurationMs },
        });
      }
      this.opikService.flush().catch(() => {});

      const result: KeepRecommendationResult = {
        subscriptionId,
        subscriptionName: subscription.name,
        tips: Array.isArray(parsed.tips)
          ? parsed.tips.map((t: Record<string, unknown>) => ({
              title: String(t.title || ''),
              description: String(t.description || ''),
              estimatedSavings: t.estimatedSavings ? String(t.estimatedSavings) : null,
              actionUrl: t.actionUrl ? String(t.actionUrl) : null,
            }))
          : [],
        summary: parsed.summary || 'Review these tips to optimize your spending.',
      };

      // Cache the result for 24h (tips for the same service rarely change)
      this.keepTipsCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + SharkService.KEEP_TIPS_TTL_MS,
      });

      return result;
    } catch (error) {
      this.logger.warn(`Failed to generate keep recommendation: ${error}`);

      // Record failed parse
      if (trace) {
        this.opikService.endLLMSpan(llmSpan, {
          output: { error: String(error) },
        });
        this.opikService.addFeedback({
          traceId: trace.traceId,
          name: 'tips_parse_success',
          value: 0.0,
          category: 'quality',
          comment: `Parse failed: ${error}`,
        });
        this.opikService.endTrace(trace, {
          success: false,
          error: String(error),
        });
      }
      this.opikService.flush().catch(() => {});

      return {
        subscriptionId,
        subscriptionName: subscription.name,
        tips: [
          {
            title: 'Switch to annual billing',
            description: `Most services offer ~17% off when you pay annually. For ${subscription.name}, that could save you roughly ${currencySymbol}${Math.round(annualCost * 0.17)}/year.`,
            estimatedSavings: `~${currencySymbol}${Math.round(annualCost * 0.17)}/year`,
            actionUrl: null,
          },
          {
            title: 'Review your plan tier',
            description: `Check if ${subscription.name} offers a cheaper plan that still covers your needs. Many users pay for features they never use.`,
            estimatedSavings: null,
            actionUrl: null,
          },
          {
            title: 'Look for shared or family plans',
            description: `Splitting a family or team plan with others can cut your per-person cost by 50% or more.`,
            estimatedSavings: null,
            actionUrl: null,
          },
        ],
        summary: `You could save up to ${currencySymbol}${Math.round(annualCost * 0.17)}/year by switching to annual billing alone.`,
      };
    }
  }

  // ==========================================
  // DECISION HISTORY
  // ==========================================

  /**
   * Get decision history with savings calculations
   *
   * Aggregates all swipe decisions with subscription data
   * and computes total lifetime savings from cancellations.
   *
   * @param userId - User ID
   * @returns Decision history with savings summary
   */
  async getDecisionHistory(userId: string): Promise<DecisionHistoryResult> {
    await this.validateUserExists(userId);

    const decisions = await this.prisma.swipeDecision.findMany({
      where: { userId },
      include: {
        subscription: {
          select: {
            id: true,
            name: true,
            category: true,
            monthlyCost: true,
            annualCost: true,
            currency: true,
          },
        },
      },
      orderBy: { decidedAt: 'desc' },
      take: 50,
    });

    const currency = await this.getUserCurrency(userId);

    // Calculate lifetime savings from all CANCEL decisions
    const cancelDecisions = decisions.filter((d) => d.action === SwipeAction.CANCEL);
    const totalLifetimeSavings = cancelDecisions.reduce(
      (sum, d) => sum + Number(d.subscription.annualCost),
      0,
    );

    const items: DecisionHistoryItem[] = decisions.map((d) => ({
      id: d.id,
      subscriptionId: d.subscriptionId,
      subscriptionName: d.subscription.name,
      category: d.subscription.category,
      action: d.action,
      monthlyCost: Number(d.subscription.monthlyCost),
      annualSavings: d.action === SwipeAction.CANCEL ? Number(d.subscription.annualCost) : 0,
      decidedAt: d.decidedAt,
    }));

    return {
      decisions: items,
      totalLifetimeSavings,
      totalCancelled: cancelDecisions.length,
      totalKept: decisions.filter((d) => d.action === SwipeAction.KEEP).length,
      currency,
    };
  }

  // ==========================================
  // USER FINANCIAL CONTEXT (for AI prompt)
  // ==========================================

  /**
   * Get user's financial context for enriching AI prompts
   */
  private async getUserFinancialContext(
    userId: string,
    _currency: Currency,
  ): Promise<{
    totalMonthlyCost: number;
    activeCount: number;
    monthlyIncome: number;
    subscriptionPctOfIncome: number;
  }> {
    const [subscriptionAgg, incomeSources] = await Promise.all([
      this.prisma.subscription.aggregate({
        where: { userId, isActive: true },
        _sum: { monthlyCost: true },
        _count: { id: true },
      }),
      this.prisma.incomeSource.findMany({
        where: { userId, isActive: true },
        select: { amount: true, frequency: true },
      }),
    ]);

    const totalMonthlyCost = Number(subscriptionAgg._sum.monthlyCost) || 0;
    const activeCount = subscriptionAgg._count.id;

    // Calculate monthly income from all sources
    let monthlyIncome = 0;
    for (const source of incomeSources) {
      const amount = Number(source.amount);
      switch (source.frequency) {
        case 'DAILY': monthlyIncome += amount * 30; break;
        case 'WEEKLY': monthlyIncome += amount * 4.33; break;
        case 'BIWEEKLY': monthlyIncome += amount * 2.17; break;
        case 'MONTHLY': monthlyIncome += amount; break;
        case 'QUARTERLY': monthlyIncome += amount / 3; break;
        case 'ANNUALLY': monthlyIncome += amount / 12; break;
        default: monthlyIncome += amount; break;
      }
    }

    const subscriptionPctOfIncome =
      monthlyIncome > 0 ? (totalMonthlyCost / monthlyIncome) * 100 : 0;

    return {
      totalMonthlyCost,
      activeCount,
      monthlyIncome,
      subscriptionPctOfIncome,
    };
  }

  // ==========================================
  // METRICS (for Opik)
  // ==========================================

  /**
   * Calculate and log audit metrics to Opik
   */
  private async logAuditMetrics(
    _userId: string,
    traceId: string,
    auditResult: AuditResult,
  ): Promise<void> {
    if (!traceId) return;

    // Log zombie detection rate
    const zombieRate =
      auditResult.totalSubscriptions > 0
        ? auditResult.zombiesDetected / auditResult.totalSubscriptions
        : 0;

    this.opikService.addFeedback({
      traceId,
      name: 'ZombieDetectionRate',
      value: zombieRate,
      category: 'quality',
      comment: `${auditResult.zombiesDetected}/${auditResult.totalSubscriptions} zombies`,
    });

    // Log potential savings
    this.opikService.addFeedback({
      traceId,
      name: 'PotentialAnnualSavings',
      value: auditResult.potentialAnnualSavings,
      category: 'custom',
      comment: `${auditResult.currency} ${auditResult.potentialAnnualSavings}`,
      metadata: { currency: auditResult.currency },
    });

    // Log newly detected count
    this.opikService.addFeedback({
      traceId,
      name: 'NewlyDetected',
      value: auditResult.newlyDetected,
      category: 'quality',
      comment: `${auditResult.newlyDetected} new subscriptions detected`,
    });
  }

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Validate user exists
   */
  private async validateUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new SharkUserNotFoundException(userId);
    }
  }

  /**
   * Get user's primary currency
   */
  private async getUserCurrency(userId: string): Promise<Currency> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    });

    return user?.currency || Currency.NGN;
  }

  /**
   * Transform a Prisma subscription to API response format
   */
  private transformSubscription(
    subscription: PrismaSubscription & {
      swipeDecisions?: Array<{ action: SwipeAction; decidedAt: Date }>;
    },
    _currency: Currency,
  ): SubscriptionWithSwipe {
    // Get last decision if exists
    const lastDecision = subscription.swipeDecisions?.[0];

    // Generate annualized framing for cost awareness
    const framing = this.annualizedFraming.generate({
      monthlyCost: Number(subscription.monthlyCost),
      currency: subscription.currency,
      subscriptionName: subscription.name,
    });

    return {
      id: subscription.id,
      userId: subscription.userId,
      name: subscription.name,
      merchantPattern: subscription.merchantPattern,
      category: subscription.category,
      monthlyCost: subscription.monthlyCost,
      annualCost: subscription.annualCost,
      currency: subscription.currency,
      status: subscription.status,
      lastUsageDate: subscription.lastUsageDate,
      detectedAt: subscription.detectedAt,
      firstChargeDate: subscription.firstChargeDate,
      lastChargeDate: subscription.lastChargeDate,
      chargeCount: subscription.chargeCount,
      isActive: subscription.isActive,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      framing,
      lastDecision: lastDecision
        ? {
            action: lastDecision.action,
            decidedAt: lastDecision.decidedAt,
          }
        : undefined,
    } as SubscriptionWithSwipe;
  }

  /**
   * Calculate subscription summary from Prisma groupBy result
   * More efficient than fetching all records
   */
  private calculateSummaryFromGroupBy(
    groupedData: Array<{
      status: SubscriptionStatus;
      _sum: { monthlyCost: unknown };
      _count: { id: number };
    }>,
    currency: Currency,
    cancelledCount = 0,
  ): {
    totalSubscriptions: number;
    zombieCount: number;
    activeCount: number;
    unknownCount: number;
    cancelledCount: number;
    totalMonthlyCost: number;
    zombieMonthlyCost: number;
    potentialAnnualSavings: number;
    currency: Currency;
  } {
    let totalSubscriptions = 0;
    let zombieCount = 0;
    let activeCount = 0;
    let unknownCount = 0;
    let totalMonthlyCost = 0;
    let zombieMonthlyCost = 0;

    for (const group of groupedData) {
      const count = group._count.id;
      const cost = Number(group._sum.monthlyCost) || 0;

      totalSubscriptions += count;
      totalMonthlyCost += cost;

      switch (group.status) {
        case SubscriptionStatus.ZOMBIE:
          zombieCount = count;
          zombieMonthlyCost = cost;
          break;
        case SubscriptionStatus.ACTIVE:
          activeCount = count;
          break;
        case SubscriptionStatus.UNKNOWN:
          unknownCount = count;
          break;
      }
    }

    return {
      totalSubscriptions,
      zombieCount,
      activeCount,
      unknownCount,
      cancelledCount,
      totalMonthlyCost,
      zombieMonthlyCost,
      potentialAnnualSavings: zombieMonthlyCost * 12,
      currency,
    };
  }

  /**
   * Get message for swipe action
   */
  private getSwipeMessage(action: SwipeAction, subscriptionName: string): string {
    switch (action) {
      case SwipeAction.KEEP:
        return `Marked ${subscriptionName} as a keeper. It won't appear in zombie alerts.`;
      case SwipeAction.CANCEL:
        return `${subscriptionName} has been queued for cancellation.`;
      case SwipeAction.REVIEW_LATER:
        return `${subscriptionName} has been saved for later review.`;
      default:
        return `Decision recorded for ${subscriptionName}.`;
    }
  }
}
