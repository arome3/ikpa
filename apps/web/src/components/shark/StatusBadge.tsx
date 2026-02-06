'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { SubscriptionStatus } from '@/hooks/useShark';

const statusConfig: Record<SubscriptionStatus, { label: string; color: string; bg: string; pulse?: boolean }> = {
  ZOMBIE: {
    label: 'Zombie',
    color: 'text-amber-300',
    bg: 'bg-amber-500/15 border-amber-500/30',
    pulse: true,
  },
  ACTIVE: {
    label: 'Active',
    color: 'text-teal-300',
    bg: 'bg-teal-500/15 border-teal-500/30',
  },
  UNKNOWN: {
    label: 'Unknown',
    color: 'text-slate-300',
    bg: 'bg-slate-500/15 border-slate-500/30',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'text-neutral-400',
    bg: 'bg-neutral-500/15 border-neutral-500/30',
  },
};

interface StatusBadgeProps {
  status: SubscriptionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.UNKNOWN;

  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        config.bg,
        config.color,
        className
      )}
    >
      {/* Pulsing dot for zombies */}
      {config.pulse ? (
        <span className="relative flex h-2 w-2">
          <motion.span
            className="absolute inset-0 rounded-full bg-amber-400"
            animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex rounded-full h-2 w-2',
            status === 'ACTIVE' && 'bg-teal-400',
            status === 'UNKNOWN' && 'bg-slate-400',
            status === 'CANCELLED' && 'bg-neutral-500'
          )}
        />
      )}
      {config.label}
    </span>
  );
}
