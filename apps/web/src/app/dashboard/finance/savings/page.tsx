'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, PiggyBank, Building2, Landmark, Coins, Shield, Lock,
  Pencil, Trash2, TrendingUp, Percent
} from 'lucide-react';
import { useSavings, type Savings, type CreateSavingsData } from '@/hooks/useFinance';
import { Button, Modal, ModalFooter, Input, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWithSeparators, useCurrency } from '@/hooks';

const savingsTypeConfig: Record<string, { icon: typeof PiggyBank; color: string; label: string }> = {
  BANK_ACCOUNT: { icon: Landmark, color: 'blue', label: 'Bank Account' },
  MOBILE_MONEY: { icon: PiggyBank, color: 'emerald', label: 'Mobile Money' },
  CASH: { icon: Coins, color: 'amber', label: 'Cash' },
  FIXED_DEPOSIT: { icon: Lock, color: 'purple', label: 'Fixed Deposit' },
  AJO_SUSU: { icon: Shield, color: 'rose', label: 'Ajo/Susu' },
  COOPERATIVE: { icon: Building2, color: 'pink', label: 'Cooperative' },
  OTHER: { icon: TrendingUp, color: 'gray', label: 'Other' },
};

export default function SavingsPage() {
  const { items, isLoading, create, update, delete: deleteSavings, isCreating, isUpdating, isDeleting } = useSavings();
  const { symbol: currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Savings | null>(null);
  const [formData, setFormData] = useState<CreateSavingsData>({
    name: '',
    type: 'BANK_ACCOUNT',
    balance: 0,
  });

  const activeItems = items.filter((s: Savings) => s.isActive);
  const totalSavings = activeItems.reduce((sum: number, item: Savings) => sum + Number(item.balance), 0);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', type: 'BANK_ACCOUNT', balance: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Savings) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      balance: Number(item.balance),
      interestRate: item.interestRate ? Number(item.interestRate) : undefined,
      institution: item.institution || undefined,
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
    if (confirm('Are you sure you want to remove this savings account?')) {
      await deleteSavings(id);
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
            Savings Accounts
          </h1>
          <p className="text-neutral-500 mt-1">
            Track your savings across different accounts and goals
          </p>
        </div>
        <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
          Add Savings
        </Button>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative">
          <p className="text-blue-100 text-sm font-medium">Total Savings</p>
          <p className="text-4xl font-bold mt-2 tabular-nums">
            {currencySymbol}{formatWithSeparators(Math.round(totalSavings))}
          </p>
          <p className="text-blue-200 text-sm mt-2">
            Across {activeItems.length} account{activeItems.length !== 1 ? 's' : ''}
          </p>
        </div>
      </motion.div>

      {/* Savings List */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="md:col-span-2 text-center py-16 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl"
            >
              <PiggyBank className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-500">No savings accounts added yet</p>
              <Button onClick={openAddModal} variant="secondary" className="mt-4">
                Add your first savings
              </Button>
            </motion.div>
          ) : (
            activeItems.map((item: Savings, index: number) => {
              const config = savingsTypeConfig[item.type] || savingsTypeConfig.OTHER;
              const Icon = config.icon;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        config.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                        config.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                        config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                        config.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                        config.color === 'pink' && 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
                        config.color === 'rose' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
                        config.color === 'gray' && 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400',
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-white">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" size="sm">{config.label}</Badge>
                          {item.interestRate && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <Percent className="w-3 h-3" />
                              {Number(item.interestRate)}% APY
                            </span>
                          )}
                        </div>
                        {item.institution && (
                          <p className="text-sm text-neutral-500 mt-1">{item.institution}</p>
                        )}
                      </div>
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

                  <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                    <p className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">
                      {currencySymbol}{formatWithSeparators(Number(item.balance))}
                    </p>
                    <p className="text-sm text-neutral-500">Current Balance</p>
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
        title={editingItem ? 'Edit Savings Account' : 'Add Savings Account'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Account Name"
            placeholder="e.g., Emergency Fund"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Account Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(savingsTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type as Savings['type'] }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                      formData.type === type
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5',
                      formData.type === type ? 'text-blue-600' : 'text-neutral-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium text-center',
                      formData.type === type ? 'text-blue-700 dark:text-blue-400' : 'text-neutral-600 dark:text-neutral-400'
                    )}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Current Balance"
            type="number"
            placeholder="0"
            currencySymbol={currencySymbol}
            value={formData.balance || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, balance: Number(e.target.value) }))}
            required
            min={0}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Interest Rate (optional)"
              type="number"
              placeholder="0"
              rightAddon="%"
              value={formData.interestRate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, interestRate: Number(e.target.value) || undefined }))}
              min={0}
              step={0.01}
            />
            <Input
              label="Institution (optional)"
              placeholder="e.g., GTBank"
              value={formData.institution || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, institution: e.target.value }))}
            />
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
              {editingItem ? 'Save Changes' : 'Add Savings'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
