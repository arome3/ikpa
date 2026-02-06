'use client';

import { motion } from 'framer-motion';
import { Layers, ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/utils';
import type { OverlapGroup } from '@/hooks/useShark';

interface OverlapWarningProps {
  overlaps: OverlapGroup[];
  currency: string;
  onReview?: () => void;
}

export function OverlapWarning({ overlaps, currency, onReview }: OverlapWarningProps) {
  if (overlaps.length === 0) return null;

  const symbol = getCurrencySymbol(currency);

  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {overlaps.map((group) => (
        <button
          key={group.category}
          onClick={onReview}
          className="w-full p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/30 transition-colors text-left"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Layers className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-300">
              {group.subscriptions.length} {group.category.toLowerCase().replace('_', '/')} services
            </span>
            <span className="ml-auto text-xs text-orange-400 font-medium">
              {symbol}{Math.round(group.combinedMonthlyCost).toLocaleString()}/mo
            </span>
            {onReview && <ChevronRight className="w-4 h-4 text-slate-500" />}
          </div>
          <p className="text-xs text-slate-400">
            {group.subscriptions.map((s) => s.name).join(', ')} — do you need all of them?
          </p>
        </button>
      ))}
    </motion.div>
  );
}
