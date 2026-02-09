'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Car,
  Gamepad2,
  Zap,
  ShoppingBag,
  Heart,
  GraduationCap,
  Briefcase,
  Laptop,
  Gift,
  TrendingUp,
  MoreHorizontal,
  ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { SkeletonTransaction } from '@/components/ui';
import type { Transaction, TransactionCategory } from '@/lib/mock/dashboard.mock';

export interface RecentTransactionsProps {
  /** Additional class names */
  className?: string;
  /** List of transactions to display */
  transactions?: Transaction[];
  /** Loading state */
  isLoading?: boolean;
  /** Maximum number of transactions to show */
  limit?: number;
  /** Currency for formatting */
  currency?: 'NGN' | 'USD' | 'GBP' | 'EUR' | 'GHS' | 'KES' | 'ZAR';
}

// Icon mapping for categories
const categoryIcons: Record<TransactionCategory, typeof UtensilsCrossed> = {
  food: UtensilsCrossed,
  transport: Car,
  entertainment: Gamepad2,
  utilities: Zap,
  shopping: ShoppingBag,
  health: Heart,
  education: GraduationCap,
  salary: Briefcase,
  freelance: Laptop,
  gift: Gift,
  investment: TrendingUp,
  other: MoreHorizontal,
};

/**
 * Clean ledger-style transaction list — no card wrapper
 */
export function RecentTransactions({
  className,
  transactions = [],
  isLoading = false,
  limit = 5,
  currency = 'USD',
}: RecentTransactionsProps) {
  const displayTransactions = transactions.slice(0, limit);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3, ease: 'easeOut' }}
    >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif text-[#1A2E22]">
            Recent Activity
          </h3>
          <Link
            href="/transactions"
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Transaction list */}
        <div>
          {isLoading ? (
            <div className="divide-y divide-stone-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTransaction key={i} />
              ))}
            </div>
          ) : displayTransactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-stone-500">No recent transactions</p>
              <p className="text-sm text-stone-400 mt-1">
                Your transactions will appear here
              </p>
            </div>
          ) : (
            <div>
              {displayTransactions.map((transaction, index) => {
                const Icon = categoryIcons[transaction.category];
                const isIncome = transaction.type === 'income';

                return (
                  <motion.div
                    key={transaction.id}
                    className="flex items-center gap-3 py-4 border-b border-stone-100 last:border-b-0"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.05, duration: 0.2 }}
                  >
                    {/* Category icon */}
                    <div className="p-2 rounded-lg bg-stone-50">
                      <Icon className="h-5 w-5 text-stone-500" strokeWidth={1.5} />
                    </div>

                    {/* Description and date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-sans text-[#1A2E22] truncate">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-stone-400">
                        {formatDate(transaction.date)}
                      </p>
                    </div>

                    {/* Amount */}
                    <p
                      className={cn(
                        'font-mono text-sm tabular-nums',
                        isIncome
                          ? 'text-emerald-700'
                          : 'text-[#1A2E22]'
                      )}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(transaction.amount, currency)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
    </motion.div>
  );
}
