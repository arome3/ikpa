'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  status: 'FORMING' | 'ACTIVE' | 'COMPLETED' | 'DISBANDED';
  memberCount: number;
  maxMembers: number;
  myRole: 'OWNER' | 'MEMBER';
  createdAt: string;
}

export interface GroupMemberProgress {
  userId: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
  hasContract: boolean;
  progress: 'on_track' | 'behind' | 'completed' | 'failed' | 'pending';
  groupBonusAwarded: boolean;
  joinedAt: string;
  encouragementCount?: number;
  reactions?: Array<{ emoji: string; count: number; myReaction: boolean }>;
}

export interface GroupDashboard {
  group: GroupInfo;
  members: GroupMemberProgress[];
  allResolved: boolean;
  allSucceeded: boolean;
  groupBonusAwarded: boolean;
  sharedGoal?: {
    target: number;
    current: number;
    percentage: number;
    currency: string;
    label: string | null;
  } | null;
  recentEncouragements?: Array<{
    id: string;
    fromName: string;
    toName: string;
    message: string;
    createdAt: string;
  }>;
}

// ============================================
// HELPERS
// ============================================

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

// ============================================
// QUERY KEYS
// ============================================

export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  dashboard: (groupId: string) => [...groupKeys.all, 'dashboard', groupId] as const,
  timeline: (groupId: string) => [...groupKeys.all, 'timeline', groupId] as const,
};

// ============================================
// HOOK
// ============================================

export function useGroups() {
  const queryClient = useQueryClient();

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; sharedGoalAmount?: number; sharedGoalLabel?: string }) => {
      const res = await apiClient.post('/commitment/groups', data);
      return unwrap<{ id: string; name: string; inviteCode: string; status: string; maxMembers: number }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });

  // Join group mutation
  const joinGroupMutation = useMutation({
    mutationFn: async (data: { inviteCode: string }) => {
      const res = await apiClient.post('/commitment/groups/join', data);
      return unwrap<{ success: boolean; groupId: string; groupName: string; memberCount: number }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });

  // Link contract mutation
  const linkContractMutation = useMutation({
    mutationFn: async ({ groupId, contractId }: { groupId: string; contractId: string }) => {
      const res = await apiClient.post(`/commitment/groups/${groupId}/link`, { contractId });
      return unwrap<{ success: boolean }>(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.dashboard(variables.groupId) });
    },
  });

  // Leave group mutation
  const leaveGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await apiClient.post(`/commitment/groups/${groupId}/leave`);
      return unwrap<{ success: boolean }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });

  // Disband group mutation
  const disbandGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const res = await apiClient.delete(`/commitment/groups/${groupId}`);
      return unwrap<{ success: boolean }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });

  // My groups query
  const myGroupsQuery = useQuery({
    queryKey: groupKeys.lists(),
    queryFn: async () => {
      const res = await apiClient.get('/commitment/groups');
      return unwrap<{ groups: GroupInfo[] }>(res);
    },
  });

  // Group dashboard query (factory)
  const useGroupDashboard = (groupId: string | null) =>
    useQuery({
      queryKey: groupKeys.dashboard(groupId ?? ''),
      queryFn: async () => {
        const res = await apiClient.get(`/commitment/groups/${groupId}`);
        return unwrap<GroupDashboard>(res);
      },
      enabled: !!groupId,
    });

  // Send encouragement mutation
  const sendEncouragementMutation = useMutation({
    mutationFn: async ({ groupId, toUserId, message }: { groupId: string; toUserId: string; message?: string }) => {
      const res = await apiClient.post(`/commitment/groups/${groupId}/encourage`, { toUserId, message });
      return unwrap<{ id: string }>(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.dashboard(variables.groupId) });
    },
  });

  // Toggle reaction mutation
  const toggleReactionMutation = useMutation({
    mutationFn: async ({ groupId, targetId, emoji }: { groupId: string; targetId: string; emoji: string }) => {
      const res = await apiClient.post(`/commitment/groups/${groupId}/react`, { targetId, emoji });
      return unwrap<{ added: boolean }>(res);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.dashboard(variables.groupId) });
    },
  });

  // Group timeline query (factory)
  const useGroupTimeline = (groupId: string | null) =>
    useQuery({
      queryKey: groupKeys.timeline(groupId ?? ''),
      queryFn: async () => {
        const res = await apiClient.get(`/commitment/groups/${groupId}/timeline`);
        return unwrap<{ weeks: Array<{ weekStart: string; onTrack: number; behind: number; completed: number; failed: number }> }>(res);
      },
      enabled: !!groupId,
    });

  return {
    // Mutations
    createGroup: createGroupMutation.mutateAsync,
    isCreatingGroup: createGroupMutation.isPending,

    joinGroup: joinGroupMutation.mutateAsync,
    isJoiningGroup: joinGroupMutation.isPending,

    linkContract: linkContractMutation.mutateAsync,
    isLinkingContract: linkContractMutation.isPending,

    leaveGroup: leaveGroupMutation.mutateAsync,
    isLeavingGroup: leaveGroupMutation.isPending,

    disbandGroup: disbandGroupMutation.mutateAsync,
    isDisbandingGroup: disbandGroupMutation.isPending,

    // Queries
    myGroups: myGroupsQuery.data?.groups ?? [],
    isLoadingGroups: myGroupsQuery.isLoading,

    useGroupDashboard,

    sendEncouragement: sendEncouragementMutation.mutateAsync,
    isSendingEncouragement: sendEncouragementMutation.isPending,

    toggleReaction: toggleReactionMutation.mutateAsync,
    isTogglingReaction: toggleReactionMutation.isPending,

    useGroupTimeline,
  };
}
