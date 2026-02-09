'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Target, Home, Car, GraduationCap, Plane, Heart, Sparkles,
  Pencil, Trash2, Calendar, CheckCircle2
} from 'lucide-react';
import { useGoals, type Goal, type CreateGoalData } from '@/hooks/useFinance';
import { Button, Modal, ModalFooter, Input, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWithSeparators, useCurrency } from '@/hooks';

const goalTypeConfig: Record<string, { icon: typeof Target; color: string; label: string }> = {
  EMERGENCY_FUND: { icon: Heart, color: 'rose', label: 'Emergency Fund' },
  SAVINGS: { icon: Target, color: 'blue', label: 'Savings' },
  INVESTMENT: { icon: Sparkles, color: 'purple', label: 'Investment' },
  DEBT_PAYOFF: { icon: Target, color: 'amber', label: 'Debt Payoff' },
  MAJOR_PURCHASE: { icon: Home, color: 'blue', label: 'Major Purchase' },
  EDUCATION: { icon: GraduationCap, color: 'emerald', label: 'Education' },
  TRAVEL: { icon: Plane, color: 'amber', label: 'Travel' },
  FAMILY: { icon: Heart, color: 'pink', label: 'Family' },
  BUSINESS: { icon: Car, color: 'purple', label: 'Business' },
  RETIREMENT: { icon: Sparkles, color: 'pink', label: 'Retirement' },
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
    <div className="space-y-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif text-[#1A2E22] dark:text-white tracking-tight">
            Financial Goals
          </h1>
          <p className="text-stone-500 dark:text-neutral-400 text-sm mt-1">
            Portfolio strategy and target tracking
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#064E3B] focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Executive Summary Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pb-8 mb-8 border-b border-stone-200 dark:border-neutral-800"
      >
        <div className="flex flex-col sm:flex-row sm:items-stretch sm:divide-x divide-stone-200 dark:divide-neutral-800">
          {/* Total Portfolio Target */}
          <div className="pb-6 sm:pb-0 sm:pr-8 border-b sm:border-b-0 border-stone-200 dark:border-neutral-800">
            <p className="text-xs font-bold tracking-widest text-emerald-800 dark:text-emerald-400 uppercase mb-3">
              Total Portfolio Target
            </p>
            <p className="text-5xl sm:text-7xl font-serif text-[#1A2E22] dark:text-white tracking-tight tabular-nums">
              {currencySymbol}{formatWithSeparators(Math.round(totalTarget))}
            </p>
            <p className="text-stone-500 dark:text-neutral-400 text-sm mt-2">
              {activeItems.length} active goal{activeItems.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Current Progress */}
          <div className="py-6 sm:py-0 sm:px-8 border-b sm:border-b-0 border-stone-200 dark:border-neutral-800">
            <p className="text-xs font-bold tracking-widest text-stone-400 dark:text-neutral-500 uppercase mb-3">
              Current Progress
            </p>
            <p className="font-mono text-3xl text-[#1A2E22] dark:text-white tabular-nums">
              {currencySymbol}{formatWithSeparators(Math.round(totalSaved))}
            </p>
            <p className="text-sm mt-2">
              <span className="inline-flex items-center text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-xs font-medium px-2.5 py-0.5">
                {overallProgress.toFixed(0)}% Funded
              </span>
            </p>
          </div>

          {/* Goals Achieved */}
          <div className="pt-6 sm:pt-0 sm:pl-8">
            <p className="text-xs font-bold tracking-widest text-stone-400 dark:text-neutral-500 uppercase mb-3">
              Goals Achieved
            </p>
            <p className="text-3xl font-serif text-[#1A2E22] dark:text-white tabular-nums">
              {completedItems.length} / {activeItems.length + completedItems.length}
            </p>
            <p className="text-stone-500 dark:text-neutral-400 text-sm mt-2">
              goals achieved
            </p>
          </div>
        </div>
      </motion.div>

      {/* Active Goals */}
      <div>
        {activeItems.length > 0 && (
          <p className="text-xs font-bold tracking-widest text-stone-400 dark:text-neutral-500 uppercase mb-6">
            Active Goals
          </p>
        )}
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-[#F2F0E9] dark:bg-neutral-800/50 rounded-2xl"
            >
              <Target className="w-12 h-12 mx-auto text-stone-400 dark:text-neutral-500 mb-4 stroke-[1.5]" />
              <p className="text-stone-500 dark:text-neutral-400">No goals set yet</p>
              <p className="text-stone-400 dark:text-neutral-500 text-sm mt-1">Start by setting your first financial goal</p>
              <button
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-stone-300 dark:border-neutral-600 text-stone-700 dark:text-neutral-300 hover:border-stone-400 dark:hover:border-neutral-500 px-5 py-2 text-sm font-medium transition-colors"
              >
                Create your first goal
              </button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activeItems.map((item: Goal, index: number) => {
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
                    className="group relative bg-white dark:bg-neutral-800 rounded-lg p-6 border border-stone-200 dark:border-neutral-700 hover:bg-stone-50/50 dark:hover:bg-neutral-800/80 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <Icon className="w-5 h-5 stroke-[1.5] text-stone-500 dark:text-neutral-500 flex-shrink-0 mt-1" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-serif text-xl text-[#1A2E22] dark:text-white">
                            {item.name}
                          </h3>
                          <span className="bg-stone-100 dark:bg-neutral-700 text-stone-600 dark:text-neutral-400 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium">
                            {config.label}
                          </span>
                          <span className={cn(
                            'border text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium',
                            prioConfig.color === 'emerald' && 'border-stone-300 dark:border-neutral-600 text-stone-500 dark:text-neutral-400',
                            prioConfig.color === 'amber' && 'border-stone-400 dark:border-neutral-500 text-stone-600 dark:text-neutral-300',
                            prioConfig.color === 'rose' && 'border-stone-500 dark:border-neutral-400 text-stone-700 dark:text-neutral-200',
                          )}>
                            {prioConfig.label}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-sm text-stone-400 dark:text-neutral-500 mt-1">{item.description}</p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-sm">
                          {item.targetDate && (
                            <span className={cn(
                              'flex items-center gap-1',
                              daysRemaining !== null && daysRemaining < 30 ? 'text-[#C2410C]' : 'text-stone-500 dark:text-neutral-400'
                            )}>
                              <Calendar className="w-3 h-3" />
                              {daysRemaining !== null && daysRemaining > 0
                                ? `${daysRemaining} days left`
                                : daysRemaining === 0
                                  ? 'Due today!'
                                  : 'Overdue'}
                            </span>
                          )}
                          <span className="font-mono text-stone-500 dark:text-neutral-400 tabular-nums">
                            {currencySymbol}{formatWithSeparators(Math.round(remaining))} to go
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="font-mono text-[#1A2E22] dark:text-white tabular-nums">
                              {currencySymbol}{formatWithSeparators(Number(item.currentAmount))}
                            </span>
                            <span className="font-mono text-stone-400 dark:text-neutral-500 tabular-nums">
                              {currencySymbol}{formatWithSeparators(Number(item.targetAmount))}
                            </span>
                          </div>
                          <div className="h-2 bg-stone-100 dark:bg-neutral-700 rounded-sm overflow-hidden">
                            <motion.div
                              className={cn(
                                'h-full rounded-sm',
                                progress >= 100 ? 'bg-[#3F6212]' : 'bg-[#064E3B]'
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(progress, 100)}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-stone-400 dark:text-neutral-500">{progress.toFixed(0)}% funded</span>
                            {progress >= 100 && (
                              <span className="text-xs text-[#3F6212] dark:text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Target reached
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
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Completed Goals — Ledger Pattern */}
      {completedItems.length > 0 && (
        <div className="mt-10">
          <p className="text-xs font-bold tracking-widest text-stone-400 dark:text-neutral-500 uppercase mb-4">
            Completed
          </p>
          <div>
            {completedItems.map((item: Goal) => (
              <div
                key={item.id}
                className="flex items-center gap-4 py-4 border-b border-stone-100 dark:border-neutral-800"
              >
                <CheckCircle2 className="w-5 h-5 text-[#3F6212] dark:text-emerald-400 flex-shrink-0" />
                <h4 className="font-serif text-[#1A2E22] dark:text-white flex-1 min-w-0 truncate">
                  {item.name}
                </h4>
                <p className="font-mono text-[#1A2E22] dark:text-white tabular-nums text-right flex-shrink-0">
                  {currencySymbol}{formatWithSeparators(Number(item.targetAmount))}
                </p>
              </div>
            ))}
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
            <label className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1.5">
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
                        ? 'border-[#064E3B] bg-[#064E3B]/5 dark:bg-emerald-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5',
                      formData.type === type ? 'text-[#064E3B] dark:text-emerald-400' : 'text-neutral-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium text-center',
                      formData.type === type ? 'text-[#064E3B] dark:text-emerald-400' : 'text-neutral-600 dark:text-neutral-400'
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
            <label className="block text-sm font-medium text-stone-700 dark:text-gray-300 mb-1.5">
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
                      ? 'border-[#064E3B] bg-[#064E3B]/5 text-[#064E3B] dark:bg-emerald-900/20 dark:text-emerald-400'
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
            <Button
              type="submit"
              isLoading={isCreating || isUpdating}
              className="!rounded-full !bg-[#064E3B] hover:!bg-[#053D2E] !from-[#064E3B] !to-[#064E3B]"
            >
              {editingItem ? 'Save Changes' : 'Create Goal'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
