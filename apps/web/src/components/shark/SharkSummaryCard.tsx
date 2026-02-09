'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, HelpCircle, XCircle, Fish } from 'lucide-react';
import { useCountUp, formatWithSeparators } from '@/hooks/useCountUp';
import { getCurrencySymbol } from '@/lib/utils';
import type { SubscriptionSummary } from '@/hooks/useShark';

interface SharkSummaryCardProps {
  summary: SubscriptionSummary | null;
  isLoading: boolean;
  pendingCount: number;
  onScan: () => void;
  onReview: () => void;
}

export function SharkSummaryCard({
  summary,
  isLoading,
  pendingCount,
  onScan,
  onReview,
}: SharkSummaryCardProps) {
  const symbol = getCurrencySymbol(summary?.currency ?? 'USD');

  const zombiePlusCancelled = (summary?.zombieCount ?? 0) + (summary?.cancelledCount ?? 0);

  const { value: zombieValue } = useCountUp({
    to: zombiePlusCancelled,
    duration: 800,
  });

  const { value: savingsValue } = useCountUp({
    to: summary?.potentialAnnualSavings ?? 0,
    duration: 1200,
    decimals: 0,
  });

  if (isLoading) {
    return (
      <div className="border-y border-stone-200 py-8 animate-pulse">
        <div className="h-12 w-48 bg-stone-100 rounded mb-4" />
        <div className="h-8 w-32 bg-stone-100 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      className="border-y border-stone-200 py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Hero stats row */}
      <div className="flex flex-wrap items-end gap-8 mb-6">
        {/* Zombie count */}
        <div>
          <p className="text-xs font-bold tracking-widest text-orange-800 uppercase mb-1">
            Issues Found
          </p>
          <span className="text-6xl font-serif text-[#C2410C] tabular-nums">
            {formatWithSeparators(zombieValue)}
          </span>
        </div>

        {/* Potential savings */}
        {(summary?.potentialAnnualSavings ?? 0) > 0 && (
          <div>
            <p className="text-xs font-bold tracking-widest text-emerald-800 uppercase mb-1">
              Potential Savings
            </p>
            <span className="text-4xl font-mono text-[#064E3B] tabular-nums">
              {symbol}{formatWithSeparators(savingsValue)}
              <span className="text-lg text-stone-400 font-normal">/yr</span>
            </span>
          </div>
        )}

        {/* Cancelled count */}
        {(summary?.cancelledCount ?? 0) > 0 && (
          <div>
            <p className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-1">
              Cancelled
            </p>
            <span className="text-3xl font-serif text-stone-500 tabular-nums">
              {summary?.cancelledCount ?? 0}
            </span>
          </div>
        )}
      </div>

      {/* Status counts */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
          <span className="font-mono text-sm text-stone-600 tabular-nums">
            {summary?.activeCount ?? 0}
          </span>
          <span className="text-xs text-stone-400 uppercase tracking-wider">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
          <span className="font-mono text-sm text-stone-600 tabular-nums">
            {summary?.zombieCount ?? 0}
          </span>
          <span className="text-xs text-stone-400 uppercase tracking-wider">Zombie</span>
        </div>
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
          <span className="font-mono text-sm text-stone-600 tabular-nums">
            {summary?.unknownCount ?? 0}
          </span>
          <span className="text-xs text-stone-400 uppercase tracking-wider">Unknown</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5 text-stone-400" />
          <span className="font-mono text-sm text-stone-600 tabular-nums">
            {summary?.cancelledCount ?? 0}
          </span>
          <span className="text-xs text-stone-400 uppercase tracking-wider">Cancelled</span>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        {pendingCount > 0 && (
          <button
            onClick={onReview}
            className="rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Review {pendingCount} Subscription{pendingCount !== 1 ? 's' : ''}
          </button>
        )}
        <button
          onClick={onScan}
          className="rounded-full border border-stone-300 hover:border-stone-400 text-stone-700 px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Fish className="w-4 h-4" />
          Scan Expenses
        </button>
      </div>
    </motion.div>
  );
}
