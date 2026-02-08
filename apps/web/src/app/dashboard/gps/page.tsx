'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Navigation,
  Flame,
  Trophy,
  AlertTriangle,
  ChevronRight,
  Zap,
  Pause,
  Clock,
  TrendingUp,
  Shield,
  Sparkles,
  RefreshCw,
  Gauge,
  Bell,
  BarChart3,
  Target,
  Calendar,
  DollarSign,
  Heart,
  Check,
  X,
  ChevronDown,
  PieChart,
  ArrowRightLeft,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGps, useNotifications } from '@/hooks';
import { useBudgets } from '@/hooks/useFinance';
import type { SpendingVelocityResponse, RebalanceOption, BudgetInsight, WeeklyBreakdownResponse, SpendingBreakdownResponse } from '@/hooks/useGps';
import { Modal } from '@/components/ui/Modal';

// ============================================
// GPS COMMAND CENTER
// ============================================

export default function GpsCommandCenter() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const {
    activeAdjustments,
    streaks,
    achievements,
    recalculate,
    isRecalculating,
    isLoadingAdjustments,
    isLoadingStreaks,
    isLoadingForecast,
    forecastData,
    getSpendingVelocity,
    checkCategoryFrozen,
    quickRebalance,
    isQuickRebalancing,
    getRebalanceOptions,
    budgetInsights,
    isLoadingBudgetInsights,
    applyBudgetInsight,
    isApplyingBudgetInsight,
    dailyLimits,
    isLoadingDailyLimits,
    getWeeklyBreakdown,
    getSpendingBreakdown,
  } = useGps();
  const { unreadCount } = useNotifications();
  const { items: budgets, isLoading: budgetsLoading } = useBudgets();

  // Speed Check: fetch velocity for each budget category
  const [velocityData, setVelocityData] = useState<SpendingVelocityResponse[]>([]);
  const [velocityLoading, setVelocityLoading] = useState(true);

  useEffect(() => {
    if (budgetsLoading || budgets.length === 0) {
      setVelocityLoading(false);
      return;
    }

    let cancelled = false;
    const fetchVelocity = async () => {
      setVelocityLoading(true);
      const results: SpendingVelocityResponse[] = [];
      for (const budget of budgets) {
        if (cancelled) return;
        try {
          const data = await getSpendingVelocity(budget.category?.id || budget.id);
          if (data?.velocity) results.push(data);
        } catch {
          // Skip categories without velocity data
        }
      }
      if (!cancelled) {
        setVelocityData(results);
        setVelocityLoading(false);
      }
    };

    fetchVelocity();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, budgetsLoading]);

  // Frozen category check for alert budgets
  const [frozenCategories, setFrozenCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (budgetsLoading || budgets.length === 0) return;

    let cancelled = false;
    const fetchFrozen = async () => {
      const results: Record<string, boolean> = {};
      for (const budget of budgets) {
        if (cancelled) return;
        try {
          const categoryId = budget.category?.id || budget.id;
          const data = await checkCategoryFrozen(categoryId);
          if (data?.isFrozen) results[categoryId] = true;
        } catch {
          // Skip on error
        }
      }
      if (!cancelled) setFrozenCategories(results);
    };

    fetchFrozen();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, budgetsLoading]);

  // Weekly breakdown: fetch for the first budget category (expandable)
  const [weeklyData, setWeeklyData] = useState<WeeklyBreakdownResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyCategory, setWeeklyCategory] = useState<string | null>(null);

  const fetchWeeklyBreakdown = async (categoryId: string) => {
    if (weeklyCategory === categoryId && weeklyData) {
      // Toggle off
      setWeeklyCategory(null);
      setWeeklyData(null);
      return;
    }
    setWeeklyCategory(categoryId);
    setWeeklyLoading(true);
    try {
      const data = await getWeeklyBreakdown(categoryId);
      setWeeklyData(data);
    } catch {
      setWeeklyData(null);
    }
    setWeeklyLoading(false);
  };

  // Quick Move modal state
  const [quickMoveTarget, setQuickMoveTarget] = useState<{
    categoryId: string;
    categoryName: string;
    overage: number;
    currency: string;
  } | null>(null);
  const [rebalanceOptions, setRebalanceOptions] = useState<RebalanceOption[]>([]);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<RebalanceOption | null>(null);
  const [moveAmount, setMoveAmount] = useState<string>('');
  const [quickMoveSuccess, setQuickMoveSuccess] = useState<string | null>(null);
  const [quickMoveError, setQuickMoveError] = useState<string | null>(null);

  const openQuickMove = async (categoryId: string, categoryName: string, overage: number, currency: string) => {
    setQuickMoveTarget({ categoryId, categoryName, overage, currency });
    setSelectedSource(null);
    setMoveAmount(overage > 0 ? String(Math.ceil(overage)) : '');
    setQuickMoveError(null);
    setRebalanceLoading(true);
    try {
      const data = await getRebalanceOptions(categoryId);
      setRebalanceOptions(data.options);
      if (!data.canRebalance) {
        setQuickMoveError(`Rebalance limit reached (${data.maxRebalances} per period)`);
      }
    } catch {
      setRebalanceOptions([]);
      setQuickMoveError('Could not load rebalance options');
    } finally {
      setRebalanceLoading(false);
    }
  };

  const handleQuickMove = async () => {
    if (!quickMoveTarget || !selectedSource || !moveAmount) return;
    const amt = parseFloat(moveAmount);
    if (isNaN(amt) || amt <= 0) return;
    setQuickMoveError(null);
    try {
      const result = await quickRebalance({
        fromCategoryId: selectedSource.categoryId,
        toCategoryId: quickMoveTarget.categoryId,
        amount: amt,
      });
      setQuickMoveSuccess(result.message);
      setTimeout(() => {
        setQuickMoveTarget(null);
        setQuickMoveSuccess(null);
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Move failed. Please try again.';
      setQuickMoveError(errorMessage);
    }
  };

  // Spending breakdown state
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);
  const [breakdownData, setBreakdownData] = useState<Record<string, SpendingBreakdownResponse>>({});
  const [breakdownLoading, setBreakdownLoading] = useState<string | null>(null);

  const loadBreakdown = async (categoryId: string) => {
    if (expandedBreakdown === categoryId) { setExpandedBreakdown(null); return; }
    setExpandedBreakdown(categoryId);
    if (breakdownData[categoryId]) return;
    setBreakdownLoading(categoryId);
    try { const data = await getSpendingBreakdown(categoryId); setBreakdownData((prev) => ({ ...prev, [categoryId]: data })); } catch { /* skip */ } finally { setBreakdownLoading(null); }
  };

  // Drifting categories: prefer forecast data (more reliable), fall back to velocity data
  const driftingCategories = forecastData?.forecasts && forecastData.forecasts.length > 0
    ? [] // Forecast section handles this — avoid duplicate display
    : velocityData.filter(
        (v) => v.velocity && v.velocity.ratio > 1.1,
      );

  // Determine if any categories are at risk (from either data source)
  const hasAtRiskCategories = (forecastData?.atRiskCount ?? 0) > 0 || driftingCategories.length > 0;

  // Find budgets that are over threshold
  const alertBudgets = budgets.filter((b) => {
    const percentUsed = b.percentUsed ?? 0;
    return percentUsed >= 80;
  });

  const handleRecalculate = async (category: string) => {
    setSelectedCategory(category);
    try {
      const result = await recalculate({ category });
      router.push(`/dashboard/gps/recovery/${result.sessionId}`);
    } catch (error) {
      console.error('Recalculate failed:', error);
      setSelectedCategory(null);
    }
  };

  // Budget Health Check state
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [applyingInsightId, setApplyingInsightId] = useState<string | null>(null);

  const visibleInsights = (budgetInsights?.insights ?? []).filter(
    (insight: BudgetInsight) => !dismissedInsights.has(insight.categoryId),
  );

  const handleApplyInsight = async (insight: BudgetInsight) => {
    setApplyingInsightId(insight.categoryId);
    try {
      await applyBudgetInsight({
        categoryId: insight.categoryId,
        suggestedBudget: insight.suggestedBudget,
        offsetCategoryId: insight.offsetSuggestion?.categoryId,
        offsetAmount: insight.offsetSuggestion?.suggestedReduction,
      });
    } catch (error) {
      console.error('Apply budget insight failed:', error);
    } finally {
      setApplyingInsightId(null);
    }
  };

  const handleDismissInsight = (categoryId: string) => {
    setDismissedInsights((prev) => new Set([...prev, categoryId]));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-secondary-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary-500/5 to-transparent rounded-full" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary-500/20 rounded-xl backdrop-blur-sm">
              <Navigation className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                GPS Re-Router
              </h1>
              <p className="text-sm text-slate-400">
                Your financial navigation system
              </p>
            </div>
          </div>
        </motion.header>

        {/* Streak Card */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-red-500/20 border border-amber-500/20 backdrop-blur-sm p-5">
            {/* Flame glow effect */}
            <div className="absolute -top-10 right-4 w-32 h-32 bg-gradient-to-b from-amber-500/30 to-transparent blur-2xl" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <motion.div
                    className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/30"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Flame className="w-7 h-7 text-white" />
                  </motion.div>
                  {streaks?.isFrozen && (
                    <div className="absolute -top-1 -right-1 p-0.5 bg-blue-500 rounded-full">
                      <Shield className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-amber-200/80 font-medium">Current Streak</p>
                  <div className="flex items-baseline gap-1">
                    {isLoadingStreaks ? (
                      <div className="h-9 w-16 bg-white/10 animate-pulse rounded" />
                    ) : (
                      <>
                        <span className="text-4xl font-black text-white tabular-nums">
                          {streaks?.currentStreak ?? 0}
                        </span>
                        <span className="text-lg text-amber-200/70">days</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Best streak</p>
                <p className="text-xl font-bold text-white/80">
                  {streaks?.longestStreak ?? 0} days
                </p>
              </div>
            </div>

            {streaks?.isFrozen && (
              <div className="mt-3 px-3 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <p className="text-xs text-blue-200">
                  Streak frozen until {new Date(streaks.frozenUntil!).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </motion.section>

        {/* Speed Check */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-amber-400" />
            Speed Check
          </h2>

          {velocityLoading && isLoadingForecast ? (
            <div className="h-20 bg-white/5 animate-pulse rounded-xl" />
          ) : !hasAtRiskCategories ? (
            <motion.div
              className="p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <div className="inline-flex p-2.5 bg-green-500/20 rounded-full mb-2">
                <Gauge className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-green-300 font-medium">All spending on pace!</p>
              <p className="text-sm text-slate-400 mt-1">
                Your spending velocity looks good across all categories.
              </p>
            </motion.div>
          ) : driftingCategories.length === 0 ? (
            <motion.div
              className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <div className="inline-flex p-2.5 bg-amber-500/20 rounded-full mb-2">
                <Gauge className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-amber-300 font-medium">{forecastData?.atRiskCount} categories over pace</p>
              <p className="text-sm text-slate-400 mt-1">
                Check the Spending Forecast below for details.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {driftingCategories.map((item, index) => {
                const v = item.velocity!;
                const isSignificant = v.ratio >= 1.3;

                return (
                  <motion.div
                    key={item.categoryId}
                    className={cn(
                      'relative overflow-hidden rounded-xl border backdrop-blur-sm p-4',
                      isSignificant
                        ? 'bg-gradient-to-br from-orange-500/15 to-amber-500/10 border-orange-500/30'
                        : 'bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/20'
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="font-semibold text-white">{item.category}</p>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-bold',
                              isSignificant
                                ? 'bg-orange-500/30 text-orange-300'
                                : 'bg-yellow-500/25 text-yellow-300'
                            )}
                          >
                            {v.ratio.toFixed(1)}x pace
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {item.timeline.projectedOverspendDate
                            ? `Over budget ~${new Date(item.timeline.projectedOverspendDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                            : 'Spending faster than planned'}
                          {' · '}
                          Aim for {v.courseCorrectionDaily.formatted}/day
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className={cn(
                          'text-lg font-bold',
                          isSignificant ? 'text-orange-400' : 'text-yellow-400'
                        )}>
                          {v.dailySpendingRate.formatted}
                        </p>
                        <p className="text-xs text-slate-500">/day spent</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Budget Health Check */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" />
            Budget Health Check
          </h2>

          {isLoadingBudgetInsights ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-32 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : visibleInsights.length === 0 ? (
            <motion.div
              className="p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <div className="inline-flex p-2.5 bg-green-500/20 rounded-full mb-2">
                <Heart className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-green-300 font-medium">
                Your budgets match your spending patterns &mdash; nice!
              </p>
              <p className="text-sm text-slate-400 mt-1">
                No unrealistic budgets detected.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {visibleInsights.map((insight, index) => {
                const isApplying = applyingInsightId === insight.categoryId;
                const maxSpent = Math.max(...insight.monthlyHistory.map((m) => m.spent), insight.budgeted);

                return (
                  <motion.div
                    key={insight.categoryId}
                    className="relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 backdrop-blur-sm p-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-white">{insight.category}</p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-pink-500/25 text-pink-300">
                            {insight.type === 'CURRENT_MONTH_EXCEEDED'
                              ? 'Over this month'
                              : `${insight.monthsExceeded}mo over`}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{insight.message}</p>
                      </div>
                      <button
                        onClick={() => handleDismissInsight(insight.categoryId)}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Mini bar chart - 3 months */}
                    <div className="flex items-end gap-1.5 h-16 mb-3">
                      {insight.monthlyHistory.map((month) => {
                        const height = maxSpent > 0 ? (month.spent / maxSpent) * 100 : 0;
                        const budgetHeight = maxSpent > 0 ? (insight.budgeted / maxSpent) * 100 : 0;
                        const isOver = month.spent > insight.budgeted;

                        return (
                          <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full relative" style={{ height: '48px' }}>
                              {/* Budget line */}
                              <div
                                className="absolute w-full border-t border-dashed border-slate-500/50"
                                style={{ bottom: budgetHeight + '%' }}
                              />
                              {/* Spending bar */}
                              <motion.div
                                className={isOver
                                  ? 'absolute bottom-0 w-full rounded-t bg-gradient-to-t from-pink-500 to-rose-400'
                                  : 'absolute bottom-0 w-full rounded-t bg-gradient-to-t from-slate-600 to-slate-500'
                                }
                                initial={{ height: 0 }}
                                animate={{ height: height + '%' }}
                                transition={{ duration: 0.6, delay: 0.1 * index }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-500">{month.month.slice(-2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Suggestion + Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="text-sm">
                        <span className="text-slate-400">Suggested: </span>
                        <span className="text-white font-semibold">
                          {formatCurrency(insight.suggestedBudget, 'USD')}
                        </span>
                        {insight.offsetSuggestion && (
                          <span className="text-slate-500 text-xs ml-1">
                            (offset from {insight.offsetSuggestion.categoryName})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleApplyInsight(insight)}
                        disabled={isApplying || isApplyingBudgetInsight}
                        className={
                          isApplying
                            ? 'px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500/20 text-pink-300 cursor-wait flex items-center gap-1.5'
                            : 'px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition-colors flex items-center gap-1.5'
                        }
                      >
                        {isApplying ? (
                          <>
                            <motion.div
                              className="w-3 h-3 border-2 border-pink-300/30 border-t-pink-300 rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            />
                            Adjusting...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Adjust Budget
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Spending Forecast */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-400" />
            Spending Forecast
          </h2>

          {isLoadingForecast ? (
            <div className="h-20 bg-white/5 animate-pulse rounded-xl" />
          ) : !forecastData?.forecasts?.some(
              (f) => f.riskLevel === 'caution' || f.riskLevel === 'warning'
            ) ? (
            <motion.div
              className="p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <div className="inline-flex p-2.5 bg-green-500/20 rounded-full mb-2">
                <Target className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-green-300 font-medium">
                All spending on pace &mdash; you&apos;re in good shape!
              </p>
              <p className="text-sm text-slate-400 mt-1">
                No categories are projected to exceed their budget.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {forecastData.forecasts
                .filter((f) => f.riskLevel === 'caution' || f.riskLevel === 'warning')
                .map((forecast, index) => {
                  const isWarning = forecast.riskLevel === 'warning';
                  const projectedPercent = forecast.budgeted > 0
                    ? (forecast.projectedTotal / forecast.budgeted) * 100
                    : 0;
                  const currentPercent = forecast.budgeted > 0
                    ? (forecast.spent / forecast.budgeted) * 100
                    : 0;

                  return (
                    <motion.div
                      key={forecast.categoryId}
                      className={cn(
                        'relative overflow-hidden rounded-xl border backdrop-blur-sm p-4',
                        isWarning
                          ? 'bg-gradient-to-br from-rose-500/15 to-orange-500/10 border-rose-500/30'
                          : 'bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border-amber-500/20'
                      )}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-white">{forecast.categoryName}</p>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-bold',
                                isWarning
                                  ? 'bg-rose-500/30 text-rose-300'
                                  : 'bg-amber-500/25 text-amber-300'
                              )}
                            >
                              {isWarning ? 'Over budget pace' : 'Caution'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            At this pace: {formatCurrency(forecast.projectedTotal, forecast.currency)} by month end
                            {' '}(budget: {formatCurrency(forecast.budgeted, forecast.currency)})
                          </p>
                          <p className="text-sm text-slate-300 mt-1">
                            Safe daily limit:{' '}
                            <span className={cn(
                              'font-semibold',
                              isWarning ? 'text-rose-300' : 'text-amber-300'
                            )}>
                              {formatCurrency(forecast.suggestedDailyLimit, forecast.currency)}/day
                            </span>
                          </p>
                        </div>
                        {forecast.daysUntilExceed !== null && forecast.daysUntilExceed > 0 && (
                          <div className="text-right ml-3">
                            <p className={cn(
                              'text-lg font-bold',
                              isWarning ? 'text-rose-400' : 'text-amber-400'
                            )}>
                              {forecast.daysUntilExceed}d
                            </p>
                            <p className="text-xs text-slate-500">until exceed</p>
                          </div>
                        )}
                      </div>

                      {/* Progress bar with projected extension */}
                      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                        {/* Current spending (solid) */}
                        <motion.div
                          className={cn(
                            'absolute h-full rounded-full',
                            isWarning
                              ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                              : 'bg-gradient-to-r from-amber-500 to-amber-400'
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(currentPercent, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.1 * index }}
                        />
                        {/* Projected spending (dashed/translucent extension) */}
                        <motion.div
                          className={cn(
                            'absolute h-full rounded-full opacity-40',
                            isWarning
                              ? 'bg-gradient-to-r from-rose-400 to-rose-300'
                              : 'bg-gradient-to-r from-amber-400 to-amber-300'
                          )}
                          style={{
                            left: `${Math.min(currentPercent, 100)}%`,
                            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 6px)',
                          }}
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(Math.max(projectedPercent - currentPercent, 0), 100 - Math.min(currentPercent, 100))}%`,
                          }}
                          transition={{ duration: 0.8, delay: 0.2 + 0.1 * index }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-slate-500">
                          {formatCurrency(forecast.spent, forecast.currency)} spent
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatCurrency(forecast.budgeted, forecast.currency)} budget
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          )}
        </motion.section>

        {/* Budget Alerts */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Budget Alerts
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="space-y-3">
            {budgetsLoading ? (
              [...Array(2)].map((_, i) => (
                <div key={i} className="h-24 bg-white/5 animate-pulse rounded-xl" />
              ))
            ) : alertBudgets.length === 0 ? (
              <motion.div
                className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
              >
                <div className="inline-flex p-3 bg-green-500/20 rounded-full mb-3">
                  <Sparkles className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-green-300 font-medium">All budgets on track!</p>
                <p className="text-sm text-slate-400 mt-1">
                  You&apos;re doing great. Keep it up!
                </p>
              </motion.div>
            ) : (
              alertBudgets.map((budget, index) => {
                const percentUsed = budget.percentUsed ?? 0;
                const severity = percentUsed >= 120 ? 'critical' : percentUsed >= 100 ? 'exceeded' : 'warning';
                const isProcessing = isRecalculating && selectedCategory === budget.category?.name;

                return (
                  <motion.div
                    key={budget.id}
                    className={cn(
                      'relative overflow-hidden rounded-xl border backdrop-blur-sm p-4',
                      severity === 'critical' && 'bg-red-500/10 border-red-500/30',
                      severity === 'exceeded' && 'bg-orange-500/10 border-orange-500/30',
                      severity === 'warning' && 'bg-amber-500/10 border-amber-500/30'
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-lg overflow-hidden"
                            style={{ backgroundColor: budget.category?.color + '30' }}
                          >
                            {budget.category?.icon}
                          </span>
                          <div>
                            <p className="font-semibold text-white">
                              {budget.category?.name ?? 'Unknown'}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <p className={cn(
                                'text-xs font-medium',
                                severity === 'critical' && 'text-red-400',
                                severity === 'exceeded' && 'text-orange-400',
                                severity === 'warning' && 'text-amber-400'
                              )}>
                                {severity === 'critical' && 'Critical - 120%+ spent'}
                                {severity === 'exceeded' && 'Budget exceeded'}
                                {severity === 'warning' && `${Math.round(percentUsed)}% of budget used`}
                              </p>
                              {frozenCategories[budget.category?.id || budget.id] && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Paused
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-400">
                            Spent: <span className="text-white font-medium">{formatCurrency(budget.spent ?? 0, budget.currency)}</span>
                          </span>
                          <span className="text-slate-500">/</span>
                          <span className="text-slate-400">
                            Budget: <span className="text-white font-medium">{formatCurrency(budget.amount, budget.currency)}</span>
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className={cn(
                              'h-full rounded-full',
                              severity === 'critical' && 'bg-gradient-to-r from-red-500 to-red-400',
                              severity === 'exceeded' && 'bg-gradient-to-r from-orange-500 to-orange-400',
                              severity === 'warning' && 'bg-gradient-to-r from-amber-500 to-amber-400'
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(percentUsed, 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.2 * index }}
                          />
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        <button
                          onClick={() => handleRecalculate(budget.category?.name ?? '')}
                          disabled={isProcessing}
                          className={cn(
                            'px-4 py-2 rounded-lg font-medium text-sm',
                            'transition-all duration-200',
                            'flex items-center gap-2',
                            isProcessing
                              ? 'bg-white/10 text-white/50 cursor-wait'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          )}
                        >
                          {isProcessing ? (
                            <>
                              <motion.div
                                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                              />
                              <span>Calculating...</span>
                            </>
                          ) : (
                            <>
                              <Navigation className="w-4 h-4" />
                              <span>Recalculate</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            const categoryId = budget.category?.id || budget.id;
                            const spent = budget.spent ?? 0;
                            const budgetAmt = budget.amount;
                            const overage = Math.max(0, spent - budgetAmt);
                            openQuickMove(categoryId, budget.category?.name ?? '', overage, budget.currency);
                          }}
                          className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 border border-white/20 hover:border-white/40 text-white/80 hover:text-white"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          <span>Quick Move</span>
                        </button>
                      </div>
                    </div>

                    {/* Spending Breakdown */}
                    <button
                      onClick={() => loadBreakdown(budget.category?.id || budget.id)}
                      className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs text-slate-400"
                    >
                      <span className="flex items-center gap-1.5">
                        <PieChart className="w-3.5 h-3.5" />
                        Where is it going?
                      </span>
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expandedBreakdown === (budget.category?.id || budget.id) && "rotate-180")} />
                    </button>

                    {expandedBreakdown === (budget.category?.id || budget.id) && (
                      <motion.div
                        className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        {breakdownLoading === (budget.category?.id || budget.id) ? (
                          <div className="h-16 bg-white/5 animate-pulse rounded-lg" />
                        ) : breakdownData[budget.category?.id || budget.id] ? (
                          <div className="space-y-2">
                            {breakdownData[budget.category?.id || budget.id].breakdown.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="h-1.5 rounded-full bg-white/10 flex-1">
                                    <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500" style={{ width: item.percent + "%" }} />
                                  </div>
                                  <span className="text-slate-300 truncate max-w-[120px]">{item.label}</span>
                                </div>
                                <span className="text-white font-medium ml-2 tabular-nums">{formatCurrency(item.amount, budget.currency)}</span>
                              </div>
                            ))}
                            {breakdownData[budget.category?.id || budget.id].insight && (
                              <p className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-white/5">{breakdownData[budget.category?.id || budget.id].insight}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 text-center">No breakdown data available</p>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.section>

        {/* Active Adjustments */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-secondary-400" />
            Active Recovery Actions
          </h2>

          {isLoadingAdjustments ? (
            <div className="h-24 bg-white/5 animate-pulse rounded-xl" />
          ) : !activeAdjustments?.summary?.hasActiveBoost &&
               (activeAdjustments?.summary?.activeFreezeCount ?? 0) === 0 &&
               (activeAdjustments?.summary?.totalExtensionDays ?? 0) === 0 &&
               (activeAdjustments?.budgetRebalances?.length ?? 0) === 0 ? (
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-slate-400">No active recovery actions</p>
              <p className="text-sm text-slate-500 mt-1">
                They&apos;ll appear here when you select a recovery path
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Savings Boost */}
              {activeAdjustments?.savingsBoost && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">Savings Boost Active</p>
                      <p className="text-sm text-slate-400">
                        +{activeAdjustments.savingsBoost.boostPercentage}% savings rate
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-400">
                        {activeAdjustments.savingsBoost.daysRemaining}d
                      </p>
                      <p className="text-xs text-slate-500">remaining</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Freezes */}
              {activeAdjustments?.categoryFreezes?.map((freeze) => (
                <div
                  key={freeze.id}
                  className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Pause className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">Category Paused</p>
                      <p className="text-sm text-slate-400">{freeze.categoryName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-400">
                        {freeze.daysRemaining}d
                      </p>
                      <p className="text-xs text-slate-500">remaining</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Timeline Extensions */}
              {activeAdjustments?.timelineExtensions?.map((ext) => (
                <div
                  key={ext.goalId}
                  className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Clock className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">Timeline Extended</p>
                      <p className="text-sm text-slate-400">{ext.goalName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-purple-400">
                        +{ext.extensionDays}d
                      </p>
                      <p className="text-xs text-slate-500">added</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Budget Rebalances */}
              {activeAdjustments?.budgetRebalances?.map((rebalance) => (
                <div
                  key={rebalance.id}
                  className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <RefreshCw className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">Smart Swap</p>
                      <p className="text-sm text-slate-400">
                        {rebalance.fromCategoryName} → {rebalance.toCategoryName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-400">
                        {rebalance.amount.formatted}
                      </p>
                      <p className="text-xs text-slate-500">moved</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Today's Limits */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Today&apos;s Limits
          </h2>

          {isLoadingDailyLimits ? (
            <div className="h-20 bg-white/5 animate-pulse rounded-xl" />
          ) : !dailyLimits || dailyLimits.length === 0 ? (
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-slate-400">No active budgets</p>
              <p className="text-sm text-slate-500 mt-1">
                Set up budgets to see daily spending limits
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              {dailyLimits.map((item) => (
                <div key={item.categoryId} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {item.categoryName}
                      </p>
                      {item.status === 'over' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 shrink-0">
                          Over
                        </span>
                      )}
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          item.status === 'over' && 'bg-red-500',
                          item.status === 'on_track' && 'bg-amber-500',
                          item.status === 'under' && 'bg-emerald-500'
                        )}
                        style={{
                          width: item.dailyLimit > 0
                            ? `${Math.min((item.spentToday / item.dailyLimit) * 100, 100)}%`
                            : '100%',
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className={cn(
                      'text-sm font-bold tabular-nums',
                      item.status === 'over' ? 'text-red-400' :
                      item.status === 'on_track' ? 'text-amber-400' : 'text-emerald-400'
                    )}>
                      {formatCurrency(item.dailyLimit, item.currency)}/day
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatCurrency(item.spentToday, item.currency)} spent today
                    </p>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] text-slate-500 text-center">
                  {dailyLimits[0]?.daysRemaining ?? 0} days remaining in budget period
                </p>
              </div>
            </div>
          )}
        </motion.section>

        {/* Weekly Budget Breakdown */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Weekly Breakdown
          </h2>

          {budgetsLoading ? (
            <div className="h-20 bg-white/5 animate-pulse rounded-xl" />
          ) : budgets.length === 0 ? (
            <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-slate-400">No budgets to break down</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Category selector buttons */}
              <div className="flex flex-wrap gap-2">
                {budgets.map((budget) => {
                  const catId = budget.category?.id || budget.id;
                  const isActive = weeklyCategory === catId;
                  return (
                    <button
                      key={catId}
                      onClick={() => fetchWeeklyBreakdown(catId)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20'
                      )}
                    >
                      {budget.category?.name ?? 'Unknown'}
                    </button>
                  );
                })}
              </div>

              {/* Weekly breakdown display */}
              {weeklyLoading && (
                <div className="h-32 bg-white/5 animate-pulse rounded-xl mt-2" />
              )}

              {weeklyData && !weeklyLoading && (
                <motion.div
                  className="mt-2 p-4 rounded-xl bg-white/5 border border-white/10"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Current week highlight */}
                  <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-cyan-200/70 font-medium">This Week</p>
                        <p className="text-sm text-white font-semibold mt-0.5">
                          Week {weeklyData.currentWeek.weekNumber}
                          {' · '}
                          {weeklyData.currentWeek.daysRemaining} days left
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-cyan-400 tabular-nums">
                          {formatCurrency(weeklyData.currentWeek.dailyLimit, weeklyData.currency)}
                        </p>
                        <p className="text-[10px] text-slate-500">/day limit</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Spent today: {formatCurrency(weeklyData.currentWeek.spentToday, weeklyData.currency)}
                    </p>
                  </div>

                  {/* Week-by-week mini progress bars */}
                  <div className="space-y-2">
                    {weeklyData.weeks.map((week) => {
                      const percent = week.allocated > 0
                        ? (week.spent / week.allocated) * 100
                        : 0;
                      const isCurrent = week.weekNumber === weeklyData.currentWeek.weekNumber;

                      return (
                        <div key={week.weekNumber} className="flex items-center gap-3">
                          <span className={cn(
                            'text-[10px] font-medium w-7 shrink-0',
                            isCurrent ? 'text-cyan-300' : 'text-slate-500'
                          )}>
                            W{week.weekNumber}
                          </span>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className={cn(
                                'h-full rounded-full',
                                week.status === 'over' && 'bg-red-500',
                                week.status === 'on_track' && 'bg-amber-500',
                                week.status === 'under' && 'bg-emerald-500'
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(percent, 100)}%` }}
                              transition={{ duration: 0.6 }}
                            />
                          </div>
                          <span className={cn(
                            'text-[10px] font-medium w-20 text-right shrink-0 tabular-nums',
                            week.status === 'over' ? 'text-red-400' :
                            week.status === 'on_track' ? 'text-amber-400' : 'text-slate-400'
                          )}>
                            {formatCurrency(week.spent, weeklyData.currency)}
                            {' / '}
                            {formatCurrency(week.allocated, weeklyData.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Adjusted budget info */}
                  {weeklyData.adjustedWeeklyBudget > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-xs text-slate-400">
                        Remaining weeks:{' '}
                        <span className="text-white font-medium">
                          {formatCurrency(weeklyData.adjustedWeeklyBudget, weeklyData.currency)}/week
                        </span>
                        {' '}to stay on track
                      </p>
                    </div>
                  )}

                  {/* Monthly summary */}
                  <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                    <span>Total spent: {formatCurrency(weeklyData.totalSpent, weeklyData.currency)}</span>
                    <span>Budget: {formatCurrency(weeklyData.monthlyBudget, weeklyData.currency)}</span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.section>

        {/* Achievements Preview */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Achievements
            </h2>
            <button
              onClick={() => router.push('/dashboard/gps/achievements')}
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">
                  {achievements?.totalEarned ?? 0}
                </p>
                <p className="text-sm text-slate-400">earned</p>
              </div>
              <div className="flex -space-x-2">
                {achievements?.earned?.slice(0, 4).map((achievement, i) => (
                  <motion.div
                    key={achievement.id}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-slate-800 flex items-center justify-center text-lg"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1 * i, type: 'spring' }}
                  >
                    {{ footprints: '👣', trophy: '🏆', medal: '🏅', snowflake: '❄️', rocket: '🚀', flag: '🚩' }[achievement.icon] ?? '⭐'}
                  </motion.div>
                ))}
                {(achievements?.totalEarned ?? 0) > 4 && (
                  <div key="overflow" className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-white">
                    +{(achievements?.totalEarned ?? 0) - 4}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/dashboard/gps/what-if')}
              className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-left hover:border-indigo-500/40 transition-colors"
            >
              <Sparkles className="w-6 h-6 text-indigo-400 mb-2" />
              <p className="font-medium text-white">What-If</p>
              <p className="text-xs text-slate-400 mt-0.5">Preview before spending</p>
            </button>

            <button
              onClick={() => router.push('/dashboard/finance/budgets')}
              className="p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border border-primary-500/20 text-left hover:border-primary-500/40 transition-colors"
            >
              <Navigation className="w-6 h-6 text-primary-400 mb-2" />
              <p className="font-medium text-white">Budgets</p>
              <p className="text-xs text-slate-400 mt-0.5">Manage your limits</p>
            </button>

            <button
              onClick={() => router.push('/dashboard/gps/notifications')}
              className="p-4 rounded-xl bg-gradient-to-br from-rose-500/10 to-orange-500/10 border border-rose-500/20 text-left hover:border-rose-500/40 transition-colors"
            >
              <div className="relative inline-block mb-2">
                <Bell className="w-6 h-6 text-rose-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <p className="font-medium text-white">Notifications</p>
              <p className="text-xs text-slate-400 mt-0.5">Alerts &amp; updates</p>
            </button>

            <button
              onClick={() => router.push('/dashboard/gps/analytics')}
              className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20 text-left hover:border-violet-500/40 transition-colors"
            >
              <BarChart3 className="w-6 h-6 text-violet-400 mb-2" />
              <p className="font-medium text-white">Analytics</p>
              <p className="text-xs text-slate-400 mt-0.5">Recovery insights</p>
            </button>
          </div>
        </motion.section>

        {/* Quick Move Modal */}
        <Modal
          isOpen={quickMoveTarget !== null}
          onClose={() => { setQuickMoveTarget(null); setQuickMoveSuccess(null); setQuickMoveError(null); }}
          title={quickMoveSuccess ? undefined : `Move budget to ${quickMoveTarget?.categoryName ?? ''}`}
          size="md"
        >
          {quickMoveSuccess ? (
            <motion.div
              className="flex flex-col items-center py-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-lg font-semibold text-white text-center">{quickMoveSuccess}</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {quickMoveError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                  {quickMoveError}
                </div>
              )}

              {/* Source category selection */}
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">Move from:</p>
                {rebalanceLoading ? (
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : rebalanceOptions.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                    <p className="text-slate-400 text-sm">No categories with surplus available</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rebalanceOptions.map((opt) => (
                      <button
                        key={opt.categoryId}
                        onClick={() => {
                          setSelectedSource(opt);
                          const currentAmt = parseFloat(moveAmount) || 0;
                          if (currentAmt > opt.proratedSurplus) {
                            setMoveAmount(String(Math.floor(opt.proratedSurplus)));
                          }
                        }}
                        className={cn(
                          'w-full p-3 rounded-xl border text-left transition-all',
                          selectedSource?.categoryId === opt.categoryId
                            ? 'bg-primary-500/10 border-primary-500/40'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white text-sm">{opt.categoryName}</p>
                            <p className="text-xs text-slate-400">
                              {formatCurrency(opt.spent, opt.currency)} of {formatCurrency(opt.budgeted, opt.currency)} spent
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-400">
                              {formatCurrency(opt.proratedSurplus, opt.currency)}
                            </p>
                            <p className="text-[10px] text-slate-500">available</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Amount input */}
              {selectedSource && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-sm font-medium text-slate-300 mb-2">Amount:</p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={moveAmount}
                        onChange={(e) => setMoveAmount(e.target.value)}
                        min={0.01}
                        max={selectedSource.proratedSurplus}
                        step="0.01"
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      onClick={() => setMoveAmount(String(Math.floor(selectedSource.proratedSurplus)))}
                      className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap"
                    >
                      Max
                    </button>
                  </div>
                  {parseFloat(moveAmount) > selectedSource.proratedSurplus && (
                    <p className="text-xs text-red-400 mt-1">
                      Exceeds available surplus of {formatCurrency(selectedSource.proratedSurplus, selectedSource.currency)}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Confirm button */}
              {selectedSource && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="pt-2"
                >
                  <button
                    onClick={handleQuickMove}
                    disabled={
                      isQuickRebalancing ||
                      !moveAmount ||
                      parseFloat(moveAmount) <= 0 ||
                      parseFloat(moveAmount) > selectedSource.proratedSurplus
                    }
                    className={cn(
                      'w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200',
                      'flex items-center justify-center gap-2',
                      isQuickRebalancing || !moveAmount || parseFloat(moveAmount) <= 0 || parseFloat(moveAmount) > selectedSource.proratedSurplus
                        ? 'bg-primary-500/30 text-white/50 cursor-not-allowed'
                        : 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                    )}
                  >
                    {isQuickRebalancing ? (
                      <>
                        <motion.div
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        />
                        Moving...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-4 h-4" />
                        Move {moveAmount && parseFloat(moveAmount) > 0
                          ? formatCurrency(parseFloat(moveAmount), quickMoveTarget?.currency || 'USD')
                          : 'budget'}
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
