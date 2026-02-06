'use client';

import { motion } from 'framer-motion';
import { Fish, AlertTriangle, CheckCircle, HelpCircle, XCircle } from 'lucide-react';
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
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 animate-pulse">
        <div className="h-8 w-48 bg-white/10 rounded mb-4" />
        <div className="h-16 w-32 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-950/80 via-slate-900/90 to-slate-900 border border-cyan-500/20 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Ambient glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-teal-500/8 rounded-full blur-2xl" />

      <div className="relative p-6">
        {/* Zombie count hero */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-sm text-cyan-300/70 font-medium mb-1">Zombie Subscriptions</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-white tabular-nums">
                {formatWithSeparators(zombieValue)}
              </span>
              <span className="text-lg text-amber-400/80">detected</span>
            </div>
          </div>
          {zombiePlusCancelled > 0 && (
            <motion.div
              className="p-2.5 bg-amber-500/15 rounded-xl"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </motion.div>
          )}
        </div>

        {/* Potential savings */}
        {(summary?.potentialAnnualSavings ?? 0) > 0 && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20">
            <p className="text-xs text-teal-300/70 mb-0.5">Potential Annual Savings</p>
            <span className="text-2xl font-bold text-teal-300 tabular-nums">
              {symbol}{formatWithSeparators(savingsValue)}
            </span>
          </div>
        )}

        {/* Status counts */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="px-2 py-2.5 rounded-lg bg-white/5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs text-slate-400">Active</span>
            </div>
            <p className="text-lg font-bold text-white">{summary?.activeCount ?? 0}</p>
          </div>
          <div className="px-2 py-2.5 rounded-lg bg-white/5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-slate-400">Zombie</span>
            </div>
            <p className="text-lg font-bold text-white">{summary?.zombieCount ?? 0}</p>
          </div>
          <div className="px-2 py-2.5 rounded-lg bg-white/5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">Unknown</span>
            </div>
            <p className="text-lg font-bold text-white">{summary?.unknownCount ?? 0}</p>
          </div>
          <div className="px-2 py-2.5 rounded-lg bg-white/5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-slate-400">Cancelled</span>
            </div>
            <p className="text-lg font-bold text-white">{summary?.cancelledCount ?? 0}</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-3">
          {pendingCount > 0 && (
            <button
              onClick={onReview}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
            >
              Review {pendingCount} Subscription{pendingCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={onScan}
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm border border-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <Fish className="w-4 h-4" />
            Scan Expenses
          </button>
        </div>
      </div>
    </motion.div>
  );
}
