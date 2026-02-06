'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationDropdown } from '@/components/notifications';

export interface DashboardHeaderProps {
  /** Additional class names */
  className?: string;
  /** User's first name for greeting */
  firstName?: string;
  /** Whether there are unread notifications */
  hasNotifications?: boolean;
  /** Callback when notification bell is clicked */
  onNotificationsClick?: () => void;
  /** Callback when settings is clicked */
  onSettingsClick?: () => void;
}

/**
 * Get time-based greeting
 */
function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Dashboard header with time-based greeting and action icons
 */
export function DashboardHeader({
  className,
  firstName = 'there',
  onSettingsClick,
}: DashboardHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <motion.header
      className={cn(
        'flex items-center justify-between py-4',
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Here&apos;s your financial snapshot
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Notification dropdown */}
          <NotificationDropdown />

          {/* Settings */}
          <button
            onClick={onSettingsClick}
            className={cn(
              'p-2 rounded-xl',
              'text-gray-500 hover:text-gray-700',
              'hover:bg-gray-100 dark:hover:bg-slate-800',
              'dark:text-gray-400 dark:hover:text-gray-200',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
            )}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
    </motion.header>
  );
}
