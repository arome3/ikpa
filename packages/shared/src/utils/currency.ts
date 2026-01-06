import { Currency } from '../types/user';
import { CURRENCY_SYMBOLS } from '../constants';

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  currency: Currency,
  options: FormatCurrencyOptions = {},
): string {
  const { showSymbol = true, decimals = 2, locale = 'en-NG' } = options;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);

  if (showSymbol) {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol}${formatted}`;
  }

  return formatted;
}

export interface FormatCurrencyOptions {
  showSymbol?: boolean;
  decimals?: number;
  locale?: string;
}

/**
 * Format a large number in compact form (e.g., 1.2M, 500K)
 */
export function formatCompactCurrency(
  amount: number,
  currency: Currency,
  locale = 'en-NG',
): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  const formatted = new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(amount);

  return `${symbol}${formatted}`;
}

/**
 * Parse a currency string to number
 */
export function parseCurrencyString(value: string): number {
  // Remove currency symbols and thousands separators
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}

/**
 * Format a number as percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Calculate monthly amount from different frequencies
 */
export function toMonthlyAmount(
  amount: number,
  frequency: import('../types/finance').Frequency,
): number {
  const Frequency = {
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    BIWEEKLY: 'BIWEEKLY',
    MONTHLY: 'MONTHLY',
    QUARTERLY: 'QUARTERLY',
    ANNUALLY: 'ANNUALLY',
    ONE_TIME: 'ONE_TIME',
    IRREGULAR: 'IRREGULAR',
  } as const;

  switch (frequency) {
    case Frequency.DAILY:
      return amount * 30;
    case Frequency.WEEKLY:
      return amount * 4.33;
    case Frequency.BIWEEKLY:
      return amount * 2.17;
    case Frequency.MONTHLY:
      return amount;
    case Frequency.QUARTERLY:
      return amount / 3;
    case Frequency.ANNUALLY:
      return amount / 12;
    case Frequency.ONE_TIME:
    case Frequency.IRREGULAR:
      return 0; // Cannot convert one-time to monthly
    default:
      return amount;
  }
}
