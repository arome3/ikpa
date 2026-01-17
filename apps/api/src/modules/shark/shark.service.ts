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
} from './interfaces';
import {
  SubscriptionNotFoundException,
  InsufficientExpenseDataException,
  AuditOperationException,
  SubscriptionCancellationException,
  SharkUserNotFoundException,
  DuplicateSwipeDecisionException,
} from './exceptions';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly opikService: OpikService,
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
    const paginatedWhere: Record<string, unknown> = {
      userId,
      isActive: true,
    };

    if (status) {
      paginatedWhere.status = status;
    }

    // Base where for summary (all active, regardless of status filter)
    const summaryWhere = { userId, isActive: true };

    // Execute all queries in parallel to minimize latency
    const [subscriptions, total, summaryData, user] = await Promise.all([
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
    const summary = this.calculateSummaryFromGroupBy(summaryData, currency);

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

    // Get existing subscription merchant patterns
    const existingPatterns = await this.prisma.subscription.findMany({
      where: { userId },
      select: { merchantPattern: true },
    });
    const existingPatternSet = new Set(
      existingPatterns.map((s) => s.merchantPattern?.toLowerCase()),
    );

    // Filter to only new subscriptions
    const newSubscriptions = detected.filter(
      (d) => !existingPatternSet.has(d.merchantPattern.toLowerCase()),
    );

    // Save new subscriptions
    if (newSubscriptions.length > 0) {
      await this.saveDetectedSubscriptions(userId, newSubscriptions);
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
    // These should not be re-classified as zombies
    const subscriptionsToAnalyze = subscriptions.filter((s) => {
      const lastDecision = s.swipeDecisions?.[0];
      return lastDecision?.action !== SwipeAction.KEEP;
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

    // Create swipe decision
    const swipeDecision = await this.prisma.swipeDecision.create({
      data: {
        subscriptionId: decision.subscriptionId,
        userId,
        action: decision.action,
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
  ): {
    totalSubscriptions: number;
    zombieCount: number;
    activeCount: number;
    unknownCount: number;
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
