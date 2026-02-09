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
      {/* Paper receipt summary */}
      <div className="bg-white border border-stone-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-5 h-5 text-[#064E3B]" />
          <h3 className="text-sm font-medium text-[#1A2E22]">Your Savings</h3>
        </div>
        <p className="text-4xl font-serif text-[#064E3B] tabular-nums">
          {symbol}{Math.round(history.totalLifetimeSavings).toLocaleString()}
          <span className="text-lg text-stone-400 font-sans font-normal">/yr</span>
        </p>

        {/* Dashed separator */}
        <div className="border-t border-dashed border-stone-200 my-4" />

        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <X className="w-3 h-3 text-orange-600" />
            {history.totalCancelled} cancelled
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Check className="w-3 h-3 text-green-700" />
            {history.totalKept} kept
          </div>
        </div>
      </div>

      {/* Decision list */}
      {history.decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">Recent Decisions</h4>
          <div>
            {history.decisions.slice(0, 10).map((d, i) => (
              <motion.div
                key={d.id}
                className="flex items-center gap-3 py-3 border-b border-stone-100"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  d.action === 'CANCEL'
                    ? 'bg-orange-50'
                    : d.action === 'KEEP'
                    ? 'bg-green-50'
                    : 'bg-stone-50'
                }`}>
                  {d.action === 'CANCEL' ? (
                    <X className="w-3 h-3 text-orange-600" />
                  ) : d.action === 'KEEP' ? (
                    <Check className="w-3 h-3 text-green-700" />
                  ) : (
                    <Clock className="w-3 h-3 text-stone-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1A2E22] truncate">{d.subscriptionName}</p>
                  <p className="text-xs text-stone-400">
                    {new Date(d.decidedAt).toLocaleDateString()}
                  </p>
                </div>
                {d.annualSavings > 0 && (
                  <span className="text-xs font-mono text-[#064E3B] font-medium flex-shrink-0 tabular-nums">
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
