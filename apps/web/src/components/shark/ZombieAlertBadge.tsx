'use client';

import { motion } from 'framer-motion';
import { Fish, ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/utils';
import { useCountUp, formatWithSeparators } from '@/hooks/useCountUp';

interface ZombieAlertBadgeProps {
  zombieCount: number;
  potentialSavings: number;
  currency: string;
  onClick: () => void;
}

export function ZombieAlertBadge({
  zombieCount,
  potentialSavings,
  currency,
  onClick,
}: ZombieAlertBadgeProps) {
  const symbol = getCurrencySymbol(currency);
  const { value: countValue } = useCountUp({ to: zombieCount, duration: 600 });
  const { value: savingsValue } = useCountUp({ to: potentialSavings, duration: 1000 });

  if (zombieCount === 0) return null;

  return (
    <motion.button
      onClick={onClick}
      className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 border border-amber-500/20 p-4 text-left"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Ambient glow */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />

      <div className="relative flex items-center gap-3">
        {/* Icon with pulse */}
        <div className="relative flex-shrink-0">
          <motion.div
            className="p-2.5 bg-amber-500/15 rounded-xl"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Fish className="w-6 h-6 text-amber-400" />
          </motion.div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">
            {formatWithSeparators(countValue)} zombie subscription{zombieCount !== 1 ? 's' : ''} found
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Save up to{' '}
            <span className="text-teal-300 font-medium">
              {symbol}{formatWithSeparators(savingsValue)}
            </span>
            /year
          </p>
        </div>

        <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
      </div>
    </motion.button>
  );
}
