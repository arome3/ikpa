'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Target, Home, Car, GraduationCap, Plane, Heart, Sparkles,
  Pencil, Trash2, Calendar
} from 'lucide-react';
import { useGoals, type Goal, type CreateGoalData } from '@/hooks/useFinance';
import { Button, Modal, ModalFooter, Input, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWithSeparators, useCurrency } from '@/hooks';

const goalTypeConfig: Record<string, { icon: typeof Target; color: string; label: string }> = {
  EMERGENCY_FUND: { icon: Heart, color: 'rose', label: 'Emergency Fund' },
  HOME: { icon: Home, color: 'blue', label: 'Home' },
  VEHICLE: { icon: Car, color: 'purple', label: 'Vehicle' },
  EDUCATION: { icon: GraduationCap, color: 'emerald', label: 'Education' },
  TRAVEL: { icon: Plane, color: 'amber', label: 'Travel' },
  RETIREMENT: { icon: Sparkles, color: 'pink', label: 'Retirement' },
  WEDDING: { icon: Heart, color: 'rose', label: 'Wedding' },
  OTHER: { icon: Target, color: 'gray', label: 'Other' },
};

const priorityConfig: Record<string, { color: string; label: string }> = {
  LOW: { color: 'emerald', label: 'Low Priority' },
  MEDIUM: { color: 'amber', label: 'Medium Priority' },
  HIGH: { color: 'rose', label: 'High Priority' },
};

export default function GoalsPage() {
  const { items, isLoading, create, update, delete: deleteGoal, isCreating, isUpdating, isDeleting } = useGoals();
  const { symbol: currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Goal | null>(null);
  const [formData, setFormData] = useState<CreateGoalData>({
    name: '',
    type: 'OTHER',
    targetAmount: 0,
    currentAmount: 0,
    priority: 'MEDIUM',
  });

  const activeItems = items.filter((g: Goal) => g.status === 'ACTIVE');
  const completedItems = items.filter((g: Goal) => g.status === 'COMPLETED');
  const totalTarget = activeItems.reduce((sum: number, item: Goal) => sum + Number(item.targetAmount), 0);
  const totalSaved = activeItems.reduce((sum: number, item: Goal) => sum + Number(item.currentAmount), 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      type: 'OTHER',
      targetAmount: 0,
      currentAmount: 0,
      priority: 'MEDIUM',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Goal) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      targetAmount: Number(item.targetAmount),
      currentAmount: Number(item.currentAmount),
      priority: item.priority,
      targetDate: item.targetDate ? new Date(item.targetDate).toISOString().split('T')[0] : undefined,
      description: item.description || undefined,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      targetDate: formData.targetDate ? new Date(formData.targetDate).toISOString() : undefined,
    };
    if (editingItem) {
      await update({ id: editingItem.id, data: submitData });
    } else {
      await create(submitData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this goal?')) {
      await deleteGoal(id);
    }
  };

  // Calculate days remaining for a goal
  const getDaysRemaining = (targetDate: string | null | undefined) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
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
            Financial Goals
          </h1>
          <p className="text-neutral-500 mt-1">
            Set and track your savings goals
          </p>
        </div>
        <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
          Add Goal
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <p className="text-amber-100 text-sm font-medium">Total Goal Target</p>
            <p className="text-3xl font-bold mt-2 tabular-nums">
              {currencySymbol}{formatWithSeparators(Math.round(totalTarget))}
            </p>
            <p className="text-amber-200 text-sm mt-2">
              {activeItems.length} active goal{activeItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 border border-neutral-200 dark:border-neutral-700"
        >
          <p className="text-neutral-500 text-sm font-medium">Progress</p>
          <p className="text-3xl font-bold mt-2 text-emerald-600 dark:text-emerald-400 tabular-nums">
            {currencySymbol}{formatWithSeparators(Math.round(totalSaved))}
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span>Overall</span>
              <span>{overallProgress.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(overallProgress, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative overflow-hidden rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-6 border border-emerald-200 dark:border-emerald-800"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium">Completed</p>
          </div>
          <p className="text-3xl font-bold mt-2 text-emerald-700 dark:text-emerald-400">
            {completedItems.length}
          </p>
          <p className="text-emerald-600 dark:text-emerald-500 text-sm mt-1">
            goal{completedItems.length !== 1 ? 's' : ''} achieved
          </p>
        </motion.div>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Active Goals
        </h2>
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl"
            >
              <Target className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-500">No goals set yet</p>
              <p className="text-neutral-400 text-sm mt-1">Start by setting your first financial goal</p>
              <Button onClick={openAddModal} variant="secondary" className="mt-4">
                Create your first goal
              </Button>
            </motion.div>
          ) : (
            activeItems.map((item: Goal, index: number) => {
              const config = goalTypeConfig[item.type] || goalTypeConfig.OTHER;
              const prioConfig = priorityConfig[item.priority] || priorityConfig.MEDIUM;
              const Icon = config.icon;
              const progress = Number(item.targetAmount) > 0
                ? (Number(item.currentAmount) / Number(item.targetAmount)) * 100
                : 0;
              const remaining = Number(item.targetAmount) - Number(item.currentAmount);
              const daysRemaining = getDaysRemaining(item.targetDate);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
                      config.color === 'rose' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
                      config.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                      config.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                      config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                      config.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                      config.color === 'pink' && 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
                      config.color === 'gray' && 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400',
                    )}>
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-neutral-900 dark:text-white text-lg">
                          {item.name}
                        </h3>
                        <Badge variant="outline" size="sm">{config.label}</Badge>
                        <Badge
                          variant="outline"
                          size="sm"
                          className={cn(
                            prioConfig.color === 'emerald' && 'border-emerald-300 text-emerald-600',
                            prioConfig.color === 'amber' && 'border-amber-300 text-amber-600',
                            prioConfig.color === 'rose' && 'border-rose-300 text-rose-600',
                          )}
                        >
                          {prioConfig.label}
                        </Badge>
                      </div>

                      {item.description && (
                        <p className="text-sm text-neutral-500 mt-1">{item.description}</p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {item.targetDate && (
                          <span className={cn(
                            'flex items-center gap-1',
                            daysRemaining !== null && daysRemaining < 30 ? 'text-amber-600' : 'text-neutral-500'
                          )}>
                            <Calendar className="w-3 h-3" />
                            {daysRemaining !== null && daysRemaining > 0
                              ? `${daysRemaining} days left`
                              : daysRemaining === 0
                                ? 'Due today!'
                                : 'Overdue'}
                          </span>
                        )}
                        <span className="text-neutral-500">
                          {currencySymbol}{formatWithSeparators(Math.round(remaining))} to go
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="font-medium text-neutral-900 dark:text-white tabular-nums">
                            {currencySymbol}{formatWithSeparators(Number(item.currentAmount))}
                          </span>
                          <span className="text-neutral-500 tabular-nums">
                            {currencySymbol}{formatWithSeparators(Number(item.targetAmount))}
                          </span>
                        </div>
                        <div className="h-3 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <motion.div
                            className={cn(
                              'h-full rounded-full',
                              progress >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-neutral-500">{progress.toFixed(0)}% complete</span>
                          {progress >= 100 && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Goal reached!
                            </span>
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
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Completed Goals */}
      {completedItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Completed Goals
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {completedItems.map((item: Goal) => {
              const config = goalTypeConfig[item.type] || goalTypeConfig.OTHER;
              const Icon = config.icon;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-neutral-900 dark:text-white">{item.name}</h4>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">
                        {currencySymbol}{formatWithSeparators(Number(item.targetAmount))} achieved
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Goal' : 'Create New Goal'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Goal Name"
            placeholder="e.g., Buy a Car"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Goal Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(goalTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type as Goal['type'] }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                      formData.type === type
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5',
                      formData.type === type ? 'text-amber-600' : 'text-neutral-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium text-center',
                      formData.type === type ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-600 dark:text-neutral-400'
                    )}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Target Amount"
              type="number"
              placeholder="0"
              currencySymbol={currencySymbol}
              value={formData.targetAmount || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, targetAmount: Number(e.target.value) }))}
              required
              min={0}
            />
            <Input
              label="Current Progress"
              type="number"
              placeholder="0"
              currencySymbol={currencySymbol}
              value={formData.currentAmount || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, currentAmount: Number(e.target.value) }))}
              min={0}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Priority Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(priorityConfig).map(([level, config]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: level as Goal['priority'] }))}
                  className={cn(
                    'p-3 rounded-xl border-2 transition-all text-sm font-medium',
                    formData.priority === level
                      ? cn(
                          'border-current',
                          config.color === 'emerald' && 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                          config.color === 'amber' && 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
                          config.color === 'rose' && 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',
                        )
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 text-neutral-600'
                  )}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Target Date (optional)"
            type="date"
            value={formData.targetDate || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, targetDate: e.target.value }))}
          />

          <Input
            label="Description (optional)"
            placeholder="Add notes about this goal..."
            value={formData.description || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          />

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreating || isUpdating}>
              {editingItem ? 'Save Changes' : 'Create Goal'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
