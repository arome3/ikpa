'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, CreditCard, Home, Car, GraduationCap, Users, ShoppingBag,
  Pencil, Trash2, Calendar, Percent, AlertTriangle
} from 'lucide-react';
import { useDebts, type Debt, type CreateDebtData } from '@/hooks/useFinance';
import { Button, Modal, ModalFooter, Input, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWithSeparators, useCurrency } from '@/hooks';

const debtTypeConfig: Record<string, { icon: typeof CreditCard; color: string; label: string }> = {
  BANK_LOAN: { icon: Home, color: 'blue', label: 'Bank Loan' },
  CREDIT_CARD: { icon: CreditCard, color: 'rose', label: 'Credit Card' },
  BNPL: { icon: ShoppingBag, color: 'pink', label: 'Buy Now Pay Later' },
  PERSONAL_LOAN: { icon: Users, color: 'amber', label: 'Personal Loan' },
  MORTGAGE: { icon: Home, color: 'purple', label: 'Mortgage' },
  STUDENT_LOAN: { icon: GraduationCap, color: 'emerald', label: 'Student Loan' },
  BUSINESS_LOAN: { icon: Car, color: 'blue', label: 'Business Loan' },
  OTHER: { icon: CreditCard, color: 'gray', label: 'Other' },
};

export default function DebtsPage() {
  const { items, isLoading, create, update, delete: deleteDebt, isCreating, isUpdating, isDeleting } = useDebts();
  const { symbol: currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Debt | null>(null);
  const [formData, setFormData] = useState<CreateDebtData>({
    name: '',
    type: 'PERSONAL_LOAN',
    originalAmount: 0,
    currentBalance: 0,
    interestRate: 0,
    minimumPayment: 0,
  });

  const activeItems = items.filter((d: Debt) => d.isActive);
  const totalDebt = activeItems.reduce((sum: number, item: Debt) => sum + Number(item.currentBalance), 0);
  const totalOriginal = activeItems.reduce((sum: number, item: Debt) => sum + Number(item.originalAmount), 0);
  const totalPaid = totalOriginal - totalDebt;
  const paidPercent = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;

  // Find highest interest debt
  const highestInterest = activeItems.reduce((max: Debt | undefined, item: Debt) =>
    Number(item.interestRate) > Number(max?.interestRate || 0) ? item : max
  , activeItems[0]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      type: 'PERSONAL_LOAN',
      originalAmount: 0,
      currentBalance: 0,
      interestRate: 0,
      minimumPayment: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Debt) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      originalAmount: Number(item.originalAmount),
      currentBalance: Number(item.currentBalance),
      interestRate: Number(item.interestRate),
      minimumPayment: Number(item.minimumPayment),
      dueDate: item.dueDate || undefined,
      lender: item.lender || undefined,
      description: item.description || undefined,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (editingItem) {
      await update({ id: editingItem.id, data: submitData });
    } else {
      await create(submitData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this debt?')) {
      await deleteDebt(id);
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
            Debts & Loans
          </h1>
          <p className="text-neutral-500 mt-1">
            Track your debts and monitor repayment progress
          </p>
        </div>
        <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
          Add Debt
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 p-6 text-white"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <p className="text-rose-100 text-sm font-medium">Total Debt</p>
            <p className="text-3xl font-bold mt-2 tabular-nums">
              {currencySymbol}{formatWithSeparators(Math.round(totalDebt))}
            </p>
            <p className="text-rose-200 text-sm mt-2">
              {activeItems.length} active debt{activeItems.length !== 1 ? 's' : ''}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 border border-neutral-200 dark:border-neutral-700"
        >
          <p className="text-neutral-500 text-sm font-medium">Total Paid Off</p>
          <p className="text-3xl font-bold mt-2 text-emerald-600 dark:text-emerald-400 tabular-nums">
            {currencySymbol}{formatWithSeparators(Math.round(totalPaid))}
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <span>Progress</span>
              <span>{paidPercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${paidPercent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>

        {highestInterest && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-6 border border-amber-200 dark:border-amber-800"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">Priority Debt</p>
            </div>
            <p className="text-lg font-bold mt-2 text-neutral-900 dark:text-white">
              {highestInterest.name}
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">
              {Number(highestInterest.interestRate)}% interest rate
            </p>
          </motion.div>
        )}
      </div>

      {/* Debts List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl"
            >
              <CreditCard className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-500">No debts tracked yet</p>
              <p className="text-neutral-400 text-sm mt-1">Great job staying debt-free!</p>
              <Button onClick={openAddModal} variant="secondary" className="mt-4">
                Add a debt to track
              </Button>
            </motion.div>
          ) : (
            activeItems.map((item: Debt, index: number) => {
              const config = debtTypeConfig[item.type] || debtTypeConfig.OTHER;
              const Icon = config.icon;
              const paidAmount = Number(item.originalAmount) - Number(item.currentBalance);
              const progress = Number(item.originalAmount) > 0
                ? (paidAmount / Number(item.originalAmount)) * 100
                : 0;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-700 hover:border-rose-300 dark:hover:border-rose-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                      config.color === 'rose' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
                      config.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                      config.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                      config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                      config.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                      config.color === 'pink' && 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
                      config.color === 'gray' && 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400',
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-neutral-900 dark:text-white">
                          {item.name}
                        </h3>
                        <Badge variant="outline" size="sm">{config.label}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          {Number(item.interestRate)}% APR
                        </span>
                        {item.minimumPayment && Number(item.minimumPayment) > 0 && (
                          <span>
                            Min: {currencySymbol}{formatWithSeparators(Number(item.minimumPayment))}/mo
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due: {item.dueDate}th of month
                          </span>
                        )}
                      </div>
                      {item.lender && (
                        <p className="text-sm text-neutral-400 mt-1">{item.lender}</p>
                      )}

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                          <span>{currencySymbol}{formatWithSeparators(Math.round(paidAmount))} paid</span>
                          <span>{progress.toFixed(0)}% complete</span>
                        </div>
                        <div className="h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-emerald-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {currencySymbol}{formatWithSeparators(Number(item.currentBalance))}
                      </p>
                      <p className="text-sm text-neutral-500">
                        of {currencySymbol}{formatWithSeparators(Number(item.originalAmount))}
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
        title={editingItem ? 'Edit Debt' : 'Add Debt'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Debt Name"
            placeholder="e.g., Credit Card Balance"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Debt Type
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Object.entries(debtTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type as Debt['type'] }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                      formData.type === type
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5',
                      formData.type === type ? 'text-rose-600' : 'text-neutral-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium text-center',
                      formData.type === type ? 'text-rose-700 dark:text-rose-400' : 'text-neutral-600 dark:text-neutral-400'
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
              label="Original Amount"
              type="number"
              placeholder="0"
              currencySymbol={currencySymbol}
              value={formData.originalAmount || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, originalAmount: Number(e.target.value) }))}
              required
              min={0}
            />
            <Input
              label="Current Balance"
              type="number"
              placeholder="0"
              currencySymbol={currencySymbol}
              value={formData.currentBalance || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, currentBalance: Number(e.target.value) }))}
              required
              min={0}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Interest Rate"
              type="number"
              placeholder="0"
              rightAddon="% APR"
              value={formData.interestRate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, interestRate: Number(e.target.value) }))}
              required
              min={0}
              step={0.01}
            />
            <Input
              label="Minimum Payment"
              type="number"
              placeholder="0"
              currencySymbol={currencySymbol}
              value={formData.minimumPayment || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, minimumPayment: Number(e.target.value) }))}
              min={0}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Day of Month (optional)"
              type="number"
              placeholder="1-31"
              value={formData.dueDate || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              min={1}
              max={31}
            />
            <Input
              label="Lender (optional)"
              placeholder="e.g., First Bank"
              value={formData.lender || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, lender: e.target.value }))}
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
              {editingItem ? 'Save Changes' : 'Add Debt'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
