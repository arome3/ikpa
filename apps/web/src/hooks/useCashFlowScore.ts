'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CashFlowScoreData } from '@/lib/mock/dashboard.mock';
import { getScoreStatus } from '@/lib/mock/dashboard.mock';
import { apiClient } from '@/lib/api';

// Query key factory
export const cashFlowScoreKeys = {
  all: ['cashFlowScore'] as const,
  current: () => [...cashFlowScoreKeys.all, 'current'] as const,
};

interface ScoreApiResponse {
  success: boolean;
  data: {
    finalScore: number;
    previousScore?: number;
    change?: number;
    label?: string;
    timestamp: string;
    components: Record<string, { value: number; score: number }>;
    calculation: string;
  };
}

/**
 * Hook for fetching and caching the current cash flow score
 * Calls GET /finance/score and transforms to CashFlowScoreData
 */
export function useCashFlowScore() {
  return useQuery<CashFlowScoreData>({
    queryKey: cashFlowScoreKeys.current(),
    queryFn: async () => {
      const res = await apiClient.get<ScoreApiResponse>('/finance/score');
      const d = (res as unknown as ScoreApiResponse).data ?? (res as unknown as ScoreApiResponse['data']);

      const score = d.finalScore ?? 0;
      const previousScore = d.previousScore ?? score;

      return {
        score,
        previousScore,
        status: getScoreStatus(score),
        lastUpdated: d.timestamp ?? new Date().toISOString(),
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
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
