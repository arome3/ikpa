'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  BellOff,
  AlertTriangle,
  Gauge,
  Navigation,
  Flame,
  Trophy,
  CheckCheck,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useNotifications } from '@/hooks';
import type { GpsNotification, NotificationsFilters } from '@/hooks/useNotifications';

// ============================================
// FILTER TYPES
// ============================================

type FilterTab = 'all' | 'unread' | 'budget' | 'drift' | 'recovery';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'budget', label: 'Budget' },
  { key: 'drift', label: 'Drift' },
  { key: 'recovery', label: 'Recovery' },
];

function getFiltersForTab(tab: FilterTab): NotificationsFilters | undefined {
  switch (tab) {
    case 'unread':
      return { isRead: false };
    case 'budget':
      return { type: 'BUDGET_WARNING' };
    case 'drift':
      return { type: 'BUDGET_EXCEEDED' };
    case 'recovery':
      return { type: 'RECOVERY_REMINDER' };
    default:
      return undefined;
  }
}

// ============================================
// NOTIFICATION ICON HELPERS
// ============================================

function getNotificationIcon(type: GpsNotification['type']) {
  switch (type) {
    case 'BUDGET_WARNING':
    case 'BUDGET_EXCEEDED':
    case 'BUDGET_CRITICAL':
      return { Icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/20' };
    case 'RECOVERY_REMINDER':
    case 'MILESTONE_REACHED':
      return { Icon: Navigation, color: 'text-primary-400', bg: 'bg-primary-500/20' };
    case 'STREAK_BROKEN':
      return { Icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/20' };
    case 'ACHIEVEMENT_EARNED':
      return { Icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    default:
      return { Icon: Gauge, color: 'text-slate-400', bg: 'bg-slate-500/20' };
  }
}

// ============================================
// NOTIFICATIONS PAGE
// ============================================

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filters = getFiltersForTab(activeTab);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    isMarkingAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotifications(filters);

  const handleNotificationTap = async (notification: GpsNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-secondary-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Back button */}
        <motion.button
          onClick={() => router.push('/dashboard/gps')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        {/* Header */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative p-2.5 bg-primary-500/20 rounded-xl backdrop-blur-sm">
                <Bell className="w-6 h-6 text-primary-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Notifications
                </h1>
                <p className="text-sm text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                disabled={isMarkingAllAsRead}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4" />
                <span>{isMarkingAllAsRead ? 'Marking...' : 'Mark all read'}</span>
              </button>
            )}
          </div>
        </motion.header>

        {/* Filter Tabs */}
        <motion.div
          className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              )}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Notification List */}
        <div className="space-y-3">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-white/5 animate-pulse rounded-xl"
              />
            ))
          ) : notifications.length === 0 ? (
            <motion.div
              className="p-8 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="inline-flex p-4 bg-green-500/20 rounded-full mb-4">
                <BellOff className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-green-300 font-medium text-lg">No notifications yet</p>
              <p className="text-sm text-slate-400 mt-2">
                {activeTab === 'all'
                  ? "We'll notify you when something needs your attention."
                  : 'No notifications match this filter.'}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {notifications.map((notification, index) => {
                const { Icon, color, bg } = getNotificationIcon(notification.type);

                return (
                  <motion.button
                    key={notification.id}
                    onClick={() => handleNotificationTap(notification)}
                    disabled={isMarkingAsRead}
                    className={cn(
                      'w-full text-left p-4 rounded-xl border backdrop-blur-sm transition-colors',
                      notification.isRead
                        ? 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ delay: 0.03 * index }}
                    layout
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={cn('p-2 rounded-lg shrink-0', bg)}>
                        <Icon className={cn('w-5 h-5', color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium text-sm leading-tight',
                          notification.isRead ? 'text-slate-300' : 'text-white'
                        )}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-500 mt-1.5">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.isRead && (
                        <div className="shrink-0 mt-1.5">
                          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full shadow-lg shadow-primary-500/50" />
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
