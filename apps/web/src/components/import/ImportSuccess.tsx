'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Fish } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import { Button } from '@/components/ui';

interface ImportSuccessProps {
  expensesCreated: number;
  skipped: number;
  onViewExpenses: () => void;
  onRunShark: () => void;
}

export function ImportSuccess({
  expensesCreated,
  skipped,
  onViewExpenses,
  onRunShark,
}: ImportSuccessProps) {
  const { value: animatedCount } = useCountUp({
    to: expensesCreated,
    duration: 800,
    easing: 'easeOut',
  });

  return (
    <motion.div
      className={cn(
        'rounded-2xl p-8 text-center',
        'bg-emerald-50 border border-emerald-200',
        'dark:bg-emerald-500/5 dark:border-emerald-500/20',
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      {/* Checkmark burst */}
      <div className="relative inline-flex items-center justify-center mb-6">
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-500/20"
          initial={{ scale: 0 }}
          animate={{ scale: [0, 2, 0] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="relative"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
        >
          <CheckCircle2 className="w-16 h-16 text-emerald-500 dark:text-emerald-400" />
        </motion.div>
      </div>

      {/* Count */}
      <motion.h2
        className="text-3xl font-bold text-slate-900 dark:text-white mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {animatedCount} expense{expensesCreated !== 1 ? 's' : ''} imported!
      </motion.h2>

      {/* Skipped info */}
      {skipped > 0 && (
        <motion.p
          className="text-sm text-slate-500 dark:text-slate-400 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {skipped} skipped (duplicates)
        </motion.p>
      )}

      {skipped === 0 && <div className="mb-6" />}

      {/* CTAs */}
      <motion.div
        className="flex flex-col sm:flex-row items-center justify-center gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          variant="primary"
          size="lg"
          onClick={onViewExpenses}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          View Expenses
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={onRunShark}
          leftIcon={<Fish className="w-4 h-4" />}
        >
          Run Shark Audit
        </Button>
      </motion.div>
    </motion.div>
  );
}
