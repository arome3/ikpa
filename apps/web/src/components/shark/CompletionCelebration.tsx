'use client';

import { motion } from 'framer-motion';
import { PartyPopper, TrendingDown, Check, X } from 'lucide-react';
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
      {/* Celebration icon */}
      <motion.div
        className="relative mb-6"
        initial={{ rotate: -10 }}
        animate={{ rotate: [0, -5, 5, 0] }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="p-5 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-full">
          <PartyPopper className="w-12 h-12 text-cyan-300" />
        </div>
        {/* Burst particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-cyan-400"
            style={{
              top: '50%',
              left: '50%',
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos((i * 60 * Math.PI) / 180) * 60,
              y: Math.sin((i * 60 * Math.PI) / 180) * 60,
              opacity: 0,
              scale: 0,
            }}
            transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </motion.div>

      <motion.h2
        className="text-2xl font-bold text-white mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        All Reviewed!
      </motion.h2>

      <motion.p
        className="text-slate-400 mb-6 max-w-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        You reviewed {totalReviewed} subscription{totalReviewed !== 1 ? 's' : ''}
      </motion.p>

      {/* Savings counter */}
      {totalSaved > 0 && (
        <motion.div
          className="mb-6 px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-teal-500/20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-teal-400" />
            <p className="text-sm text-teal-300/70">Annual Savings</p>
          </div>
          <SavingsTicker
            amount={totalSaved}
            currency={currency}
            size="lg"
            className="text-teal-300"
            duration={1500}
          />
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        className="flex gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-500/20 rounded-full">
            <Check className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-white">{keptCount}</span> kept
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/20 rounded-full">
            <X className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-sm text-slate-300">
            <span className="font-semibold text-white">{cancelledCount}</span> cancelled
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
