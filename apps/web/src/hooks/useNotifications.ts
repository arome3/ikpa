'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface GpsNotification {
  id: string;
  userId: string;
  sessionId?: string;
  type: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL' | 'RECOVERY_REMINDER' | 'MILESTONE_REACHED' | 'STREAK_BROKEN' | 'ACHIEVEMENT_EARNED';
  title: string;
  message: string;
  actionUrl?: string;
  category?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  items: GpsNotification[];
  count: number;
  unreadCount: number;
}

export interface NotificationsFilters {
  type?: GpsNotification['type'];
  isRead?: boolean;
  limit?: number;
}

// ============================================
// HOOK
// ============================================

export function useNotifications(filters?: NotificationsFilters) {
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters?.type) queryParams.set('type', filters.type);
  if (filters?.isRead !== undefined) queryParams.set('isRead', String(filters.isRead));
  if (filters?.limit) queryParams.set('limit', String(filters.limit));

  const queryString = queryParams.toString();
  const endpoint = `/gps/notifications${queryString ? `?${queryString}` : ''}`;

  // List notifications
  const {
    data: listData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['notifications', filters],
    queryFn: async () => {
      return apiClient.get<NotificationsResponse>(endpoint);
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Get unread count
  const {
    data: unreadData,
    refetch: refetchUnread,
  } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      return apiClient.get<{ count: number }>('/gps/notifications/unread-count');
    },
    refetchInterval: 15000, // Poll every 15 seconds
  });

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiClient.post<{ success: boolean }>(`/gps/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<{ success: boolean; count: number }>('/gps/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    // List data
    notifications: listData?.items ?? [],
    count: listData?.count ?? 0,
    unreadCount: unreadData?.count ?? listData?.unreadCount ?? 0,
    isLoading,
    error: error as ApiError | null,
    refetch,
    refetchUnread,

    // Operations
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
}
