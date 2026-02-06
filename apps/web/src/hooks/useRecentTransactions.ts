'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Transaction, TransactionCategory } from '@/lib/mock/dashboard.mock';
import { apiClient } from '@/lib/api';

// Query key factory
export const transactionKeys = {
  all: ['transactions'] as const,
  recent: (limit: number) => [...transactionKeys.all, 'recent', limit] as const,
};

interface UseRecentTransactionsOptions {
  limit?: number;
  enabled?: boolean;
}

interface ExpenseItem {
  id: string;
  description: string;
  amount: number | string;
  currency: string;
  date: string;
  categoryId: string;
  merchant?: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
  };
}

interface ExpensesApiResponse {
  success: boolean;
  data: {
    items: ExpenseItem[];
    count: number;
    totalAmount: number;
    byCategory: Record<string, unknown>;
  };
}

// Map API category slugs to frontend TransactionCategory
const categorySlugMap: Record<string, TransactionCategory> = {
  'food-dining': 'food',
  'food': 'food',
  'transportation': 'transport',
  'transport': 'transport',
  'entertainment': 'entertainment',
  'utilities': 'utilities',
  'shopping': 'shopping',
  'health-fitness': 'health',
  'health': 'health',
  'education': 'education',
  'salary': 'salary',
  'freelance': 'freelance',
  'gift': 'gift',
  'investment': 'investment',
};

function mapCategory(categoryId: string): TransactionCategory {
  return categorySlugMap[categoryId] ?? 'other';
}

/**
 * Hook for fetching and caching recent transactions (expenses)
 * Calls GET /finance/expenses and transforms to Transaction[]
 */
export function useRecentTransactions(options: UseRecentTransactionsOptions = {}) {
  const { limit = 5, enabled = true } = options;

  return useQuery<Transaction[]>({
    queryKey: transactionKeys.recent(limit),
    queryFn: async () => {
      const res = await apiClient.get<ExpensesApiResponse>(
        `/finance/expenses?limit=${limit}&page=1&sortBy=date&sortOrder=desc`
      );
      const d = (res as unknown as ExpensesApiResponse).data ?? (res as unknown as ExpensesApiResponse['data']);

      if (!d?.items?.length) return [];

      return d.items.map((item): Transaction => ({
        id: item.id,
        description: item.description,
        amount: typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount,
        type: 'expense',
        category: mapCategory(item.categoryId),
        date: item.date,
        merchant: item.merchant ?? item.category?.name,
      }));
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
    retry: 1,
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
