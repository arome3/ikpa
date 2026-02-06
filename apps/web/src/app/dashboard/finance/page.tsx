'use client';

import { motion } from 'framer-motion';
import {
  Wallet, PiggyBank, TrendingUp, CreditCard, Target, Receipt, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const financeModules = [
  {
    href: '/dashboard/finance/income',
    label: 'Income Sources',
    description: 'Track your salary, business income, and other earnings',
    icon: Wallet,
    color: 'emerald',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  {
    href: '/dashboard/finance/savings',
    label: 'Savings Accounts',
    description: 'Monitor your savings across different accounts',
    icon: PiggyBank,
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    href: '/dashboard/finance/investments',
    label: 'Investments',
    description: 'Track your portfolio and investment returns',
    icon: TrendingUp,
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    href: '/dashboard/finance/debts',
    label: 'Debts & Loans',
    description: 'Manage your debts and track repayment progress',
    icon: CreditCard,
    color: 'rose',
    gradient: 'from-rose-500 to-rose-600',
  },
  {
    href: '/dashboard/finance/goals',
    label: 'Financial Goals',
    description: 'Set savings targets and track your progress',
    icon: Target,
    color: 'amber',
    gradient: 'from-amber-500 to-amber-600',
  },
  {
    href: '/dashboard/finance/budgets',
    label: 'Budget Manager',
    description: 'Set spending limits and monitor expenses',
    icon: Receipt,
    color: 'pink',
    gradient: 'from-pink-500 to-pink-600',
  },
];

export default function FinanceOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Financial Management
        </h1>
        <p className="text-neutral-500 mt-1">
          Manage all aspects of your personal finances in one place
        </p>
      </div>

      {/* Module Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {financeModules.map((module, index) => {
          const Icon = module.icon;

          return (
            <motion.div
              key={module.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                href={module.href}
                className="group block bg-white dark:bg-neutral-800 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br text-white',
                    module.gradient
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 group-hover:translate-x-1 transition-all" />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">
                  {module.label}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {module.description}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-6 border border-primary-200 dark:border-primary-800"
      >
        <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100">
          Quick Tips for Financial Success
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-primary-700 dark:text-primary-300">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>Start by adding all your income sources to get an accurate picture of your earnings</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>Set up budgets for your major expense categories to stay on track</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>Create at least one savings goal - even small amounts add up over time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>Track your debts and focus on paying off high-interest ones first</span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
