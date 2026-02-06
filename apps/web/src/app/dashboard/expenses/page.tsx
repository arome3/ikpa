'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Calendar,
  Filter,
  X,
  Receipt,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Edit3,
  Check,
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useExpenses, CreateExpenseData, Expense } from '@/hooks/useExpenses';
import { useCategories, useBudgets } from '@/hooks/useFinance';
import { useCurrency } from '@/hooks';

// ============================================
// EXPENSES PAGE
// ============================================

export default function ExpensesPage() {
  const { currency } = useCurrency();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const {
    expenses,
    byCategory,
    isLoading,
    create,
    isCreating,
    update,
    isUpdating,
    delete: deleteExpense,
    isDeleting,
  } = useExpenses();
  const { categories } = useCategories();
  const { items: budgets } = useBudgets();

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        !searchQuery ||
        expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.merchant?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category?.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        !selectedCategory || expense.category?.name === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchQuery, selectedCategory]);

  // Group expenses by date
  const groupedExpenses = useMemo(() => {
    const groups: { [key: string]: Expense[] } = {};

    filteredExpenses.forEach((expense) => {
      const dateKey = new Date(expense.date).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(expense);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, items]) => ({
        date: new Date(date),
        expenses: items,
        total: items.reduce((sum, e) => sum + Math.abs(e.amount), 0),
      }));
  }, [filteredExpenses]);

  // Compute month and year totals
  const { monthTotal, yearTotal } = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    let month = 0;
    let year = 0;

    for (const e of expenses) {
      const d = new Date(e.date);
      const amt = Math.abs(e.amount);
      if (d.getFullYear() === thisYear) {
        year += amt;
        if (d.getMonth() === thisMonth) {
          month += amt;
        }
      }
    }

    return { monthTotal: month, yearTotal: year };
  }, [expenses]);

  // Check which categories are over budget
  const overBudgetCategories = useMemo(() => {
    return budgets
      .filter((b) => (b.percentUsed ?? 0) >= 80)
      .map((b) => b.category?.name);
  }, [budgets]);

  const handleAddExpense = async (data: CreateExpenseData) => {
    await create(data);
    setIsAddModalOpen(false);
  };

  const handleUpdateExpense = async (data: CreateExpenseData) => {
    if (!editingExpense) return;
    await update({ id: editingExpense.id, data });
    setEditingExpense(null);
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Delete this expense?')) {
      await deleteExpense(id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-40 -left-20 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top pb-32">
        {/* Header */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Expenses</h1>
              <p className="text-sm text-slate-400">Track where your money goes</p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-3 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl text-white shadow-lg shadow-primary-500/25"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          {/* Summary Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 via-orange-500/10 to-amber-500/10 border border-red-500/20 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-slate-400">This Month</p>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(monthTotal, currency)}
                </p>
              </div>
              <div className="p-3 bg-red-500/20 rounded-xl">
                <Receipt className="w-8 h-8 text-red-400" />
              </div>
            </div>

            {/* Year total */}
            <div className="mb-3 px-3 py-2 bg-white/5 rounded-xl flex items-center justify-between">
              <span className="text-sm text-slate-400">This Year</span>
              <span className="text-sm font-semibold text-white">
                {formatCurrency(yearTotal, currency)}
              </span>
            </div>

            {/* Category breakdown mini */}
            <div className="flex flex-wrap gap-2">
              {byCategory.slice(0, 4).map((cat) => (
                <div
                  key={cat.categoryId}
                  className="px-3 py-1.5 bg-white/10 rounded-full text-xs text-slate-300"
                >
                  {cat.categoryName}: {formatCurrency(Math.abs(cat.total), currency, { compact: true })}
                </div>
              ))}
            </div>
          </div>
        </motion.header>

        {/* Search & Filters */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-3 rounded-xl border transition-colors',
                showFilters
                  ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                  : 'bg-white/5 border-white/10 text-slate-400'
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Pills */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => setSelectedCategory('')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      !selectedCategory
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    )}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5',
                        selectedCategory === cat.name
                          ? 'bg-primary-500 text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      )}
                    >
                      <span>{cat.icon}</span>
                      {cat.name}
                      {overBudgetCategories.includes(cat.name) && (
                        <AlertTriangle className="w-3 h-3 text-caution-400" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Expenses List */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-white/5 rounded-full mb-4">
                <Receipt className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400">No expenses found</p>
              <p className="text-sm text-slate-500 mt-1">
                {searchQuery || selectedCategory
                  ? 'Try adjusting your filters'
                  : 'Tap + to add your first expense'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedExpenses.map((group, groupIndex) => (
                <motion.div
                  key={group.date.toISOString()}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * groupIndex }}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-400">
                        {formatDate(group.date, { relative: true })}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency(group.total, currency)}
                    </span>
                  </div>

                  {/* Expense Cards */}
                  <div className="space-y-2">
                    {group.expenses.map((expense, index) => (
                      <motion.div
                        key={expense.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.02 * index }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Category Icon */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                            style={{ backgroundColor: (expense.category?.color || '#666') + '20' }}
                          >
                            {expense.category?.icon || '💰'}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white truncate">
                                {expense.description || expense.merchant || expense.category?.name}
                              </p>
                              {overBudgetCategories.includes(expense.category?.name) && (
                                <AlertTriangle className="w-4 h-4 text-caution-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-slate-500">
                              {expense.category?.name}
                              {expense.merchant && ` · ${expense.merchant}`}
                            </p>
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <p className="font-semibold text-white">
                              -{formatCurrency(Math.abs(expense.amount), expense.currency)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => setEditingExpense(expense)}
                              className="p-2 text-slate-500 hover:text-white transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                              disabled={isDeleting}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(isAddModalOpen || editingExpense) && (
          <ExpenseModal
            expense={editingExpense}
            categories={categories}
            budgets={budgets}
            onSubmit={editingExpense ? handleUpdateExpense : handleAddExpense}
            onClose={() => {
              setIsAddModalOpen(false);
              setEditingExpense(null);
            }}
            isLoading={isCreating || isUpdating}
          />
        )}
      </AnimatePresence>

      {/* Quick Add FAB */}
      <motion.button
        onClick={() => setIsAddModalOpen(true)}
        className={cn(
          'fixed bottom-24 right-4 md:bottom-8',
          'w-14 h-14 rounded-full',
          'bg-gradient-to-r from-primary-500 to-secondary-500',
          'shadow-lg shadow-primary-500/30',
          'flex items-center justify-center',
          'text-white'
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <Plus className="w-7 h-7" />
      </motion.button>
    </div>
  );
}

// ============================================
// EXPENSE MODAL
// ============================================

interface ExpenseModalProps {
  expense: Expense | null;
  categories: { id: string; name: string; icon: string; color: string }[];
  budgets: { categoryId: string; percentUsed?: number }[];
  onSubmit: (data: CreateExpenseData) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

function ExpenseModal({
  expense,
  categories,
  budgets,
  onSubmit,
  onClose,
  isLoading,
}: ExpenseModalProps) {
  const { symbol: currencySymbol } = useCurrency();
  const [formData, setFormData] = useState<CreateExpenseData>({
    categoryId: expense?.categoryId || '',
    amount: expense?.amount || 0,
    description: expense?.description || '',
    merchant: expense?.merchant || '',
    date: expense?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const categoryBudget = budgets.find((b) => b.categoryId === formData.categoryId);
  const isOverBudget = (categoryBudget?.percentUsed ?? 0) >= 80;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId || formData.amount <= 0) return;
    await onSubmit(formData);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-t-3xl md:rounded-2xl overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {expense ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-medium">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-2xl font-bold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Category</label>
            <button
              type="button"
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className={cn(
                'w-full flex items-center justify-between p-4 rounded-xl border transition-colors',
                formData.categoryId
                  ? 'bg-white/5 border-white/20'
                  : 'bg-white/5 border-white/10'
              )}
            >
              {selectedCategory ? (
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: selectedCategory.color + '30' }}
                  >
                    {selectedCategory.icon}
                  </span>
                  <span className="font-medium text-white">{selectedCategory.name}</span>
                  {isOverBudget && (
                    <span className="px-2 py-0.5 bg-caution-500/20 text-caution-400 text-xs rounded-full">
                      {Math.round(categoryBudget?.percentUsed ?? 0)}% used
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-500">Select category</span>
              )}
              <ChevronDown className={cn(
                'w-5 h-5 text-slate-400 transition-transform',
                showCategoryPicker && 'rotate-180'
              )} />
            </button>

            {/* Category Picker */}
            <AnimatePresence>
              {showCategoryPicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {categories.map((cat) => {
                      const budget = budgets.find((b) => b.categoryId === cat.id);
                      const over = (budget?.percentUsed ?? 0) >= 80;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, categoryId: cat.id });
                            setShowCategoryPicker(false);
                          }}
                          className={cn(
                            'p-3 rounded-xl border flex flex-col items-center gap-1 transition-all',
                            formData.categoryId === cat.id
                              ? 'bg-primary-500/20 border-primary-500/50'
                              : 'bg-white/5 border-white/10 hover:bg-white/10',
                            over && 'ring-1 ring-caution-500/50'
                          )}
                        >
                          <span
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: cat.color + '30' }}
                          >
                            {cat.icon}
                          </span>
                          <span className="text-xs text-slate-300 truncate w-full text-center">
                            {cat.name}
                          </span>
                          {over && (
                            <AlertTriangle className="w-3 h-3 text-caution-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Description (optional)</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this for?"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Merchant (optional)</label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              placeholder="Where did you spend?"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Budget Warning */}
          {isOverBudget && (
            <div className="p-4 bg-caution-500/10 border border-caution-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-caution-400" />
                <span className="font-medium text-caution-400">Budget Alert</span>
              </div>
              <p className="text-sm text-slate-400">
                This category is at {Math.round(categoryBudget?.percentUsed ?? 0)}% of budget.
                Adding this expense may trigger a GPS recalculation.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!formData.categoryId || formData.amount <= 0 || isLoading}
            className={cn(
              'w-full py-4 rounded-xl font-semibold text-white',
              'bg-gradient-to-r from-primary-500 to-secondary-500',
              'hover:from-primary-400 hover:to-secondary-400',
              'shadow-lg shadow-primary-500/25',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {isLoading ? (
              <>
                <motion.div
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>{expense ? 'Update Expense' : 'Add Expense'}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
