'use client';

import { cn } from '@/lib/utils';
import type { SubscriptionStatus } from '@/hooks/useShark';

const statusConfig: Record<SubscriptionStatus, { label: string; color: string }> = {
  ZOMBIE: {
    label: 'Zombie',
    color: 'border-orange-200 text-orange-700 bg-orange-50',
  },
  ACTIVE: {
    label: 'Active',
    color: 'border-green-200 text-green-700 bg-green-50',
  },
  UNKNOWN: {
    label: 'Unknown',
    color: 'border-stone-200 text-stone-600 bg-stone-50',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: 'border-stone-200 text-stone-500 bg-stone-50',
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
        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
