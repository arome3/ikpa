'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Plus, Trash2, Building2, ShoppingBag, Landmark,
  GraduationCap, Briefcase, Home, MoreHorizontal, TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { Debt, CreateDebtData } from '@/hooks/useFinance';

interface DebtsStepProps {
  items: Debt[];
  currency: string;
  onAdd: (data: CreateDebtData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onContinue: () => void;
  onSkip?: () => void;
  isAdding: boolean;
  isDeleting: boolean;
  isRequired: boolean;
}

const debtTypes = [
  { value: 'BANK_LOAN', label: 'Bank Loan', icon: Building2, color: 'blue' },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard, color: 'purple' },
  { value: 'BNPL', label: 'Buy Now Pay Later', icon: ShoppingBag, color: 'pink' },
  { value: 'PERSONAL_LOAN', label: 'Personal Loan', icon: Landmark, color: 'amber' },
  { value: 'MORTGAGE', label: 'Mortgage', icon: Home, color: 'emerald' },
  { value: 'STUDENT_LOAN', label: 'Student Loan', icon: GraduationCap, color: 'cyan' },
  { value: 'BUSINESS_LOAN', label: 'Business Loan', icon: Briefcase, color: 'indigo' },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal, color: 'neutral' },
] as const;

export function DebtsStep({
  items,
  currency,
  onAdd,
  onDelete,
  onContinue,
  onSkip,
  isAdding,
  isDeleting,
  isRequired,
}: DebtsStepProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateDebtData>>({
    type: 'BANK_LOAN',
  });

  const totalDebt = items.reduce((sum, item) => sum + Number(item.currentBalance), 0);
  const totalMinimumPayments = items.reduce((sum, item) => sum + Number(item.minimumPayment), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.currentBalance || !formData.type) return;

    await onAdd({
      name: formData.name,
      type: formData.type as CreateDebtData['type'],
      originalAmount: formData.originalAmount || formData.currentBalance,
      currentBalance: formData.currentBalance,
      interestRate: formData.interestRate || 0,
      minimumPayment: formData.minimumPayment || 0,
      currency,
      lender: formData.lender,
    });

    setFormData({ type: 'BANK_LOAN' });
    setShowForm(false);
  };

  const canContinue = !isRequired || items.length > 0;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white mb-4 shadow-xl shadow-purple-500/25"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          <CreditCard className="w-8 h-8" />
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Your Debts & Loans
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Track your debts to create a clear path to financial freedom. No judgment—just progress.
        </p>
      </div>

      {/* No Debts Message */}
      {items.length === 0 && !showForm && (
        <motion.div
          className="p-8 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border border-emerald-200 dark:border-emerald-800 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <TrendingDown className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
            No Debts? That&apos;s Great!
          </h3>
          <p className="mt-2 text-emerald-700 dark:text-emerald-300 text-sm">
            Being debt-free gives you more freedom. You can skip this step or add any debts you have.
          </p>
        </motion.div>
      )}

      {/* Summary Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            className="p-5 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl shadow-purple-500/25"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-purple-100 text-sm font-medium">Total Debt</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalDebt, currency)}
            </p>
          </motion.div>
          <motion.div
            className="p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/25"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-amber-100 text-sm font-medium">Monthly Payments</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalMinimumPayments, currency)}
            </p>
          </motion.div>
        </div>
      )}

      {/* Debt List */}
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => {
          const typeInfo = debtTypes.find((t) => t.value === item.type);
          const Icon = typeInfo?.icon || CreditCard;
          const percentPaid = Number(item.originalAmount) > 0
            ? Math.round(((Number(item.originalAmount) - Number(item.currentBalance)) / Number(item.originalAmount)) * 100)
            : 0;

          return (
            <motion.div
              key={item.id}
              className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    typeInfo?.color === 'blue' && 'bg-blue-100 text-blue-600',
                    typeInfo?.color === 'purple' && 'bg-purple-100 text-purple-600',
                    typeInfo?.color === 'pink' && 'bg-pink-100 text-pink-600',
                    typeInfo?.color === 'amber' && 'bg-amber-100 text-amber-600',
                    typeInfo?.color === 'emerald' && 'bg-emerald-100 text-emerald-600',
                    typeInfo?.color === 'cyan' && 'bg-cyan-100 text-cyan-600',
                    typeInfo?.color === 'indigo' && 'bg-indigo-100 text-indigo-600',
                    typeInfo?.color === 'neutral' && 'bg-neutral-100 text-neutral-600'
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-white truncate">
                    {item.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {typeInfo?.label} · {item.interestRate}% APR
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-neutral-900 dark:text-white">
                    {formatCurrency(Number(item.currentBalance), currency)}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {formatCurrency(Number(item.minimumPayment), currency)}/mo
                  </p>
                </div>
                <button
                  onClick={() => onDelete(item.id)}
                  disabled={isDeleting}
                  className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                  <span>{percentPaid}% paid off</span>
                  <span>{formatCurrency(Number(item.originalAmount) - Number(item.currentBalance), currency)} of {formatCurrency(Number(item.originalAmount), currency)}</span>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentPaid}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-dashed border-purple-300 dark:border-purple-800 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Add Debt
            </h3>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Name
              </label>
              <input
                type="text"
                placeholder="e.g., Car Loan"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {debtTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value })}
                      className={cn(
                        'p-2 rounded-lg border text-center transition-all text-xs',
                        formData.type === type.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-purple-300'
                      )}
                    >
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Original Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.originalAmount || ''}
                    onChange={(e) => setFormData({ ...formData, originalAmount: Number(e.target.value) })}
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Current Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.currentBalance || ''}
                    onChange={(e) => setFormData({ ...formData, currentBalance: Number(e.target.value) })}
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Interest & Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={formData.interestRate || ''}
                  onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
                  className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Minimum Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.minimumPayment || ''}
                    onChange={(e) => setFormData({ ...formData, minimumPayment: Number(e.target.value) })}
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.name || !formData.currentBalance || isAdding}
                className="flex-1 py-3 px-4 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAdding ? 'Adding...' : 'Add Debt'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Add Button */}
      {!showForm && (
        <motion.button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-purple-600 hover:border-purple-300 transition-all flex items-center justify-center gap-2"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus className="w-5 h-5" />
          Add Debt
        </motion.button>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {!isRequired && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-4 px-6 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            {items.length === 0 ? 'I Have No Debts' : 'Skip for Now'}
          </button>
        )}
        <motion.button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={cn(
            'flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200',
            'bg-gradient-to-r from-emerald-500 to-emerald-600',
            'hover:from-emerald-600 hover:to-emerald-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'shadow-lg shadow-emerald-500/25'
          )}
          whileHover={canContinue ? { scale: 1.02 } : {}}
          whileTap={canContinue ? { scale: 0.98 } : {}}
        >
          Continue
        </motion.button>
      </div>
    </motion.div>
  );
}
