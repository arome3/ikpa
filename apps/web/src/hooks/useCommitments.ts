'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface CommitmentContract {
  id: string;
  goalId: string;
  goalName: string;
  userId: string;
  stakeType: 'SOCIAL' | 'ANTI_CHARITY' | 'LOSS_POOL';
  stakeAmount: number | null;
  antiCharityCause: string | null;
  verificationMethod: 'SELF_REPORT' | 'REFEREE_VERIFY' | 'AUTO_DETECT';
  deadline: string;
  status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  daysRemaining: number;
  successProbability: number;
  referee?: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  };
  message: { headline: string; subtext: string };
  createdAt: string;
  achievementTier?: string | null;
  achievementPercentage?: number | null;
  tierRefundPercentage?: number | null;
  selfVerifyOfferedAt?: string | null;
  selfVerifyExpiresAt?: string | null;
  trustBonusApplied?: boolean;
  trustBonusAmount?: number | null;
}

export interface CreateStakeInput {
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
  idempotencyKey?: string;
  negotiationSessionId?: string;
}

export interface StakeEffectiveness {
  stakeType: string;
  totalCommitments: number;
  successfulCommitments: number;
  successRate: number;
  averageStakeAmount: number | null;
}

export interface PendingVerification {
  contractId: string;
  goalName: string;
  userName: string;
  userEmail: string;
  stakeType: string;
  stakeAmount: number | null;
  deadline: string;
  daysOverdue: number;
  createdAt: string;
}

export interface NegotiationResponse {
  sessionId: string;
  message: string;
  recommendation?: {
    stakeType: string;
    stakeAmount: number;
    reasoning: string;
  };
  isComplete: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  trustBonusRate: number;
  bonusEligible: boolean;
  lastSucceededAt: string | null;
}

export interface DebriefData {
  contractId: string;
  analysis: string;
  suggestedStakeType?: string;
  suggestedStakeAmount?: number;
  suggestedDeadlineDays?: number;
  keyInsights: string[];
  createdAt: string;
}

export interface AchievementCard {
  goalName: string;
  stakeType: string;
  stakeAmount?: number;
  achievementTier?: string;
  succeededAt: string;
  userName: string;
  currency: string;
  streakCount?: number;
}

// ============================================
// HELPERS
// ============================================

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

// ============================================
// HOOK
// ============================================

export function useCommitments() {
  const queryClient = useQueryClient();

  // Create stake mutation
  const createStakeMutation = useMutation({
    mutationFn: async (data: CreateStakeInput) => {
      const res = await apiClient.post('/commitment/stakes', data);
      return unwrap<CommitmentContract & { refereeInvited: boolean }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
    },
  });

  // Get stakes for a goal
  const getStakesByGoal = async (goalId: string) => {
    const res = await apiClient.get(`/commitment/stakes/${goalId}`);
    return unwrap<{
      data: CommitmentContract[];
      goalId: string;
      pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
    }>(res);
  };

  // Update stake mutation
  const updateStakeMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; deadline?: string; stakeAmount?: number; antiCharityCause?: string; antiCharityUrl?: string }) => {
      const res = await apiClient.put(`/commitment/stakes/${id}`, data);
      return unwrap<CommitmentContract>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
    },
  });

  // Cancel stake mutation
  const cancelStakeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/commitment/stakes/${id}`);
      return unwrap<{ success: boolean; contractId: string; message: string; refundedAmount?: number; penaltyAmount?: number }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
    },
  });

  // Verify commitment (public, token-based)
  const verifyCommitmentMutation = useMutation({
    mutationFn: async ({ contractId, ...data }: { contractId: string; token: string; decision: boolean; notes?: string }) => {
      const res = await apiClient.post(`/commitment/verify/${contractId}`, data);
      return unwrap<{ success: boolean; contractId: string; decision: boolean; newStatus: string; message: { headline: string; subtext: string }; stakeProcessed?: number }>(res);
    },
  });

  // Get pending verifications for a referee
  const getPendingVerifications = async (token: string) => {
    const res = await apiClient.get(`/commitment/referee/pending?token=${encodeURIComponent(token)}`);
    return unwrap<{ pending: PendingVerification[]; total: number; refereeId: string; refereeName: string }>(res);
  };

  // Invite referee mutation
  const inviteRefereeMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; relationship: string }) => {
      const res = await apiClient.post('/commitment/referee/invite', data);
      return unwrap<{ success: boolean; refereeId: string; email: string; name: string; message: string; inviteExpires: string }>(res);
    },
  });

  // Accept referee invite (public, token-based)
  const acceptInviteMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.post('/commitment/referee/accept', { token });
      return unwrap<{ success: boolean; refereeId: string; message: string; userName: string }>(res);
    },
  });

  // Get stake effectiveness analytics
  const getEffectiveness = async () => {
    const res = await apiClient.get('/commitment/analytics/effectiveness');
    return unwrap<{ userId: string; metrics: StakeEffectiveness[]; recommendation: string }>(res);
  };

  // Start negotiation with AI coach
  const startNegotiationMutation = useMutation({
    mutationFn: async (data: { goalId: string }) => {
      const res = await apiClient.post('/commitment/negotiate', data);
      return unwrap<NegotiationResponse>(res);
    },
  });

  // Continue negotiation with AI coach
  const continueNegotiationMutation = useMutation({
    mutationFn: async (data: { sessionId: string; message: string }) => {
      const res = await apiClient.post('/commitment/negotiate/respond', data);
      return unwrap<NegotiationResponse>(res);
    },
  });

  // Get streak info
  const getStreak = async () => {
    const res = await apiClient.get('/commitment/streak');
    return unwrap<StreakInfo>(res);
  };

  // Get debrief for a failed contract
  const getDebrief = async (contractId: string) => {
    const res = await apiClient.get(`/commitment/debrief/${contractId}`);
    return unwrap<DebriefData>(res);
  };

  // Generate debrief for a failed contract
  const generateDebriefMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const res = await apiClient.post(`/commitment/debrief/${contractId}/generate`);
      return unwrap<DebriefData>(res);
    },
  });

  // Self-verify a commitment
  const selfVerifyMutation = useMutation({
    mutationFn: async ({ contractId, decision, notes }: { contractId: string; decision: boolean; notes?: string }) => {
      const res = await apiClient.post(`/commitment/self-verify/${contractId}`, { decision, notes });
      return unwrap<{ success: boolean; newStatus: string; message: string }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commitments'] });
    },
  });

  // Get achievement card data
  const getAchievement = async (contractId: string) => {
    const res = await apiClient.get(`/commitment/achievement/${contractId}`);
    return unwrap<AchievementCard>(res);
  };

  return {
    // Create
    createStake: createStakeMutation.mutateAsync,
    isCreatingStake: createStakeMutation.isPending,
    createdStake: createStakeMutation.data,

    // Read
    getStakesByGoal,

    // Update
    updateStake: updateStakeMutation.mutateAsync,
    isUpdatingStake: updateStakeMutation.isPending,

    // Cancel
    cancelStake: cancelStakeMutation.mutateAsync,
    isCancellingStake: cancelStakeMutation.isPending,

    // Verify
    verifyCommitment: verifyCommitmentMutation.mutateAsync,
    isVerifying: verifyCommitmentMutation.isPending,

    // Referee
    getPendingVerifications,
    inviteReferee: inviteRefereeMutation.mutateAsync,
    isInvitingReferee: inviteRefereeMutation.isPending,
    acceptInvite: acceptInviteMutation.mutateAsync,
    isAcceptingInvite: acceptInviteMutation.isPending,

    // Analytics
    getEffectiveness,

    // AI Coach Negotiation
    startNegotiation: startNegotiationMutation.mutateAsync,
    isStartingNegotiation: startNegotiationMutation.isPending,
    continueNegotiation: continueNegotiationMutation.mutateAsync,
    isContinuingNegotiation: continueNegotiationMutation.isPending,

    // Streak
    getStreak,

    // Debrief
    getDebrief,
    generateDebrief: generateDebriefMutation.mutateAsync,
    isGeneratingDebrief: generateDebriefMutation.isPending,

    // Self-verify
    selfVerify: selfVerifyMutation.mutateAsync,
    isSelfVerifying: selfVerifyMutation.isPending,

    // Achievement
    getAchievement,
  };
}
