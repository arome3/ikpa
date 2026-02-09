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

// Raw API response shapes
interface DashboardApiResponse {
  system: Record<string, unknown>;
  opik: Record<string, unknown>;
  metrics: { count: number; registered: Array<Record<string, unknown>> };
  experiments: { recent: Array<Record<string, unknown>>; stats: Record<string, number> };
  optimizers: Record<string, unknown>;
  evalRunners: Array<Record<string, unknown>>;
}

interface MetricsApiResponse {
  count: number;
  metrics: Array<Record<string, unknown>>;
}

interface ExperimentsApiResponse {
  count: number;
  experiments: Array<Record<string, unknown>>;
}

interface LetterHistoryApiResponse {
  optimizer: string;
  description: string;
  experiments: Array<Record<string, unknown>>;
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
      const raw = unwrap<DashboardApiResponse>(await apiClient.get('/opik/dashboard'));
      return {
        overview: {
          totalTraces: 0,
          avgScore: 0,
          activeExperiments: raw.experiments?.stats?.running ?? raw.experiments?.recent?.length ?? 0,
          evaluationsRun: raw.experiments?.stats?.completed ?? 0,
        },
        recentTraces: [],
      } as OpikDashboardData;
    },
  });
}

export function useOpikMetrics() {
  return useQuery({
    queryKey: ['opik', 'metrics'],
    queryFn: async () => {
      const raw = unwrap<MetricsApiResponse>(await apiClient.get('/opik/metrics'));
      return (raw.metrics ?? []) as unknown as OpikMetric[];
    },
  });
}

export function useOpikExperiments() {
  return useQuery({
    queryKey: ['opik', 'experiments'],
    queryFn: async () => {
      const raw = unwrap<ExperimentsApiResponse>(await apiClient.get('/opik/experiments'));
      return (raw.experiments ?? []) as unknown as OpikExperiment[];
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
      const raw = unwrap<{ report: { summary: Record<string, unknown>; scenarios: Array<Record<string, unknown>> } }>(
        await apiClient.post('/opik/eval/gps', {}),
      );
      const report = raw.report;
      return {
        totalScenarios: (report.summary?.total as number) ?? report.scenarios?.length ?? 0,
        passed: (report.summary?.passed as number) ?? 0,
        failed: (report.summary?.failed as number) ?? 0,
        avgScore: (report.summary?.passRate as number) ?? 0,
        results: (report.scenarios ?? []).map((s) => ({
          scenario: (s.scenarioName as string) ?? '',
          score: (s.toneScore as number) ?? 0,
          passed: (s.passed as boolean) ?? false,
        })),
      } as EvalResult;
    },
  });
}

export function useRunCommitmentEval() {
  return useMutation({
    mutationFn: async () => {
      const raw = unwrap<{ report: Record<string, unknown> }>(
        await apiClient.post('/opik/eval/commitment', {}),
      );
      const report = raw.report;
      return {
        totalScenarios: (report.totalScenarios as number) ?? 0,
        passed: (report.passed as number) ?? 0,
        failed: (report.failed as number) ?? 0,
        avgScore: (report.passRate as number) ?? 0,
        results: ((report.scenarios as Array<Record<string, unknown>>) ?? []).map((s) => ({
          scenario: (s.scenarioName as string) ?? '',
          score: Object.values((s.scores as Record<string, number>) ?? {}).reduce((a, b) => a + b, 0) / Math.max(Object.keys((s.scores as Record<string, number>) ?? {}).length, 1),
          passed: (s.passed as boolean) ?? false,
        })),
      } as EvalResult;
    },
  });
}

export function useOptimizationHistory() {
  return useQuery({
    queryKey: ['opik', 'optimizers', 'letter', 'history'],
    queryFn: async () => {
      const raw = unwrap<LetterHistoryApiResponse>(await apiClient.get('/opik/optimizers/letter/history'));
      return (raw.experiments ?? []).map((exp, i) => ({
        generation: i + 1,
        fitness: (exp.fitnessScore as number) ?? 0,
        prompt: (exp.hypothesis as string) ?? '',
      }));
    },
  });
}
