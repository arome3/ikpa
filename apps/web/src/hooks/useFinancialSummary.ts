'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FinancialSummary } from '@/lib/mock/dashboard.mock';
import { apiClient } from '@/lib/api';
import { cashFlowScoreKeys } from './useCashFlowScore';

// Query key factory
export const financialSummaryKeys = {
  all: ['financialSummary'] as const,
  current: () => [...financialSummaryKeys.all, 'current'] as const,
};

interface SnapshotApiResponse {
  success: boolean;
  data: {
    cashFlowScore: number;
    savingsRate: number;
    runwayMonths: number;
    burnRate: number;
    netWorth: number;
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    totalDebt: number;
    totalAssets: number;
    currency: string;
  };
}

/**
 * Hook for fetching and caching the financial summary
 * Calls GET /finance/snapshot and transforms to FinancialSummary
 */
export function useFinancialSummary() {
  return useQuery<FinancialSummary>({
    queryKey: financialSummaryKeys.current(),
    queryFn: async () => {
      const res = await apiClient.get<SnapshotApiResponse>('/finance/snapshot');
      const d = (res as unknown as SnapshotApiResponse).data ?? (res as unknown as SnapshotApiResponse['data']);

      return {
        totalSaved: d.totalSavings ?? 0,
        totalSavedChange: 0,
        savingsRate: d.savingsRate ?? 0,
        savingsRateChange: 0,
        runway: d.runwayMonths ?? 0,
        runwayChange: 0,
        monthlyIncome: d.totalIncome ?? 0,
        monthlyIncomeChange: 0,
        monthlyExpenses: d.totalExpenses ?? 0,
        monthlyExpensesChange: 0,
        currency: d.currency ?? 'USD',
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
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

/**
 * Hook to force-refresh the financial snapshot.
 * Calls GET /finance/snapshot?force=true to delete the cached snapshot
 * and recalculate, then invalidates both summary and score queries.
 */
export function useRefreshSnapshot() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await apiClient.get('/finance/snapshot?force=true');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financialSummaryKeys.all }),
        queryClient.invalidateQueries({ queryKey: cashFlowScoreKeys.all }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  return { refresh, isRefreshing };
}
