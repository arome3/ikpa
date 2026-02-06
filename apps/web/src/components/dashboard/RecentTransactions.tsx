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
import { Card, SkeletonTransaction } from '@/components/ui';
import type { Transaction, TransactionCategory } from '@/lib/mock/dashboard.mock';
import { categoryConfig } from '@/lib/mock/dashboard.mock';

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
 * Recent transactions list with category icons
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
        <Card variant="default" padding="none">
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Recent Transactions
            </h3>
            <Link
              href="/transactions"
              className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              View all
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Transaction list */}
          <div className="px-4 pb-4">
            {isLoading ? (
              // Loading skeletons
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonTransaction key={i} />
                ))}
              </div>
            ) : displayTransactions.length === 0 ? (
              // Empty state
              <div className="py-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No recent transactions</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Your transactions will appear here
                </p>
              </div>
            ) : (
              // Transaction rows
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {displayTransactions.map((transaction, index) => {
                  const Icon = categoryIcons[transaction.category];
                  const config = categoryConfig[transaction.category];
                  const isIncome = transaction.type === 'income';

                  return (
                    <motion.div
                      key={transaction.id}
                      className="flex items-center gap-3 py-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.05, duration: 0.2 }}
                    >
                      {/* Category icon */}
                      <div className={cn('p-2.5 rounded-xl', config.color)}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Description and date */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(transaction.date)}
                        </p>
                      </div>

                      {/* Amount */}
                      <p
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          isIncome
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-900 dark:text-white'
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
        </Card>
    </motion.div>
  );
}
