'use client';

import { motion } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/utils';

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
      className="px-4 py-4 border-t border-white/10 bg-gradient-to-t from-slate-900/80 to-transparent backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* AI recommendation text */}
      <p className="text-xs text-slate-400 text-center mb-3">
        {isRecommendCancel
          ? `My take: cancel ${subscriptionName} and save ${symbol}${Math.round(absAnnualCost).toLocaleString()}/yr`
          : `My take: ${subscriptionName} is worth keeping`}
      </p>

      <div className="flex gap-3">
        {/* Cancel button */}
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 ${
            isRecommendCancel
              ? 'bg-red-500/20 border-2 border-red-500/40 text-red-300 hover:bg-red-500/30 animate-pulse'
              : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
          }`}
        >
          <X className="w-4 h-4" />
          Cancel · {symbol}{Math.round(absAnnualCost).toLocaleString()}/yr
        </button>

        {/* Keep button */}
        <button
          onClick={onKeep}
          disabled={isProcessing}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50 ${
            !isRecommendCancel
              ? 'bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 animate-pulse'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          <Check className="w-4 h-4" />
          Keep
        </button>
      </div>

      {/* Skip for later option */}
      {onSkip && (
        <button
          onClick={onSkip}
          disabled={isProcessing}
          className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          <Clock className="w-3.5 h-3.5" />
          Skip for now — decide later
        </button>
      )}
    </motion.div>
  );
}
