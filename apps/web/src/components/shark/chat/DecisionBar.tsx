'use client';

import { motion } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { cn, getCurrencySymbol } from '@/lib/utils';

interface DecisionBarProps {
  recommendation: 'KEEP' | 'CANCEL' | null;
  subscriptionName: string;
  annualCost: number;
  currency: string;
  onKeep: () => void;
  onCancel: () => void;
  onSkip?: () => void;
  isProcessing: boolean;
}

export function DecisionBar({
  recommendation,
  subscriptionName,
  annualCost,
  currency,
  onKeep,
  onCancel,
  onSkip,
  isProcessing,
}: DecisionBarProps) {
  const symbol = getCurrencySymbol(currency);
  const absAnnualCost = Math.abs(annualCost);
  const isRecommendCancel = recommendation === 'CANCEL';

  return (
    <motion.div
      className="max-w-2xl mx-auto px-4 py-6 border-t border-stone-200"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* AI recommendation text */}
      <p className="text-sm font-serif text-stone-500 italic text-center mb-4">
        {isRecommendCancel
          ? `Recommendation: cancel ${subscriptionName} and save ${symbol}${Math.round(absAnnualCost).toLocaleString()}/yr`
          : `Recommendation: ${subscriptionName} is worth keeping`}
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Cancel card */}
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className={cn(
            'flex flex-col items-center justify-center gap-2 py-4 rounded-lg font-medium text-sm transition-all disabled:opacity-50',
            isRecommendCancel
              ? 'border-2 border-orange-400 bg-orange-50 text-orange-700'
              : 'border border-stone-200 bg-white text-stone-600 hover:border-orange-300 hover:bg-orange-50/50',
          )}
        >
          <X className="w-5 h-5" />
          <span>Cancel</span>
          <span className="font-mono text-xs opacity-70">
            Save {symbol}{Math.round(absAnnualCost).toLocaleString()}/yr
          </span>
        </button>

        {/* Keep card */}
        <button
          onClick={onKeep}
          disabled={isProcessing}
          className={cn(
            'flex flex-col items-center justify-center gap-2 py-4 rounded-lg font-medium text-sm transition-all disabled:opacity-50',
            !isRecommendCancel
              ? 'border-2 border-emerald-400 bg-emerald-50 text-emerald-700'
              : 'border border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:bg-emerald-50/50',
          )}
        >
          <Check className="w-5 h-5" />
          <span>Keep</span>
          <span className="text-xs opacity-70">Worth it</span>
        </button>
      </div>

      {/* Skip for later option */}
      {onSkip && (
        <button
          onClick={onSkip}
          disabled={isProcessing}
          className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-50"
        >
          <Clock className="w-3.5 h-3.5" />
          Skip for now — decide later
        </button>
      )}
    </motion.div>
  );
}
