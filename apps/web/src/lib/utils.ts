import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS conflict resolution
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR' | 'GHS' | 'KES' | 'ZAR';

const currencySymbols: Record<CurrencyCode, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  GHS: '₵',
  KES: 'KSh',
  ZAR: 'R',
};

/**
 * Format a number as currency
 */
export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'NGN',
  options?: {
    compact?: boolean;
    showSign?: boolean;
  }
): string {
  const { compact = false, showSign = false } = options ?? {};

  const symbol = currencySymbols[currency] ?? currency;
  const sign = showSign && amount > 0 ? '+' : '';

  let formatted: string;

  if (compact && Math.abs(amount) >= 1_000_000) {
    formatted = (amount / 1_000_000).toFixed(1) + 'M';
  } else if (compact && Math.abs(amount) >= 1_000) {
    formatted = (amount / 1_000).toFixed(1) + 'K';
  } else {
    formatted = new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return `${sign}${symbol}${formatted}`;
}

/**
 * Format a date relatively (e.g., "2 days ago", "in 3 hours")
 */
export function formatDate(
  date: Date | string | number,
  options?: {
    relative?: boolean;
    format?: 'short' | 'medium' | 'long';
  }
): string {
  const { relative = true, format = 'medium' } = options ?? {};
  const d = new Date(date);
  const now = new Date();

  if (relative) {
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    // Future dates
    if (diffMs < 0) {
      const futureDays = Math.abs(diffDay);
      if (futureDays === 0) return 'Today';
      if (futureDays === 1) return 'Tomorrow';
      if (futureDays < 7) return `In ${futureDays} days`;
      if (futureDays < 30) return `In ${Math.ceil(futureDays / 7)} weeks`;
      return `In ${Math.ceil(futureDays / 30)} months`;
    }

    // Past dates
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    if (diffWeek < 4) return `${diffWeek} weeks ago`;
    if (diffMonth < 12) return `${diffMonth} months ago`;
    return `${Math.floor(diffMonth / 12)} years ago`;
  }

  // Absolute formatting
  const formatOptions: Intl.DateTimeFormatOptions =
    format === 'short'
      ? { month: 'short', day: 'numeric' }
      : format === 'long'
      ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };

  return d.toLocaleDateString('en-US', formatOptions);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trim() + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
