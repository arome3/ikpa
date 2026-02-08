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
  projectedDate?: string;
  humanReadable?: string;
  scheduleStatus?: string;
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
  newProbability: number | null;
  effort: 'None' | 'Low' | 'Medium' | 'High';
  timelineImpact?: string;
  savingsImpact?: string;
  freezeDuration?: string;
  rebalanceInfo?: {
    fromCategory: string;
    fromCategoryId: string;
    availableSurplus: number;
    coverageAmount: number;
    isFullCoverage: boolean;
  };
  concreteActions?: string[];
  budgetImpact?: string;
  timelineEffect?: string;
}

export interface NonJudgmentalMessage {
  tone: 'Supportive';
  headline: string;
  subtext: string;
}

export interface CommitmentAtRisk {
  hasActiveCommitment: boolean;
  contracts: Array<{
    id: string;
    goalId: string;
    goalName: string;
    stakeType: string;
    stakeAmount: number | null;
    daysRemaining: number;
  }>;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  totalStakeAtRisk: number;
  message: string;
}

export interface RecoveryResponse {
  sessionId: string;
  budgetStatus: BudgetStatus;
  goalImpact: GoalImpact | null;
  multiGoalImpact?: MultiGoalImpact;
  recoveryPaths: RecoveryPath[];
  message: NonJudgmentalMessage;
  commitmentAtRisk?: CommitmentAtRisk;
}

export interface RecoverySession {
  id: string;
  userId: string;
  goalId: string | null;
  goalName?: string;
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
  } | null;
  triggerPreview: {
    wouldTrigger: boolean;
    triggerLevel?: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL';
    description: string;
  };
  recoveryPreview?: RecoveryPath[];
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SpendingVelocityResponse {
  category: string;
  categoryId: string;
  velocity: {
    ratio: number;
    status: 'on_pace' | 'slightly_ahead' | 'significantly_ahead';
    dailySpendingRate: MonetaryValue;
    safeDailyRate: MonetaryValue;
    courseCorrectionDaily: MonetaryValue;
  } | null;
  timeline: {
    daysElapsed: number;
    daysRemaining: number;
    projectedOverspendDate: string | null;
    willOverspend: boolean;
  };
  budget: {
    budgeted: MonetaryValue;
    spent: MonetaryValue;
    remaining: MonetaryValue;
  };
  recommendations: string[];
  message?: string;
  error?: string;
}



// ============================================
// QUICK REBALANCE TYPES
// ============================================

export interface QuickRebalanceRequest {
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
}

export interface QuickRebalanceResponse {
  fromCategory: string;
  toCategory: string;
  amount: MonetaryValue;
  fromRemaining: MonetaryValue;
  toNewRemaining: MonetaryValue;
  message: string;
}

export interface RebalanceOption {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  spent: number;
  surplus: number;
  proratedSurplus: number;
  currency: string;
}

export interface RebalanceOptionsResponse {
  options: RebalanceOption[];
  rebalancesUsed: number;
  maxRebalances: number;
  canRebalance: boolean;
}



export type ForecastRiskLevel = 'safe' | 'caution' | 'warning';

export interface BudgetForecast {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  spent: number;
  projectedTotal: number;
  projectedOverage: number;
  daysUntilExceed: number | null;
  suggestedDailyLimit: number;
  riskLevel: ForecastRiskLevel;
  currency: string;
}

export interface ForecastResponse {
  forecasts: BudgetForecast[];
  atRiskCount: number;
  totalCategories: number;
}

// ============================================
// RECOVERY TRACKING TYPES
// ============================================

export interface RecoveryProgressResponse {
  sessionId: string;
  pathId: string;
  pathName: string;
  startDate: string;
  endDate: string;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  adherence: number;
  status: 'on_track' | 'at_risk' | 'completed' | 'failed';
  actualSaved: number;
  targetSaved: number;
  message: string;
}

export interface RecoveryHistoryEntry {
  date: string;
  category: string;
  pathChosen: string;
  target: number;
  actual: number;
  success: boolean;
}

export interface SpendingBreakdownResponse {
  categoryId: string;
  categoryName: string;
  totalSpent: number;
  budgeted: number;
  breakdown: Array<{
    label: string;
    amount: number;
    percent: number;
    count: number;
  }>;
  insight: string;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface PathSelectionDistribution {
  pathId: string;
  pathName: string;
  count: number;
  percentage: number;
}

export interface GoalSurvivalMetrics {
  totalSlips: number;
  recovered: number;
  abandoned: number;
  pending: number;
  survivalRate: number;
}

export interface TimeDistribution {
  under1Hour: number;
  hours1to6: number;
  hours6to24: number;
  over24Hours: number;
}

export interface TimeToRecoveryMetrics {
  averageHours: number;
  medianHours: number;
  minHours: number;
  maxHours: number;
  distribution: TimeDistribution;
}

export interface ProbabilityRestorationMetrics {
  averageDropPercent: number;
  averageRestoredPercent: number;
  fullyRestoredCount: number;
  partiallyRestoredCount: number;
  restorationRate: number;
}

export interface AnalyticsDashboard {
  period: { start: string; end: string };
  pathSelection: PathSelectionDistribution[];
  goalSurvival: GoalSurvivalMetrics;
  timeToRecovery: TimeToRecoveryMetrics;
  probabilityRestoration: ProbabilityRestorationMetrics;
  totalSessions: number;
  totalBudgetThresholdsCrossed: number;
}

export interface PreferredPath {
  id: string;
  name: string;
  usageCount: number;
}

export interface UserAnalytics {
  totalSlips: number;
  recoveryRate: number;
  recoveryRateFormatted: string;
  preferredPath: PreferredPath | null;
  averageTimeToRecovery: { hours: number; formatted: string };
  totalProbabilityRestored: number;
}

export interface MostSelectedPath {
  id: string;
  name: string;
  count: number;
}

export interface CategoryAnalytics {
  category: string;
  categoryId: string;
  totalSlips: number;
  recoveryRate: number;
  recoveryRateFormatted: string;
  mostSelectedPath: MostSelectedPath | null;
  averageOverspendPercent: number;
  totalOverspendAmount: MonetaryValue;
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
  budgetRebalances?: {
    id: string;
    fromCategoryId: string;
    fromCategoryName: string;
    toCategoryId: string;
    toCategoryName: string;
    amount: { amount: number; formatted: string; currency: string };
    createdAt: string;
  }[];
  summary: {
    hasActiveBoost: boolean;
    activeFreezeCount: number;
    totalExtensionDays: number;
  };
}

// ============================================
// BUDGET INSIGHT TYPES
// ============================================

export interface BudgetInsightOffsetSuggestion {
  categoryId: string;
  categoryName: string;
  currentBudget: number;
  suggestedReduction: number;
  averageSurplus: number;
}

export interface BudgetInsight {
  id: string;
  type: 'UNREALISTIC_BUDGET' | 'CURRENT_MONTH_EXCEEDED' | 'CONSISTENT_SURPLUS' | 'NEW_CATEGORY';
  category: string;
  categoryId: string;
  budgeted: number;
  averageSpent: number;
  monthsExceeded: number;
  monthlyHistory: { month: string; spent: number }[];
  suggestedBudget: number;
  offsetSuggestion?: BudgetInsightOffsetSuggestion;
  message: string;
}

export interface BudgetInsightsResponse {
  insights: BudgetInsight[];
  hasUnrealisticBudgets: boolean;
}

export interface ApplyBudgetInsightRequest {
  categoryId: string;
  suggestedBudget: number;
  offsetCategoryId?: string;
  offsetAmount?: number;
}

export interface ApplyBudgetInsightResponse {
  success: boolean;
  updated: Array<{ categoryId: string; newAmount: number }>;
  message: string;
}

// ============================================
// WEEKLY MICRO-BUDGET TYPES
// ============================================

export interface WeekBreakdown {
  weekNumber: number;
  startDate: string;
  endDate: string;
  allocated: number;
  spent: number;
  remaining: number;
  status: 'under' | 'on_track' | 'over';
}

export interface CurrentWeekInfo {
  weekNumber: number;
  dailyLimit: number;
  spentToday: number;
  daysRemaining: number;
}

export interface WeeklyBreakdownResponse {
  categoryId: string;
  categoryName: string;
  monthlyBudget: number;
  totalSpent: number;
  currency: string;
  weeks: WeekBreakdown[];
  currentWeek: CurrentWeekInfo;
  adjustedWeeklyBudget: number;
}

export interface DailyLimitItem {
  categoryId: string;
  categoryName: string;
  dailyLimit: number;
  spentToday: number;
  remaining: number;
  daysRemaining: number;
  currency: string;
  status: 'under' | 'on_track' | 'over';
}

// ============================================
// HELPERS
// ============================================

/** Extract `data` from the API envelope `{ success, data }` */
function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
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
      const res = await apiClient.get('/gps/active-adjustments');
      return unwrap<ActiveAdjustments>(res);
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
      const res = await apiClient.get('/gps/streaks');
      return unwrap<StreakStatus>(res);
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
      const res = await apiClient.get('/gps/achievements');
      return unwrap<AchievementsResponse>(res);
    },
  });

  // Recalculate mutation
  const recalculateMutation = useMutation({
    mutationFn: async (data: { category: string; goalId?: string }) => {
      const res = await apiClient.post('/gps/recalculate', data);
      return unwrap<RecoveryResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Get recovery paths
  const getRecoveryPaths = async (sessionId?: string) => {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    const res = await apiClient.get(`/gps/recovery-paths${params}`);
    return unwrap<{ paths: RecoveryPath[]; sessionId: string; category: string }>(res);
  };

  // Select path mutation
  const selectPathMutation = useMutation({
    mutationFn: async ({ pathId, sessionId }: { pathId: string; sessionId: string }) => {
      const res = await apiClient.post(`/gps/recovery-paths/${pathId}/select`, {
        sessionId,
      });
      return unwrap<SelectPathResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Get session
  const getSession = async (sessionId: string) => {
    const res = await apiClient.get(`/gps/sessions/${sessionId}`);
    return unwrap<RecoverySession & { progress?: { milestone: number; message: string } }>(res);
  };

  // What-if simulation
  const whatIfMutation = useMutation({
    mutationFn: async (data: WhatIfRequest) => {
      const res = await apiClient.post('/gps/what-if', data);
      return unwrap<WhatIfResponse>(res);
    },
  });

  // Check if category is frozen
  const checkCategoryFrozen = async (categoryId: string) => {
    const res = await apiClient.get(`/gps/active-adjustments/frozen/${categoryId}`);
    return unwrap<{ isFrozen: boolean; freeze?: ActiveAdjustments['categoryFreezes'][0] }>(res);
  };

  // Get analytics dashboard
  const getAnalyticsDashboard = async (days?: number) => {
    const params = days ? `?days=${days}` : '';
    const res = await apiClient.get(`/gps/analytics/dashboard${params}`);
    return unwrap<AnalyticsDashboard>(res);
  };

  // Get user analytics
  const getUserAnalytics = async (days?: number) => {
    const params = days ? `?days=${days}` : '';
    const res = await apiClient.get(`/gps/analytics/me${params}`);
    return unwrap<UserAnalytics>(res);
  };

  // Get category analytics
  const getCategoryAnalytics = async (days?: number) => {
    const params = days ? `?days=${days}` : '';
    const res = await apiClient.get(`/gps/analytics/categories${params}`);
    return unwrap<CategoryAnalytics[]>(res);
  };

  // Get spending velocity for a category
  const getSpendingVelocity = async (categoryId: string) => {
    const res = await apiClient.get(`/gps/spending-velocity/${encodeURIComponent(categoryId)}`);
    return unwrap<SpendingVelocityResponse>(res);
  };


  // Quick rebalance mutation
  const quickRebalanceMutation = useMutation({
    mutationFn: async (data: QuickRebalanceRequest) => {
      const res = await apiClient.post('/gps/quick-rebalance', data);
      return unwrap<QuickRebalanceResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
    },
  });

  // Get rebalance options for a category
  const getRebalanceOptions = async (categoryId: string) => {
    const res = await apiClient.get(`/gps/rebalance-options/${encodeURIComponent(categoryId)}`);
    return unwrap<RebalanceOptionsResponse>(res);
  };

  // Get spending forecasts
  const {
    data: forecastData,
    isLoading: isLoadingForecast,
    error: forecastError,
  } = useQuery({
    queryKey: ['gps', 'forecast'],
    queryFn: async () => {
      const res = await apiClient.get('/gps/forecast');
      return unwrap<ForecastResponse>(res);
    },
  });


  // Get budget insights (health check)
  const {
    data: budgetInsights,
    isLoading: isLoadingBudgetInsights,
    error: budgetInsightsError,
  } = useQuery({
    queryKey: ['gps', 'budget-insights'],
    queryFn: async () => {
      const res = await apiClient.get('/gps/budget-insights');
      return unwrap<BudgetInsightsResponse>(res);
    },
  });

  // Apply budget insight mutation
  const applyBudgetInsightMutation = useMutation({
    mutationFn: async (data: ApplyBudgetInsightRequest) => {
      const res = await apiClient.post('/gps/budget-insights/apply', data);
      return unwrap<ApplyBudgetInsightResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
    },
  });

  // Get recovery progress for a session
  const getRecoveryProgress = async (sessionId: string) => {
    const res = await apiClient.get(`/gps/recovery-progress/${encodeURIComponent(sessionId)}`);
    return unwrap<RecoveryProgressResponse>(res);
  };

  // Get recovery history
  const getRecoveryHistory = async () => {
    const res = await apiClient.get('/gps/recovery-history');
    return unwrap<RecoveryHistoryEntry[]>(res);
  };

  // Get spending breakdown for a category
  const getSpendingBreakdown = async (categoryId: string) => {
    const res = await apiClient.get(`/gps/spending-breakdown/${encodeURIComponent(categoryId)}`);
    return unwrap<SpendingBreakdownResponse>(res);
  };

  // Get weekly breakdown for a category
  const getWeeklyBreakdown = async (categoryId: string) => {
    const res = await apiClient.get(`/gps/budget/${encodeURIComponent(categoryId)}/weekly`);
    return unwrap<WeeklyBreakdownResponse>(res);
  };

  // Get daily limits for all categories (auto-fetched query)
  const {
    data: dailyLimits,
    isLoading: isLoadingDailyLimits,
    error: dailyLimitsError,
  } = useQuery({
    queryKey: ['gps', 'daily-limits'],
    queryFn: async () => {
      const res = await apiClient.get('/gps/daily-limits');
      return unwrap<DailyLimitItem[]>(res);
    },
  });

  return {
    // Daily Limits
    dailyLimits,
    isLoadingDailyLimits,
    dailyLimitsError: dailyLimitsError as ApiError | null,

    // Weekly Breakdown
    getWeeklyBreakdown,

    // Forecast
    forecastData,
    isLoadingForecast,
    forecastError: forecastError as ApiError | null,

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

    // Analytics
    getAnalyticsDashboard,
    getUserAnalytics,
    getCategoryAnalytics,

    // Utilities
    checkCategoryFrozen,
    getSpendingVelocity,

    // Quick Rebalance
    quickRebalance: quickRebalanceMutation.mutateAsync,
    isQuickRebalancing: quickRebalanceMutation.isPending,
    quickRebalanceData: quickRebalanceMutation.data,
    getRebalanceOptions,

    // Budget Insights (Health Check)
    budgetInsights,
    isLoadingBudgetInsights,
    budgetInsightsError: budgetInsightsError as ApiError | null,
    applyBudgetInsight: applyBudgetInsightMutation.mutateAsync,
    isApplyingBudgetInsight: applyBudgetInsightMutation.isPending,

    // Recovery Tracking
    getRecoveryProgress,
    getRecoveryHistory,

    // Spending Breakdown
    getSpendingBreakdown,
  };
}
