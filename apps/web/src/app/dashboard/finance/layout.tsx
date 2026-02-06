'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Wallet, PiggyBank, TrendingUp, CreditCard, Target, Receipt, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

const financeNavItems = [
  { href: '/dashboard/finance/income', label: 'Income', icon: Wallet, color: 'emerald' },
  { href: '/dashboard/finance/savings', label: 'Savings', icon: PiggyBank, color: 'blue' },
  { href: '/dashboard/finance/investments', label: 'Investments', icon: TrendingUp, color: 'purple' },
  { href: '/dashboard/finance/debts', label: 'Debts', icon: CreditCard, color: 'rose' },
  { href: '/dashboard/finance/goals', label: 'Goals', icon: Target, color: 'amber' },
  { href: '/dashboard/finance/budgets', label: 'Budgets', icon: Receipt, color: 'pink' },
];

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <div className="py-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide pb-3">
            {financeNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4',
                    isActive && item.color === 'emerald' && 'text-emerald-500',
                    isActive && item.color === 'blue' && 'text-blue-500',
                    isActive && item.color === 'purple' && 'text-purple-500',
                    isActive && item.color === 'rose' && 'text-rose-500',
                    isActive && item.color === 'amber' && 'text-amber-500',
                    isActive && item.color === 'pink' && 'text-pink-500'
                  )} />
                  {item.label}
                  {isActive && (
                    <motion.div
                      className={cn(
                        'absolute inset-0 rounded-xl -z-10',
                        item.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30',
                        item.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
                        item.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30',
                        item.color === 'rose' && 'bg-rose-100 dark:bg-rose-900/30',
                        item.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30',
                        item.color === 'pink' && 'bg-pink-100 dark:bg-pink-900/30'
                      )}
                      layoutId="financeNavActive"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
