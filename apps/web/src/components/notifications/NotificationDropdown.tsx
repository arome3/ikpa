'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  Trophy,
  Flame,
  Target,
  Navigation,
  CheckCheck,
  X,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useNotifications, GpsNotification } from '@/hooks/useNotifications';

// ============================================
// NOTIFICATION DROPDOWN
// ============================================

const notificationIcons: Record<GpsNotification['type'], typeof AlertTriangle> = {
  BUDGET_WARNING: AlertTriangle,
  BUDGET_EXCEEDED: AlertTriangle,
  BUDGET_CRITICAL: AlertTriangle,
  RECOVERY_REMINDER: Navigation,
  MILESTONE_REACHED: Target,
  STREAK_BROKEN: Flame,
  ACHIEVEMENT_EARNED: Trophy,
};

const notificationColors: Record<GpsNotification['type'], string> = {
  BUDGET_WARNING: 'text-amber-400 bg-amber-500/20',
  BUDGET_EXCEEDED: 'text-caution-400 bg-caution-500/20',
  BUDGET_CRITICAL: 'text-red-400 bg-red-500/20',
  RECOVERY_REMINDER: 'text-primary-400 bg-primary-500/20',
  MILESTONE_REACHED: 'text-green-400 bg-green-500/20',
  STREAK_BROKEN: 'text-orange-400 bg-orange-500/20',
  ACHIEVEMENT_EARNED: 'text-yellow-400 bg-yellow-500/20',
};

interface NotificationDropdownProps {
  className?: string;
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
  } = useNotifications({ limit: 10 });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: GpsNotification) => {
    // Mark as read
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Navigate if there's an action URL
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    } else if (notification.sessionId) {
      router.push(`/dashboard/gps/recovery/${notification.sessionId}`);
    } else {
      router.push('/dashboard/gps');
    }

    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative p-2 rounded-xl',
          'text-gray-500 hover:text-gray-700',
          'hover:bg-gray-100 dark:hover:bg-slate-800',
          'dark:text-gray-400 dark:hover:text-gray-200',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
        )}
        aria-label={unreadCount > 0 ? `${unreadCount} new notifications` : 'View notifications'}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-caution-500 text-white text-xs font-bold rounded-full"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden z-50"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    disabled={isMarkingAllAsRead}
                    className="text-xs text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="inline-flex p-3 bg-gray-100 dark:bg-slate-800 rounded-full mb-3">
                    <Bell className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-slate-400">No notifications yet</p>
                  <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                    You&apos;ll see budget alerts here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {notifications.map((notification, index) => {
                    const Icon = notificationIcons[notification.type] || Bell;
                    const colorClass = notificationColors[notification.type] || 'text-gray-400 bg-gray-500/20';

                    return (
                      <motion.button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          'w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors',
                          !notification.isRead && 'bg-primary-50/50 dark:bg-primary-500/5'
                        )}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.02 * index }}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={cn('p-2 rounded-lg flex-shrink-0', colorClass)}>
                            <Icon className="w-4 h-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={cn(
                                'font-medium text-sm',
                                notification.isRead
                                  ? 'text-gray-700 dark:text-slate-300'
                                  : 'text-gray-900 dark:text-white'
                              )}>
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                              {formatDate(notification.createdAt, { relative: true })}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => {
                    router.push('/dashboard/gps');
                    setIsOpen(false);
                  }}
                  className="w-full py-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
                >
                  View GPS Dashboard
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationDropdown;
