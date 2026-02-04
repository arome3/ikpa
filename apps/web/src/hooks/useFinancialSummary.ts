'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FinancialSummary } from '@/lib/mock/dashboard.mock';
import { fetchFinancialSummary } from '@/lib/mock/dashboard.mock';

// Query key factory
export const financialSummaryKeys = {
  all: ['financialSummary'] as const,
  current: () => [...financialSummaryKeys.all, 'current'] as const,
};

/**
 * Hook for fetching and caching the financial summary
 */
export function useFinancialSummary() {
  return useQuery<FinancialSummary>({
    queryKey: financialSummaryKeys.current(),
    queryFn: fetchFinancialSummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

/**
 * Hook for invalidating financial summary data
 */
export function useInvalidateFinancialSummary() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: financialSummaryKeys.all });
  };
}
