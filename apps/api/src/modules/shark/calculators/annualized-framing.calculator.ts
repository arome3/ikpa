/**
 * Annualized Framing Calculator
 *
 * Generates human-friendly cost framing for subscriptions,
 * helping users understand the true annual impact of their
 * monthly subscription costs.
 *
 * @module AnnualizedFramingCalculator
 */

import { Injectable, Logger } from '@nestjs/common';
import { Currency } from '@prisma/client';
import {
  AnnualizedFraming,
  AnnualizedFramingInput,
  CurrencyFormat,
} from '../interfaces';
import { CURRENCY_FORMATS, CONTEXT_COMPARISONS } from '../constants';

/**
 * Calculator for generating annualized cost framing
 *
 * Transforms monthly subscription costs into relatable annual figures
 * with context comparisons and impact statements.
 *
 * @example
 * ```typescript
 * const framing = framingCalculator.generate({
 *   monthlyCost: 5000,
 *   currency: Currency.NGN,
 *   subscriptionName: 'Netflix'
 * });
 * // Returns:
 * // {
 * //   monthly: "₦5,000/month",
 * //   annual: "₦60,000/year",
 * //   context: "That's equivalent to a weekend trip to Calabar",
 * //   impact: "Cancelling Netflix could save you ₦60,000 this year"
 * // }
 * ```
 */
@Injectable()
export class AnnualizedFramingCalculator {
  private readonly logger = new Logger(AnnualizedFramingCalculator.name);

  /**
   * Generate annualized framing for a subscription
   *
   * @param input - Subscription cost details
   * @returns Formatted framing strings for UI display
   */
  generate(input: AnnualizedFramingInput): AnnualizedFraming {
    const { monthlyCost, currency, subscriptionName } = input;

    // Calculate annual cost
    const annualCost = monthlyCost * 12;

    // Format costs
    const monthlyFormatted = this.formatCurrency(monthlyCost, currency);
    const annualFormatted = this.formatCurrency(annualCost, currency);

    // Generate context comparison
    const context = this.generateContext(annualCost, currency);

    // Generate impact statement
    const impact = this.generateImpact(annualCost, currency, subscriptionName);

    return {
      monthly: `${monthlyFormatted}/month`,
      annual: `${annualFormatted}/year`,
      context,
      impact,
    };
  }

  /**
   * Format a currency amount for display
   *
   * @param amount - Amount to format
   * @param currency - Currency code
   * @returns Formatted currency string
   */
  formatCurrency(amount: number, currency: Currency): string {
    const format = CURRENCY_FORMATS[currency] || CURRENCY_FORMATS[Currency.USD];

    try {
      // Use Intl.NumberFormat for proper locale-aware formatting
      const formatter = new Intl.NumberFormat(format.locale, {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

      const formattedNumber = formatter.format(Math.round(amount));

      // Add currency symbol based on position
      if (format.symbolPosition === 'before') {
        return `${format.symbol}${formattedNumber}`;
      } else {
        return `${formattedNumber} ${format.symbol}`;
      }
    } catch (error) {
      // Fallback to simple formatting
      this.logger.warn(
        `Currency formatting failed for ${currency}, using fallback`,
      );
      return `${format.symbol}${Math.round(amount).toLocaleString()}`;
    }
  }

  /**
   * Generate a relatable context comparison
   *
   * Compares the annual cost to relatable items that help
   * users understand the true magnitude of the expense.
   *
   * @param annualCost - Annual cost amount
   * @param currency - Currency code
   * @returns Context comparison string
   */
  generateContext(annualCost: number, currency: Currency): string {
    const comparisons = CONTEXT_COMPARISONS[currency] || CONTEXT_COMPARISONS[Currency.USD];

    // Find the appropriate comparison for this cost level
    for (const comparison of comparisons) {
      if (annualCost >= comparison.threshold) {
        return comparison.template;
      }
    }

    // Fallback (should never reach here if comparisons are properly defined)
    return "That's money that could be growing in savings";
  }

  /**
   * Generate an impact statement
   *
   * Creates a personalized statement about the potential
   * savings from cancelling the subscription.
   *
   * @param annualCost - Annual cost amount
   * @param currency - Currency code
   * @param subscriptionName - Name of the subscription
   * @returns Impact statement string
   */
  generateImpact(
    annualCost: number,
    currency: Currency,
    subscriptionName: string,
  ): string {
    const formattedAmount = this.formatCurrency(annualCost, currency);

    return `Cancelling ${subscriptionName} could save you ${formattedAmount} this year`;
  }

  /**
   * Get the currency format configuration
   *
   * @param currency - Currency code
   * @returns Currency format configuration
   */
  getCurrencyFormat(currency: Currency): CurrencyFormat {
    return CURRENCY_FORMATS[currency] || CURRENCY_FORMATS[Currency.USD];
  }

  /**
   * Calculate total annual cost for multiple subscriptions
   *
   * @param subscriptions - Array of subscriptions with monthlyCost
   * @returns Total annual cost
   */
  calculateTotalAnnualCost(
    subscriptions: Array<{ monthlyCost: number }>,
  ): number {
    return subscriptions.reduce(
      (total, sub) => total + sub.monthlyCost * 12,
      0,
    );
  }

  /**
   * Generate summary framing for multiple subscriptions
   *
   * @param totalMonthlyCost - Total monthly cost
   * @param currency - Currency code
   * @returns Summary framing
   */
  generateSummaryFraming(
    totalMonthlyCost: number,
    currency: Currency,
  ): {
    monthlyTotal: string;
    annualTotal: string;
    context: string;
  } {
    const annualTotal = totalMonthlyCost * 12;

    return {
      monthlyTotal: `${this.formatCurrency(totalMonthlyCost, currency)}/month`,
      annualTotal: `${this.formatCurrency(annualTotal, currency)}/year`,
      context: this.generateContext(annualTotal, currency),
    };
  }
}
