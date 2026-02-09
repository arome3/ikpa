import type { GpsNotification } from '@/hooks/useNotifications';

// ============================================
// NOTIFICATION CATEGORIES
// ============================================

export type NotificationCategory = 'priority' | 'transactional' | 'system';

export const NOTIFICATION_CATEGORY_MAP: Record<GpsNotification['type'], NotificationCategory> = {
  BUDGET_CRITICAL: 'priority',
  BUDGET_EXCEEDED: 'priority',
  STREAK_BROKEN: 'priority',
  BUDGET_WARNING: 'transactional',
  RECOVERY_REMINDER: 'transactional',
  MILESTONE_REACHED: 'system',
  ACHIEVEMENT_EARNED: 'system',
};

// ============================================
// BRIEFING TABS
// ============================================

export interface BriefingTab {
  key: 'all' | NotificationCategory;
  label: string;
}

export const BRIEFING_TABS: BriefingTab[] = [
  { key: 'all', label: 'All' },
  { key: 'priority', label: 'Priority' },
  { key: 'transactional', label: 'Transactional' },
  { key: 'system', label: 'System' },
];

// ============================================
// CATEGORY STRIPE COLORS
// ============================================

export const CATEGORY_STRIPE_COLORS: Record<NotificationCategory, string> = {
  priority: 'border-l-[#C2410C]',
  transactional: 'border-l-[#064E3B]',
  system: 'border-l-[#3F6212]',
};

export const CATEGORY_STRIPE_COLORS_MUTED: Record<NotificationCategory, string> = {
  priority: 'border-l-stone-300',
  transactional: 'border-l-stone-300',
  system: 'border-l-stone-300',
};

// ============================================
// CATEGORY LABELS
// ============================================

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  priority: 'PRIORITY',
  transactional: 'TRANSACTIONAL',
  system: 'SYSTEM',
};

// ============================================
// HELPERS
// ============================================

export function getNotificationCategory(type: GpsNotification['type']): NotificationCategory {
  return NOTIFICATION_CATEGORY_MAP[type] ?? 'system';
}

export function getCategoryCounts(notifications: GpsNotification[]): Record<NotificationCategory, number> {
  const counts: Record<NotificationCategory, number> = {
    priority: 0,
    transactional: 0,
    system: 0,
  };

  for (const n of notifications) {
    const cat = getNotificationCategory(n.type);
    counts[cat]++;
  }

  return counts;
}
