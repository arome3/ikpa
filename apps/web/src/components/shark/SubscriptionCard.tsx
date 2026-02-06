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
        'w-full flex items-center gap-3 p-4 rounded-xl border backdrop-blur-sm text-left transition-colors',
        subscription.status === 'ZOMBIE'
          ? 'bg-amber-500/5 border-amber-500/15 hover:border-amber-500/30'
          : 'bg-white/5 border-white/10 hover:border-white/20'
      )}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      {/* Category icon */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          subscription.status === 'ZOMBIE' ? 'bg-amber-500/15' : 'bg-white/10'
        )}
      >
        <Icon
          className={cn(
            'w-5 h-5',
            subscription.status === 'ZOMBIE' ? 'text-amber-400' : 'text-slate-300'
          )}
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium text-white truncate">{subscription.name}</p>
          <StatusBadge status={subscription.status} />
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge category={subscription.category} size="sm" />
          <span className="text-xs text-slate-500">
            {subscription.chargeCount} charge{subscription.chargeCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Cost */}
      <div className="flex-shrink-0 text-right">
        <div className="flex items-center gap-1 justify-end">
          {subscription.priceChangePercent != null && Math.abs(subscription.priceChangePercent) >= 5 && (
            <span className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
              subscription.priceChangePercent > 0
                ? 'bg-red-500/20 text-red-300'
                : 'bg-emerald-500/20 text-emerald-300'
            )}>
              <TrendingUp className={cn('w-2.5 h-2.5', subscription.priceChangePercent < 0 && 'rotate-180')} />
              {subscription.priceChangePercent > 0 ? '+' : ''}{Math.round(subscription.priceChangePercent)}%
            </span>
          )}
          <p className="font-semibold text-white tabular-nums">
            {formatCurrency(subscription.monthlyCost, subscription.currency)}
          </p>
        </div>
        <p className="text-xs text-slate-400">/month</p>
      </div>

      {onClick && <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
    </motion.button>
  );
}
