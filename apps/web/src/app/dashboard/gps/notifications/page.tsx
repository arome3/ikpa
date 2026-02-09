'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useNotifications } from '@/hooks';
import type { GpsNotification } from '@/hooks/useNotifications';
import {
  BRIEFING_TABS,
  CATEGORY_STRIPE_COLORS,
  CATEGORY_STRIPE_COLORS_MUTED,
  CATEGORY_LABELS,
  getNotificationCategory,
  getCategoryCounts,
} from '@/components/notifications';
import type { NotificationCategory } from '@/components/notifications';

// ============================================
// BRIEFING ROOM — Notifications Page
// ============================================

type ActiveTab = 'all' | NotificationCategory;

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');

  const {
    notifications: allNotifications,
    unreadCount,
    isLoading,
    markAsRead,
    isMarkingAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotifications();

  // Client-side category filtering
  const notifications = activeTab === 'all'
    ? allNotifications
    : allNotifications.filter((n) => getNotificationCategory(n.type) === activeTab);

  const categoryCounts = getCategoryCounts(allNotifications);

  const handleNotificationTap = async (notification: GpsNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  // Dynamic subtitle
  const attentionCount = allNotifications.filter((n) => !n.isRead).length;
  const subtitle = attentionCount > 0
    ? `${attentionCount} item${attentionCount !== 1 ? 's' : ''} require${attentionCount === 1 ? 's' : ''} your attention today.`
    : 'All clear.';

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back button */}
      <motion.button
        onClick={() => router.push('/dashboard/gps')}
        className="flex items-center gap-1.5 text-[#A8A29E] hover:text-[#44403C] transition-colors mb-8"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        <span className="text-sm">Back to GPS</span>
      </motion.button>

      {/* Header */}
      <motion.header
        className="mb-8"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-4xl text-[#1A2E22] tracking-tight">
              Briefing
            </h1>
            <p className="text-[#A8A29E] mt-1">
              {subtitle}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              disabled={isMarkingAllAsRead}
              className="text-sm text-[#A8A29E] hover:text-[#44403C] hover:underline transition-colors disabled:opacity-50 mt-2"
            >
              {isMarkingAllAsRead ? 'Archiving...' : 'Archive All'}
            </button>
          )}
        </div>
      </motion.header>

      {/* Folder Tabs */}
      <motion.div
        className="flex gap-6 border-b border-stone-200 mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        {BRIEFING_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tab.key === 'all'
            ? allNotifications.length
            : categoryCounts[tab.key as NotificationCategory];

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ActiveTab)}
              className={cn(
                'relative pb-3 text-sm transition-colors whitespace-nowrap',
                isActive
                  ? 'text-[#1A2E22] font-medium'
                  : 'text-[#A8A29E] hover:text-[#44403C]'
              )}
            >
              {tab.label}
              {count > 0 && (
                <sup className="font-mono text-[10px] ml-0.5">
                  {count}
                </sup>
              )}
              {isActive && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1A2E22]"
                  layoutId="activeTab"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Ledger Rows */}
      <div>
        {isLoading ? (
          /* Skeleton loaders */
          <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="px-6 py-5 border-b border-stone-100 last:border-b-0"
              >
                <div className="space-y-2.5">
                  <div className="h-2.5 bg-stone-100 rounded-full w-20 animate-pulse" />
                  <div className="h-3.5 bg-stone-100 rounded-full w-2/3 animate-pulse" />
                  <div className="h-3 bg-stone-50 rounded-full w-full animate-pulse" />
                  <div className="h-2.5 bg-stone-50 rounded-full w-16 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          /* Empty state */
          <motion.div
            className="py-16 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="font-serif text-xl text-[#1A2E22]">No items</p>
            <p className="text-sm text-[#A8A29E] mt-2">
              {activeTab === 'all'
                ? 'Items will appear here as they arrive.'
                : 'No items match this category.'}
            </p>
          </motion.div>
        ) : (
          /* Notification rows */
          <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
            <AnimatePresence mode="popLayout">
              {notifications.map((notification, index) => {
                const category = getNotificationCategory(notification.type);
                const stripeColor = notification.isRead
                  ? CATEGORY_STRIPE_COLORS_MUTED[category]
                  : CATEGORY_STRIPE_COLORS[category];

                return (
                  <motion.button
                    key={notification.id}
                    onClick={() => handleNotificationTap(notification)}
                    disabled={isMarkingAsRead}
                    className={cn(
                      'w-full text-left px-6 py-5 border-l-[3px] transition-colors',
                      'border-b border-stone-100 last:border-b-0',
                      'hover:bg-[#F2F0E9]/40',
                      stripeColor
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: 0.03 * index }}
                    layout
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Category label */}
                        <span className={cn(
                          'text-[10px] uppercase tracking-widest',
                          notification.isRead ? 'text-stone-300' : 'text-[#A8A29E]'
                        )}>
                          {CATEGORY_LABELS[category]}
                        </span>

                        {/* Title */}
                        <p className={cn(
                          'font-serif text-base leading-snug mt-1',
                          notification.isRead
                            ? 'text-[#A8A29E]'
                            : 'text-[#1A2E22]'
                        )}>
                          {notification.title}
                        </p>

                        {/* Body */}
                        <p className={cn(
                          'text-sm mt-0.5 line-clamp-2',
                          notification.isRead
                            ? 'text-stone-300'
                            : 'text-[#44403C]'
                        )}>
                          {notification.message}
                        </p>

                        {/* Timestamp */}
                        <p className="font-mono text-xs text-[#A8A29E] mt-2">
                          {formatDate(notification.createdAt, { relative: true })}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!notification.isRead && (
                        <span className="mt-2 w-[6px] h-[6px] rounded-full bg-[#C2410C] flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
