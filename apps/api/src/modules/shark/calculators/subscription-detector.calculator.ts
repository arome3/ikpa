/**
 * Subscription Detector Calculator
 *
 * Detects subscriptions from recurring expense records using
 * pattern matching against known subscription service names.
 *
 * @module SubscriptionDetectorCalculator
 */

import { Injectable, Logger } from '@nestjs/common';
import { Currency, SubscriptionCategory } from '@prisma/client';
import {
  DetectedSubscription,
  PatternMatchResult,
  ExpenseForDetection,
  MerchantExpenseGroup,
} from '../interfaces';
import {
  SUBSCRIPTION_PATTERNS,
  MIN_CHARGES_FOR_SUBSCRIPTION,
  MIN_CONFIDENCE_THRESHOLD,
} from '../constants';

/**
 * Calculator for detecting subscriptions from expense records
 *
 * Uses regex pattern matching to identify recurring expenses
 * that match known subscription service names.
 */
@Injectable()
export class SubscriptionDetectorCalculator {
  private readonly logger = new Logger(SubscriptionDetectorCalculator.name);

  /**
   * Detect subscriptions from recurring expenses
   *
   * @param userId - User ID for tracing
   * @param expenses - User's recurring expenses to analyze
   * @returns Array of detected subscriptions
   *
   * @example
   * ```typescript
   * const detected = await detector.detect(userId, expenses);
   * // Returns: [{ name: 'Netflix', category: 'STREAMING', ... }]
   * ```
   */
  async detect(
    userId: string,
    expenses: ExpenseForDetection[],
  ): Promise<DetectedSubscription[]> {
    this.logger.debug(
      `Detecting subscriptions for user ${userId} from ${expenses.length} expenses`,
    );

    // Filter to only recurring expenses with merchants
    const recurringExpenses = expenses.filter(
      (e) => e.isRecurring && e.merchant && e.merchant.trim().length > 0,
    );

    if (recurringExpenses.length === 0) {
      this.logger.debug('No recurring expenses with merchants found');
      return [];
    }

    // Group expenses by merchant
    const merchantGroups = this.groupByMerchant(recurringExpenses);

    // Detect subscriptions from each group
    const detected: DetectedSubscription[] = [];

    for (const [merchant, group] of merchantGroups.entries()) {
      // Skip if not enough charges to confirm subscription
      if (group.chargeCount < MIN_CHARGES_FOR_SUBSCRIPTION) {
        this.logger.debug(
          `Skipping ${merchant}: only ${group.chargeCount} charges (need ${MIN_CHARGES_FOR_SUBSCRIPTION})`,
        );
        continue;
      }

      // Try to match merchant against patterns
      const matchResult = this.matchMerchant(merchant);

      if (matchResult.matched && matchResult.category) {
        detected.push({
          name: this.extractServiceName(merchant, matchResult),
          merchantPattern: merchant,
          category: matchResult.category,
          monthlyCost: group.averageAmount,
          currency: recurringExpenses[0].currency as Currency,
          firstChargeDate: group.firstDate,
          lastChargeDate: group.lastDate,
          chargeCount: group.chargeCount,
        });

        this.logger.debug(
          `Detected subscription: ${merchant} -> ${matchResult.category}`,
        );
      } else {
        // Unknown merchant with recurring charges - categorize as OTHER
        detected.push({
          name: this.normalizeServiceName(merchant),
          merchantPattern: merchant,
          category: SubscriptionCategory.OTHER,
          monthlyCost: group.averageAmount,
          currency: recurringExpenses[0].currency as Currency,
          firstChargeDate: group.firstDate,
          lastChargeDate: group.lastDate,
          chargeCount: group.chargeCount,
        });

        this.logger.debug(
          `Detected unknown subscription: ${merchant} -> OTHER`,
        );
      }
    }

    this.logger.log(
      `Detected ${detected.length} subscriptions for user ${userId}`,
    );

    return detected;
  }

  /**
   * Match a merchant name against subscription patterns
   *
   * Filters out low-confidence matches to reduce false positives.
   * For example, "Zoom Pizza Restaurant" won't match VPN pattern
   * because the confidence would be too low.
   *
   * @param merchant - Merchant name to match
   * @returns Pattern match result with category and confidence
   */
  matchMerchant(merchant: string): PatternMatchResult {
    const normalizedMerchant = merchant.toLowerCase().trim();

    for (const patternDef of SUBSCRIPTION_PATTERNS) {
      if (patternDef.pattern.test(normalizedMerchant)) {
        // Calculate confidence based on match quality
        const confidence = this.calculateMatchConfidence(
          normalizedMerchant,
          patternDef.pattern,
        );

        // Filter out low-confidence matches to prevent false positives
        // e.g., "Zoom Pizza" matching VPN pattern would have low confidence
        if (confidence < MIN_CONFIDENCE_THRESHOLD) {
          this.logger.debug(
            `Skipping low-confidence match: ${merchant} -> ${patternDef.category} (confidence: ${confidence.toFixed(2)})`,
          );
          continue; // Try next pattern
        }

        return {
          matched: true,
          category: patternDef.category,
          displayName: patternDef.displayName,
          confidence,
        };
      }
    }

    return {
      matched: false,
      category: null,
      displayName: null,
      confidence: 0,
    };
  }

  /**
   * Group expenses by merchant name
   *
   * @param expenses - Expenses to group
   * @returns Map of merchant names to expense groups
   */
  private groupByMerchant(
    expenses: ExpenseForDetection[],
  ): Map<string, MerchantExpenseGroup> {
    const groups = new Map<string, MerchantExpenseGroup>();

    for (const expense of expenses) {
      const merchant = expense.merchant?.toLowerCase().trim();
      if (!merchant) continue;

      const existing = groups.get(merchant);

      if (existing) {
        existing.expenses.push({
          amount: expense.amount,
          date: expense.date,
        });
        existing.totalAmount += expense.amount;
        existing.chargeCount++;

        // Update date range
        if (expense.date < existing.firstDate) {
          existing.firstDate = expense.date;
        }
        if (expense.date > existing.lastDate) {
          existing.lastDate = expense.date;
        }

        // Recalculate average
        existing.averageAmount = existing.totalAmount / existing.chargeCount;
      } else {
        groups.set(merchant, {
          merchant,
          expenses: [{ amount: expense.amount, date: expense.date }],
          totalAmount: expense.amount,
          chargeCount: 1,
          firstDate: expense.date,
          lastDate: expense.date,
          averageAmount: expense.amount,
        });
      }
    }

    return groups;
  }

  /**
   * Common payment/subscription descriptor words
   * These are generic terms that appear in merchant names but don't
   * indicate a different business (unlike "pizza" or "restaurant")
   */
  private readonly PAYMENT_DESCRIPTORS = new Set([
    'subscription',
    'payment',
    'monthly',
    'annual',
    'yearly',
    'charge',
    'renewal',
    'service',
    'services',
    'plan',
    'premium',
    'storage',
    'cloud',
    'account',
    'billing',
    'auto',
    'recurring',
    'membership',
    'member',
    'online',
    'digital',
    'inc',
    'ltd',
    'llc',
    'corp',
    'apple', // For "Apple iCloud Storage" - Apple is a known prefix
    'google', // For "Google One"
    'microsoft', // For Microsoft services
    'amazon', // For Amazon services
    'multichoice', // DStv parent company - not a false positive indicator
  ]);

  /**
   * Calculate confidence score for a pattern match
   *
   * Higher scores indicate more confident matches. Uses multiple signals:
   * 1. Match length relative to merchant name length
   * 2. Whether match is at the start of merchant name
   * 3. Whether non-matching parts are common payment descriptors
   *
   * @param merchant - Normalized merchant name
   * @param pattern - Regex pattern that matched
   * @returns Confidence score (0-1)
   */
  private calculateMatchConfidence(merchant: string, pattern: RegExp): number {
    const match = merchant.match(pattern);
    if (!match || !match[0]) return 0;

    // Base confidence from match length relative to merchant length
    const matchLength = match[0].length;
    const merchantLength = merchant.length;
    const lengthRatio = matchLength / merchantLength;

    // High confidence for exact or near-exact matches
    if (lengthRatio > 0.8) return 1.0;
    if (lengthRatio > 0.5) return 0.9;
    if (lengthRatio > 0.3) return 0.8;

    // For shorter matches, apply contextual analysis
    let confidence = 0.7;

    // Boost if match is at the start of the merchant name
    const matchIndex = match.index ?? 0;
    if (matchIndex === 0) {
      confidence += 0.05;
    }

    // Analyze non-matching parts for context
    const beforeMatch = merchant.slice(0, matchIndex).trim();
    const afterMatch = merchant.slice(matchIndex + matchLength).trim();

    // Check if non-matching parts are common descriptors
    const beforeWords = beforeMatch.split(/\s+/).filter((w) => w.length > 0);
    const afterWords = afterMatch.split(/\s+/).filter((w) => w.length > 0);

    const allNonMatchWords = [...beforeWords, ...afterWords];

    if (allNonMatchWords.length > 0) {
      const descriptorCount = allNonMatchWords.filter((word) =>
        this.PAYMENT_DESCRIPTORS.has(word.toLowerCase()),
      ).length;

      // Boost if most non-matching words are descriptors
      const descriptorRatio = descriptorCount / allNonMatchWords.length;
      if (descriptorRatio >= 0.5) {
        confidence += 0.1;
      } else if (descriptorRatio > 0) {
        confidence += 0.05;
      }
    } else {
      // No extra words means the match IS the merchant name
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract a clean service name from merchant and match result
   *
   * @param merchant - Original merchant name
   * @param _matchResult - Pattern match result (unused, reserved for future use)
   * @returns Clean service name for display
   */
  private extractServiceName(
    merchant: string,
    _matchResult: PatternMatchResult,
  ): string {
    // Common service names for direct matching
    const knownServices: Record<string, string> = {
      netflix: 'Netflix',
      spotify: 'Spotify',
      'amazon prime': 'Amazon Prime',
      'youtube premium': 'YouTube Premium',
      'apple music': 'Apple Music',
      'disney+': 'Disney+',
      hulu: 'Hulu',
      'hbo max': 'HBO Max',
      dstv: 'DStv',
      gotv: 'GOtv',
      showmax: 'Showmax',
      multichoice: 'MultiChoice',
      startimes: 'StarTimes',
      dropbox: 'Dropbox',
      icloud: 'iCloud',
      'google one': 'Google One',
      onedrive: 'OneDrive',
      adobe: 'Adobe',
      'microsoft 365': 'Microsoft 365',
      canva: 'Canva',
      figma: 'Figma',
      notion: 'Notion',
      slack: 'Slack',
      zoom: 'Zoom',
      nordvpn: 'NordVPN',
      expressvpn: 'ExpressVPN',
      surfshark: 'Surfshark',
      coursera: 'Coursera',
      udemy: 'Udemy',
      skillshare: 'Skillshare',
      'linkedin learning': 'LinkedIn Learning',
      masterclass: 'MasterClass',
      duolingo: 'Duolingo',
    };

    const normalizedMerchant = merchant.toLowerCase().trim();

    // Check for known service names
    for (const [key, value] of Object.entries(knownServices)) {
      if (normalizedMerchant.includes(key)) {
        return value;
      }
    }

    // Fall back to normalized merchant name
    return this.normalizeServiceName(merchant);
  }

  /**
   * Normalize a merchant name for display
   *
   * @param merchant - Raw merchant name
   * @returns Normalized name with proper capitalization
   */
  private normalizeServiceName(merchant: string): string {
    return merchant
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
