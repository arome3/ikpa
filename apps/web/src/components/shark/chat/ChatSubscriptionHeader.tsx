'use client';

import { ArrowLeft } from 'lucide-react';
import { CategoryBadge } from '../CategoryBadge';
import { getCurrencySymbol } from '@/lib/utils';
import type { Subscription } from '@/hooks/useShark';

interface ChatSubscriptionHeaderProps {
  subscription: Subscription;
  onBack: () => void;
}

export function ChatSubscriptionHeader({
  subscription,
  onBack,
}: ChatSubscriptionHeaderProps) {
  const symbol = getCurrencySymbol(subscription.currency);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border-b border-white/10 backdrop-blur-sm">
      <button
        onClick={onBack}
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5 text-slate-400" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {subscription.name}
        </p>
        <p className="text-xs text-slate-400">
          {symbol}
          {Math.abs(subscription.monthlyCost).toLocaleString()}/mo
        </p>
      </div>
      <CategoryBadge category={subscription.category} size="sm" />
    </div>
  );
}
