'use client';

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
    <div className="space-y-2">
      {overlaps.map((group) => (
        <button
          key={group.category}
          onClick={onReview}
          className="w-full p-3 rounded-xl bg-orange-50 border border-orange-200 hover:border-orange-300 transition-colors text-left"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Layers className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">
              {group.subscriptions.length} {group.category.toLowerCase().replace('_', '/')} services
            </span>
            <span className="ml-auto text-xs font-mono text-orange-700 font-medium tabular-nums">
              {symbol}{Math.round(group.combinedMonthlyCost).toLocaleString()}/mo
            </span>
            {onReview && <ChevronRight className="w-4 h-4 text-stone-400" />}
          </div>
          <p className="text-xs text-stone-500">
            {group.subscriptions.map((s) => s.name).join(', ')} — do you need all of them?
          </p>
        </button>
      ))}
    </div>
  );
}
