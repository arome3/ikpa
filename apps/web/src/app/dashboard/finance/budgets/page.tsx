'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Receipt, Utensils, Car, Home, ShoppingBag, Heart, Gamepad2,
  Pencil, Trash2, AlertTriangle, CheckCircle2, Navigation, Zap
} from 'lucide-react';
import { useBudgets, useCategories, type Budget, type CreateBudgetData, useGps, useCurrency } from '@/hooks';
import { Button, Modal, ModalFooter, Input, Spinner, Badge } from '@/components/ui';
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
    <div className="space-y-8">
      {/* GPS Alert Banner - Shows when budgets are over limit */}
      {budgetStats.overBudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border border-orange-500/20 dark:from-orange-500/20 dark:via-amber-500/20 dark:to-orange-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Navigation className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-orange-700 dark:text-orange-400">
                {budgetStats.overBudget} budget{budgetStats.overBudget > 1 ? 's' : ''} exceeded
              </p>
              <p className="text-sm text-orange-600/80 dark:text-orange-400/70">
                Use GPS Re-Router to find your way back on track
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/gps')}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Open GPS
            </button>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Budget Manager
          </h1>
          <p className="text-neutral-500 mt-1">
            Set spending limits and track your expenses by category
          </p>
        </div>
        <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
          Create Budget
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 p-5 text-white"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <p className="text-pink-100 text-sm font-medium">Total Budget</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">
              {currencySymbol}{formatWithSeparators(Math.round(budgetStats.totalBudget))}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white dark:bg-neutral-800 p-5 border border-neutral-200 dark:border-neutral-700"
        >
          <p className="text-neutral-500 text-sm font-medium">Total Spent</p>
          <p className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white tabular-nums">
            {currencySymbol}{formatWithSeparators(Math.round(budgetStats.totalSpent))}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {budgetStats.totalBudget > 0
              ? `${((budgetStats.totalSpent / budgetStats.totalBudget) * 100).toFixed(0)}% of budget`
              : 'No budget set'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-5 border border-emerald-200 dark:border-emerald-800"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium">On Track</p>
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
            {budgetStats.onTrack}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
            budget{budgetStats.onTrack !== 1 ? 's' : ''} within limit
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            'rounded-2xl p-5 border',
            budgetStats.overBudget > 0
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn(
              'w-4 h-4',
              budgetStats.overBudget > 0 ? 'text-orange-600' : 'text-neutral-400'
            )} />
            <p className={cn(
              'text-sm font-medium',
              budgetStats.overBudget > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-neutral-500'
            )}>
              Over Budget
            </p>
          </div>
          <p className={cn(
            'text-2xl font-bold mt-1',
            budgetStats.overBudget > 0 ? 'text-orange-700 dark:text-orange-400' : 'text-neutral-400'
          )}>
            {budgetStats.overBudget}
          </p>
          <p className={cn(
            'text-xs mt-1',
            budgetStats.overBudget > 0 ? 'text-orange-600 dark:text-orange-500' : 'text-neutral-400'
          )}>
            {budgetStats.overBudget > 0 ? 'needs attention' : 'all good!'}
          </p>
        </motion.div>
      </div>

      {/* Budgets List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl"
            >
              <Receipt className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-500">No budgets created yet</p>
              <p className="text-neutral-400 text-sm mt-1">Start tracking your spending by creating a budget</p>
              <Button onClick={openAddModal} variant="secondary" className="mt-4">
                Create your first budget
              </Button>
            </motion.div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeItems.map((item: Budget, index: number) => {
                const category = item.category || getCategoryById(item.category?.id || item.categoryId);
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
                    className={cn(
                      'group relative bg-white dark:bg-neutral-800 rounded-2xl p-5 border transition-colors',
                      isOverBudget
                        ? 'border-orange-300 dark:border-orange-700'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-pink-300 dark:hover:border-pink-700'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                          isOverBudget
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                            : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900 dark:text-white">
                            {category?.name || 'Unknown Category'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" size="sm">
                              {periodOptions.find(p => p.value === item.period)?.label}
                            </Badge>
                            {isOverBudget && (
                              <Badge variant="outline" size="sm" className="border-orange-300 text-orange-600">
                                Over Budget
                              </Badge>
                            )}
                            {isNearLimit && (
                              <Badge variant="outline" size="sm" className="border-amber-300 text-amber-600">
                                Near Limit
                              </Badge>
                            )}
                          </div>
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

                    {/* Progress Section */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className={cn(
                          'font-medium tabular-nums',
                          isOverBudget ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-900 dark:text-white'
                        )}>
                          {currencySymbol}{formatWithSeparators(spent)} spent
                        </span>
                        <span className="text-neutral-500 tabular-nums">
                          of {currencySymbol}{formatWithSeparators(budget)}
                        </span>
                      </div>
                      <div className="h-3 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            isOverBudget
                              ? 'bg-orange-500'
                              : isNearLimit
                                ? 'bg-amber-500'
                                : 'bg-gradient-to-r from-pink-400 to-pink-500'
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-neutral-500">{progress.toFixed(0)}% used</span>
                        <span className={cn(
                          'text-xs font-medium',
                          isOverBudget
                            ? 'text-orange-600'
                            : remaining > 0
                              ? 'text-emerald-600'
                              : 'text-neutral-500'
                        )}>
                          {isOverBudget
                            ? `${currencySymbol}${formatWithSeparators(Math.abs(remaining))} over`
                            : `${currencySymbol}${formatWithSeparators(remaining)} remaining`}
                        </span>
                      </div>
                    </div>

                    {/* GPS Recalculate Button - Shows when over budget */}
                    {(isOverBudget || isNearLimit) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700"
                      >
                        <button
                          onClick={() => handleRecalculate(category?.name || '')}
                          disabled={isRecalculating && recalculatingCategory === category?.name}
                          className={cn(
                            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl',
                            'text-sm font-medium transition-all',
                            isOverBudget
                              ? 'bg-orange-100 hover:bg-orange-200 text-orange-700 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 dark:text-orange-400'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400'
                          )}
                        >
                          {isRecalculating && recalculatingCategory === category?.name ? (
                            <>
                              <motion.div
                                className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                              />
                              <span>Calculating route...</span>
                            </>
                          ) : (
                            <>
                              <Navigation className="w-4 h-4" />
                              <span>Recalculate Route</span>
                            </>
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
        title={editingItem ? 'Edit Budget' : 'Create Budget'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              className="w-full h-14 px-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat: { id: string; name: string }) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="Budget Amount"
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
              Budget Period
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
                      ? 'border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 text-neutral-600 dark:text-neutral-400'
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
            <Button type="submit" isLoading={isCreating || isUpdating}>
              {editingItem ? 'Save Changes' : 'Create Budget'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
