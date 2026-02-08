'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  User,
  Layers,
  Clock,
  TrendingUp,
  Sparkles,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGps } from '@/hooks/useGps';
import type {
  AnalyticsDashboard,
  UserAnalytics,
  CategoryAnalytics,
} from '@/hooks/useGps';

// ============================================
// PERIOD OPTIONS
// ============================================

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

// ============================================
// ANALYTICS PAGE
// ============================================

export default function AnalyticsPage() {
  const router = useRouter();
  const { getAnalyticsDashboard, getUserAnalytics, getCategoryAnalytics } = useGps();

  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [userStats, setUserStats] = useState<UserAnalytics | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryAnalytics[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [dash, user, cats] = await Promise.all([
          getAnalyticsDashboard(days),
          getUserAnalytics(days),
          getCategoryAnalytics(days),
        ]);
        if (!cancelled) {
          setDashboard(dash);
          setUserStats(user);
          setCategoryStats(cats);
        }
      } catch {
        // Endpoints may 404 if no data yet — handled by empty states
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const hasData = userStats && userStats.totalSlips > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Back button */}
        <motion.button
          onClick={() => router.push('/dashboard/gps')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        {/* Header */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-violet-500/20 rounded-xl backdrop-blur-sm">
              <BarChart3 className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Recovery Analytics
              </h1>
              <p className="text-sm text-slate-400">
                How you bounce back from budget slips
              </p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  days === p.days
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                )}
              >
                {p.label}
              </button>
            ))}
            {loading && (
              <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin ml-1" />
            )}
          </div>
          {/* Date range label */}
          {dashboard && !loading && (
            <p className="text-xs text-slate-500 mt-2">
              {new Date(dashboard.period.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' — '}
              {new Date(dashboard.period.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </motion.header>

        {/* Loading */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-white/5 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : !hasData ? (
          /* Empty State */
          <motion.div
            className="p-8 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center mt-12"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="inline-flex p-4 bg-green-500/20 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-green-300 font-medium text-lg">No budget slips yet!</p>
            <p className="text-sm text-slate-400 mt-2">
              You&apos;re doing great. Analytics will appear here after recovery events.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Section A — Your Stats */}
            {userStats && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-violet-400" />
                  Your Stats
                </h2>

                {/* 2x2 Stat Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-500 mb-1">Total Slips</p>
                    <p className="text-2xl font-bold text-white tabular-nums">
                      {userStats.totalSlips}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-500 mb-1">Recovery Rate</p>
                    <p className={cn(
                      'text-2xl font-bold tabular-nums',
                      userStats.recoveryRate >= 0.8
                        ? 'text-green-400'
                        : userStats.recoveryRate >= 0.5
                        ? 'text-amber-400'
                        : 'text-red-400'
                    )}>
                      {userStats.recoveryRateFormatted}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-500 mb-1">Preferred Path</p>
                    <p className="text-sm font-semibold text-white truncate">
                      {userStats.preferredPath?.name ?? 'None yet'}
                    </p>
                    {userStats.preferredPath && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Used {userStats.preferredPath.usageCount}x
                      </p>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-slate-500 mb-1">Avg Recovery</p>
                    <p className="text-sm font-semibold text-white">
                      {userStats.averageTimeToRecovery.formatted}
                    </p>
                  </div>
                </div>

                {/* Probability Restored Bar */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-400">Probability Restored</p>
                    <p className="text-sm font-bold text-violet-300">
                      +{(userStats.totalProbabilityRestored * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(userStats.totalProbabilityRestored * 100, 100)}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              </motion.section>
            )}

            {/* Section B — Recovery Patterns */}
            {dashboard && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Recovery Patterns
                </h2>

                {/* Path Distribution */}
                {dashboard.pathSelection.length > 0 && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-3">
                    <p className="text-sm text-slate-400 mb-3">Path Distribution</p>
                    <div className="space-y-3">
                      {dashboard.pathSelection.map((path) => (
                        <div key={path.pathId}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-300">{path.pathName}</span>
                            <span className="text-white font-medium tabular-nums">
                              {path.percentage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${path.percentage}%` }}
                              transition={{ duration: 0.6 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Goal Survival Ring */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-3">
                  <p className="text-sm text-slate-400 mb-3">Goal Survival</p>
                  <div className="flex items-center gap-6">
                    {/* Conic gradient ring */}
                    <div className="relative w-24 h-24 shrink-0">
                      <div
                        className="w-full h-full rounded-full"
                        style={{
                          background: `conic-gradient(
                            #22c55e ${dashboard.goalSurvival.recovered / Math.max(dashboard.goalSurvival.totalSlips, 1) * 360}deg,
                            #f59e0b ${dashboard.goalSurvival.recovered / Math.max(dashboard.goalSurvival.totalSlips, 1) * 360}deg ${(dashboard.goalSurvival.recovered + dashboard.goalSurvival.pending) / Math.max(dashboard.goalSurvival.totalSlips, 1) * 360}deg,
                            #ef4444 ${(dashboard.goalSurvival.recovered + dashboard.goalSurvival.pending) / Math.max(dashboard.goalSurvival.totalSlips, 1) * 360}deg
                          )`,
                        }}
                      />
                      <div className="absolute inset-2 bg-slate-900 rounded-full flex items-center justify-center">
                        <span className="text-xl font-bold text-white">
                          {dashboard.goalSurvival.survivalRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-slate-400">Recovered</span>
                        <span className="text-white font-medium ml-auto">{dashboard.goalSurvival.recovered}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-slate-400">Pending</span>
                        <span className="text-white font-medium ml-auto">{dashboard.goalSurvival.pending}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-slate-400">Abandoned</span>
                        <span className="text-white font-medium ml-auto">{dashboard.goalSurvival.abandoned}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Speed Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <p className="text-xs text-slate-500">Avg Recovery</p>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {dashboard.timeToRecovery.averageHours.toFixed(1)}h
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <p className="text-xs text-slate-500">Median Recovery</p>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {dashboard.timeToRecovery.medianHours.toFixed(1)}h
                    </p>
                  </div>
                </div>

                {/* Time Distribution */}
                <div className="mt-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-sm text-slate-400 mb-3">Recovery Speed Breakdown</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: '<1h', value: dashboard.timeToRecovery.distribution.under1Hour },
                      { label: '1-6h', value: dashboard.timeToRecovery.distribution.hours1to6 },
                      { label: '6-24h', value: dashboard.timeToRecovery.distribution.hours6to24 },
                      { label: '24h+', value: dashboard.timeToRecovery.distribution.over24Hours },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-lg font-bold text-white tabular-nums">{item.value}</p>
                        <p className="text-xs text-slate-500">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Section C — Category Breakdown */}
            {categoryStats.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  Category Breakdown
                </h2>

                <div className="space-y-3">
                  {[...categoryStats]
                    .sort((a, b) => b.totalSlips - a.totalSlips)
                    .map((cat, index) => (
                      <motion.div
                        key={cat.categoryId}
                        className="p-4 rounded-xl bg-white/5 border border-white/10"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-white">{cat.category}</p>
                            <p className="text-xs text-slate-500">
                              {cat.totalSlips} slip{cat.totalSlips !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-bold',
                            cat.recoveryRate >= 0.8
                              ? 'bg-green-500/20 text-green-300'
                              : cat.recoveryRate >= 0.5
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-red-500/20 text-red-300'
                          )}>
                            {cat.recoveryRateFormatted}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">Go-To Path</p>
                            <p className="text-slate-300 font-medium truncate">
                              {cat.mostSelectedPath?.name ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Avg Over</p>
                            <p className="text-slate-300 font-medium">
                              {cat.averageOverspendPercent.toFixed(0)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Total Over</p>
                            <p className="text-slate-300 font-medium">
                              {cat.totalOverspendAmount.formatted}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </motion.section>
            )}

            {/* Summary Footer */}
            {dashboard && (
              <motion.div
                className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <p className="text-sm text-violet-300 font-medium">
                    {dashboard.totalSessions} recovery session{dashboard.totalSessions !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {dashboard.totalBudgetThresholdsCrossed} budget threshold{dashboard.totalBudgetThresholdsCrossed !== 1 ? 's' : ''} crossed in this period
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
