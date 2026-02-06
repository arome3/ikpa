'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, TrendingUp, TrendingDown, Building, Coins, BarChart3, Bitcoin,
  Pencil, Trash2, ArrowUpRight, ArrowDownRight, Landmark, Gem
} from 'lucide-react';
import { useInvestments, type Investment, type CreateInvestmentData } from '@/hooks/useFinance';
import { Button, Modal, ModalFooter, Input, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatWithSeparators, useCurrency } from '@/hooks';

const investmentTypeConfig: Record<string, { icon: typeof TrendingUp; color: string; label: string }> = {
  STOCKS: { icon: BarChart3, color: 'blue', label: 'Stocks' },
  BONDS: { icon: Landmark, color: 'amber', label: 'Bonds' },
  MUTUAL_FUNDS: { icon: Building, color: 'purple', label: 'Mutual Funds' },
  ETF: { icon: TrendingUp, color: 'emerald', label: 'ETFs' },
  REAL_ESTATE: { icon: Building, color: 'rose', label: 'Real Estate' },
  CRYPTO: { icon: Bitcoin, color: 'orange', label: 'Cryptocurrency' },
  COMMODITIES: { icon: Gem, color: 'yellow', label: 'Commodities' },
  OTHER: { icon: Coins, color: 'gray', label: 'Other' },
};

const riskLevelConfig: Record<string, { color: string; label: string }> = {
  LOW: { color: 'emerald', label: 'Low Risk' },
  MEDIUM: { color: 'amber', label: 'Medium Risk' },
  HIGH: { color: 'rose', label: 'High Risk' },
};

export default function InvestmentsPage() {
  const { items, isLoading, create, update, delete: deleteInvestment, isCreating, isUpdating, isDeleting } = useInvestments();
  const { symbol: currencySymbol } = useCurrency();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Investment | null>(null);
  const [formData, setFormData] = useState<CreateInvestmentData>({
    name: '',
    type: 'STOCKS',
    currentValue: 0,
    purchaseValue: 0,
    riskLevel: 'MEDIUM',
  });

  const activeItems = items.filter((i: Investment) => i.isActive);
  const totalValue = activeItems.reduce((sum: number, item: Investment) => sum + Number(item.currentValue), 0);
  const totalPurchased = activeItems.reduce((sum: number, item: Investment) => sum + Number(item.purchaseValue), 0);
  const totalReturn = totalValue - totalPurchased;
  const returnPercent = totalPurchased > 0 ? ((totalReturn / totalPurchased) * 100) : 0;

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', type: 'STOCKS', currentValue: 0, purchaseValue: 0, riskLevel: 'MEDIUM' });
    setIsModalOpen(true);
  };

  const openEditModal = (item: Investment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      type: item.type,
      currentValue: Number(item.currentValue),
      purchaseValue: Number(item.purchaseValue),
      riskLevel: item.riskLevel,
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
    if (confirm('Are you sure you want to remove this investment?')) {
      await deleteInvestment(id);
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
            Investments
          </h1>
          <p className="text-neutral-500 mt-1">
            Track your investment portfolio and returns
          </p>
        </div>
        <Button onClick={openAddModal} leftIcon={<Plus className="w-4 h-4" />}>
          Add Investment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <p className="text-purple-100 text-sm font-medium">Portfolio Value</p>
            <p className="text-3xl font-bold mt-2 tabular-nums">
              {currencySymbol}{formatWithSeparators(Math.round(totalValue))}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 border border-neutral-200 dark:border-neutral-700"
        >
          <p className="text-neutral-500 text-sm font-medium">Total Invested</p>
          <p className="text-3xl font-bold mt-2 text-neutral-900 dark:text-white tabular-nums">
            {currencySymbol}{formatWithSeparators(Math.round(totalPurchased))}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            'relative overflow-hidden rounded-2xl p-6',
            totalReturn >= 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800'
          )}
        >
          <div className="flex items-center gap-2">
            {totalReturn >= 0 ? (
              <ArrowUpRight className="w-5 h-5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-5 h-5 text-rose-600" />
            )}
            <p className={cn(
              'text-sm font-medium',
              totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'
            )}>
              Total Return
            </p>
          </div>
          <p className={cn(
            'text-3xl font-bold mt-2 tabular-nums',
            totalReturn >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
          )}>
            {totalReturn >= 0 ? '+' : ''}{currencySymbol}{formatWithSeparators(Math.round(totalReturn))}
          </p>
          <p className={cn(
            'text-sm mt-1',
            totalReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'
          )}>
            {totalReturn >= 0 ? '+' : ''}{returnPercent.toFixed(1)}%
          </p>
        </motion.div>
      </div>

      {/* Investments List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {activeItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-neutral-100 dark:bg-neutral-800/50 rounded-2xl"
            >
              <TrendingUp className="w-12 h-12 mx-auto text-neutral-400 mb-4" />
              <p className="text-neutral-500">No investments added yet</p>
              <Button onClick={openAddModal} variant="secondary" className="mt-4">
                Add your first investment
              </Button>
            </motion.div>
          ) : (
            activeItems.map((item: Investment, index: number) => {
              const config = investmentTypeConfig[item.type] || investmentTypeConfig.OTHER;
              const riskConfig = riskLevelConfig[item.riskLevel] || riskLevelConfig.MEDIUM;
              const Icon = config.icon;
              const itemReturn = Number(item.currentValue) - Number(item.purchaseValue);
              const itemReturnPercent = Number(item.purchaseValue) > 0
                ? ((itemReturn / Number(item.purchaseValue)) * 100)
                : 0;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white dark:bg-neutral-800 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                      config.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                      config.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                      config.color === 'emerald' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                      config.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                      config.color === 'rose' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
                      config.color === 'orange' && 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
                      config.color === 'yellow' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
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
                        <Badge
                          variant="outline"
                          size="sm"
                          className={cn(
                            riskConfig.color === 'emerald' && 'border-emerald-300 text-emerald-600',
                            riskConfig.color === 'amber' && 'border-amber-300 text-amber-600',
                            riskConfig.color === 'rose' && 'border-rose-300 text-rose-600',
                          )}
                        >
                          {riskConfig.label}
                        </Badge>
                      </div>
                      {item.institution && (
                        <p className="text-sm text-neutral-500 mt-1">{item.institution}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-neutral-500">
                          Cost: {currencySymbol}{formatWithSeparators(Number(item.purchaseValue))}
                        </span>
                        <span className={cn(
                          'flex items-center gap-1 font-medium',
                          itemReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        )}>
                          {itemReturn >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {itemReturn >= 0 ? '+' : ''}{itemReturnPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                        {currencySymbol}{formatWithSeparators(Number(item.currentValue))}
                      </p>
                      <p className={cn(
                        'text-sm font-medium tabular-nums',
                        itemReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      )}>
                        {itemReturn >= 0 ? '+' : ''}{currencySymbol}{formatWithSeparators(Math.round(itemReturn))}
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
        title={editingItem ? 'Edit Investment' : 'Add Investment'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Investment Name"
            placeholder="e.g., Apple Stocks"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Investment Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(investmentTypeConfig).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type as Investment['type'] }))}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                      formData.type === type
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5',
                      formData.type === type ? 'text-purple-600' : 'text-neutral-400'
                    )} />
                    <span className={cn(
                      'text-xs font-medium text-center',
                      formData.type === type ? 'text-purple-700 dark:text-purple-400' : 'text-neutral-600 dark:text-neutral-400'
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
              label="Purchase Value"
              type="number"
              placeholder="0"
              currencySymbol={currencySymbol}
              value={formData.purchaseValue || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, purchaseValue: Number(e.target.value) }))}
              required
              min={0}
            />
            <Input
              label="Current Value"
              type="number"
              placeholder="0"
              currencySymbol={currencySymbol}
              value={formData.currentValue || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, currentValue: Number(e.target.value) }))}
              required
              min={0}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Risk Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(riskLevelConfig).map(([level, config]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, riskLevel: level as Investment['riskLevel'] }))}
                  className={cn(
                    'p-3 rounded-xl border-2 transition-all text-sm font-medium',
                    formData.riskLevel === level
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
            label="Institution (optional)"
            placeholder="e.g., Bamboo, Risevest"
            value={formData.institution || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, institution: e.target.value }))}
          />

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
              {editingItem ? 'Save Changes' : 'Add Investment'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
