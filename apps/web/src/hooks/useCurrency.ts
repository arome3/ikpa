'use client';

import { useAuthStore } from '@/stores/auth.store';
import { getCurrencySymbol } from '@/lib/utils';

/**
 * Returns the user's currency code and symbol.
 * Reads from auth store (set during login from backend User.currency).
 * Falls back to 'USD' if not set.
 */
export function useCurrency() {
  const currency = useAuthStore((s) => s.user?.currency ?? 'USD');
  const symbol = getCurrencySymbol(currency);

  return { currency, symbol };
}
