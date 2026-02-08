'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

// Types
export interface OpikDashboardData {
  overview: {
    totalTraces: number;
    avgScore: number;
    activeExperiments: number;
    evaluationsRun: number;
  };
  recentTraces: Array<{
    name: string;
    count: number;
    avgDuration: number;
  }>;
}

export interface OpikMetric {
  name: string;
  displayName: string;
  description: string;
  type: string;
  currentAvg: number;
  sampleSize: number;
}

export interface OpikExperiment {
  id: string;
  type: string;
  name: string;
  description: string;
  status: string;
  startedAt: string;
  completedAt: string;
  result: Record<string, unknown>;
}

export interface OpikExperimentDetail {
  experiment: OpikExperiment;
  comparison?: {
    variantA: { label: string; scores: Record<string, number> };
    variantB: { label: string; scores: Record<string, number> };
  };
}

export interface EvalResult {
  totalScenarios: number;
  passed: number;
  failed: number;
  avgScore: number;
  results: Array<{
    scenario: string;
    score: number;
    passed: boolean;
  }>;
}

// Hooks
export function useOpikDashboard() {
  return useQuery({
    queryKey: ['opik', 'dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/opik/dashboard');
      return unwrap<OpikDashboardData>(res);
    },
  });
}

export function useOpikMetrics() {
  return useQuery({
    queryKey: ['opik', 'metrics'],
    queryFn: async () => {
      const res = await apiClient.get('/opik/metrics');
      return unwrap<OpikMetric[]>(res);
    },
  });
}

export function useOpikExperiments() {
  return useQuery({
    queryKey: ['opik', 'experiments'],
    queryFn: async () => {
      const res = await apiClient.get('/opik/experiments');
      return unwrap<OpikExperiment[]>(res);
    },
  });
}

export function useOpikExperimentDetail(id: string | null) {
  return useQuery({
    queryKey: ['opik', 'experiments', id],
    queryFn: async () => {
      const res = await apiClient.get(`/opik/experiments/${id}`);
      return unwrap<OpikExperimentDetail>(res);
    },
    enabled: !!id,
  });
}

export function useRunGpsEval() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/opik/eval/gps', {});
      return unwrap<EvalResult>(res);
    },
  });
}

export function useRunCommitmentEval() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/opik/eval/commitment', {});
      return unwrap<EvalResult>(res);
    },
  });
}

export function useOptimizationHistory() {
  return useQuery({
    queryKey: ['opik', 'optimizers', 'letter', 'history'],
    queryFn: async () => {
      const res = await apiClient.get('/opik/optimizers/letter/history');
      return unwrap<Array<{ generation: number; fitness: number; prompt: string }>>(res);
    },
  });
}
