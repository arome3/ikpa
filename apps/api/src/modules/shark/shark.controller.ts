/**
 * Shark Auditor Controller
 *
 * API endpoints for the Shark Auditor subscription detection
 * and management system.
 *
 * @module SharkController
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { SharkService } from './shark.service';
import {
  SubscriptionQueryDto,
  SubscriptionListResponseDto,
  SubscriptionDto,
  AnnualizedFramingDto,
  TriggerAuditDto,
  AuditResultDto,
  SwipeDecisionDto,
  SwipeDecisionResponseDto,
  CancelSubscriptionDto,
  CancellationResultDto,
} from './dto';

/**
 * Controller for Shark Auditor subscription management
 *
 * Provides endpoints for:
 * - Listing detected subscriptions with framing
 * - Triggering subscription audits
 * - Recording swipe decisions
 * - Processing cancellations
 */
@ApiTags('Shark Auditor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/shark')
export class SharkController {
  constructor(private readonly sharkService: SharkService) {}

  // ==========================================
  // SUBSCRIPTION ENDPOINTS
  // ==========================================

  /**
   * Get all detected subscriptions
   *
   * Returns subscriptions with annualized framing, summary statistics,
   * and pagination information.
   */
  @Get('subscriptions')
  @ApiOperation({
    summary: 'Get detected subscriptions',
    description:
      'Returns all detected subscriptions with status, annualized cost framing, ' +
      'and summary statistics. Supports filtering by status and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
    type: SubscriptionListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getSubscriptions(
    @CurrentUser('id') userId: string,
    @Query() query: SubscriptionQueryDto,
  ): Promise<SubscriptionListResponseDto> {
    const result = await this.sharkService.getSubscriptions(userId, {
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      subscriptions: result.subscriptions.map((sub) => ({
        id: sub.id,
        name: sub.name,
        category: sub.category,
        monthlyCost: Number(sub.monthlyCost),
        annualCost: Number(sub.annualCost),
        currency: sub.currency,
        status: sub.status,
        lastUsageDate: sub.lastUsageDate ?? undefined,
        detectedAt: sub.detectedAt,
        firstChargeDate: sub.firstChargeDate ?? undefined,
        lastChargeDate: sub.lastChargeDate ?? undefined,
        chargeCount: sub.chargeCount,
        framing: this.generateFramingDto(sub),
        lastDecision: sub.lastDecision
          ? {
              action: sub.lastDecision.action,
              decidedAt: sub.lastDecision.decidedAt,
            }
          : undefined,
      })),
      summary: result.summary,
      pagination: result.pagination,
    };
  }

  /**
   * Get a single subscription by ID
   */
  @Get('subscriptions/:id')
  @ApiOperation({
    summary: 'Get subscription details',
    description:
      'Returns detailed information about a specific subscription ' +
      'including cost framing and last swipe decision.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: 'sub-123-abc-def',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription retrieved successfully',
    type: SubscriptionDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found',
  })
  async getSubscription(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) subscriptionId: string,
  ): Promise<SubscriptionDto> {
    const subscription = await this.sharkService.getSubscriptionById(
      userId,
      subscriptionId,
    );

    return {
      id: subscription.id,
      name: subscription.name,
      category: subscription.category,
      monthlyCost: Number(subscription.monthlyCost),
      annualCost: Number(subscription.annualCost),
      currency: subscription.currency,
      status: subscription.status,
      lastUsageDate: subscription.lastUsageDate ?? undefined,
      detectedAt: subscription.detectedAt,
      firstChargeDate: subscription.firstChargeDate ?? undefined,
      lastChargeDate: subscription.lastChargeDate ?? undefined,
      chargeCount: subscription.chargeCount,
      framing: this.generateFramingDto(subscription),
      lastDecision: subscription.lastDecision
        ? {
            action: subscription.lastDecision.action,
            decidedAt: subscription.lastDecision.decidedAt,
          }
        : undefined,
    };
  }

  // ==========================================
  // AUDIT ENDPOINTS
  // ==========================================

  /**
   * Trigger a manual subscription audit
   *
   * Rate limited to 3 requests per hour to prevent abuse.
   */
  @Post('audit')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour
  @ApiOperation({
    summary: 'Trigger manual audit',
    description:
      'Scans expense records to detect subscriptions and identify zombie ' +
      '(unused) subscriptions. Returns audit summary with potential savings. ' +
      'Rate limited to 3 requests per hour.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit completed successfully',
    type: AuditResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 422,
    description: 'Insufficient expense data to detect subscriptions',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - Max 3 audits per hour',
  })
  async triggerAudit(
    @CurrentUser('id') userId: string,
    @Body() body: TriggerAuditDto,
  ): Promise<AuditResultDto> {
    const result = await this.sharkService.triggerAudit(userId, body.force);

    return {
      totalSubscriptions: result.totalSubscriptions,
      newlyDetected: result.newlyDetected,
      zombiesDetected: result.zombiesDetected,
      potentialAnnualSavings: result.potentialAnnualSavings,
      currency: result.currency,
      auditedAt: result.auditedAt,
    };
  }

  // ==========================================
  // SWIPE ENDPOINTS
  // ==========================================

  /**
   * Record a swipe decision
   *
   * Records the user's decision on a subscription: KEEP, CANCEL, or REVIEW_LATER.
   * If CANCEL is selected, the subscription is queued for cancellation.
   */
  @Post('swipe')
  @ApiOperation({
    summary: 'Record swipe decision',
    description:
      'Records a swipe decision (KEEP, CANCEL, or REVIEW_LATER) for a subscription. ' +
      'CANCEL decisions will mark the subscription for cancellation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Decision recorded successfully',
    type: SwipeDecisionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid swipe action',
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found',
  })
  async recordSwipe(
    @CurrentUser('id') userId: string,
    @Body() body: SwipeDecisionDto,
  ): Promise<SwipeDecisionResponseDto> {
    const result = await this.sharkService.recordSwipeDecision(userId, {
      subscriptionId: body.subscriptionId,
      action: body.action,
    });

    return {
      id: result.id,
      subscriptionId: result.subscriptionId,
      action: result.action,
      decidedAt: result.decidedAt,
      message: result.message,
    };
  }

  // ==========================================
  // CANCELLATION ENDPOINTS
  // ==========================================

  /**
   * Process subscription cancellation
   *
   * Marks a subscription as cancelled and calculates the annual savings.
   */
  @Post('subscriptions/:id/cancel')
  @ApiOperation({
    summary: 'Process cancellation',
    description:
      'Marks a subscription as cancelled and calculates the annual savings. ' +
      'Optionally accepts a cancellation reason for analytics.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID to cancel',
    example: 'sub-123-abc-def',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
    type: CancellationResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Subscription not found',
  })
  @ApiResponse({
    status: 422,
    description: 'Subscription cannot be cancelled (e.g., already cancelled)',
  })
  async cancelSubscription(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) subscriptionId: string,
    @Body() body: CancelSubscriptionDto,
  ): Promise<CancellationResultDto> {
    const result = await this.sharkService.cancelSubscription(
      userId,
      subscriptionId,
      body.reason,
    );

    return {
      subscriptionId: result.subscriptionId,
      success: result.success,
      message: result.message,
      annualSavings: result.annualSavings,
      cancelledAt: result.cancelledAt,
    };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Generate framing DTO from subscription data
   */
  private generateFramingDto(subscription: {
    monthlyCost: unknown;
    annualCost: unknown;
    currency: string;
    name: string;
  }): AnnualizedFramingDto {
    const monthlyCost = Number(subscription.monthlyCost);
    const annualCost = Number(subscription.annualCost);
    const { currency, name } = subscription;

    // Get currency format
    const currencySymbol = this.getCurrencySymbol(currency);

    return {
      monthly: `${currencySymbol}${this.formatNumber(monthlyCost)}/month`,
      annual: `${currencySymbol}${this.formatNumber(annualCost)}/year`,
      context: this.generateContext(annualCost, currency),
      impact: `Cancelling ${name} could save you ${currencySymbol}${this.formatNumber(annualCost)} this year`,
    };
  }

  /**
   * Get currency symbol
   */
  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      NGN: '₦',
      GHS: 'GH₵',
      KES: 'KSh',
      ZAR: 'R',
      EGP: 'E£',
      USD: '$',
    };
    return symbols[currency] || '$';
  }

  /**
   * Format number with commas
   */
  private formatNumber(value: number): string {
    return Math.round(value).toLocaleString();
  }

  /**
   * Generate context comparison
   */
  private generateContext(annualCost: number, currency: string): string {
    // Simple context generation for controller
    // More sophisticated logic is in the AnnualizedFramingCalculator
    if (currency === 'NGN') {
      if (annualCost >= 500000) return "That's equivalent to a month's rent in many cities";
      if (annualCost >= 200000) return "That's a weekend getaway";
      if (annualCost >= 100000) return "That's 2 months of groceries";
      return "That's money that could be growing in savings";
    }
    return "That's money that could be growing in savings";
  }
}
