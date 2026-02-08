'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

export type TimeMachineFrequency = 'daily' | 'weekly' | 'monthly';

export interface TimeMachineProjection {
  year: number;
  spent: number;
  invested: number;
}

export interface TimeMachineResult {
  totalSpent: number;
  investedValue: number;
  difference: number;
  projections: TimeMachineProjection[];
}

export function useTimeMachine() {
  const mutation = useMutation({
    mutationFn: async ({
      amount,
      frequency,
      years,
      returnRate,
    }: {
      amount: number;
      frequency: TimeMachineFrequency;
      years?: number;
      returnRate?: number;
    }) => {
      const res = await apiClient.post('/finance/time-machine', {
        amount,
        frequency,
        years,
        returnRate,
      });
      return unwrap<TimeMachineResult>(res);
    },
  });

  return {
    calculate: mutation.mutateAsync,
    isCalculating: mutation.isPending,
    result: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
