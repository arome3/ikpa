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
  { href: '/dashboard/finance/income', label: 'Income', icon: Wallet },
  { href: '/dashboard/finance/savings', label: 'Savings', icon: PiggyBank },
  { href: '/dashboard/finance/investments', label: 'Investments', icon: TrendingUp },
  { href: '/dashboard/finance/debts', label: 'Debts', icon: CreditCard },
  { href: '/dashboard/finance/goals', label: 'Goals', icon: Target },
  { href: '/dashboard/finance/budgets', label: 'Budgets', icon: Receipt },
];

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#FDFCF8] dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#FDFCF8]/95 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-stone-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <div className="py-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-[#1A2E22] dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex gap-8 overflow-x-auto scrollbar-hide">
            {financeNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-2 pb-3 font-serif text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'text-[#1A2E22] dark:text-white'
                      : 'text-stone-400 hover:text-stone-700 dark:text-neutral-500 dark:hover:text-neutral-300'
                  )}
                >
                  <Icon className={cn(
                    'w-4 h-4 stroke-[1.5]',
                    isActive
                      ? 'text-[#1A2E22] dark:text-white'
                      : 'text-stone-400 dark:text-neutral-500'
                  )} />
                  {item.label}
                  {isActive && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1A2E22] dark:bg-white"
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
