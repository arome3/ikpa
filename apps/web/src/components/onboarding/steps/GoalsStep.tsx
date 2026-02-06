'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Plus, Trash2, Shield, PiggyBank, TrendingUp, CreditCard,
  ShoppingBag, GraduationCap, Plane, Users, Briefcase, Sparkles, MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { Goal, CreateGoalData } from '@/hooks/useFinance';

interface GoalsStepProps {
  items: Goal[];
  currency: string;
  onAdd: (data: CreateGoalData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onContinue: () => void;
  onSkip?: () => void;
  isAdding: boolean;
  isDeleting: boolean;
  isRequired: boolean;
}

const goalTypes = [
  { value: 'EMERGENCY_FUND', label: 'Emergency Fund', icon: Shield, color: 'emerald', description: '3-6 months of expenses' },
  { value: 'SAVINGS', label: 'Savings', icon: PiggyBank, color: 'blue', description: 'General savings goal' },
  { value: 'INVESTMENT', label: 'Investment', icon: TrendingUp, color: 'purple', description: 'Grow your wealth' },
  { value: 'DEBT_PAYOFF', label: 'Debt Payoff', icon: CreditCard, color: 'rose', description: 'Become debt-free' },
  { value: 'MAJOR_PURCHASE', label: 'Major Purchase', icon: ShoppingBag, color: 'amber', description: 'Car, electronics, etc.' },
  { value: 'EDUCATION', label: 'Education', icon: GraduationCap, color: 'cyan', description: 'Learning & skills' },
  { value: 'TRAVEL', label: 'Travel', icon: Plane, color: 'pink', description: 'Explore the world' },
  { value: 'FAMILY', label: 'Family', icon: Users, color: 'orange', description: 'Family support & events' },
  { value: 'BUSINESS', label: 'Business', icon: Briefcase, color: 'indigo', description: 'Start or grow a business' },
  { value: 'RETIREMENT', label: 'Retirement', icon: Sparkles, color: 'yellow', description: 'Future security' },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal, color: 'neutral', description: 'Custom goal' },
] as const;

const goalNamePlaceholders: Record<string, string> = {
  EMERGENCY_FUND: 'e.g., Emergency Fund - 3 months',
  SAVINGS: 'e.g., Rainy Day Fund',
  INVESTMENT: 'e.g., Stock Portfolio Growth',
  DEBT_PAYOFF: 'e.g., Pay Off Credit Card',
  MAJOR_PURCHASE: 'e.g., New Laptop',
  EDUCATION: 'e.g., Online Course Fund',
  TRAVEL: 'e.g., Summer Trip to Europe',
  FAMILY: 'e.g., Wedding Fund',
  BUSINESS: 'e.g., Startup Capital',
  RETIREMENT: 'e.g., Retirement by 50',
  OTHER: 'e.g., My Financial Goal',
};

export function GoalsStep({
  items,
  currency,
  onAdd,
  onDelete,
  onContinue,
  onSkip,
  isAdding,
  isDeleting,
  isRequired,
}: GoalsStepProps) {
  const [showForm, setShowForm] = useState(items.length === 0);
  const [formData, setFormData] = useState<Partial<CreateGoalData>>({
    type: 'EMERGENCY_FUND',
    priority: 'MEDIUM',
  });

  const totalTarget = items.reduce((sum, item) => sum + Number(item.targetAmount), 0);
  const totalCurrent = items.reduce((sum, item) => sum + Number(item.currentAmount), 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.targetAmount || !formData.type) return;

    await onAdd({
      name: formData.name,
      type: formData.type as CreateGoalData['type'],
      targetAmount: formData.targetAmount,
      currentAmount: formData.currentAmount || 0,
      currency,
      targetDate: formData.targetDate,
      priority: formData.priority || 'MEDIUM',
    });

    setFormData({ type: 'EMERGENCY_FUND', priority: 'MEDIUM' });
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
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white mb-4 shadow-xl shadow-amber-500/25"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          <Target className="w-8 h-8" />
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Your Financial Goals
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Set meaningful goals and we&apos;ll help you track progress and stay motivated on your journey.
        </p>
      </div>

      {/* Summary Card */}
      {items.length > 0 && (
        <motion.div
          className="p-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xl shadow-amber-500/25"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-amber-100 text-sm font-medium">{items.length} Goal{items.length !== 1 ? 's' : ''}</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(totalCurrent, currency)} / {formatCurrency(totalTarget, currency)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">{overallProgress}%</p>
              <p className="text-amber-100 text-sm">Overall Progress</p>
            </div>
          </div>
          <div className="h-3 bg-amber-600/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {/* Goals List */}
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => {
          const typeInfo = goalTypes.find((t) => t.value === item.type);
          const Icon = typeInfo?.icon || Target;
          const progress = Number(item.targetAmount) > 0
            ? Math.round((Number(item.currentAmount) / Number(item.targetAmount)) * 100)
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
                    typeInfo?.color === 'emerald' && 'bg-emerald-100 text-emerald-600',
                    typeInfo?.color === 'blue' && 'bg-blue-100 text-blue-600',
                    typeInfo?.color === 'purple' && 'bg-purple-100 text-purple-600',
                    typeInfo?.color === 'rose' && 'bg-rose-100 text-rose-600',
                    typeInfo?.color === 'amber' && 'bg-amber-100 text-amber-600',
                    typeInfo?.color === 'cyan' && 'bg-cyan-100 text-cyan-600',
                    typeInfo?.color === 'pink' && 'bg-pink-100 text-pink-600',
                    typeInfo?.color === 'orange' && 'bg-orange-100 text-orange-600',
                    typeInfo?.color === 'indigo' && 'bg-indigo-100 text-indigo-600',
                    typeInfo?.color === 'yellow' && 'bg-yellow-100 text-yellow-600',
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
                    {typeInfo?.label}
                    {item.targetDate && ` · Due ${new Date(item.targetDate).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-neutral-900 dark:text-white">
                    {progress}%
                  </p>
                  <p className="text-sm text-neutral-500">
                    {formatCurrency(Number(item.currentAmount), currency)}
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
                  <span>{formatCurrency(Number(item.currentAmount), currency)} saved</span>
                  <span>{formatCurrency(Number(item.targetAmount) - Number(item.currentAmount), currency)} to go</span>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      progress >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
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
            className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-dashed border-amber-300 dark:border-amber-800 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Add a Goal
            </h3>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                What are you saving for?
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {goalTypes.slice(0, 8).map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: cat.value as Goal['type'] })}
                      className={cn(
                        'p-3 rounded-xl border text-center transition-all',
                        formData.type === cat.value
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-amber-300'
                      )}
                    >
                      <Icon className={cn(
                        'w-5 h-5 mx-auto mb-1',
                        formData.type === cat.value ? 'text-amber-600' : 'text-neutral-400'
                      )} />
                      <span className={cn(
                        'text-xs font-medium',
                        formData.type === cat.value ? 'text-amber-600' : 'text-neutral-600 dark:text-neutral-400'
                      )}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Goal Name
              </label>
              <input
                type="text"
                placeholder={goalNamePlaceholders[formData.type || 'EMERGENCY_FUND']}
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
              />
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Target Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.targetAmount || ''}
                    onChange={(e) => setFormData({ ...formData, targetAmount: Number(e.target.value) })}
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Already Saved
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                    {currency}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.currentAmount || ''}
                    onChange={(e) => setFormData({ ...formData, currentAmount: Number(e.target.value) })}
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Target Date */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Target Date (optional)
              </label>
              <input
                type="date"
                value={formData.targetDate || ''}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
              />
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
                disabled={!formData.name || !formData.targetAmount || isAdding}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAdding ? 'Adding...' : 'Add Goal'}
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
          className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-amber-600 hover:border-amber-300 transition-all flex items-center justify-center gap-2"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus className="w-5 h-5" />
          Add {items.length > 0 ? 'Another ' : ''}Goal
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
          Add at least one financial goal to continue
        </p>
      )}
    </motion.div>
  );
}
