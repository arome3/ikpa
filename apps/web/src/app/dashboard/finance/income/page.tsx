'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Wallet, Briefcase, Building2, TrendingUp, Gift, MoreHorizontal,
  Pencil, Trash2
} from 'lucide-react';
import { useIncome, type Income, type CreateIncomeData } from '@/hooks/useFinance';
import { Button, Modal, ModalFooter, Input, Spinner } from '@/components/ui';
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
    <div className="space-y-0">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif text-[#1A2E22] dark:text-white tracking-tight">
            Income Sources
          </h1>
          <p className="text-stone-500 dark:text-neutral-400 text-sm mt-1">
            Revenue streams and recurring earnings
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#064E3B] focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Add Income
        </button>
      </div>

      {/* Hero — Monthly Recurring Revenue */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pb-8 mb-8 border-b border-stone-200 dark:border-neutral-800"
      >
        <p className="text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase mb-3">
          Monthly Recurring Revenue
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <p className="text-5xl sm:text-7xl font-serif text-[#1A2E22] dark:text-white tracking-tight tabular-nums">
            {currencySymbol}{formatWithSeparators(Math.round(totalMonthly))}
          </p>
          <div className="flex items-center gap-3 pb-2">
            <span className="text-stone-500 dark:text-neutral-400 text-sm">
              from {activeItems.length} source{activeItems.length !== 1 ? 's' : ''}
            </span>
            {activeItems.length > 0 && (
              <span className="inline-flex items-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-xs font-medium px-2.5 py-0.5">
                Active
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Source Ledger */}
      <div>
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-[#F2F0E9] dark:bg-neutral-800/50 rounded-2xl"
            >
              <Wallet className="w-12 h-12 mx-auto text-stone-400 dark:text-neutral-500 mb-4 stroke-[1.5]" />
              <p className="text-stone-500 dark:text-neutral-400">No income sources added yet</p>
              <button
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-300 hover:border-stone-400 dark:hover:border-neutral-500 px-5 py-2 text-sm font-medium transition-colors"
              >
                Add your first income
              </button>
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
                  className="group py-5 border-b border-stone-200 dark:border-neutral-800 hover:bg-stone-50/50 dark:hover:bg-neutral-800/30 transition-colors -mx-2 px-2 rounded-sm"
                >
                  <div className="flex items-center gap-4">
                    <Icon className="w-5 h-5 stroke-[1.5] text-stone-500 dark:text-neutral-500 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif text-xl text-[#1A2E22] dark:text-white truncate">
                          {item.name}
                        </h3>
                        <span className="bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                          {frequencyOptions.find(f => f.value === item.frequency)?.label}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-stone-400 dark:text-neutral-500 text-sm mt-0.5 truncate">{item.description}</p>
                      )}
                    </div>

                    <p className="font-mono text-2xl text-[#1A2E22] dark:text-white tabular-nums text-right flex-shrink-0">
                      {currencySymbol}{formatWithSeparators(Number(item.amount))}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-700 text-stone-400 hover:text-stone-700 dark:hover:text-neutral-300 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={isDeleting}
                        className="p-2 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20 text-stone-400 hover:text-orange-600 transition-colors"
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
            <label className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(incomeTypeConfig).map(([type, config]) => {
                const TypeIcon = config.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type as Income['type'] }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                      formData.type === type
                        ? 'border-[#064E3B] bg-[#064E3B]/5 dark:bg-emerald-900/20'
                        : 'border-stone-200 dark:border-neutral-700 hover:border-stone-300'
                    )}
                  >
                    <TypeIcon className={cn(
                      'w-5 h-5 stroke-[1.5]',
                      formData.type === type ? 'text-[#064E3B] dark:text-emerald-400' : 'text-stone-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium',
                      formData.type === type ? 'text-[#064E3B] dark:text-emerald-400' : 'text-stone-500 dark:text-neutral-400'
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
            <label className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1.5">
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as Income['frequency'] }))}
              className="w-full h-14 px-4 rounded-xl border border-stone-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-stone-900 dark:text-white focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/20 outline-none transition-all"
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
            <Button
              type="submit"
              isLoading={isCreating || isUpdating}
              className="!rounded-full !bg-[#064E3B] hover:!bg-[#053D2E] !from-[#064E3B] !to-[#064E3B]"
            >
              {editingItem ? 'Save Changes' : 'Add Income'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
