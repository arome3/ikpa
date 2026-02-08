'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

// Income
export interface Income {
  id: string;
  name: string;
  type: 'SALARY' | 'FREELANCE' | 'BUSINESS' | 'INVESTMENT' | 'RENTAL' | 'GIFT' | 'OTHER';
  amount: number;
  currency: string;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'ONE_TIME';
  variancePercentage: number;
  description?: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncomeData {
  name: string;
  type: Income['type'];
  amount: number;
  currency?: string;
  frequency: Income['frequency'];
  variancePercentage?: number;
  description?: string;
}

// Savings
export interface Savings {
  id: string;
  name: string;
  type: 'BANK_ACCOUNT' | 'MOBILE_MONEY' | 'CASH' | 'FIXED_DEPOSIT' | 'AJO_SUSU' | 'COOPERATIVE' | 'OTHER';
  balance: number;
  currency: string;
  interestRate?: number;
  institution?: string;
  accountNumber?: string;
  description?: string;
  isEmergencyFund: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavingsData {
  name: string;
  type: Savings['type'];
  balance: number;
  currency?: string;
  interestRate?: number;
  institution?: string;
  accountNumber?: string;
  description?: string;
  isEmergencyFund?: boolean;
}

// Investment
export interface Investment {
  id: string;
  name: string;
  type: 'STOCKS' | 'BONDS' | 'MUTUAL_FUNDS' | 'ETF' | 'REAL_ESTATE' | 'CRYPTO' | 'PENSION' | 'OTHER';
  currentValue: number;  // API returns as 'value' but we alias it
  purchaseValue: number; // API returns as 'costBasis' but we alias it
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  currency: string;
  institution?: string;
  description?: string;
  purchaseDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  unrealizedGain?: number;
}

export interface CreateInvestmentData {
  name: string;
  type: Investment['type'];
  currentValue: number;
  purchaseValue: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  currency?: string;
  institution?: string;
  description?: string;
  purchaseDate?: string;
}

// Debt
export interface Debt {
  id: string;
  name: string;
  type: 'BANK_LOAN' | 'CREDIT_CARD' | 'BNPL' | 'PERSONAL_LOAN' | 'MORTGAGE' | 'STUDENT_LOAN' | 'BUSINESS_LOAN' | 'OTHER';
  originalAmount: number;
  currentBalance: number; // Mapped from remainingBalance
  currency: string;
  interestRate: number;
  minimumPayment: number;
  dueDate?: string;
  lender?: string; // Mapped from institution
  description?: string; // Mapped from notes
  startDate: string;
  targetPayoffDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  percentPaidOff?: number;
}

export interface CreateDebtData {
  name: string;
  type: Debt['type'];
  originalAmount: number;
  currentBalance: number;
  currency?: string;
  interestRate: number;
  minimumPayment: number;
  dueDate?: string;
  lender?: string;
  description?: string;
  startDate?: string;
  targetPayoffDate?: string;
}

// Goal
export interface Goal {
  id: string;
  name: string;
  type: 'EMERGENCY_FUND' | 'SAVINGS' | 'INVESTMENT' | 'DEBT_PAYOFF' | 'MAJOR_PURCHASE' | 'EDUCATION' | 'TRAVEL' | 'FAMILY' | 'BUSINESS' | 'RETIREMENT' | 'OTHER';
  targetAmount: number;
  currentAmount: number;
  currency: string;
  description?: string;
  targetDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  progressPercent?: number;
  remainingAmount?: number;
}

export interface CreateGoalData {
  name: string;
  type: Goal['type'];
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  description?: string;
  targetDate?: string;
  priority?: Goal['priority'];
}

export interface ContributeGoalData {
  amount: number;
  note?: string;
}

// Budget
export interface Budget {
  id: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  amount: number;
  currency: string;
  period: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  alertThreshold?: number;
  startDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  spent?: number;
  remaining?: number;
  percentUsed?: number;
}

export interface CreateBudgetData {
  categoryId: string;
  amount: number;
  period: Budget['period'];
  alertThreshold?: number;
  currency?: string;
  startDate?: string;
}

// Category
export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
}

// List Response Types
export interface IncomeListResponse {
  items: Income[];
  count: number;
  totalMonthly: number;
}

export interface SavingsListResponse {
  items: Savings[];
  count: number;
  totalBalance: number;
  emergencyFundTotal: number;
}

export interface InvestmentListResponse {
  items: Investment[];
  count: number;
  totalValue: number;
  totalUnrealizedGain: number;
}

export interface DebtListResponse {
  items: Debt[];
  count: number;
  totalRemainingBalance: number;
  totalMinimumPayments: number;
}

export interface GoalListResponse {
  items: Goal[];
  count: number;
  totalTarget: number;
  totalCurrent: number;
  overallProgress: number;
}

export interface BudgetListResponse {
  items: Budget[];
  count: number;
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
}

// ============================================
// GENERIC CRUD HOOK FACTORY
// ============================================

// Unwrap API envelope { success, data } → data
function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

function createFinanceHook<
  TItem,
  TListResponse extends { items: TItem[] },
  TCreateData,
  TUpdateData = Partial<TCreateData>
>(endpoint: string, queryKey: string) {
  return function useFinanceEntity() {
    const queryClient = useQueryClient();

    // List
    const {
      data: listData,
      isLoading: isLoadingList,
      error: listError,
      refetch: refetchList,
    } = useQuery({
      queryKey: ['finance', queryKey],
      queryFn: async () => {
        const res = await apiClient.get(`/finance/${endpoint}`);
        return unwrap<TListResponse>(res);
      },
    });

    // Get by ID
    const getById = async (id: string): Promise<TItem> => {
      const res = await apiClient.get(`/finance/${endpoint}/${id}`);
      return unwrap<TItem>(res);
    };

    // Create
    const createMutation = useMutation({
      mutationFn: async (data: TCreateData) => {
        const res = await apiClient.post(`/finance/${endpoint}`, data);
        return unwrap<TItem>(res);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['finance', queryKey] });
        queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      },
    });

    // Update
    const updateMutation = useMutation({
      mutationFn: async ({ id, data }: { id: string; data: TUpdateData }) => {
        const res = await apiClient.patch(`/finance/${endpoint}/${id}`, data);
        return unwrap<TItem>(res);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['finance', queryKey] });
      },
    });

    // Delete
    const deleteMutation = useMutation({
      mutationFn: async (id: string) => {
        await apiClient.delete(`/finance/${endpoint}/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['finance', queryKey] });
        queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      },
    });

    return {
      // List data
      items: listData?.items ?? [],
      listData,
      isLoading: isLoadingList,
      error: listError as ApiError | null,
      refetch: refetchList,

      // Operations
      getById,
      create: createMutation.mutateAsync,
      isCreating: createMutation.isPending,
      update: updateMutation.mutateAsync,
      isUpdating: updateMutation.isPending,
      delete: deleteMutation.mutateAsync,
      isDeleting: deleteMutation.isPending,
    };
  };
}

// ============================================
// SPECIFIC HOOKS
// ============================================

export const useIncome = createFinanceHook<Income, IncomeListResponse, CreateIncomeData>(
  'income',
  'income'
);

export const useSavings = createFinanceHook<Savings, SavingsListResponse, CreateSavingsData>(
  'savings',
  'savings'
);

export const useInvestments = createFinanceHook<Investment, InvestmentListResponse, CreateInvestmentData>(
  'investments',
  'investments'
);

// Custom hook for debts — maps between frontend-friendly field names
// (currentBalance, lender, description) and backend API field names
// (remainingBalance, institution, notes).
export const useDebts = () => {
  const queryClient = useQueryClient();

  // Map API response → frontend Debt
  const mapFromApi = (raw: Record<string, unknown>): Debt => ({
    id: raw.id as string,
    name: raw.name as string,
    type: raw.type as Debt['type'],
    originalAmount: raw.originalAmount as number,
    currentBalance: raw.remainingBalance as number,
    currency: raw.currency as string,
    interestRate: raw.interestRate as number,
    minimumPayment: raw.minimumPayment as number,
    dueDate: raw.dueDate != null ? String(raw.dueDate) : undefined,
    lender: (raw.institution as string) ?? undefined,
    description: (raw.notes as string) ?? undefined,
    startDate: raw.startDate as string,
    targetPayoffDate: (raw.targetPayoffDate as string) ?? undefined,
    isActive: raw.isActive as boolean,
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
    percentPaidOff: raw.percentPaidOff as number | undefined,
  });

  // Map frontend CreateDebtData → backend API fields
  const mapToApi = (data: Partial<CreateDebtData>): Record<string, unknown> => {
    const mapped: Record<string, unknown> = {};
    if (data.name !== undefined) mapped.name = data.name;
    if (data.type !== undefined) mapped.type = data.type;
    if (data.originalAmount !== undefined) mapped.originalAmount = data.originalAmount;
    if (data.currentBalance !== undefined) mapped.remainingBalance = data.currentBalance;
    if (data.interestRate !== undefined) mapped.interestRate = data.interestRate;
    if (data.minimumPayment !== undefined) mapped.minimumPayment = data.minimumPayment;
    if (data.currency !== undefined) mapped.currency = data.currency;
    if (data.lender !== undefined) mapped.institution = data.lender;
    if (data.description !== undefined) mapped.notes = data.description;
    if (data.startDate !== undefined) mapped.startDate = data.startDate;
    if (data.targetPayoffDate !== undefined) mapped.targetPayoffDate = data.targetPayoffDate;
    // dueDate: frontend may send date string; backend expects day-of-month integer (1-31)
    if (data.dueDate !== undefined && data.dueDate) {
      if (data.dueDate.includes('-')) {
        mapped.dueDate = new Date(data.dueDate).getDate();
      } else {
        const parsed = parseInt(data.dueDate, 10);
        if (!isNaN(parsed)) mapped.dueDate = parsed;
      }
    }
    return mapped;
  };

  // List
  const {
    data: listData,
    isLoading: isLoadingList,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['finance', 'debts'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/debts');
      const raw = unwrap<{ items: Record<string, unknown>[]; count: number; totalRemainingBalance: number; totalMinimumPayments: number }>(res);
      return {
        items: raw.items.map(mapFromApi),
        count: raw.count,
        totalRemainingBalance: raw.totalRemainingBalance,
        totalMinimumPayments: raw.totalMinimumPayments,
      } as DebtListResponse;
    },
  });

  // Get by ID
  const getById = async (id: string): Promise<Debt> => {
    const res = await apiClient.get(`/finance/debts/${id}`);
    return mapFromApi(unwrap<Record<string, unknown>>(res));
  };

  // Create
  const createMutation = useMutation({
    mutationFn: async (data: CreateDebtData) => {
      const apiData = mapToApi(data);
      // Auto-generate startDate if not provided (backend requires it)
      if (!apiData.startDate) {
        apiData.startDate = new Date().toISOString().split('T')[0];
      }
      const res = await apiClient.post('/finance/debts', apiData);
      return mapFromApi(unwrap<Record<string, unknown>>(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'debts'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateDebtData> }) => {
      const res = await apiClient.patch(`/finance/debts/${id}`, mapToApi(data));
      return mapFromApi(unwrap<Record<string, unknown>>(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'debts'] });
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/debts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'debts'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  return {
    items: listData?.items ?? [],
    listData,
    isLoading: isLoadingList,
    error: listError as ApiError | null,
    refetch: refetchList,
    getById,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    delete: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};

// Custom hook for goals — maps between frontend field names
// (type, priority as string) and backend API field names
// (category, priority as integer 0-100).
export const useGoals = () => {
  const queryClient = useQueryClient();

  // Priority: frontend string ↔ backend integer
  const priorityToApi = (p?: string): number | undefined => {
    if (!p) return undefined;
    switch (p) {
      case 'HIGH': return 1;
      case 'MEDIUM': return 50;
      case 'LOW': return 100;
      default: return 50;
    }
  };
  const priorityFromApi = (p: number): Goal['priority'] => {
    if (p <= 33) return 'HIGH';
    if (p <= 66) return 'MEDIUM';
    return 'LOW';
  };

  // Map API response → frontend Goal
  const mapFromApi = (raw: Record<string, unknown>): Goal => ({
    id: raw.id as string,
    name: raw.name as string,
    type: (raw.category as Goal['type']) ?? (raw.type as Goal['type']),
    targetAmount: raw.targetAmount as number,
    currentAmount: raw.currentAmount as number,
    currency: raw.currency as string,
    description: (raw.description as string) ?? undefined,
    targetDate: (raw.targetDate as string) ?? undefined,
    priority: typeof raw.priority === 'number' ? priorityFromApi(raw.priority) : (raw.priority as Goal['priority']) ?? 'MEDIUM',
    status: raw.status as Goal['status'],
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
    progressPercent: raw.progressPercent as number | undefined,
    remainingAmount: raw.remainingAmount as number | undefined,
  });

  // Map frontend CreateGoalData → backend API fields
  const mapToApi = (data: Partial<CreateGoalData>): Record<string, unknown> => {
    const mapped: Record<string, unknown> = {};
    if (data.name !== undefined) mapped.name = data.name;
    if (data.type !== undefined) mapped.category = data.type;
    if (data.targetAmount !== undefined) mapped.targetAmount = data.targetAmount;
    if (data.currentAmount !== undefined) mapped.currentAmount = data.currentAmount;
    if (data.currency !== undefined) mapped.currency = data.currency;
    if (data.description !== undefined) mapped.description = data.description;
    if (data.targetDate !== undefined) mapped.targetDate = data.targetDate;
    if (data.priority !== undefined) mapped.priority = priorityToApi(data.priority);
    return mapped;
  };

  // List
  const {
    data: listData,
    isLoading: isLoadingList,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['finance', 'goals'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/goals');
      const raw = unwrap<{ items: Record<string, unknown>[]; count: number; totalTarget: number; totalCurrent: number; overallProgress: number }>(res);
      return {
        items: raw.items.map(mapFromApi),
        count: raw.count,
        totalTarget: raw.totalTarget,
        totalCurrent: raw.totalCurrent,
        overallProgress: raw.overallProgress,
      } as GoalListResponse;
    },
  });

  // Get by ID
  const getById = async (id: string): Promise<Goal> => {
    const res = await apiClient.get(`/finance/goals/${id}`);
    return mapFromApi(unwrap<Record<string, unknown>>(res));
  };

  // Create
  const createMutation = useMutation({
    mutationFn: async (data: CreateGoalData) => {
      const res = await apiClient.post('/finance/goals', mapToApi(data));
      return mapFromApi(unwrap<Record<string, unknown>>(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateGoalData> }) => {
      const res = await apiClient.patch(`/finance/goals/${id}`, mapToApi(data));
      return mapFromApi(unwrap<Record<string, unknown>>(res));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'goals'] });
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/finance/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  // Contribute mutation (goal-specific)
  const contributeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContributeGoalData }) => {
      const res = await apiClient.post(`/finance/goals/${id}/contribute`, data);
      return unwrap(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'goals'] });
    },
  });

  return {
    items: listData?.items ?? [],
    listData,
    isLoading: isLoadingList,
    error: listError as ApiError | null,
    refetch: refetchList,
    getById,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    delete: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    contribute: contributeMutation.mutateAsync,
    isContributing: contributeMutation.isPending,
  };
};

export const useBudgets = createFinanceHook<Budget, BudgetListResponse, CreateBudgetData>(
  'budgets',
  'budgets'
);

// Categories hook
export function useCategories() {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['finance', 'categories'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/categories');
      return unwrap<ExpenseCategory[]>(res);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - categories rarely change
  });

  return {
    categories: data ?? [],
    isLoading,
    error: error as ApiError | null,
  };
}
