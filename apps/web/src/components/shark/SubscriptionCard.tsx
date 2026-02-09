'use client';

import { motion } from 'framer-motion';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { CategoryBadge, getCategoryIcon } from './CategoryBadge';
import { StatusBadge } from './StatusBadge';
import type { Subscription, SwipeAction } from '@/hooks/useShark';

interface SubscriptionCardProps {
  subscription: Subscription;
  onClick?: () => void;
  onSwipe?: (action: SwipeAction) => void;
  delay?: number;
}

export function SubscriptionCard({ subscription, onClick, delay = 0 }: SubscriptionCardProps) {
  const Icon = getCategoryIcon(subscription.category);

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 py-4 border-b border-stone-100 text-left transition-colors',
        subscription.status === 'ZOMBIE'
          ? 'bg-orange-50/40 hover:bg-orange-50/70'
          : 'hover:bg-stone-50/50'
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      {/* Category icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-stone-100">
        <Icon className="w-5 h-5 text-stone-500 stroke-[1.5]" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-sans font-medium text-[#1A2E22] truncate">{subscription.name}</p>
          <StatusBadge status={subscription.status} />
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge category={subscription.category} size="sm" />
          <span className="text-xs text-stone-400">
            {subscription.chargeCount} charge{subscription.chargeCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Cost */}
      <div className="flex-shrink-0 text-right">
        <div className="flex items-center gap-1 justify-end">
          {subscription.priceChangePercent != null && Math.abs(subscription.priceChangePercent) >= 5 && (
            <span className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium border',
              subscription.priceChangePercent > 0
                ? 'border-orange-200 text-orange-700 bg-orange-50'
                : 'border-green-200 text-green-700 bg-green-50'
            )}>
              <TrendingUp className={cn('w-2.5 h-2.5', subscription.priceChangePercent < 0 && 'rotate-180')} />
              {subscription.priceChangePercent > 0 ? '+' : ''}{Math.round(subscription.priceChangePercent)}%
            </span>
          )}
          <p className="font-mono text-lg text-[#1A2E22] tabular-nums">
            {formatCurrency(subscription.monthlyCost, subscription.currency)}
          </p>
        </div>
        <p className="text-xs text-stone-400">/month</p>
      </div>

      {onClick && <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />}
    </motion.button>
  );
}
