'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  X,
  Receipt,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Edit3,
  Check,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useExpenses, CreateExpenseData, Expense } from '@/hooks/useExpenses';
import { useCategories, useBudgets } from '@/hooks/useFinance';
import { useCurrency } from '@/hooks';
import { useExpenseNudge } from '@/hooks/useExpenses';
import { TimeMachineCard } from '@/components/time-machine/TimeMachineCard';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

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
  const [timeMachineExpense, setTimeMachineExpense] = useState<Expense | null>(null);
  const [lastCreatedExpenseId, setLastCreatedExpenseId] = useState<string | null>(null);

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
    const expense = await create(data);
    setLastCreatedExpenseId(expense?.id ?? null);
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
    <div className="min-h-screen bg-[#FDFCF8]">
      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top pb-24">
        {/* Header */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-serif text-[#1A2E22]">Expenses</h1>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-[#064E3B] text-white rounded-full px-5 py-2.5 text-sm font-medium hover:bg-[#053F30] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          </div>

          {/* Statement Header */}
          <div className="pt-2">
            <p className="text-xs uppercase tracking-widest text-stone-500 mb-1">This Month</p>
            <p className="text-6xl font-serif text-[#1A2E22] mb-2">
              {formatCurrency(monthTotal, currency)}
            </p>
            <p className="text-sm text-stone-500 mb-4">
              Year total: {formatCurrency(yearTotal, currency)}
            </p>

            {/* Category breakdown mini */}
            <div className="flex flex-wrap gap-2">
              {byCategory.slice(0, 4).map((cat) => (
                <div
                  key={cat.categoryId}
                  className="px-3 py-1.5 border border-stone-200 rounded-full text-xs text-stone-600"
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses..."
                className="w-full pl-7 pr-4 py-3 bg-transparent border-b border-stone-300 text-[#1A2E22] placeholder-stone-400 focus:outline-none focus:border-[#064E3B] transition-colors"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'p-3 rounded-full border transition-colors',
                showFilters
                  ? 'bg-[#064E3B] border-[#064E3B] text-white'
                  : 'border-stone-300 text-stone-400 hover:border-stone-400'
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
                        ? 'bg-[#064E3B] text-white'
                        : 'border border-stone-200 text-stone-600 hover:bg-stone-100'
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
                          ? 'bg-[#064E3B] text-white'
                          : 'border border-stone-200 text-stone-600 hover:bg-stone-100'
                      )}
                    >
                      <CategoryIcon name={cat.icon} className="w-4 h-4" />
                      {cat.name}
                      {overBudgetCategories.includes(cat.name) && (
                        <AlertTriangle className="w-3 h-3 text-orange-600" />
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-stone-200 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-stone-100 rounded-full mb-4">
                <Receipt className="w-8 h-8 text-stone-500" />
              </div>
              <p className="text-stone-500">No expenses found</p>
              <p className="text-sm text-stone-400 mt-1">
                {searchQuery || selectedCategory
                  ? 'Try adjusting your filters'
                  : 'Add your first expense'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedExpenses.map((group, groupIndex) => (
                <motion.div
                  key={group.date.toISOString()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 * groupIndex }}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between mb-1 pb-2 border-b border-stone-200">
                    <span className="text-xs uppercase tracking-widest text-stone-400">
                      {formatDate(group.date, { relative: true })}
                    </span>
                    <span className="text-sm font-mono font-semibold text-[#1A2E22]">
                      {formatCurrency(group.total, currency)}
                    </span>
                  </div>

                  {/* Expense Rows */}
                  <div>
                    {group.expenses.map((expense, index) => (
                      <motion.div
                        key={expense.id}
                        className="py-5 border-b border-stone-200 last:border-b-0 group"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.02 * index }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Category Icon */}
                          <span className="flex-shrink-0 text-stone-600">
                            <CategoryIcon name={expense.category?.icon || 'receipt'} className="w-5 h-5" />
                          </span>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-stone-900 truncate">
                                {expense.description || expense.merchant || expense.category?.name}
                              </p>
                              {overBudgetCategories.includes(expense.category?.name) && (
                                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-stone-500">
                              {expense.category?.name}
                              {expense.merchant && ` · ${expense.merchant}`}
                            </p>
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <p className="font-mono font-semibold text-[#1A2E22]">
                              -{formatCurrency(Math.abs(expense.amount), expense.currency)}
                            </p>
                          </div>

                          {/* Actions — hidden until hover on desktop, always visible on mobile */}
                          <div className="flex items-center gap-1 ml-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setTimeMachineExpense(expense)}
                              className="p-2 text-stone-400 hover:text-emerald-700 transition-colors"
                              title="Time Machine"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingExpense(expense)}
                              className="p-2 text-stone-400 hover:text-emerald-700 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-2 text-stone-400 hover:text-red-600 transition-colors"
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

      {/* Time Machine Bottom Sheet */}
      <AnimatePresence>
        {timeMachineExpense && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setTimeMachineExpense(null)}
            />
            <motion.div
              className="relative w-full max-w-lg"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <TimeMachineCard
                amount={Math.abs(timeMachineExpense.amount)}
                currency={timeMachineExpense.currency || currency}
                onClose={() => setTimeMachineExpense(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Spending Nudge */}
      <AnimatePresence>
        {lastCreatedExpenseId && (
          <ExpenseNudgeToast
            expenseId={lastCreatedExpenseId}
            onDismiss={() => setLastCreatedExpenseId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// EXPENSE MODAL
// ============================================

interface ExpenseModalProps {
  expense: Expense | null;
  categories: { id: string; name: string; icon: string; color: string }[];
  budgets: { categoryId?: string; percentUsed?: number }[];
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
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-lg bg-white border border-stone-200 rounded-t-3xl md:rounded-2xl overflow-hidden"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-lg font-serif font-semibold text-[#1A2E22]">
            {expense ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Amount */}
          <div>
            <label className="block text-sm text-stone-500 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-stone-400 text-xl font-medium">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full pl-7 pr-4 py-4 bg-transparent border-b border-stone-300 text-2xl font-bold text-[#1A2E22] placeholder-stone-300 focus:outline-none focus:border-[#064E3B] transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-stone-500 mb-2">Category</label>
            <button
              type="button"
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className={cn(
                'w-full flex items-center justify-between p-4 rounded-xl border transition-colors',
                formData.categoryId
                  ? 'bg-stone-50 border-stone-200'
                  : 'bg-white border-stone-200'
              )}
            >
              {selectedCategory ? (
                <div className="flex items-center gap-3">
                  <CategoryIcon name={selectedCategory.icon} className="w-5 h-5 text-stone-600" />
                  <span className="font-medium text-[#1A2E22]">{selectedCategory.name}</span>
                  {isOverBudget && (
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full border border-orange-200">
                      {Math.round(categoryBudget?.percentUsed ?? 0)}% used
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-stone-400">Select category</span>
              )}
              <ChevronDown className={cn(
                'w-5 h-5 text-stone-400 transition-transform',
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
                              ? 'bg-[#064E3B]/10 border-[#064E3B]/30'
                              : 'bg-stone-50 border-stone-200 hover:bg-stone-100',
                            over && 'ring-1 ring-orange-300'
                          )}
                        >
                          <CategoryIcon name={cat.icon} className="w-5 h-5 text-stone-600" />
                          <span className="text-xs text-stone-600 truncate w-full text-center">
                            {cat.name}
                          </span>
                          {over && (
                            <AlertTriangle className="w-3 h-3 text-orange-600" />
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
            <label className="block text-sm text-stone-500 mb-2">Description (optional)</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this for?"
              className="w-full px-0 py-3 bg-transparent border-b border-stone-300 text-[#1A2E22] placeholder-stone-400 focus:outline-none focus:border-[#064E3B] transition-colors"
            />
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-sm text-stone-500 mb-2">Merchant (optional)</label>
            <input
              type="text"
              value={formData.merchant}
              onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              placeholder="Where did you spend?"
              className="w-full px-0 py-3 bg-transparent border-b border-stone-300 text-[#1A2E22] placeholder-stone-400 focus:outline-none focus:border-[#064E3B] transition-colors"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm text-stone-500 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-0 py-3 bg-transparent border-b border-stone-300 text-[#1A2E22] focus:outline-none focus:border-[#064E3B] transition-colors"
            />
          </div>

          {/* Budget Warning */}
          {isOverBudget && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-700" />
                <span className="font-medium text-orange-800">Budget Alert</span>
              </div>
              <p className="text-sm text-orange-700">
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
              'w-full py-4 rounded-full font-semibold text-white',
              'bg-[#064E3B]',
              'hover:bg-[#053F30]',
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

// ============================================
// EXPENSE NUDGE TOAST (AI Spending Coach)
// ============================================

const severityStyles = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  critical: 'bg-red-50 border-red-200 text-red-800',
};

function ExpenseNudgeToast({
  expenseId,
  onDismiss,
}: {
  expenseId: string;
  onDismiss: () => void;
}) {
  const { nudge, isLoading } = useExpenseNudge(expenseId);

  // Auto-dismiss after 8 seconds if no nudge
  useEffect(() => {
    const timer = setTimeout(onDismiss, 12000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!nudge && !isLoading) return null;

  const severity = (nudge?.severity || 'info') as keyof typeof severityStyles;

  return (
    <motion.div
      className="fixed bottom-8 left-4 right-4 md:left-auto md:right-8 md:w-96 z-40"
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
    >
      <div
        className={cn(
          'p-4 rounded-2xl border',
          severityStyles[severity],
        )}
      >
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-0.5">AI Spending Coach</p>
            {isLoading ? (
              <p className="text-xs opacity-75">Analyzing your spending...</p>
            ) : nudge ? (
              <p className="text-xs opacity-90 leading-relaxed">{nudge.nudge}</p>
            ) : null}
          </div>
          <button
            onClick={onDismiss}
            className="p-1 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
