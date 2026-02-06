'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface MonetaryValue {
  amount: number;
  formatted: string;
  currency: string;
}

export interface BudgetStatus {
  category: string;
  categoryId: string;
  budgeted: MonetaryValue;
  spent: MonetaryValue;
  remaining: MonetaryValue;
  overagePercent: number;
  trigger: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';
  period: string;
}

export interface GoalImpact {
  goalId: string;
  goalName: string;
  goalAmount: MonetaryValue;
  goalDeadline: string;
  previousProbability: number;
  newProbability: number;
  probabilityDrop: number;
  message: string;
}

export interface MultiGoalImpact {
  primaryGoal: GoalImpact;
  otherGoals: GoalImpact[];
  summary: {
    totalGoalsAffected: number;
    averageProbabilityDrop: number;
    mostAffectedGoal: string;
    leastAffectedGoal: string;
  };
}

export interface RecoveryPath {
  id: string;
  name: string;
  description: string;
  newProbability: number;
  effort: 'Low' | 'Medium' | 'High';
  timelineImpact?: string;
  savingsImpact?: string;
  freezeDuration?: string;
}

export interface NonJudgmentalMessage {
  tone: 'Supportive';
  headline: string;
  subtext: string;
}

export interface RecoveryResponse {
  sessionId: string;
  budgetStatus: BudgetStatus;
  goalImpact: GoalImpact;
  multiGoalImpact?: MultiGoalImpact;
  recoveryPaths: RecoveryPath[];
  message: NonJudgmentalMessage;
}

export interface RecoverySession {
  id: string;
  userId: string;
  goalId: string;
  category: string;
  overspendAmount: number;
  previousProbability: number;
  newProbability: number;
  selectedPathId?: string;
  selectedAt?: string;
  status: 'PENDING' | 'PATH_SELECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  createdAt: string;
  updatedAt: string;
}

export interface SelectPathResponse {
  success: boolean;
  message: string;
  selectedPathId: string;
  selectedAt: string;
  details: {
    action: string;
    previousValue?: string;
    newValue?: string;
    duration?: string;
    categoryFrozen?: string;
    boostAmount?: number;
    newDeadline?: string;
    endDate?: string;
  };
  nextSteps: string[];
}

export interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  lastUpdated: string;
  frozenUntil?: string;
  isFrozen: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: string;
  isEarned: boolean;
}

export interface AchievementsResponse {
  earned: Achievement[];
  available: Achievement[];
  totalEarned: number;
  totalAvailable: number;
}

export interface WhatIfRequest {
  category: string;
  additionalSpend: number;
  goalId?: string;
}

export interface WhatIfResponse {
  category: string;
  simulatedAmount: number;
  budgetImpact: {
    budgetAmount: number;
    currentSpending: number;
    projectedSpending: number;
    currentPercentUsed: number;
    projectedPercentUsed: number;
    remainingAfterSpend: number;
  };
  probabilityImpact: {
    goalId: string;
    goalName: string;
    currentProbability: number;
    projectedProbability: number;
    probabilityChange: number;
    changePercentPoints: number;
  };
  triggerPreview: {
    wouldTrigger: boolean;
    triggerLevel?: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';
    description: string;
  };
  recoveryPreview?: RecoveryPath[];
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ActiveAdjustments {
  savingsBoost?: {
    id: string;
    boostPercentage: number;
    startDate: string;
    endDate: string;
    daysRemaining: number;
    isActive: boolean;
  };
  categoryFreezes: {
    id: string;
    categoryId: string;
    categoryName: string;
    startDate: string;
    endDate: string;
    daysRemaining: number;
    isActive: boolean;
  }[];
  timelineExtensions: {
    goalId: string;
    goalName: string;
    originalDeadline: string;
    newDeadline: string;
    extensionDays: number;
  }[];
  summary: {
    hasActiveBoost: boolean;
    activeFreezeCount: number;
    totalExtensionDays: number;
  };
}

// ============================================
// HOOK
// ============================================

export function useGps() {
  const queryClient = useQueryClient();

  // Get active adjustments
  const {
    data: activeAdjustments,
    isLoading: isLoadingAdjustments,
    error: adjustmentsError,
  } = useQuery({
    queryKey: ['gps', 'active-adjustments'],
    queryFn: async () => {
      return apiClient.get<ActiveAdjustments>('/gps/active-adjustments');
    },
  });

  // Get streaks
  const {
    data: streaks,
    isLoading: isLoadingStreaks,
    error: streaksError,
  } = useQuery({
    queryKey: ['gps', 'streaks'],
    queryFn: async () => {
      return apiClient.get<StreakStatus>('/gps/streaks');
    },
  });

  // Get achievements
  const {
    data: achievements,
    isLoading: isLoadingAchievements,
    error: achievementsError,
  } = useQuery({
    queryKey: ['gps', 'achievements'],
    queryFn: async () => {
      return apiClient.get<AchievementsResponse>('/gps/achievements');
    },
  });

  // Recalculate mutation
  const recalculateMutation = useMutation({
    mutationFn: async (data: { category: string; goalId?: string }) => {
      return apiClient.post<RecoveryResponse>('/gps/recalculate', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Get recovery paths
  const getRecoveryPaths = async (sessionId?: string) => {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return apiClient.get<{ paths: RecoveryPath[]; sessionId: string; category: string }>(
      `/gps/recovery-paths${params}`
    );
  };

  // Select path mutation
  const selectPathMutation = useMutation({
    mutationFn: async ({ pathId, sessionId }: { pathId: string; sessionId: string }) => {
      return apiClient.post<SelectPathResponse>(`/gps/recovery-paths/${pathId}/select`, {
        sessionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Get session
  const getSession = async (sessionId: string) => {
    return apiClient.get<RecoverySession & { progress?: { milestone: number; message: string } }>(
      `/gps/sessions/${sessionId}`
    );
  };

  // What-if simulation
  const whatIfMutation = useMutation({
    mutationFn: async (data: WhatIfRequest) => {
      return apiClient.post<WhatIfResponse>('/gps/what-if', data);
    },
  });

  // Check if category is frozen
  const checkCategoryFrozen = async (categoryId: string) => {
    return apiClient.get<{ isFrozen: boolean; freeze?: ActiveAdjustments['categoryFreezes'][0] }>(
      `/gps/active-adjustments/frozen/${categoryId}`
    );
  };

  return {
    // Active adjustments
    activeAdjustments,
    isLoadingAdjustments,
    adjustmentsError: adjustmentsError as ApiError | null,

    // Streaks
    streaks,
    isLoadingStreaks,
    streaksError: streaksError as ApiError | null,

    // Achievements
    achievements,
    isLoadingAchievements,
    achievementsError: achievementsError as ApiError | null,

    // Recalculate
    recalculate: recalculateMutation.mutateAsync,
    isRecalculating: recalculateMutation.isPending,
    recalculateData: recalculateMutation.data,

    // Recovery paths
    getRecoveryPaths,
    selectPath: selectPathMutation.mutateAsync,
    isSelectingPath: selectPathMutation.isPending,
    selectPathData: selectPathMutation.data,

    // Session
    getSession,

    // What-if
    simulateWhatIf: whatIfMutation.mutateAsync,
    isSimulating: whatIfMutation.isPending,
    whatIfData: whatIfMutation.data,

    // Utilities
    checkCategoryFrozen,
  };
}
