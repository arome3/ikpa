'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CashFlowScoreData } from '@/lib/mock/dashboard.mock';
import { fetchCashFlowScore } from '@/lib/mock/dashboard.mock';

// Query key factory
export const cashFlowScoreKeys = {
  all: ['cashFlowScore'] as const,
  current: () => [...cashFlowScoreKeys.all, 'current'] as const,
};

/**
 * Hook for fetching and caching the current cash flow score
 */
export function useCashFlowScore() {
  return useQuery<CashFlowScoreData>({
    queryKey: cashFlowScoreKeys.current(),
    queryFn: fetchCashFlowScore,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

/**
 * Hook for invalidating cash flow score data
 */
export function useInvalidateCashFlowScore() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: cashFlowScoreKeys.all });
  };
}
