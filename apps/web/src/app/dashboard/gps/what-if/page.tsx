'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical,
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Pause,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { useGps } from '@/hooks/useGps';
import { useCategories, useBudgets } from '@/hooks/useFinance';
import { useCurrency } from '@/hooks';

// ============================================
// SCENARIO PLANNING (What-If Simulator)
// ============================================

export default function WhatIfSimulator() {
  const { currency, symbol: currencySymbol } = useCurrency();
  const router = useRouter();
  const { categories } = useCategories();
  const { items: budgets } = useBudgets();
  const { simulateWhatIf, isSimulating, whatIfData, checkCategoryFrozen } = useGps();

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [hasSimulated, setHasSimulated] = useState(false);
  const [isCategoryFrozen, setIsCategoryFrozen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

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

  // Click-outside handler for category popover
  useEffect(() => {
    if (!categoryOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-category-popover]')) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [categoryOpen]);

  const handleSimulate = async () => {
    if (!selectedCategory || !amount) return;

    await simulateWhatIf({
      category: selectedCategory,
      additionalSpend: parseFloat(amount),
    });
    setHasSimulated(true);
  };

  const severityConfig = {
    low: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: CheckCircle,
      label: 'Within Budget',
      bar: 'bg-emerald-600',
    },
    medium: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: AlertTriangle,
      label: 'Proceed with Caution',
      bar: 'bg-amber-500',
    },
    high: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-[#C2410C]',
      icon: AlertTriangle,
      label: 'Significant Impact',
      bar: 'bg-[#C2410C]',
    },
  };

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-12 py-8 md:py-12 space-y-8">
      {/* Back button */}
      <motion.button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-stone-400 hover:text-stone-600 transition-colors"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        <span className="text-sm">Back</span>
      </motion.button>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <FlaskConical className="w-6 h-6 text-stone-400" strokeWidth={1.5} />
          <h1 className="text-3xl md:text-4xl font-serif text-[#1A2E22]">
            Scenario Planning
          </h1>
        </div>
        <p className="text-sm text-stone-400">
          Test spending decisions before they affect your real timeline.
        </p>
      </motion.header>

      {/* Natural Language Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
      >
        <Card variant="paper" padding="lg">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-4">
            <span className="text-2xl md:text-3xl font-serif text-stone-400">
              If I spend
            </span>

            {/* Amount input */}
            <span className="inline-flex items-baseline">
              <span className="text-3xl md:text-5xl font-mono text-stone-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={cn(
                  'bg-transparent border-b-2 border-stone-300 focus:border-[#064E3B]',
                  'text-3xl md:text-5xl font-mono text-[#1A2E22] placeholder-stone-300',
                  'focus:outline-none transition-colors duration-200',
                  'w-[5ch] min-w-[3ch]'
                )}
              />
            </span>

            <span className="text-2xl md:text-3xl font-serif text-stone-400">
              on
            </span>

            {/* Category trigger */}
            <div className="relative" data-category-popover>
              <button
                onClick={() => setCategoryOpen(!categoryOpen)}
                className={cn(
                  'inline-flex items-baseline gap-2',
                  'text-2xl md:text-3xl font-serif italic border-b-2 transition-colors duration-200',
                  selectedCategory
                    ? 'text-emerald-800 border-emerald-800/40'
                    : 'text-stone-400 border-stone-300'
                )}
              >
                {selectedCategory || 'category'}
                <ChevronDown className={cn(
                  'w-4 h-4 transition-transform duration-200 self-center',
                  categoryOpen && 'rotate-180'
                )} />
              </button>

              {/* Category Popover */}
              <AnimatePresence>
                {categoryOpen && (
                  <motion.div
                    className="absolute top-full left-0 mt-2 z-50 bg-white shadow-xl border border-stone-100 rounded-lg py-1 min-w-[220px] max-h-[280px] overflow-y-auto"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    {budgetedCategories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => {
                          setSelectedCategory(category.name);
                          setCategoryOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                          selectedCategory === category.name
                            ? 'bg-emerald-50 font-medium text-[#1A2E22]'
                            : 'text-stone-600 hover:bg-emerald-50'
                        )}
                      >
                        <CategoryIcon
                          name={category.icon}
                          className="w-4 h-4 text-stone-400 shrink-0"
                        />
                        {category.name}
                      </button>
                    ))}
                    {budgetedCategories.length === 0 && (
                      <p className="px-4 py-3 text-sm text-stone-400">
                        No budgeted categories found.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Frozen Category Warning */}
          <AnimatePresence>
            {isCategoryFrozen && (
              <motion.div
                className="mt-6 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Pause className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-800">
                  This category is currently paused as part of a recovery action.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Simulate Button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleSimulate}
              disabled={!selectedCategory || !amount || isSimulating}
              className={cn(
                'px-8 py-3 rounded-full font-medium text-white',
                'bg-[#064E3B] hover:bg-[#053F30]',
                'transition-all duration-200',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'inline-flex items-center gap-2'
              )}
            >
              {isSimulating ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  />
                  <span>Calculating…</span>
                </>
              ) : (
                <span>Calculate Ripple Effect</span>
              )}
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence mode="wait">
        {hasSimulated && whatIfData && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="mt-10"
          >
            <Card variant="paper" padding="lg" className="space-y-8">
              {/* Severity Banner */}
              {(() => {
                const severity = whatIfData.severity;
                const config = severityConfig[severity];
                const Icon = config.icon;

                return (
                  <motion.div
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 rounded-lg border',
                      config.bg, config.border
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', config.text)} />
                    <div>
                      <p className={cn('font-medium text-sm', config.text)}>
                        {config.label}
                      </p>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {whatIfData.recommendation}
                      </p>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Budget Impact */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
              >
                <h3 className="font-serif text-lg text-[#1A2E22] mb-4">
                  Budget Impact
                </h3>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-4 bg-stone-50 rounded-lg">
                    <p className="text-xs text-stone-400 mb-1 uppercase tracking-wide">Before</p>
                    <p className="text-2xl font-serif text-[#1A2E22]">
                      {whatIfData.budgetImpact.currentPercentUsed}%
                    </p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-lg">
                    <p className="text-xs text-stone-400 mb-1 uppercase tracking-wide">After</p>
                    <p className={cn(
                      'text-2xl font-serif',
                      whatIfData.budgetImpact.projectedPercentUsed > 100
                        ? 'text-[#C2410C]'
                        : whatIfData.budgetImpact.projectedPercentUsed > 80
                        ? 'text-amber-700'
                        : 'text-emerald-800'
                    )}>
                      {whatIfData.budgetImpact.projectedPercentUsed}%
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-400 mb-2 font-mono">
                    <span>Budget: {formatCurrency(whatIfData.budgetImpact.budgetAmount, currency)}</span>
                    <span>Remaining: {formatCurrency(whatIfData.budgetImpact.remainingAfterSpend, currency)}</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full rounded-full',
                        whatIfData.budgetImpact.projectedPercentUsed > 100
                          ? 'bg-[#C2410C]'
                          : whatIfData.budgetImpact.projectedPercentUsed > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      )}
                      initial={{ width: `${whatIfData.budgetImpact.currentPercentUsed}%` }}
                      animate={{ width: `${Math.min(whatIfData.budgetImpact.projectedPercentUsed, 100)}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>

                {/* Trigger Warning */}
                {whatIfData.triggerPreview.wouldTrigger && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      {whatIfData.triggerPreview.description}
                    </p>
                  </div>
                )}
              </motion.div>

              {/* Goal Impact */}
              <motion.div
                className="border-t border-stone-100 pt-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
              >
                {whatIfData.probabilityImpact ? (
                  <>
                    <h3 className="font-serif text-lg text-[#1A2E22] mb-4">
                      Goal Impact
                    </h3>

                    <p className="text-sm text-stone-400 mb-3">
                      {whatIfData.probabilityImpact.goalName}
                    </p>

                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="text-3xl font-serif text-[#1A2E22]">
                        {Math.round(whatIfData.probabilityImpact.currentProbability * 100)}%
                      </span>
                      <span className="text-stone-300 text-lg">→</span>
                      <span className={cn(
                        'text-3xl font-serif',
                        whatIfData.probabilityImpact.probabilityChange < 0
                          ? 'text-[#C2410C]'
                          : 'text-emerald-800'
                      )}>
                        {Math.round(whatIfData.probabilityImpact.projectedProbability * 100)}%
                      </span>
                    </div>

                    {/* Change indicator */}
                    <div className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-sm',
                      whatIfData.probabilityImpact.probabilityChange < 0
                        ? 'bg-orange-50 text-[#C2410C]'
                        : 'bg-emerald-50 text-emerald-800'
                    )}>
                      {whatIfData.probabilityImpact.probabilityChange < 0 ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5" />
                      )}
                      {whatIfData.probabilityImpact.changePercentPoints > 0 ? '+' : ''}
                      {whatIfData.probabilityImpact.changePercentPoints} percentage points
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-serif text-lg text-[#1A2E22] mb-2">
                      Budget-Only Mode
                    </h3>
                    <p className="text-sm text-stone-400">
                      No active financial goals. The simulation shows budget impact only.
                    </p>
                  </>
                )}
              </motion.div>

              {/* Recovery Preview */}
              {whatIfData.triggerPreview.wouldTrigger && whatIfData.recoveryPreview && (
                <motion.div
                  className="border-t border-stone-100 pt-8"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: 0.15 }}
                >
                  <h3 className="font-serif text-lg text-[#1A2E22] mb-2">
                    Recovery Options
                  </h3>
                  <p className="text-sm text-stone-400 mb-4">
                    If you proceed and exceed budget, these recovery paths will be available:
                  </p>

                  <div className="space-y-2">
                    {whatIfData.recoveryPreview.slice(0, 2).map((path) => (
                      <div
                        key={path.id}
                        className="flex items-center justify-between p-3 border border-stone-100 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm text-[#1A2E22]">{path.name}</p>
                          <p className="text-xs text-stone-400 capitalize">{path.effort} effort</p>
                        </div>
                        <span className="font-mono text-sm text-emerald-800">
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
              <div className="pt-4 text-center">
                <button
                  onClick={() => {
                    setHasSimulated(false);
                    setAmount('');
                    setSelectedCategory('');
                  }}
                  className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Reset and try another scenario
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
