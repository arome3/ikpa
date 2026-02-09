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

const categoryConfig: Record<SubscriptionCategory, { icon: LucideIcon; color: string }> = {
  STREAMING: { icon: Play, color: 'text-purple-600' },
  TV_CABLE: { icon: Tv, color: 'text-blue-600' },
  FITNESS: { icon: Dumbbell, color: 'text-emerald-600' },
  CLOUD_STORAGE: { icon: Cloud, color: 'text-cyan-600' },
  SOFTWARE: { icon: Code, color: 'text-indigo-600' },
  VPN: { icon: Shield, color: 'text-teal-600' },
  LEARNING: { icon: GraduationCap, color: 'text-amber-600' },
  OTHER: { icon: CreditCard, color: 'text-stone-600' },
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
        'inline-flex items-center gap-1.5 rounded-md font-medium bg-stone-100 text-stone-600',
        size === 'sm' ? 'px-2 py-0.5 text-[10px] uppercase tracking-wider' : 'px-3 py-1.5 text-sm',
        className
      )}
    >
      <Icon className={cn(iconSize, config.color)} />
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
