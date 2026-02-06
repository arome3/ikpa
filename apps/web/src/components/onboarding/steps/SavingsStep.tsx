'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiggyBank, Plus, Trash2, Building, Smartphone, Banknote,
  Clock, Users, Landmark, MoreHorizontal, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { Savings, CreateSavingsData } from '@/hooks/useFinance';

interface SavingsStepProps {
  items: Savings[];
  currency: string;
  onAdd: (data: CreateSavingsData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onContinue: () => void;
  onSkip?: () => void;
  isAdding: boolean;
  isDeleting: boolean;
  isRequired: boolean;
}

const savingsTypes = [
  { value: 'BANK_ACCOUNT', label: 'Bank Account', icon: Building, color: 'blue' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone, color: 'purple' },
  { value: 'CASH', label: 'Cash', icon: Banknote, color: 'emerald' },
  { value: 'FIXED_DEPOSIT', label: 'Fixed Deposit', icon: Clock, color: 'amber' },
  { value: 'AJO_SUSU', label: 'Savings Circle', icon: Users, color: 'rose' },
  { value: 'COOPERATIVE', label: 'Cooperative', icon: Landmark, color: 'cyan' },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal, color: 'neutral' },
] as const;

export function SavingsStep({
  items,
  currency,
  onAdd,
  onDelete,
  onContinue,
  onSkip,
  isAdding,
  isDeleting,
  isRequired,
}: SavingsStepProps) {
  const [showForm, setShowForm] = useState(items.length === 0);
  const [formData, setFormData] = useState<Partial<CreateSavingsData>>({
    type: 'BANK_ACCOUNT',
    isEmergencyFund: false,
  });

  const totalBalance = items.reduce((sum, item) => sum + item.balance, 0);
  const emergencyFundTotal = items
    .filter((item) => item.isEmergencyFund)
    .reduce((sum, item) => sum + item.balance, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.balance || !formData.type) return;

    await onAdd({
      name: formData.name,
      type: formData.type as CreateSavingsData['type'],
      balance: formData.balance,
      currency,
      institution: formData.institution,
      isEmergencyFund: formData.isEmergencyFund,
    });

    setFormData({ type: 'BANK_ACCOUNT', isEmergencyFund: false });
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
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white mb-4 shadow-xl shadow-blue-500/25"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          <PiggyBank className="w-8 h-8" />
        </motion.div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-neutral-900 dark:text-white">
          Your Savings
        </h2>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
          Track your savings across different accounts to get a complete picture of your financial health.
        </p>
      </div>

      {/* Summary Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            className="p-5 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-500/25"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-blue-100 text-sm font-medium">Total Savings</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(totalBalance, currency)}
            </p>
          </motion.div>
          <motion.div
            className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/25"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-1 mb-1">
              <Shield className="w-4 h-4 text-emerald-200" />
              <p className="text-emerald-100 text-sm font-medium">Emergency Fund</p>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(emergencyFundTotal, currency)}
            </p>
          </motion.div>
        </div>
      )}

      {/* Savings List */}
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => {
          const typeInfo = savingsTypes.find((t) => t.value === item.type);
          const Icon = typeInfo?.icon || PiggyBank;

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
                  typeInfo?.color === 'blue' && 'bg-blue-100 text-blue-600',
                  typeInfo?.color === 'purple' && 'bg-purple-100 text-purple-600',
                  typeInfo?.color === 'emerald' && 'bg-emerald-100 text-emerald-600',
                  typeInfo?.color === 'amber' && 'bg-amber-100 text-amber-600',
                  typeInfo?.color === 'rose' && 'bg-rose-100 text-rose-600',
                  typeInfo?.color === 'cyan' && 'bg-cyan-100 text-cyan-600',
                  typeInfo?.color === 'neutral' && 'bg-neutral-100 text-neutral-600'
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-neutral-900 dark:text-white truncate">
                    {item.name}
                  </p>
                  {item.isEmergencyFund && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                      Emergency
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500">
                  {typeInfo?.label}
                  {item.institution && ` · ${item.institution}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {formatCurrency(item.balance, currency)}
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
            className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-dashed border-blue-300 dark:border-blue-800 space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3 className="font-semibold text-neutral-900 dark:text-white">
              Add Savings Account
            </h3>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Account Name
              </label>
              <input
                type="text"
                placeholder="e.g., Primary Savings"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Account Type
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {savingsTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: type.value })}
                      className={cn(
                        'p-2 rounded-lg border text-center transition-all text-sm',
                        formData.type === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-blue-300'
                      )}
                    >
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance & Institution */}
            <div className="grid grid-cols-2 gap-4">
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
                    value={formData.balance || ''}
                    onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                    className="w-full p-3 pl-14 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Institution (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Bank name"
                  value={formData.institution || ''}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>
            </div>

            {/* Emergency Fund Toggle */}
            <label className="flex items-center gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 cursor-pointer hover:border-emerald-300 transition-colors">
              <input
                type="checkbox"
                checked={formData.isEmergencyFund || false}
                onChange={(e) => setFormData({ ...formData, isEmergencyFund: e.target.checked })}
                className="w-5 h-5 rounded border-neutral-300 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <p className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  Emergency Fund
                </p>
                <p className="text-sm text-neutral-500">
                  Mark this as part of your emergency savings
                </p>
              </div>
            </label>

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
                disabled={!formData.name || !formData.balance || isAdding}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAdding ? 'Adding...' : 'Add Savings'}
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
          className="w-full p-4 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center gap-2"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus className="w-5 h-5" />
          Add {items.length > 0 ? 'Another ' : ''}Savings Account
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
    </motion.div>
  );
}
