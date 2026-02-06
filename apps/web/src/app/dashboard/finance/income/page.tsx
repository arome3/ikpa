'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Wallet, Briefcase, Building2, TrendingUp, Gift, MoreHorizontal,
  Pencil, Trash2, RefreshCw
} from 'lucide-react';
import { useIncome, type Income, type CreateIncomeData } from '@/hooks/useFinance';
import { Button, Modal, ModalFooter, Input, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWithSeparators, useCurrency } from '@/hooks';

const incomeTypeConfig: Record<string, { icon: typeof Wallet; color: string; label: string }> = {
  SALARY: { icon: Briefcase, color: 'emerald', label: 'Salary' },
  BUSINESS: { icon: Building2, color: 'blue', label: 'Business' },
  INVESTMENT: { icon: TrendingUp, color: 'purple', label: 'Investment' },
  FREELANCE: { icon: Wallet, color: 'amber', label: 'Freelance' },
  RENTAL: { icon: Building2, color: 'rose', label: 'Rental' },
  GIFT: { icon: Gift, color: 'pink', label: 'Gift' },
  OTHER: { icon: MoreHorizontal, color: 'gray', label: 'Other' },
};

const frequencyOptions = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUALLY', label: 'Yearly' },
  { value: 'ONE_TIME', label: 'One-time' },
];

export default function IncomePage() {
  const { items, isLoading, create, update, delete: deleteIncome, isCreating, isUpdating, isDeleting } = useIncome();
  const { symbol: currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Income | null>(null);
  const [formData, setFormData] = useState<CreateIncomeData>({
    name: '',
    type: 'SALARY',
    amount: 0,
    frequency: 'MONTHLY',
  });

  const activeItems = items.filter((i: Income) => i.isActive);
  const totalMonthly = activeItems.reduce((sum: number, item: Income) => {
    const amount = Number(item.amount);
    switch (item.frequency) {
      case 'WEEKLY': return sum + amount * 4.33;
      case 'BIWEEKLY': return sum + amount * 2.17;
      case 'ANNUALLY': return sum + amount / 12;
      case 'ONE_TIME': return sum;
      default: return sum + amount;
    }
  }, 0);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', type: 'SALARY', amount: 0, frequency: 'MONTHLY' });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Income) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      amount: Number(item.amount),
      frequency: item.frequency,
      description: item.description || undefined,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      await update({ id: editingItem.id, data: formData });
    } else {
      await create(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this income source?')) {
      await deleteIncome(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Income Sources
          </h1>
          <p className="text-neutral-500 mt-1">
            Manage your income streams and track monthly earnings
          </p>
        </div>
        <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
          Add Income
        </Button>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-emerald-100 text-sm font-medium">Total Monthly Income</p>
          <p className="text-4xl font-bold mt-2 tabular-nums">
            {currencySymbol}{formatWithSeparators(Math.round(totalMonthly))}
          </p>
          <p className="text-emerald-200 text-sm mt-2">
            From {activeItems.length} active source{activeItems.length !== 1 ? 's' : ''}
          </p>
        </div>
      </motion.div>

      {/* Income List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl"
            >
              <Wallet className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-500">No income sources added yet</p>
              <Button onClick={openAddModal} variant="secondary" className="mt-4">
                Add your first income
              </Button>
            </motion.div>
          ) : (
            activeItems.map((item: Income, index: number) => {
              const config = incomeTypeConfig[item.type] || incomeTypeConfig.OTHER;
              const Icon = config.icon;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                      config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                      config.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                      config.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                      config.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                      config.color === 'rose' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
                      config.color === 'pink' && 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
                      config.color === 'gray' && 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400',
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900 dark:text-white truncate">
                          {item.name}
                        </h3>
                        <Badge variant="outline" size="sm">{config.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          {frequencyOptions.find(f => f.value === item.frequency)?.label}
                        </span>
                        {item.description && (
                          <span className="truncate">{item.description}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                        {currencySymbol}{formatWithSeparators(Number(item.amount))}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-neutral-500 hover:text-orange-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Income Source' : 'Add Income Source'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g., Monthly Salary"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(incomeTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type as Income['type'] }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                      formData.type === type
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5',
                      formData.type === type ? 'text-emerald-600' : 'text-neutral-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium',
                      formData.type === type ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-400'
                    )}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Amount"
            type="number"
            placeholder="0"
            currencySymbol={currencySymbol}
            value={formData.amount || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
            required
            min={0}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as Income['frequency'] }))}
              className="w-full h-14 px-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            >
              {frequencyOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="Description (optional)"
            placeholder="Add notes..."
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating || isUpdating}>
              {editingItem ? 'Save Changes' : 'Add Income'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
