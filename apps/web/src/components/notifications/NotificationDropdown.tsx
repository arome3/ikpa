'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useNotifications, GpsNotification } from '@/hooks/useNotifications';
import {
  getNotificationCategory,
  CATEGORY_STRIPE_COLORS,
  CATEGORY_STRIPE_COLORS_MUTED,
} from './notification.constants';

// ============================================
// NOTIFICATION DROPDOWN — "Correspondence"
// ============================================

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
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

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
          'relative p-2 rounded-full',
          'text-stone-400 hover:text-stone-600 hover:bg-stone-100',
          'transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[#064E3B]/20 focus:ring-offset-2'
        )}
        aria-label={unreadCount > 0 ? `${unreadCount} new notifications` : 'View notifications'}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-[#C2410C] text-white font-mono text-[10px] font-semibold rounded-full"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden z-50"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-serif text-base text-[#1A2E22]">
                Correspondence
              </h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    disabled={isMarkingAllAsRead}
                    className="text-xs text-[#A8A29E] hover:text-[#44403C] hover:underline transition-colors disabled:opacity-50"
                  >
                    {isMarkingAllAsRead ? 'Archiving...' : 'Archive all'}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-stone-300 hover:text-stone-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Rows */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="font-serif text-base text-[#1A2E22]">No correspondence</p>
                  <p className="text-sm text-[#A8A29E] mt-1">
                    Items will appear here as they arrive.
                  </p>
                </div>
              ) : (
                <div>
                  {notifications.map((notification, index) => {
                    const category = getNotificationCategory(notification.type);
                    const stripeColor = notification.isRead
                      ? CATEGORY_STRIPE_COLORS_MUTED[category]
                      : CATEGORY_STRIPE_COLORS[category];

                    return (
                      <motion.button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          'w-full text-left px-5 py-4 border-l-2 transition-colors',
                          'border-b border-stone-50 last:border-b-0',
                          'hover:bg-[#F2F0E9]/50',
                          stripeColor
                        )}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.02 * index }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-serif text-sm leading-snug',
                              notification.isRead
                                ? 'text-[#A8A29E]'
                                : 'text-[#1A2E22]'
                            )}>
                              {notification.title}
                            </p>
                            <p className={cn(
                              'text-sm mt-0.5 line-clamp-1',
                              notification.isRead
                                ? 'text-stone-300'
                                : 'text-[#44403C]'
                            )}>
                              {notification.message}
                            </p>
                            <p className="font-mono text-[11px] text-[#A8A29E] mt-1">
                              {formatDate(notification.createdAt, { relative: true })}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <span className="mt-1.5 w-[6px] h-[6px] rounded-full bg-[#C2410C] flex-shrink-0" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-stone-100">
                <button
                  onClick={() => {
                    router.push('/dashboard/gps/notifications');
                    setIsOpen(false);
                  }}
                  className="text-sm text-[#064E3B] hover:underline transition-colors"
                >
                  View full briefing
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
