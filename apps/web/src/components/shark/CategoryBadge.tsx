'use client';

import {
  Play,
  Tv,
  Dumbbell,
  Cloud,
  Code,
  Shield,
  GraduationCap,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubscriptionCategory } from '@/hooks/useShark';

const categoryConfig: Record<SubscriptionCategory, { icon: LucideIcon; color: string; bg: string }> = {
  STREAMING: { icon: Play, color: 'text-purple-400', bg: 'bg-purple-500/15' },
  TV_CABLE: { icon: Tv, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  FITNESS: { icon: Dumbbell, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  CLOUD_STORAGE: { icon: Cloud, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  SOFTWARE: { icon: Code, color: 'text-indigo-400', bg: 'bg-indigo-500/15' },
  VPN: { icon: Shield, color: 'text-teal-400', bg: 'bg-teal-500/15' },
  LEARNING: { icon: GraduationCap, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  OTHER: { icon: CreditCard, color: 'text-slate-400', bg: 'bg-slate-500/15' },
};

interface CategoryBadgeProps {
  category: SubscriptionCategory;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function CategoryBadge({ category, showLabel = true, size = 'sm', className }: CategoryBadgeProps) {
  const config = categoryConfig[category] ?? categoryConfig.OTHER;
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const label = category
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        config.bg,
        config.color,
        className
      )}
    >
      <Icon className={iconSize} />
      {showLabel && label}
    </span>
  );
}

/** Get the icon component for a category */
export function getCategoryIcon(category: SubscriptionCategory): LucideIcon {
  return (categoryConfig[category] ?? categoryConfig.OTHER).icon;
}

/** Get the color class for a category */
export function getCategoryColor(category: SubscriptionCategory): string {
  return (categoryConfig[category] ?? categoryConfig.OTHER).color;
}
