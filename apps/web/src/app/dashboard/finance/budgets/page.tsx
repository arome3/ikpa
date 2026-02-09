'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Receipt, Utensils, Car, Home, ShoppingBag, Heart, Gamepad2,
  Pencil, Trash2, AlertTriangle, Navigation, Zap
} from 'lucide-react';
import { useBudgets, useCategories, type Budget, type CreateBudgetData, useGps, useCurrency } from '@/hooks';
import { Button, Modal, ModalFooter, Input, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWithSeparators } from '@/hooks';

const categoryIconMap: Record<string, typeof Receipt> = {
  'food-dining': Utensils,
  'transportation': Car,
  'housing': Home,
  'shopping': ShoppingBag,
  'healthcare': Heart,
  'entertainment': Gamepad2,
  'utilities': Zap,
};

const periodOptions = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

export default function BudgetsPage() {
  const router = useRouter();
  const { items, isLoading, create, update, delete: deleteBudget, isCreating, isUpdating, isDeleting } = useBudgets();
  const { categories } = useCategories();
  const { recalculate, isRecalculating } = useGps();
  const { symbol: currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Budget | null>(null);
  const [recalculatingCategory, setRecalculatingCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateBudgetData>({
    categoryId: '',
    amount: 0,
    period: 'MONTHLY',
  });

  const activeItems = items.filter((b: Budget) => b.isActive);

  // Calculate budget statistics
  const budgetStats = useMemo(() => {
    const totalBudget = activeItems.reduce((sum: number, item: Budget) => sum + Number(item.amount), 0);
    const totalSpent = activeItems.reduce((sum: number, item: Budget) => sum + Number(item.spent || 0), 0);
    const onTrack = activeItems.filter((item: Budget) => Number(item.spent || 0) <= Number(item.amount)).length;
    const overBudget = activeItems.filter((item: Budget) => Number(item.spent || 0) > Number(item.amount)).length;

    return { totalBudget, totalSpent, onTrack, overBudget };
  }, [activeItems]);

  const deployedPercent = budgetStats.totalBudget > 0
    ? ((budgetStats.totalSpent / budgetStats.totalBudget) * 100).toFixed(0)
    : '0';
  const remaining = budgetStats.totalBudget - budgetStats.totalSpent;

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ categoryId: '', amount: 0, period: 'MONTHLY' });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Budget) => {
    setEditingItem(item);
    setFormData({
      categoryId: item.category?.id || item.categoryId || '',
      amount: Number(item.amount),
      period: item.period,
      alertThreshold: item.alertThreshold ? Number(item.alertThreshold) : undefined,
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
    if (confirm('Are you sure you want to remove this budget?')) {
      await deleteBudget(id);
    }
  };

  const handleRecalculate = async (categoryName: string) => {
    setRecalculatingCategory(categoryName);
    try {
      const result = await recalculate({ category: categoryName });
      router.push(`/dashboard/gps/recovery/${result.sessionId}`);
    } catch (error) {
      console.error('Recalculate failed:', error);
      setRecalculatingCategory(null);
    }
  };

  const getCategoryById = (id: string) => categories.find((c: { id: string }) => c.id === id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-serif text-[#1A2E22] dark:text-white tracking-tight">
              Monthly Allocation
            </h1>
            {budgetStats.overBudget > 0 && (
              <span className="inline-flex items-center gap-1.5 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-400 text-xs font-medium px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                {budgetStats.overBudget} over
              </span>
            )}
          </div>
          <p className="text-stone-500 dark:text-neutral-400 text-sm mt-1">
            Tracking operating expenses against limits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {budgetStats.overBudget > 0 && (
            <button
              onClick={() => router.push('/dashboard/gps')}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-300 hover:border-stone-400 dark:hover:border-neutral-500 px-5 py-2.5 text-sm font-medium transition-colors"
            >
              <Navigation className="w-4 h-4" />
              View Trajectory
            </button>
          )}
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#064E3B] focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Set Allocation
          </button>
        </div>
      </div>

      {/* Statement Summary Strip */}
      {activeItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-y border-stone-200 dark:border-neutral-800 py-8 my-8"
        >
          <div className="grid grid-cols-3 gap-8">
            {/* Total Cap */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-500 mb-2">
                Total Cap
              </p>
              <p className="text-4xl font-serif text-[#1A2E22] dark:text-white tabular-nums">
                {currencySymbol}{formatWithSeparators(Math.round(budgetStats.totalBudget))}
              </p>
            </div>

            {/* Capital Deployed */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-500 mb-2">
                Capital Deployed
              </p>
              <p className={cn(
                'text-4xl font-mono tabular-nums',
                budgetStats.totalSpent > budgetStats.totalBudget
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-[#1A2E22] dark:text-white'
              )}>
                {currencySymbol}{formatWithSeparators(Math.round(budgetStats.totalSpent))}
              </p>
              <p className="text-stone-400 dark:text-neutral-500 text-sm mt-1">
                {deployedPercent}% deployed
              </p>
            </div>

            {/* Remaining */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-stone-500 dark:text-neutral-500 mb-2">
                Remaining
              </p>
              <p className={cn(
                'text-4xl font-mono tabular-nums',
                remaining < 0 ? 'text-red-700 dark:text-red-400' : 'text-[#1A2E22] dark:text-white'
              )}>
                {currencySymbol}{formatWithSeparators(Math.abs(Math.round(remaining)))}
              </p>
              {remaining < 0 && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {currencySymbol}{formatWithSeparators(Math.abs(Math.round(remaining)))} over limit
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Allocations Section */}
      <div>
        {activeItems.length > 0 && (
          <p className="text-xs font-bold tracking-widest text-stone-400 dark:text-neutral-500 uppercase mb-6">
            Allocations
          </p>
        )}

        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-[#F2F0E9] dark:bg-neutral-800/50 rounded-2xl"
            >
              <Receipt className="w-12 h-12 mx-auto text-stone-400 dark:text-neutral-500 mb-4 stroke-[1.5]" />
              <p className="text-stone-500 dark:text-neutral-400">No allocations set yet</p>
              <p className="text-stone-400 dark:text-neutral-500 text-sm mt-1">Start tracking your spending by setting an allocation</p>
              <button
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-300 hover:border-stone-400 dark:hover:border-neutral-500 px-5 py-2 text-sm font-medium transition-colors"
              >
                Set your first allocation
              </button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activeItems.map((item: Budget, index: number) => {
                const category = item.category || getCategoryById(item.categoryId || '');
                const Icon = category ? (categoryIconMap[category.id] || Receipt) : Receipt;
                const spent = Number(item.spent || 0);
                const budget = Number(item.amount);
                const progress = budget > 0 ? (spent / budget) * 100 : 0;
                const remaining = budget - spent;
                const isOverBudget = progress > 100;
                const isNearLimit = progress >= 80 && progress <= 100;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group rounded-lg p-6 border border-stone-200 dark:border-neutral-700 hover:shadow-md transition-all bg-white dark:bg-neutral-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <Icon className="w-5 h-5 stroke-[1.5] text-stone-500 dark:text-neutral-500 flex-shrink-0 mt-1" />
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-serif text-lg text-[#1A2E22] dark:text-white">
                              {category?.name || 'Unknown Category'}
                            </h3>
                            <span className="bg-stone-100 dark:bg-neutral-800 text-stone-600 dark:text-neutral-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium">
                              {periodOptions.find(p => p.value === item.period)?.label}
                            </span>
                            {isOverBudget && (
                              <span className="inline-flex items-center gap-1 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium">
                                Over Limit
                              </span>
                            )}
                            {isNearLimit && (
                              <span className="inline-flex items-center gap-1 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium">
                                Near Limit
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

                    {/* Progress Section */}
                    <div className="mt-4">
                      <div className="h-1.5 bg-stone-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            isOverBudget
                              ? 'bg-[#991B1B]'
                              : 'bg-[#1A2E22] dark:bg-emerald-600'
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-mono text-sm font-bold text-[#1A2E22] dark:text-white tabular-nums">
                          {currencySymbol}{formatWithSeparators(spent)}
                        </span>
                        <span className="text-stone-400 dark:text-neutral-500 text-sm tabular-nums">
                          {isOverBudget
                            ? `${currencySymbol}${formatWithSeparators(Math.abs(remaining))} over · ${progress.toFixed(0)}%`
                            : `${currencySymbol}${formatWithSeparators(remaining)} left · ${progress.toFixed(0)}%`}
                        </span>
                      </div>
                    </div>

                    {/* GPS Recalculate — text link */}
                    {(isOverBudget || isNearLimit) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-stone-200 dark:border-neutral-700"
                      >
                        <button
                          onClick={() => handleRecalculate(category?.name || '')}
                          disabled={isRecalculating && recalculatingCategory === category?.name}
                          className="text-sm text-[#991B1B] dark:text-red-400 hover:underline transition-colors"
                        >
                          {isRecalculating && recalculatingCategory === category?.name ? (
                            <span className="inline-flex items-center gap-2">
                              <motion.span
                                className="inline-block w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                              />
                              Calculating route...
                            </span>
                          ) : (
                            <span>Variance detected. <strong>Adjust Allocation →</strong></span>
                          )}
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Allocation' : 'Set Allocation'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1.5">
              Category
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              className="w-full h-14 px-4 rounded-xl border border-stone-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-stone-900 dark:text-white focus:border-[#064E3B] focus:ring-2 focus:ring-[#064E3B]/20 outline-none transition-all"
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat: { id: string; name: string }) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="Allocation Amount"
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
              Period
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, period: option.value as Budget['period'] }))}
                  className={cn(
                    'p-3 rounded-xl border-2 transition-all text-sm font-medium',
                    formData.period === option.value
                      ? 'border-[#064E3B] bg-[#064E3B]/5 text-[#064E3B] dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'border-stone-200 dark:border-neutral-700 hover:border-stone-300 text-stone-600 dark:text-neutral-400'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Alert Threshold (optional)"
            type="number"
            placeholder="80"
            rightAddon="%"
            hint="Get notified when spending reaches this percentage"
            value={formData.alertThreshold || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, alertThreshold: Number(e.target.value) || undefined }))}
            min={0}
            max={100}
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
              {editingItem ? 'Save Changes' : 'Set Allocation'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
