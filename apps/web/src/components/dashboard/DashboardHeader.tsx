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
 * Dashboard header with editorial serif greeting
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
          <h1 className="text-3xl md:text-4xl font-serif text-[#1A2E22] tracking-tight">
            {greeting}, {firstName}.
          </h1>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Notification dropdown */}
          <NotificationDropdown />

          {/* Settings */}
          <button
            onClick={onSettingsClick}
            className={cn(
              'p-2 rounded-full',
              'text-stone-400 hover:text-stone-600',
              'hover:bg-stone-100',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
            )}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
    </motion.header>
  );
}
