'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGps, useNotifications } from '@/hooks';
import { useBudgets } from '@/hooks/useFinance';

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
  } = useGps();
  const { unreadCount } = useNotifications();
  const { items: budgets, isLoading: budgetsLoading } = useBudgets();

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

        {/* Budget Alerts */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-caution-400" />
              Budget Alerts
            </h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-caution-500/20 text-caution-400 text-xs font-medium rounded-full">
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
                      severity === 'exceeded' && 'bg-caution-500/10 border-caution-500/30',
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
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                            style={{ backgroundColor: budget.category?.color + '30' }}
                          >
                            {budget.category?.icon}
                          </span>
                          <div>
                            <p className="font-semibold text-white">
                              {budget.category?.name ?? 'Unknown'}
                            </p>
                            <p className={cn(
                              'text-xs font-medium',
                              severity === 'critical' && 'text-red-400',
                              severity === 'exceeded' && 'text-caution-400',
                              severity === 'warning' && 'text-amber-400'
                            )}>
                              {severity === 'critical' && 'Critical - 120%+ spent'}
                              {severity === 'exceeded' && 'Budget exceeded'}
                              {severity === 'warning' && `${Math.round(percentUsed)}% of budget used`}
                            </p>
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
                              severity === 'exceeded' && 'bg-gradient-to-r from-caution-500 to-caution-400',
                              severity === 'warning' && 'bg-gradient-to-r from-amber-500 to-amber-400'
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(percentUsed, 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.2 * index }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleRecalculate(budget.category?.name ?? '')}
                        disabled={isProcessing}
                        className={cn(
                          'ml-4 px-4 py-2 rounded-lg font-medium text-sm',
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
                    </div>
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
               (activeAdjustments?.summary?.totalExtensionDays ?? 0) === 0 ? (
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
                    {achievement.icon}
                  </motion.div>
                ))}
                {(achievements?.totalEarned ?? 0) > 4 && (
                  <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-white">
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
          </div>
        </motion.section>
      </div>
    </div>
  );
}
