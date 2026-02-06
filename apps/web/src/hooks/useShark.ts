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

export type SubscriptionCategory =
  | 'STREAMING'
  | 'TV_CABLE'
  | 'FITNESS'
  | 'CLOUD_STORAGE'
  | 'SOFTWARE'
  | 'VPN'
  | 'LEARNING'
  | 'OTHER';

export type SubscriptionStatus = 'ACTIVE' | 'ZOMBIE' | 'UNKNOWN' | 'CANCELLED';

export type SwipeAction = 'KEEP' | 'CANCEL' | 'REVIEW_LATER';

export interface AnnualizedFraming {
  monthly: string;
  annual: string;
  context: string;
  impact: string;
}

export interface LastDecision {
  action: SwipeAction;
  decidedAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  category: SubscriptionCategory;
  monthlyCost: number;
  annualCost: number;
  currency: string;
  status: SubscriptionStatus;
  lastUsageDate?: string | null;
  detectedAt: string;
  firstChargeDate?: string | null;
  lastChargeDate?: string | null;
  chargeCount: number;
  priceChangePercent?: number | null;
  framing: AnnualizedFraming;
  lastDecision?: LastDecision;
}

export interface OverlapGroup {
  category: string;
  subscriptions: Array<{ id: string; name: string; monthlyCost: number }>;
  combinedMonthlyCost: number;
}

export interface DecisionHistoryItem {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  category: string;
  action: SwipeAction;
  monthlyCost: number;
  annualSavings: number;
  decidedAt: string;
}

export interface DecisionHistoryResult {
  decisions: DecisionHistoryItem[];
  totalLifetimeSavings: number;
  totalCancelled: number;
  totalKept: number;
  currency: string;
}

export interface CancellationGuide {
  subscriptionId: string;
  subscriptionName: string;
  steps: string[];
  directUrl: string | null;
  tips: string[];
  estimatedTime: string;
}

export interface KeepTip {
  title: string;
  description: string;
  estimatedSavings: string | null;
  actionUrl: string | null;
}

export interface KeepRecommendation {
  subscriptionId: string;
  subscriptionName: string;
  tips: KeepTip[];
  summary: string;
}

export interface SubscriptionSummary {
  totalSubscriptions: number;
  zombieCount: number;
  activeCount: number;
  unknownCount: number;
  cancelledCount: number;
  totalMonthlyCost: number;
  zombieMonthlyCost: number;
  potentialAnnualSavings: number;
  currency: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface SubscriptionListResponse {
  subscriptions: Subscription[];
  summary: SubscriptionSummary;
  pagination: Pagination;
}

export interface AuditResult {
  totalSubscriptions: number;
  newlyDetected: number;
  zombiesDetected: number;
  potentialAnnualSavings: number;
  currency: string;
  auditedAt: string;
}

export interface SwipeDecisionResponse {
  id: string;
  subscriptionId: string;
  action: SwipeAction;
  decidedAt: string;
  message: string;
}

export interface CancellationResult {
  subscriptionId: string;
  success: boolean;
  message: string;
  annualSavings: number;
  cancelledAt: string;
}

export interface SharkFilters {
  status?: SubscriptionStatus;
  limit?: number;
  offset?: number;
}

// ============================================
// HOOK
// ============================================

export function useShark(filters?: SharkFilters) {
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.limit) queryParams.set('limit', String(filters.limit));
  if (filters?.offset) queryParams.set('offset', String(filters.offset));

  const queryString = queryParams.toString();
  const endpoint = `/shark/subscriptions${queryString ? `?${queryString}` : ''}`;

  // List subscriptions + summary
  const {
    data: listData,
    isLoading: isLoadingSubscriptions,
    error: subscriptionsError,
    refetch: refetchSubscriptions,
  } = useQuery({
    queryKey: ['shark', 'subscriptions', filters],
    queryFn: async () => {
      const res = await apiClient.get(endpoint);
      return unwrap<SubscriptionListResponse>(res);
    },
  });

  // Derived: subscriptions pending review (ZOMBIE or UNKNOWN without a decision)
  // Sorted by "waste score" — zombies with highest costs first, then by days since last usage
  const pendingReview = (
    listData?.subscriptions.filter(
      (s) =>
        (s.status === 'ZOMBIE' || s.status === 'UNKNOWN') && !s.lastDecision
    ) ?? []
  ).sort((a, b) => {
    const zombieWeight = (s: Subscription) => (s.status === 'ZOMBIE' ? 2 : 1);
    const daysSinceUsage = (s: Subscription) => {
      if (!s.lastUsageDate) return 365; // Unknown usage = high waste
      return Math.max(1, Math.floor((Date.now() - new Date(s.lastUsageDate).getTime()) / 86400000));
    };
    const wasteScore = (s: Subscription) =>
      zombieWeight(s) * Math.abs(s.monthlyCost) * daysSinceUsage(s);
    return wasteScore(b) - wasteScore(a);
  });

  // Get single subscription by ID (on-demand)
  const getById = async (id: string): Promise<Subscription> => {
    const res = await apiClient.get(`/shark/subscriptions/${id}`);
    return unwrap<Subscription>(res);
  };

  // Trigger audit scan
  const auditMutation = useMutation({
    mutationFn: async (force?: boolean) => {
      const res = await apiClient.post('/shark/audit', { force: force ?? false });
      return unwrap<AuditResult>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shark', 'subscriptions'] });
    },
  });

  // Record swipe decision
  const swipeMutation = useMutation({
    mutationFn: async (data: { subscriptionId: string; action: SwipeAction }) => {
      const res = await apiClient.post('/shark/swipe', data);
      return unwrap<SwipeDecisionResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shark', 'subscriptions'] });
    },
  });

  // Cancel subscription
  const cancelMutation = useMutation({
    mutationFn: async (data: { subscriptionId: string; reason?: string }) => {
      const res = await apiClient.post(
        `/shark/subscriptions/${data.subscriptionId}/cancel`,
        { reason: data.reason }
      );
      return unwrap<CancellationResult>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shark', 'subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['financialSummary'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
    },
  });

  // Fetch overlaps
  const {
    data: overlaps,
    isLoading: isLoadingOverlaps,
  } = useQuery({
    queryKey: ['shark', 'overlaps'],
    queryFn: async () => {
      const res = await apiClient.get('/shark/overlaps');
      return unwrap<OverlapGroup[]>(res);
    },
  });

  // Fetch decision history
  const {
    data: history,
    isLoading: isLoadingHistory,
  } = useQuery({
    queryKey: ['shark', 'history'],
    queryFn: async () => {
      const res = await apiClient.get('/shark/history');
      return unwrap<DecisionHistoryResult>(res);
    },
  });

  // Fetch cancellation guide (on-demand)
  const getCancellationGuide = async (subscriptionId: string): Promise<CancellationGuide> => {
    const res = await apiClient.get(`/shark/subscriptions/${subscriptionId}/cancel-guide`);
    return unwrap<CancellationGuide>(res);
  };

  // Fetch keep recommendation tips (on-demand)
  const getKeepRecommendation = async (subscriptionId: string): Promise<KeepRecommendation> => {
    const res = await apiClient.get(`/shark/subscriptions/${subscriptionId}/keep-tips`);
    return unwrap<KeepRecommendation>(res);
  };

  return {
    // List data
    subscriptions: listData?.subscriptions ?? [],
    summary: listData?.summary ?? null,
    pagination: listData?.pagination ?? null,
    pendingReview,
    isLoadingSubscriptions,
    subscriptionsError: subscriptionsError as ApiError | null,
    refetchSubscriptions,

    // Single fetch
    getById,

    // Audit
    triggerAudit: auditMutation.mutateAsync,
    isAuditing: auditMutation.isPending,
    auditResult: auditMutation.data ?? null,

    // Swipe
    swipe: swipeMutation.mutateAsync,
    isSwiping: swipeMutation.isPending,

    // Cancel
    cancelSubscription: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,

    // Overlaps
    overlaps: overlaps ?? [],
    isLoadingOverlaps,

    // History
    history: history ?? null,
    isLoadingHistory,

    // Cancellation guide
    getCancellationGuide,

    // Keep recommendation
    getKeepRecommendation,
  };
}
