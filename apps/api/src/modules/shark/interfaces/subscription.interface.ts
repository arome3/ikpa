/**
 * Subscription Interfaces
 *
 * Core data structures for the Shark Auditor subscription detection
 * and management system.
 */

import { Decimal } from '@prisma/client/runtime/library';
import {
  SubscriptionStatus,
  SubscriptionCategory,
  SwipeAction,
  Currency,
} from '@prisma/client';
import { AnnualizedFraming } from './annualized-framing.interface';

/**
 * Core subscription data structure (from database)
 */
export interface Subscription {
  id: string;
  userId: string;
  name: string;
  merchantPattern: string | null;
  category: SubscriptionCategory;
  monthlyCost: Decimal;
  annualCost: Decimal;
  currency: Currency;
  status: SubscriptionStatus;
  lastUsageDate: Date | null;
  detectedAt: Date;
  firstChargeDate: Date | null;
  lastChargeDate: Date | null;
  chargeCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Detected subscription from expense analysis (before saving)
 */
export interface DetectedSubscription {
  name: string;
  merchantPattern: string;
  category: SubscriptionCategory;
  monthlyCost: number;
  currency: Currency;
  firstChargeDate: Date;
  lastChargeDate: Date;
  chargeCount: number;
}

/**
 * Last swipe decision on a subscription
 */
export interface LastSwipeDecision {
  action: SwipeAction;
  decidedAt: Date;
}

/**
 * Subscription with last swipe decision and framing for API response
 */
export interface SubscriptionWithSwipe extends Subscription {
  lastDecision?: LastSwipeDecision;
  framing: AnnualizedFraming;
}

/**
 * Swipe decision input
 */
export interface SwipeDecisionInput {
  subscriptionId: string;
  action: SwipeAction;
}

/**
 * Swipe decision result
 */
export interface SwipeDecisionResult {
  id: string;
  subscriptionId: string;
  action: SwipeAction;
  decidedAt: Date;
  message: string;
}

/**
 * Audit result summary
 */
export interface AuditResult {
  totalSubscriptions: number;
  newlyDetected: number;
  zombiesDetected: number;
  potentialAnnualSavings: number;
  currency: Currency;
  auditedAt: Date;
}

/**
 * Cancellation result
 */
export interface CancellationResult {
  subscriptionId: string;
  success: boolean;
  message: string;
  annualSavings: number;
  cancelledAt: Date;
}

/**
 * Subscription summary statistics
 */
export interface SubscriptionSummary {
  totalSubscriptions: number;
  zombieCount: number;
  activeCount: number;
  unknownCount: number;
  totalMonthlyCost: number;
  zombieMonthlyCost: number;
  potentialAnnualSavings: number;
  currency: Currency;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Subscription list response structure
 */
export interface SubscriptionListResult {
  subscriptions: SubscriptionWithSwipe[];
  summary: SubscriptionSummary;
  pagination: PaginationInfo;
}

/**
 * Query options for listing subscriptions
 */
export interface SubscriptionQueryOptions {
  status?: SubscriptionStatus;
  limit?: number;
  offset?: number;
}
