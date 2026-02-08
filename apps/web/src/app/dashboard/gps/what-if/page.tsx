'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Target,
  Wallet,
  ChevronRight,
  Pause,
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Film,
  HeartPulse,
  Home,
  Gamepad2,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGps } from '@/hooks/useGps';
import { useCategories, useBudgets } from '@/hooks/useFinance';
import { useCurrency } from '@/hooks';

// ============================================
// WHAT-IF SIMULATOR
// ============================================

const iconNameMap: Record<string, LucideIcon> = {
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  zap: Zap,
  film: Film,
  'heart-pulse': HeartPulse,
  home: Home,
  gamepad2: Gamepad2,
  'graduation-cap': GraduationCap,
};

export default function WhatIfSimulator() {
  const { symbol: currencySymbol } = useCurrency();
  const router = useRouter();
  const { categories } = useCategories();
  const { items: budgets } = useBudgets();
  const { simulateWhatIf, isSimulating, whatIfData, checkCategoryFrozen } = useGps();

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [hasSimulated, setHasSimulated] = useState(false);
  const [isCategoryFrozen, setIsCategoryFrozen] = useState(false);

  // Get categories that have budgets
  const budgetedCategories = categories.filter((cat) =>
    budgets.some((b) => (b.category?.id || b.categoryId) === cat.id)
  );

  // Check if selected category is frozen
  useEffect(() => {
    if (!selectedCategory) {
      setIsCategoryFrozen(false);
      return;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const cat = budgetedCategories.find((c) => c.name === selectedCategory);
        if (!cat) return;
        const result = await checkCategoryFrozen(cat.id);
        if (!cancelled) setIsCategoryFrozen(result?.isFrozen ?? false);
      } catch {
        if (!cancelled) setIsCategoryFrozen(false);
      }
    };
    check();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const handleSimulate = async () => {
    if (!selectedCategory || !amount) return;

    await simulateWhatIf({
      category: selectedCategory,
      additionalSpend: parseFloat(amount),
    });
    setHasSimulated(true);
  };

  const severityColors = {
    low: {
      bg: 'from-green-500/20 to-emerald-500/20',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: CheckCircle,
    },
    medium: {
      bg: 'from-amber-500/20 to-orange-500/20',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: AlertTriangle,
    },
    high: {
      bg: 'from-red-500/20 to-rose-500/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: AlertTriangle,
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Back button */}
        <motion.button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        {/* Header */}
        <motion.header
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex p-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl mb-4 backdrop-blur-sm">
            <Sparkles className="w-10 h-10 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">What-If Simulator</h1>
          <p className="text-slate-400">See how spending affects your goals</p>
        </motion.header>

        {/* Input Section */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4">
              If I spend...
            </h2>

            {/* Amount Input */}
            <div className="mb-5">
              <label className="block text-sm text-slate-400 mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-medium">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className={cn(
                    'w-full pl-10 pr-4 py-4 rounded-xl',
                    'bg-white/5 border border-white/10',
                    'text-2xl font-bold text-white placeholder-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'transition-all duration-200'
                  )}
                />
              </div>
            </div>

            {/* Category Select */}
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">On category</label>
              <div className="grid grid-cols-3 gap-2">
                {budgetedCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.name)}
                    className={cn(
                      'p-3 rounded-xl border transition-all duration-200',
                      'flex flex-col items-center gap-1',
                      selectedCategory === category.name
                        ? 'bg-primary-500/20 border-primary-500/50 ring-2 ring-primary-500/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    )}
                  >
                    <span
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: category.color + '30' }}
                    >
                      {(() => {
                        const Icon = iconNameMap[category.icon];
                        return Icon ? <Icon className="w-5 h-5" style={{ color: category.color }} /> : <Wallet className="w-5 h-5" style={{ color: category.color }} />;
                      })()}
                    </span>
                    <span className="text-xs text-slate-300 font-medium truncate w-full text-center">
                      {category.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Frozen Category Warning */}
            <AnimatePresence>
              {isCategoryFrozen && (
                <motion.div
                  className="mb-6 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Pause className="w-5 h-5 text-blue-400 shrink-0" />
                  <p className="text-sm text-blue-200">
                    This category is currently paused as part of a recovery action.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Simulate Button */}
            <button
              onClick={handleSimulate}
              disabled={!selectedCategory || !amount || isSimulating}
              className={cn(
                'w-full py-4 rounded-xl font-semibold text-white',
                'bg-gradient-to-r from-indigo-500 to-purple-500',
                'hover:from-indigo-400 hover:to-purple-400',
                'shadow-lg shadow-indigo-500/25',
                'transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {isSimulating ? (
                <>
                  <motion.div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Simulate Impact</span>
                </>
              )}
            </button>
          </div>
        </motion.section>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {hasSimulated && whatIfData && (
            <motion.section
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Severity Banner */}
              {(() => {
                const severity = whatIfData.severity;
                const colors = severityColors[severity];
                const Icon = colors.icon;

                return (
                  <motion.div
                    className={cn(
                      'p-5 rounded-2xl border backdrop-blur-sm mb-6',
                      `bg-gradient-to-br ${colors.bg} ${colors.border}`
                    )}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn('p-3 rounded-xl', `${colors.bg}`)}>
                        <Icon className={cn('w-6 h-6', colors.text)} />
                      </div>
                      <div>
                        <h3 className={cn('font-semibold mb-1', colors.text)}>
                          {severity === 'low' && 'Safe to Spend'}
                          {severity === 'medium' && 'Proceed with Caution'}
                          {severity === 'high' && 'High Impact'}
                        </h3>
                        <p className="text-sm text-slate-300">
                          {whatIfData.recommendation}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Budget Impact */}
              <motion.div
                className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-slate-400" />
                  <h3 className="font-semibold text-white">Budget Impact</h3>
                </div>

                <div className="space-y-4">
                  {/* Before/After comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Current Usage</p>
                      <p className="text-xl font-bold text-white">
                        {whatIfData.budgetImpact.currentPercentUsed}%
                      </p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">After Spending</p>
                      <p className={cn(
                        'text-xl font-bold',
                        whatIfData.budgetImpact.projectedPercentUsed > 100
                          ? 'text-red-400'
                          : whatIfData.budgetImpact.projectedPercentUsed > 80
                          ? 'text-amber-400'
                          : 'text-green-400'
                      )}>
                        {whatIfData.budgetImpact.projectedPercentUsed}%
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Budget: {formatCurrency(whatIfData.budgetImpact.budgetAmount, 'NGN')}</span>
                      <span>Remaining: {formatCurrency(whatIfData.budgetImpact.remainingAfterSpend, 'NGN')}</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full transition-colors duration-300',
                          whatIfData.budgetImpact.projectedPercentUsed > 100
                            ? 'bg-gradient-to-r from-red-500 to-red-400'
                            : whatIfData.budgetImpact.projectedPercentUsed > 80
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                            : 'bg-gradient-to-r from-green-500 to-green-400'
                        )}
                        initial={{ width: `${whatIfData.budgetImpact.currentPercentUsed}%` }}
                        animate={{ width: `${Math.min(whatIfData.budgetImpact.projectedPercentUsed, 100)}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>

                  {/* Trigger Warning */}
                  {whatIfData.triggerPreview.wouldTrigger && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                      <p className="text-sm text-orange-300">
                        {whatIfData.triggerPreview.description}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Goal Impact */}
              {whatIfData.probabilityImpact ? (
                <motion.div
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm mb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-slate-400" />
                    <h3 className="font-semibold text-white">Goal Impact</h3>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-slate-400">{whatIfData.probabilityImpact.goalName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">
                        {Math.round(whatIfData.probabilityImpact.currentProbability * 100)}%
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                      <span className={cn(
                        'text-lg font-bold',
                        whatIfData.probabilityImpact.probabilityChange < 0
                          ? 'text-red-400'
                          : 'text-green-400'
                      )}>
                        {Math.round(whatIfData.probabilityImpact.projectedProbability * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Probability change indicator */}
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg',
                    whatIfData.probabilityImpact.probabilityChange < 0
                      ? 'bg-red-500/10'
                      : 'bg-green-500/10'
                  )}>
                    {whatIfData.probabilityImpact.probabilityChange < 0 ? (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    )}
                    <span className={cn(
                      'text-sm font-medium',
                      whatIfData.probabilityImpact.probabilityChange < 0
                        ? 'text-red-400'
                        : 'text-green-400'
                    )}>
                      {whatIfData.probabilityImpact.changePercentPoints > 0 ? '+' : ''}
                      {whatIfData.probabilityImpact.changePercentPoints} percentage points
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm mb-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-slate-400" />
                    <h3 className="font-semibold text-white">Budget-Only Mode</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    No active financial goals. The simulation shows budget impact only.
                  </p>
                </motion.div>
              )}

              {/* Recovery Preview (if would trigger) */}
              {whatIfData.triggerPreview.wouldTrigger && whatIfData.recoveryPreview && (
                <motion.div
                  className="p-5 rounded-2xl bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border border-primary-500/20 backdrop-blur-sm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="font-semibold text-white mb-3">
                    Recovery Options Available
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    If you proceed and exceed budget, these recovery paths will be available:
                  </p>

                  <div className="space-y-2">
                    {whatIfData.recoveryPreview.slice(0, 2).map((path) => (
                      <div
                        key={path.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-white text-sm">{path.name}</p>
                          <p className="text-xs text-slate-500">{path.effort} effort</p>
                        </div>
                        <span className="text-green-400 font-bold">
                          {path.newProbability !== null
                            ? `${Math.round(path.newProbability * 100)}%`
                            : path.budgetImpact || 'Budget recovery'}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Reset Button */}
              <motion.button
                onClick={() => {
                  setHasSimulated(false);
                  setAmount('');
                  setSelectedCategory('');
                }}
                className="w-full mt-6 py-3 rounded-xl font-medium text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                Try Another Amount
              </motion.button>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
