'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface ProjectedNetWorth {
  '6mo': number;
  '1yr': number;
  '5yr': number;
  '10yr': number;
  '20yr': number;
}

export interface PathBehavior {
  savingsRate: number;
  projectedNetWorth: ProjectedNetWorth;
}

export interface FutureSimulation {
  currentBehavior: PathBehavior;
  withIKPA: PathBehavior;
  difference_20yr: number;
}

export interface TimelineProjection {
  currentPath: number;
  optimizedPath: number;
  difference: number;
  years: number;
}

export interface LetterResponse {
  content: string;
  generatedAt: string;
  simulationData: FutureSimulation;
  userAge: number;
  futureAge: number;
}

export interface LetterHistoryItem {
  id: string;
  preview: string;
  trigger: string;
  generatedAt: string;
  readAt: string | null;
  toneScore: number | null;
}

export interface LetterHistoryResponse {
  letters: LetterHistoryItem[];
  total: number;
  hasMore: boolean;
}

export interface LetterDetail {
  id: string;
  content: string;
  trigger: string;
  generatedAt: string;
  readAt: string | null;
  userAge: number;
  futureAge: number;
  currentSavingsRate: number;
  optimizedSavingsRate: number;
  wealthDifference20yr: number;
  toneScore: number | null;
}

export interface Preferences {
  weeklyLettersEnabled: boolean;
  updatedAt: string;
}

export interface EngagementResponse {
  letterId: string;
  readAt: string;
  readDurationMs: number | null;
}

export interface FutureSelfStats {
  totalLetters: number;
  lettersRead: number;
  avgReadDurationMs: number | null;
  avgToneScore: number | null;
  firstLetterDate: string | null;
  lastLetterDate: string | null;
  byTrigger: Record<string, number>;
  thisMonth: number;
}

export interface ConversationMessage {
  role: 'user' | 'future_self';
  content: string;
  createdAt: string;
}

export interface ConversationResponse {
  conversationId: string;
  response: ConversationMessage;
  messages: ConversationMessage[];
}

export interface Commitment {
  id: string;
  letterId: string;
  dailyAmount: number;
  currency: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  startDate: string;
  endDate: string | null;
  streakDays: number;
  createdAt: string;
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

export function useFutureSelf() {
  const queryClient = useQueryClient();

  // Get dual-path simulation
  const {
    data: simulation,
    isLoading: isLoadingSimulation,
    error: simulationError,
  } = useQuery({
    queryKey: ['future-self', 'simulation'],
    queryFn: async () => {
      const res = await apiClient.get('/future-self/simulation');
      return unwrap<FutureSimulation>(res);
    },
  });

  // Get letter history
  const {
    data: letterHistory,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useQuery({
    queryKey: ['future-self', 'letters'],
    queryFn: async () => {
      const res = await apiClient.get('/future-self/letters?limit=10&offset=0');
      return unwrap<LetterHistoryResponse>(res);
    },
  });

  // Get stats
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery({
    queryKey: ['future-self', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get('/future-self/stats');
      return unwrap<FutureSelfStats>(res);
    },
  });

  // Get preferences
  const {
    data: preferences,
    isLoading: isLoadingPreferences,
    error: preferencesError,
  } = useQuery({
    queryKey: ['future-self', 'preferences'],
    queryFn: async () => {
      const res = await apiClient.get('/future-self/preferences');
      return unwrap<Preferences>(res);
    },
  });

  // Generate letter mutation (gratitude mode - default)
  const generateLetterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.get('/future-self/letter');
      return unwrap<LetterResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'letters'] });
      queryClient.invalidateQueries({ queryKey: ['future-self', 'stats'] });
    },
  });

  // Generate regret letter mutation
  const generateRegretLetterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.get('/future-self/letter?mode=regret');
      return unwrap<LetterResponse>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'letters'] });
      queryClient.invalidateQueries({ queryKey: ['future-self', 'stats'] });
    },
  });

  // Update engagement mutation
  const updateEngagementMutation = useMutation({
    mutationFn: async ({ letterId, readDurationMs }: { letterId: string; readDurationMs?: number }) => {
      const res = await apiClient.patch(`/future-self/letters/${letterId}/engagement`, { readDurationMs });
      return unwrap<EngagementResponse>(res);
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: { weeklyLettersEnabled?: boolean }) => {
      const res = await apiClient.patch('/future-self/preferences', data);
      return unwrap<Preferences>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'preferences'] });
    },
  });

  // Get timeline projection
  const getTimeline = async (years: number) => {
    const res = await apiClient.get(`/future-self/timeline/${years}`);
    return unwrap<TimelineProjection>(res);
  };

  // Get letter detail
  const getLetterDetail = async (id: string) => {
    const res = await apiClient.get(`/future-self/letters/${id}`);
    return unwrap<LetterDetail>(res);
  };

  // Conversation mutation
  const conversationMutation = useMutation({
    mutationFn: async ({ letterId, message }: { letterId: string; message: string }) => {
      const res = await apiClient.post('/future-self/conversation', { letterId, message });
      return unwrap<ConversationResponse>(res);
    },
  });

  // Get conversation history
  const getConversation = async (letterId: string) => {
    const res = await apiClient.get(`/future-self/conversation/${letterId}`);
    return unwrap<{ messages: ConversationMessage[] }>(res);
  };

  // Create commitment mutation
  const createCommitmentMutation = useMutation({
    mutationFn: async ({ letterId, dailyAmount }: { letterId: string; dailyAmount: number }) => {
      const res = await apiClient.post('/future-self/commitment', { letterId, dailyAmount });
      return unwrap<Commitment>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'commitments'] });
    },
  });

  // Get commitments
  const {
    data: commitments,
    isLoading: isLoadingCommitments,
    error: commitmentsError,
  } = useQuery({
    queryKey: ['future-self', 'commitments'],
    queryFn: async () => {
      const res = await apiClient.get('/future-self/commitments');
      return unwrap<Commitment[]>(res);
    },
  });

  // Update commitment mutation
  const updateCommitmentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch(`/future-self/commitments/${id}`, { status });
      return unwrap<Commitment>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'commitments'] });
    },
  });

  // Check upgrade eligibility
  const checkUpgradeEligibility = async (microCommitmentId: string) => {
    const res = await apiClient.get(`/commitment/upgrade/check/${microCommitmentId}`);
    return unwrap<{
      eligible: boolean;
      reason: string;
      suggestedStakeType: 'SOCIAL' | 'ANTI_CHARITY' | 'LOSS_POOL';
      suggestedAmount: number;
      dailyAmount: number;
      streakDays: number;
      linkedGoals: Array<{ id: string; name: string; targetAmount: number }>;
    }>(res);
  };

  // Upgrade commitment mutation
  const upgradeCommitmentMutation = useMutation({
    mutationFn: async ({ microCommitmentId, ...data }: {
      microCommitmentId: string;
      goalId: string;
      stakeType: string;
      stakeAmount?: number;
      antiCharityCause?: string;
      antiCharityUrl?: string;
      verificationMethod: string;
      deadline: string;
      refereeEmail?: string;
      refereeName?: string;
      refereeRelationship?: string;
    }) => {
      const res = await apiClient.post(`/commitment/upgrade/${microCommitmentId}`, data);
      return unwrap<{ success: boolean; contractId: string; microCommitmentId: string; message: string }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'commitments'] });
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
    },
  });

  return {
    // Simulation
    simulation,
    isLoadingSimulation,
    simulationError: simulationError as ApiError | null,

    // Letter generation
    generateLetter: generateLetterMutation.mutateAsync,
    isGeneratingLetter: generateLetterMutation.isPending,
    generatedLetter: generateLetterMutation.data,

    // Regret letter generation
    generateRegretLetter: generateRegretLetterMutation.mutateAsync,
    isGeneratingRegretLetter: generateRegretLetterMutation.isPending,
    generatedRegretLetter: generateRegretLetterMutation.data,

    // Letter history
    letterHistory,
    isLoadingHistory,
    historyError: historyError as ApiError | null,

    // Stats
    stats,
    isLoadingStats,
    statsError: statsError as ApiError | null,

    // Preferences
    preferences,
    isLoadingPreferences,
    preferencesError: preferencesError as ApiError | null,
    updatePreferences: updatePreferencesMutation.mutateAsync,
    isUpdatingPreferences: updatePreferencesMutation.isPending,

    // Engagement
    updateEngagement: updateEngagementMutation.mutateAsync,

    // Timeline & detail
    getTimeline,
    getLetterDetail,

    // Conversation
    sendMessage: conversationMutation.mutateAsync,
    isSendingMessage: conversationMutation.isPending,
    conversationResponse: conversationMutation.data,
    getConversation,

    // Commitments
    commitments,
    isLoadingCommitments,
    commitmentsError: commitmentsError as ApiError | null,
    createCommitment: createCommitmentMutation.mutateAsync,
    isCreatingCommitment: createCommitmentMutation.isPending,
    updateCommitment: updateCommitmentMutation.mutateAsync,
    isUpdatingCommitment: updateCommitmentMutation.isPending,

    // Upgrade to staked contract
    checkUpgradeEligibility,
    upgradeCommitment: upgradeCommitmentMutation.mutateAsync,
    isUpgradingCommitment: upgradeCommitmentMutation.isPending,
  };
}
