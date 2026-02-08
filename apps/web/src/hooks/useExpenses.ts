'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

// ============================================
// TYPES
// ============================================

export interface Expense {
  id: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  amount: number;
  currency: string;
  description?: string;
  merchant?: string;
  date: string;
  isRecurring: boolean;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseData {
  categoryId: string;
  amount: number;
  currency?: string;
  description?: string;
  merchant?: string;
  date?: string;
  isRecurring?: boolean;
}

export interface ExpenseListResponse {
  items: Expense[];
  count: number;
  totalAmount: number;
  byCategory: {
    categoryId: string;
    categoryName: string;
    total: number;
    count: number;
  }[];
}

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  minAmount?: number;
  maxAmount?: number;
}

// ============================================
// HOOK
// ============================================

export function useExpenses(filters?: ExpenseFilters) {
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters?.startDate) queryParams.set('startDate', filters.startDate);
  if (filters?.endDate) queryParams.set('endDate', filters.endDate);
  if (filters?.categoryId) queryParams.set('categoryId', filters.categoryId);
  if (filters?.minAmount) queryParams.set('minAmount', String(filters.minAmount));
  if (filters?.maxAmount) queryParams.set('maxAmount', String(filters.maxAmount));

  const queryString = queryParams.toString();
  const endpoint = `/finance/expenses${queryString ? `?${queryString}` : ''}`;

  // List expenses
  const {
    data: listData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['finance', 'expenses', filters],
    queryFn: async () => {
      const res = await apiClient.get(endpoint);
      return unwrap<ExpenseListResponse>(res);
    },
  });

  // Get by ID
  const getById = async (id: string): Promise<Expense> => {
    const res = await apiClient.get(`/finance/expenses/${id}`);
    return unwrap<Expense>(res);
  };

  // Create
  const createMutation = useMutation({
    mutationFn: async (data: CreateExpenseData) => {
      const res = await apiClient.post('/finance/expenses', data);
      return unwrap<Expense>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['cashFlowScore'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateExpenseData> }) => {
      const res = await apiClient.patch(`/finance/expenses/${id}`, data);
      return unwrap<Expense>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['cashFlowScore'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['cashFlowScore'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
    },
  });

  return {
    // List data
    expenses: listData?.items ?? [],
    totalAmount: listData?.totalAmount ?? 0,
    byCategory: listData?.byCategory ?? [],
    count: listData?.count ?? 0,
    isLoading,
    error: error as ApiError | null,
    refetch,

    // Operations
    getById,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    delete: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

// ============================================
// EXPENSE NUDGE HOOK (AI Spending Coach)
// ============================================

export interface SpendingNudge {
  id: string;
  expenseId: string;
  nudge: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

/**
 * Polls for an AI spending nudge after expense creation.
 * Retries up to 3 times at 1.5s intervals.
 */
export function useExpenseNudge(expenseId: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['expense-nudge', expenseId],
    queryFn: async () => {
      const res = await apiClient.get(`/gps/nudge/latest/${expenseId}`);
      return unwrap<SpendingNudge>(res);
    },
    enabled: !!expenseId,
    refetchInterval: (query) => {
      // Stop polling after getting data or after 3 attempts
      if (query.state.data) return false;
      if ((query.state.dataUpdateCount ?? 0) >= 3) return false;
      return 1500;
    },
    retry: false,
    staleTime: Infinity,
  });

  return {
    nudge: data ?? null,
    isLoading: isLoading && !!expenseId,
  };
}
