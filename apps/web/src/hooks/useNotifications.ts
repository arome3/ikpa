'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface GpsNotification {
  id: string;
  userId?: string;
  sessionId?: string;
  type: 'BUDGET_WARNING' | 'BUDGET_EXCEEDED' | 'BUDGET_CRITICAL' | 'RECOVERY_REMINDER' | 'MILESTONE_REACHED' | 'STREAK_BROKEN' | 'ACHIEVEMENT_EARNED';
  triggerType?: string;
  title: string;
  message: string;
  actionUrl?: string;
  categoryId?: string;
  categoryName?: string;
  category?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: GpsNotification[];
  totalCount: number;
  unreadCount: number;
}

export interface NotificationsFilters {
  type?: GpsNotification['type'];
  isRead?: boolean;
  limit?: number;
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

export function useNotifications(filters?: NotificationsFilters) {
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filters?.isRead === false) queryParams.set('unreadOnly', 'true');
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
      const res = await apiClient.get(endpoint);
      const data = unwrap<NotificationsResponse>(res);
      // Normalize: API returns triggerType, frontend uses type
      if (data?.notifications) {
        data.notifications = data.notifications.map((n) => ({
          ...n,
          type: (n.type || n.triggerType) as GpsNotification['type'],
        }));
      }
      return data;
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
      const res = await apiClient.get('/gps/notifications/unread-count');
      return unwrap<{ count: number }>(res);
    },
    refetchInterval: 15000, // Poll every 15 seconds
  });

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiClient.post(`/gps/notifications/${notificationId}/read`);
      return unwrap<{ success: boolean }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/gps/notifications/read-all');
      return unwrap<{ success: boolean; count: number }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Client-side type filtering (API doesn't support type param)
  const allNotifications = listData?.notifications ?? [];
  const filteredNotifications = filters?.type
    ? allNotifications.filter((n) => n.type === filters.type)
    : allNotifications;

  return {
    // List data
    notifications: filteredNotifications,
    count: listData?.totalCount ?? 0,
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
