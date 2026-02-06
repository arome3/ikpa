'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, Trash2, Building2, Laptop, Store,
  TrendingUp, Home, Gift, MoreHorizontal, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { Income, CreateIncomeData } from '@/hooks/useFinance';

interface IncomeStepProps {
  items: Income[];
  currency: string;
  onAdd: (data: CreateIncomeData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onContinue: () => void;
  onSkip?: () => void;
  isAdding: boolean;
  isDeleting: boolean;
  isRequired: boolean;
}

const incomeTypes = [
  { value: 'SALARY', label: 'Salary', icon: Building2, color: 'emerald' },
  { value: 'FREELANCE', label: 'Freelance', icon: Laptop, color: 'blue' },
  { value: 'BUSINESS', label: 'Business', icon: Store, color: 'purple' },
  { value: 'INVESTMENT', label: 'Investment', icon: TrendingUp, color: 'amber' },
  { value: 'RENTAL', label: 'Rental', icon: Home, color: 'rose' },
  { value: 'GIFT', label: 'Gift/Support', icon: Gift, color: 'pink' },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal, color: 'neutral' },
] as const;

const namePlaceholders: Record<string, string> = {
  SALARY: 'e.g., Company Salary',
  FREELANCE: 'e.g., Web Design Projects',
  BUSINESS: 'e.g., My Online Store',
  INVESTMENT: 'e.g., Stock Dividends',
  RENTAL: 'e.g., Apartment Rental Income',
  GIFT: 'e.g., Family Support',
  OTHER: 'e.g., Side Project Income',
};

const frequencies = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'ANNUALLY', label: 'Annually' },
  { value: 'ONE_TIME', label: 'One-time' },
] as const;

export function IncomeStep({
  items,
  currency,
  onAdd,
  onDelete,
  onContinue,
  onSkip,
  isAdding,
  isDeleting,
  isRequired,
}: IncomeStepProps) {
  const [showForm, setShowForm] = useState(items.length === 0);
  const [formData, setFormData] = useState<Partial<CreateIncomeData>>({
    type: 'SALARY',
    frequency: 'MONTHLY',
  });

  const totalMonthly = items.reduce((sum, item) => {
    // Normalize to monthly
    let monthlyAmount = item.amount;
    switch (item.frequency) {
      case 'WEEKLY':
        monthlyAmount = item.amount * 4.33;
        break;
      case 'BIWEEKLY':
        monthlyAmount = item.amount * 2.17;
        break;
      case 'ANNUALLY':
        monthlyAmount = item.amount / 12;
        break;
      case 'DAILY':
        monthlyAmount = item.amount * 30;
        break;
    }
    return sum + monthlyAmount;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.type || !formData.frequency) return;

    await onAdd({
      name: formData.name,
      type: formData.type as CreateIncomeData['type'],
      amount: formData.amount,
      frequency: formData.frequency as CreateIncomeData['frequency'],
      currency,
    });

    setFormData({ type: 'SALARY', frequency: 'MONTHLY' });
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
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white mb-4 shadow-xl shadow-emerald-500/25"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          <Wallet className="w-8 h-8" />
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Your Income Sources
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Add all your income sources to get accurate financial insights and projections.
        </p>
      </div>

      {/* Total Monthly Income Card */}
      {items.length > 0 && (
        <motion.div
          className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/25"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-emerald-100 text-sm font-medium">Total Monthly Income</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(totalMonthly, currency)}
          </p>
          <p className="text-emerald-100 text-sm mt-2">
            From {items.length} source{items.length !== 1 ? 's' : ''}
          </p>
        </motion.div>
      )}

      {/* Income List */}
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => {
          const typeInfo = incomeTypes.find((t) => t.value === item.type);
          const Icon = typeInfo?.icon || Wallet;

          return (
            <motion.div
              key={item.id}
              className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  typeInfo?.color === 'emerald' && 'bg-emerald-100 text-emerald-600',
                  typeInfo?.color === 'blue' && 'bg-blue-100 text-blue-600',
                  typeInfo?.color === 'purple' && 'bg-purple-100 text-purple-600',
                  typeInfo?.color === 'amber' && 'bg-amber-100 text-amber-600',
                  typeInfo?.color === 'rose' && 'bg-rose-100 text-rose-600',
                  typeInfo?.color === 'pink' && 'bg-pink-100 text-pink-600',
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
                  {typeInfo?.label} · {item.frequency.toLowerCase().replace('_', '-')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {formatCurrency(item.amount, currency)}
                </p>
              </div>
              <button
                onClick={() => onDelete(item.id)}
                disabled={isDeleting}
                className="p-2 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-dashed border-emerald-300 dark:border-emerald-800 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Add Income Source
            </h3>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Type
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {incomeTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value })}
                      className={cn(
                        'p-2 rounded-lg border text-center transition-all text-sm',
                        formData.type === type.value
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-emerald-300'
                      )}
                    >
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Name
              </label>
              <input
                type="text"
                placeholder={namePlaceholders[formData.type || 'SALARY'] || 'e.g., Income Source'}
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
            </div>

            {/* Amount & Frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Frequency
                </label>
                <select
                  value={formData.frequency || 'MONTHLY'}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as CreateIncomeData['frequency'] })}
                  className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all appearance-none"
                >
                  {frequencies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
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
                disabled={!formData.name || !formData.amount || isAdding}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAdding ? 'Adding...' : 'Add Income'}
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
          className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-emerald-600 hover:border-emerald-300 transition-all flex items-center justify-center gap-2"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus className="w-5 h-5" />
          Add {items.length > 0 ? 'Another ' : ''}Income Source
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
            Skip for Now
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

      {isRequired && items.length === 0 && (
        <p className="text-center text-sm text-amber-600 dark:text-amber-400">
          Add at least one income source to continue
        </p>
      )}
    </motion.div>
  );
}
