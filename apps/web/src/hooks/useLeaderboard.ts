'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  streakDays: number;
  longestStreak: number;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank: number | null;
}

export interface MyRank {
  rank: number | null;
  streakDays: number;
  longestStreak: number;
  optedIn: boolean;
}

export function useLeaderboard() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['future-self', 'leaderboard'],
    queryFn: async () => {
      const res = await apiClient.get('/future-self/leaderboard');
      return unwrap<LeaderboardResponse>(res);
    },
  });

  const { data: myRank, isLoading: isLoadingRank } = useQuery({
    queryKey: ['future-self', 'leaderboard', 'my-rank'],
    queryFn: async () => {
      const res = await apiClient.get('/future-self/leaderboard/my-rank');
      return unwrap<MyRank>(res);
    },
  });

  const optInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/future-self/leaderboard/opt-in', {});
      return unwrap<{ success: boolean; optedIn: boolean }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'leaderboard'] });
    },
  });

  const optOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/future-self/leaderboard/opt-out', {});
      return unwrap<{ success: boolean; optedIn: boolean }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['future-self', 'leaderboard'] });
    },
  });

  return {
    entries: data?.entries ?? [],
    userRank: data?.userRank ?? myRank?.rank ?? null,
    myRank,
    isLoading,
    isLoadingRank,
    error,
    refetch,
    optIn: optInMutation.mutateAsync,
    optOut: optOutMutation.mutateAsync,
    isTogglingOptIn: optInMutation.isPending || optOutMutation.isPending,
  };
}
