'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction } from '@/lib/mock/dashboard.mock';
import { fetchRecentTransactions } from '@/lib/mock/dashboard.mock';

// Query key factory
export const transactionKeys = {
  all: ['transactions'] as const,
  recent: (limit: number) => [...transactionKeys.all, 'recent', limit] as const,
};

interface UseRecentTransactionsOptions {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching and caching recent transactions
 */
export function useRecentTransactions(options: UseRecentTransactionsOptions = {}) {
  const { limit = 5, enabled = true } = options;

  return useQuery<Transaction[]>({
    queryKey: transactionKeys.recent(limit),
    queryFn: () => fetchRecentTransactions(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes (transactions change more frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    enabled,
  });
}

/**
 * Hook for invalidating transaction data
 */
export function useInvalidateTransactions() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: transactionKeys.all });
  };
}
