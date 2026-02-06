'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, Plus, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { Budget, CreateBudgetData, ExpenseCategory } from '@/hooks/useFinance';

interface BudgetsStepProps {
  items: Budget[];
  categories: ExpenseCategory[];
  currency: string;
  onAdd: (data: CreateBudgetData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onContinue: () => void;
  onSkip?: () => void;
  isAdding: boolean;
  isDeleting: boolean;
  isRequired: boolean;
}

const periods = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Annually' },
] as const;

export function BudgetsStep({
  items,
  categories,
  currency,
  onAdd,
  onDelete,
  onContinue,
  onSkip,
  isAdding,
  isDeleting,
  isRequired,
}: BudgetsStepProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateBudgetData>>({
    period: 'MONTHLY',
  });

  const totalBudget = items.reduce((sum, item) => {
    // Normalize to monthly
    let monthlyAmount = item.amount;
    switch (item.period) {
      case 'WEEKLY':
        monthlyAmount = item.amount * 4.33;
        break;
      case 'QUARTERLY':
        monthlyAmount = item.amount / 3;
        break;
      case 'ANNUALLY':
        monthlyAmount = item.amount / 12;
        break;
    }
    return sum + monthlyAmount;
  }, 0);

  // Get categories that don't have budgets yet
  const availableCategories = categories.filter(
    (cat) => !items.some((item) => item.category.id === cat.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.amount || !formData.period) return;

    await onAdd({
      categoryId: formData.categoryId,
      amount: formData.amount,
      period: formData.period as CreateBudgetData['period'],
      currency,
    });

    setFormData({ period: 'MONTHLY' });
    setShowForm(false);
  };

  const canContinue = !isRequired || items.length > 0;
  const selectedCategory = categories.find((c) => c.id === formData.categoryId);

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
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white mb-4 shadow-xl shadow-rose-500/25"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          <Receipt className="w-8 h-8" />
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Category Budgets
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Set spending limits for different categories. We&apos;ll help you stay on track without being judgmental.
        </p>
      </div>

      {/* Summary Card */}
      {items.length > 0 && (
        <motion.div
          className="p-6 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-xl shadow-rose-500/25"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="text-rose-100 text-sm font-medium">Total Monthly Budget</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(totalBudget, currency)}
          </p>
          <p className="text-rose-100 text-sm mt-2">
            Across {items.length} categor{items.length !== 1 ? 'ies' : 'y'}
          </p>
        </motion.div>
      )}

      {/* Budget List */}
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center gap-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.05 }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: `${item.category.color}20` }}
            >
              {/* Use category icon as emoji or fallback */}
              <span style={{ color: item.category.color }}>
                {getCategoryEmoji(item.category.icon)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 dark:text-white truncate">
                {item.category.name}
              </p>
              <p className="text-sm text-neutral-500">
                {periods.find((p) => p.value === item.period)?.label} budget
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-neutral-900 dark:text-white">
                {formatCurrency(item.amount, currency)}
              </p>
              <p className="text-sm text-neutral-500">
                /{item.period.toLowerCase()}
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
        ))}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-dashed border-rose-300 dark:border-rose-800 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Add Budget
            </h3>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Select Category
              </label>
              {availableCategories.length === 0 ? (
                <p className="text-sm text-neutral-500 p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl text-center">
                  All categories already have budgets
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, categoryId: cat.id })}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all flex items-center gap-3',
                        formData.categoryId === cat.id
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-rose-300'
                      )}
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                        style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                      >
                        {getCategoryEmoji(cat.icon)}
                      </span>
                      <span className={cn(
                        'text-sm font-medium truncate',
                        formData.categoryId === cat.id ? 'text-rose-600' : 'text-neutral-700 dark:text-neutral-300'
                      )}>
                        {cat.name}
                      </span>
                      {formData.categoryId === cat.id && (
                        <Check className="w-4 h-4 text-rose-500 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount & Period */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Budget Amount
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
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Period
                </label>
                <select
                  value={formData.period || 'MONTHLY'}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as CreateBudgetData['period'] })}
                  className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all appearance-none"
                >
                  {periods.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
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
                disabled={!formData.categoryId || !formData.amount || isAdding}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-500 text-white font-medium hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAdding ? 'Adding...' : 'Add Budget'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Add Button */}
      {!showForm && availableCategories.length > 0 && (
        <motion.button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-rose-600 hover:border-rose-300 transition-all flex items-center justify-center gap-2"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus className="w-5 h-5" />
          Add Budget
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
          Complete Setup
        </motion.button>
      </div>
    </motion.div>
  );
}

// Helper to convert icon names to emojis
function getCategoryEmoji(icon: string): string {
  const iconMap: Record<string, string> = {
    'utensils': '🍽️',
    'car': '🚗',
    'shopping-bag': '🛍️',
    'zap': '⚡',
    'film': '🎬',
    'heart-pulse': '❤️',
    'users': '👨‍👩‍👧‍👦',
    'graduation-cap': '🎓',
    'home': '🏠',
    'more-horizontal': '📦',
  };
  return iconMap[icon] || '📦';
}
