/**
 * Annualized Framing Interfaces
 *
 * Defines structures for presenting subscription costs
 * in relatable, impactful ways to help users understand
 * the true cost of their subscriptions.
 */

import { Currency } from '@prisma/client';

/**
 * Annualized cost framing for UI display
 *
 * Transforms monthly costs into annual figures with
 * relatable context and impact statements.
 *
 * @example
 * {
 *   monthly: "₦5,000/month",
 *   annual: "₦60,000/year",
 *   context: "That's equivalent to a weekend trip to Calabar",
 *   impact: "Cancelling could save you ₦60,000 this year"
 * }
 */
export interface AnnualizedFraming {
  /** Formatted monthly cost (e.g., "₦5,000/month") */
  monthly: string;
  /** Formatted annual cost (e.g., "₦60,000/year") */
  annual: string;
  /** Relatable context comparison (e.g., "That's 2 months of groceries") */
  context: string;
  /** Impact statement (e.g., "Cancelling saves ₦60,000/year") */
  impact: string;
}

/**
 * Input for generating annualized framing
 */
export interface AnnualizedFramingInput {
  /** Monthly cost amount */
  monthlyCost: number;
  /** Currency for formatting */
  currency: Currency;
  /** Subscription name for personalized impact */
  subscriptionName: string;
}

/**
 * Currency format configuration
 */
export interface CurrencyFormat {
  /** Currency symbol (e.g., "₦", "$") */
  symbol: string;
  /** Locale for number formatting */
  locale: string;
  /** Symbol position ('before' or 'after') */
  symbolPosition: 'before' | 'after';
}

/**
 * Context comparison templates by currency
 * Used to generate relatable cost comparisons
 */
export interface ContextComparison {
  /** Threshold amount for this comparison */
  threshold: number;
  /** Template string (uses {amount} placeholder) */
  template: string;
}
