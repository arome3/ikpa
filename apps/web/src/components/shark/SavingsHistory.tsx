'use client';

import { motion } from 'framer-motion';
import { TrendingDown, Check, X, Clock } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/utils';
import type { DecisionHistoryResult } from '@/hooks/useShark';

interface SavingsHistoryProps {
  history: DecisionHistoryResult;
}

export function SavingsHistory({ history }: SavingsHistoryProps) {
  const symbol = getCurrencySymbol(history.currency);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Savings summary card */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-teal-500/15 to-emerald-500/10 border border-teal-500/20">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-5 h-5 text-teal-400" />
          <h3 className="text-sm font-medium text-teal-300">Your Savings</h3>
        </div>
        <p className="text-3xl font-bold text-white mb-1">
          {symbol}{Math.round(history.totalLifetimeSavings).toLocaleString()}
          <span className="text-lg text-slate-400 font-normal">/yr</span>
        </p>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <X className="w-3 h-3 text-red-400" />
            {history.totalCancelled} cancelled
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Check className="w-3 h-3 text-emerald-400" />
            {history.totalKept} kept
          </div>
        </div>
      </div>

      {/* Recent decisions list */}
      {history.decisions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Recent Decisions</h4>
          <div className="space-y-1.5">
            {history.decisions.slice(0, 10).map((d, i) => (
              <motion.div
                key={d.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  d.action === 'CANCEL'
                    ? 'bg-red-500/20'
                    : d.action === 'KEEP'
                    ? 'bg-emerald-500/20'
                    : 'bg-slate-500/20'
                }`}>
                  {d.action === 'CANCEL' ? (
                    <X className="w-3 h-3 text-red-400" />
                  ) : d.action === 'KEEP' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Clock className="w-3 h-3 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{d.subscriptionName}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(d.decidedAt).toLocaleDateString()}
                  </p>
                </div>
                {d.annualSavings > 0 && (
                  <span className="text-xs text-teal-400 font-medium flex-shrink-0">
                    -{symbol}{Math.round(d.annualSavings).toLocaleString()}/yr
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
