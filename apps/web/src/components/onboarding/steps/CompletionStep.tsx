'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

interface CompletionStepProps {
  onComplete: () => Promise<void>;
  isCompleting: boolean;
}

export function CompletionStep({ onComplete, isCompleting }: CompletionStepProps) {
  // Trigger confetti on mount
  useEffect(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: NodeJS.Timeout = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#10B981', '#F59E0B', '#3B82F6'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#10B981', '#F59E0B', '#3B82F6'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const completedItems = [
    { label: 'Profile configured', icon: '🌍' },
    { label: 'Income sources added', icon: '💰' },
    { label: 'Savings tracked', icon: '🏦' },
    { label: 'Debts organized', icon: '📊' },
    { label: 'Goals defined', icon: '🎯' },
    { label: 'Budgets set', icon: '📋' },
  ];

  return (
    <motion.div
      className="text-center space-y-8 max-w-lg mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Celebration Icon */}
      <motion.div
        className="relative inline-block"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
      >
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30">
          <Sparkles className="w-12 h-12" />
        </div>
        {/* Animated rings */}
        <motion.div
          className="absolute inset-0 rounded-3xl border-2 border-emerald-500/30"
          animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 rounded-3xl border-2 border-emerald-500/30"
          animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
      </motion.div>

      {/* Heading */}
      <div>
        <motion.h2
          className="text-3xl sm:text-4xl font-display font-bold text-neutral-900 dark:text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          You&apos;re All Set!
        </motion.h2>
        <motion.p
          className="mt-3 text-lg text-neutral-600 dark:text-neutral-400"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Your financial profile is complete. Let&apos;s start building your wealth together.
        </motion.p>
      </div>

      {/* Completed Items */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {completedItems.map((item, index) => (
          <motion.div
            key={item.label}
            className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {item.label}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* What's Next */}
      <motion.div
        className="p-6 rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 border border-neutral-200 dark:border-neutral-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">
          What happens next?
        </h3>
        <ul className="space-y-2 text-left text-sm text-neutral-600 dark:text-neutral-400">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span>Your Cash Flow Score will be calculated based on your data</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span>AI will analyze your finances and provide personalized insights</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span>Start tracking expenses and watch your progress grow</span>
          </li>
        </ul>
      </motion.div>

      {/* Complete Button */}
      <motion.button
        onClick={onComplete}
        disabled={isCompleting}
        className={cn(
          'w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200',
          'bg-gradient-to-r from-emerald-500 to-emerald-600',
          'hover:from-emerald-600 hover:to-emerald-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30',
          'focus:outline-none focus:ring-4 focus:ring-emerald-500/30'
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        whileHover={!isCompleting ? { scale: 1.02 } : {}}
        whileTap={!isCompleting ? { scale: 0.98 } : {}}
      >
        {isCompleting ? (
          <span className="inline-flex items-center gap-2">
            <motion.span
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            Finishing up...
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            Go to Dashboard
            <ArrowRight className="w-5 h-5" />
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}
