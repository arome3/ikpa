'use client';

import { motion } from 'framer-motion';
import { Check, Minus, RefreshCw, AlertTriangle, Copy } from 'lucide-react';
import { cn, formatCurrency, type CurrencyCode } from '@/lib/utils';
import type { ParsedTransaction } from '@/hooks/useImport';

interface TransactionReviewListProps {
  transactions: ParsedTransaction[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  currency: string;
  hideDuplicates?: boolean;
}

function formatTxnDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
}

export function TransactionReviewList({
  transactions,
  selectedIds,
  onToggle,
  onToggleAll,
  currency,
  hideDuplicates = false,
}: TransactionReviewListProps) {
  const selectableTransactions = transactions.filter(
    (t) => {
      if (t.status === 'CREATED') return false;
      if (t.status === 'DUPLICATE' && hideDuplicates) return false;
      return true;
    },
  );
  const allSelected = selectableTransactions.length > 0 && selectableTransactions.every((t) => selectedIds.has(t.id));
  const someSelected = selectableTransactions.some((t) => selectedIds.has(t.id));

  const recurringCount = transactions.filter((t) => t.isRecurringGuess).length;

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-white">{transactions.length}</span>{' '}
          transactions found
          {recurringCount > 0 && (
            <>
              , <span className="font-medium text-primary-600 dark:text-primary-400">{recurringCount}</span> likely recurring
            </>
          )}
        </p>
      </div>

      {/* Select all */}
      <div className="mb-3">
        <button
          type="button"
          onClick={onToggleAll}
          className={cn(
            'flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors',
            'bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10',
          )}
        >
          <div
            className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
              allSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : someSelected
                  ? 'bg-primary-500/50 border-primary-500 text-white'
                  : 'border-slate-300 dark:border-white/30',
            )}
          >
            {allSelected ? (
              <Check className="w-3.5 h-3.5" />
            ) : someSelected ? (
              <Minus className="w-3.5 h-3.5" />
            ) : null}
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Select All ({selectedIds.size} of {selectableTransactions.length})
          </span>
        </button>
      </div>

      {/* Transaction list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {transactions.map((txn, index) => {
          const isDuplicate = txn.status === 'DUPLICATE';
          const isCreated = txn.status === 'CREATED';
          const isDisabled = isCreated || (isDuplicate && hideDuplicates);
          const isSelected = selectedIds.has(txn.id);
          const isDebit = txn.amount < 0;

          return (
            <motion.div
              key={txn.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.5) }}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                isDisabled
                  ? 'opacity-50 bg-slate-50 dark:bg-white/[0.02]'
                  : isSelected
                    ? 'bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20'
                    : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10',
                !isDisabled && 'cursor-pointer',
              )}
              onClick={() => !isDisabled && onToggle(txn.id)}
            >
              {/* Checkbox */}
              <div
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0',
                  isDisabled
                    ? 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5'
                    : isSelected
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'border-slate-300 dark:border-white/30',
                )}
              >
                {isSelected && !isDisabled && <Check className="w-3.5 h-3.5" />}
                {isDuplicate && <Copy className="w-3 h-3 text-slate-400" />}
              </div>

              {/* Date */}
              <span className="text-sm text-slate-500 dark:text-slate-400 w-12 flex-shrink-0 font-mono">
                {formatTxnDate(txn.date)}
              </span>

              {/* Merchant/description */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  isDisabled ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white',
                )}>
                  {txn.normalizedMerchant || txn.merchant || txn.description || 'Unknown'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {txn.isRecurringGuess && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
                      <RefreshCw className="w-3 h-3" />
                      recurring
                    </span>
                  )}
                  {isDuplicate && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      possible duplicate
                    </span>
                  )}
                  {txn.confidence != null && txn.confidence < 0.7 && !isDuplicate && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {Math.round(txn.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>

              {/* Amount */}
              <span
                className={cn(
                  'text-sm font-semibold flex-shrink-0 tabular-nums',
                  isDisabled
                    ? 'text-slate-400 dark:text-slate-500'
                    : isDebit
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {isDebit ? '-' : '+'}
                {formatCurrency(Math.abs(txn.amount), currency as CurrencyCode)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
