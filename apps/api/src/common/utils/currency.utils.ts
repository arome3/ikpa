/**
 * Currency Formatting Utilities
 *
 * Provides currency formatting for African currencies and common international currencies.
 */

/**
 * Currency symbols map
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
  EGP: 'E£',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Format a number with commas as thousand separators
 */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Format a monetary value with currency symbol
 *
 * @param amount - The amount to format
 * @param currency - Currency code (e.g., 'NGN', 'USD')
 * @returns Formatted string like "₦50,000" or "$1,234"
 */
export function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const formatted = formatNumber(amount);
  return `${symbol}${formatted}`;
}

/**
 * Create a monetary value object with both raw and formatted values
 *
 * @param amount - The amount
 * @param currency - Currency code
 * @returns Object with amount and formatted string
 */
export function createMonetaryValue(
  amount: number,
  currency: string,
): { amount: number; formatted: string; currency: string } {
  return {
    amount,
    formatted: formatCurrency(amount, currency),
    currency,
  };
}

/**
 * Format a percentage value
 *
 * @param value - Decimal value (e.g., 0.75 for 75%)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string like "75%"
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  const percentage = value * 100;
  return `${percentage.toFixed(decimals)}%`;
}
