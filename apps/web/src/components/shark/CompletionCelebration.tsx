'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { SavingsTicker } from './SavingsTicker';

interface CompletionCelebrationProps {
  totalReviewed: number;
  totalSaved: number;
  currency: string;
  cancelledCount: number;
  keptCount: number;
}

export function CompletionCelebration({
  totalReviewed,
  totalSaved,
  currency,
  cancelledCount,
  keptCount,
}: CompletionCelebrationProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-8 text-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Audit complete icon */}
      <motion.div
        className="relative mb-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-full">
          <Check className="w-12 h-12 text-[#064E3B]" />
        </div>
      </motion.div>

      <motion.h2
        className="text-3xl font-serif text-[#1A2E22] mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Audit Complete
      </motion.h2>

      <motion.p
        className="text-stone-500 mb-6 max-w-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        You reviewed {totalReviewed} subscription{totalReviewed !== 1 ? 's' : ''}
      </motion.p>

      {/* Savings card */}
      {totalSaved > 0 && (
        <motion.div
          className="mb-6 px-8 py-5 rounded-lg bg-white border border-stone-200 shadow-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-xs uppercase tracking-wider text-stone-400 mb-1">
            Annual Savings
          </p>
          <SavingsTicker
            amount={totalSaved}
            currency={currency}
            size="lg"
            className="text-[#064E3B] font-serif"
            duration={1500}
          />
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        className="flex gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="px-6 py-3 bg-white border border-stone-200 rounded-lg shadow-sm">
          <p className="text-2xl font-serif text-[#1A2E22]">{keptCount}</p>
          <p className="text-xs uppercase tracking-wider text-stone-400 mt-1">Kept</p>
        </div>
        <div className="px-6 py-3 bg-white border border-stone-200 rounded-lg shadow-sm">
          <p className="text-2xl font-serif text-[#1A2E22]">{cancelledCount}</p>
          <p className="text-xs uppercase tracking-wider text-stone-400 mt-1">Cancelled</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
