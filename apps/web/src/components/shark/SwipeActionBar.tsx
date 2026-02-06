'use client';

import { motion } from 'framer-motion';
import { X, Clock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeActionBarProps {
  onKeep: () => void;
  onCancel: () => void;
  onReviewLater: () => void;
  isProcessing: boolean;
}

export function SwipeActionBar({ onKeep, onCancel, onReviewLater, isProcessing }: SwipeActionBarProps) {
  return (
    <motion.div
      className="flex items-center justify-center gap-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Cancel */}
      <button
        onClick={onCancel}
        disabled={isProcessing}
        className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center transition-all',
          'bg-amber-500/15 border-2 border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/25',
          'active:scale-95',
          isProcessing && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Cancel subscription"
      >
        <X className="w-7 h-7 text-amber-400" />
      </button>

      {/* Review Later */}
      <button
        onClick={onReviewLater}
        disabled={isProcessing}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all',
          'bg-slate-500/15 border-2 border-slate-500/30 hover:border-slate-400/60 hover:bg-slate-500/25',
          'active:scale-95',
          isProcessing && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Review later"
      >
        <Clock className="w-5 h-5 text-slate-400" />
      </button>

      {/* Keep */}
      <button
        onClick={onKeep}
        disabled={isProcessing}
        className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center transition-all',
          'bg-teal-500/15 border-2 border-teal-500/30 hover:border-teal-400/60 hover:bg-teal-500/25',
          'active:scale-95',
          isProcessing && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Keep subscription"
      >
        <Check className="w-7 h-7 text-teal-400" />
      </button>
    </motion.div>
  );
}
