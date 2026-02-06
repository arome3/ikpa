'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation,
  Clock,
  TrendingUp,
  Pause,
  ArrowLeft,
  CheckCircle2,
  Target,
  Zap,
  Sparkles,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGps, RecoveryPath, GoalImpact, BudgetStatus, NonJudgmentalMessage } from '@/hooks/useGps';

// ============================================
// RECOVERY PATH SELECTION PAGE
// ============================================

interface RecoveryData {
  sessionId: string;
  budgetStatus: BudgetStatus;
  goalImpact: GoalImpact;
  recoveryPaths: RecoveryPath[];
  message: NonJudgmentalMessage;
}

const effortColors = {
  Low: {
    bg: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/30',
    text: 'text-green-400',
    badge: 'bg-green-500/20 text-green-300',
  },
  Medium: {
    bg: 'from-amber-500/20 to-orange-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
  },
  High: {
    bg: 'from-red-500/20 to-rose-500/20',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300',
  },
};

const pathIcons = {
  time_adjustment: Clock,
  rate_adjustment: TrendingUp,
  freeze_protocol: Pause,
};

export default function RecoverySessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { getRecoveryPaths, selectPath, isSelectingPath, recalculateData } = useGps();

  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{
    message: string;
    nextSteps: string[];
  } | null>(null);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  // Load recovery data
  useEffect(() => {
    const loadData = async () => {
      // If we have data from recalculate, use it
      if (recalculateData && recalculateData.sessionId === sessionId) {
        setRecoveryData({
          sessionId: recalculateData.sessionId,
          budgetStatus: recalculateData.budgetStatus,
          goalImpact: recalculateData.goalImpact,
          recoveryPaths: recalculateData.recoveryPaths,
          message: recalculateData.message,
        });
        setIsLoading(false);
        return;
      }

      // Otherwise fetch from API
      try {
        const result = await getRecoveryPaths(sessionId);
        // We need to make another call to get full session data
        // For now, construct with what we have
        setRecoveryData({
          sessionId: result.sessionId,
          budgetStatus: {
            category: result.category,
            categoryId: '',
            budgeted: { amount: 0, formatted: '', currency: 'NGN' },
            spent: { amount: 0, formatted: '', currency: 'NGN' },
            remaining: { amount: 0, formatted: '', currency: 'NGN' },
            overagePercent: 0,
            trigger: 'BUDGET_EXCEEDED',
            period: 'MONTHLY',
          },
          goalImpact: {
            goalId: '',
            goalName: 'Your Goal',
            goalAmount: { amount: 0, formatted: '', currency: 'NGN' },
            goalDeadline: '',
            previousProbability: 0.75,
            newProbability: 0.68,
            probabilityDrop: -0.07,
            message: '',
          },
          recoveryPaths: result.paths,
          message: {
            tone: 'Supportive',
            headline: "Let's recalculate your route",
            subtext: 'Every journey has detours. What matters is getting back on track.',
          },
        });
      } catch (error) {
        console.error('Failed to load recovery data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [sessionId, recalculateData, getRecoveryPaths]);

  const handleSelectPath = async (pathId: string) => {
    setSelectedPathId(pathId);
    try {
      const result = await selectPath({ pathId, sessionId });
      setSuccessData({
        message: result.message,
        nextSteps: result.nextSteps,
      });
      setShowSuccess(true);
    } catch (error) {
      console.error('Failed to select path:', error);
      setSelectedPathId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          />
          <p className="text-slate-400">Loading recovery options...</p>
        </motion.div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
          <motion.div
            className="flex flex-col items-center justify-center min-h-[80vh] text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Success animation */}
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full" />
              <div className="relative p-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full">
                <CheckCircle2 className="w-16 h-16 text-white" />
              </div>
            </motion.div>

            <motion.h1
              className="text-2xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Route Recalculated!
            </motion.h1>

            <motion.p
              className="text-slate-400 mb-8 max-w-xs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {successData?.message}
            </motion.p>

            {/* Next Steps */}
            {successData?.nextSteps && successData.nextSteps.length > 0 && (
              <motion.div
                className="w-full max-w-sm mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h3 className="text-sm font-medium text-slate-300 mb-3 text-left">
                  Next Steps
                </h3>
                <div className="space-y-2">
                  {successData.nextSteps.map((step, index) => (
                    <motion.div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-white/5 rounded-lg text-left"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                    >
                      <div className="w-6 h-6 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary-400">{index + 1}</span>
                      </div>
                      <p className="text-sm text-slate-300">{step}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.button
              onClick={() => router.push('/dashboard/gps')}
              className="px-8 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-shadow"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Back to GPS
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-secondary-500/10 rounded-full blur-3xl" />
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

        {/* Header Message */}
        <motion.header
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex p-4 bg-primary-500/10 rounded-2xl mb-4">
            <Navigation className="w-10 h-10 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {recoveryData?.message.headline}
          </h1>
          <p className="text-slate-400 max-w-xs mx-auto">
            {recoveryData?.message.subtext}
          </p>
        </motion.header>

        {/* Impact Summary */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="p-5 rounded-2xl bg-gradient-to-br from-red-500/10 via-orange-500/10 to-amber-500/10 border border-red-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white">Budget Status</p>
                <p className="text-sm text-slate-400">{recoveryData?.budgetStatus.category}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Overspent</p>
                <p className="text-xl font-bold text-red-400">
                  {formatCurrency(
                    Math.abs(recoveryData?.budgetStatus.remaining.amount ?? 0),
                    recoveryData?.budgetStatus.remaining.currency ?? 'NGN'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Budget Used</p>
                <p className="text-xl font-bold text-white">
                  {Math.round(100 + (recoveryData?.budgetStatus.overagePercent ?? 0))}%
                </p>
              </div>
            </div>

            {/* Goal Impact */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-slate-400" />
                <p className="text-sm text-slate-400">Impact on {recoveryData?.goalImpact.goalName}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Before</p>
                  <p className="text-lg font-bold text-white">
                    {Math.round((recoveryData?.goalImpact.previousProbability ?? 0) * 100)}%
                  </p>
                </div>

                <div className="flex-1 px-4">
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-red-500"
                      initial={{ width: '100%' }}
                      animate={{
                        width: `${((recoveryData?.goalImpact.newProbability ?? 0) / (recoveryData?.goalImpact.previousProbability ?? 1)) * 100}%`,
                      }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-xs text-slate-500">After</p>
                  <p className="text-lg font-bold text-red-400">
                    {Math.round((recoveryData?.goalImpact.newProbability ?? 0) * 100)}%
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-2 text-center">
                Goal achievement probability
              </p>
            </div>
          </div>
        </motion.section>

        {/* Recovery Paths */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-secondary-400" />
            Choose Your Path
          </h2>

          <div className="space-y-4">
            {recoveryData?.recoveryPaths.map((path, index) => {
              const colors = effortColors[path.effort];
              const Icon = pathIcons[path.id as keyof typeof pathIcons] || Navigation;
              const isSelected = selectedPathId === path.id;
              const isExpanded = expandedPath === path.id;

              return (
                <motion.div
                  key={path.id}
                  className={cn(
                    'relative overflow-hidden rounded-2xl border backdrop-blur-sm',
                    `bg-gradient-to-br ${colors.bg} ${colors.border}`,
                    isSelected && 'ring-2 ring-white/50'
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <button
                    onClick={() => setExpandedPath(isExpanded ? null : path.id)}
                    className="w-full p-5 text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={cn('p-3 rounded-xl', colors.bg.replace('to-', 'to-transparent '))}>
                          <Icon className={cn('w-6 h-6', colors.text)} />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white">{path.name}</h3>
                            <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', colors.badge)}>
                              {path.effort} effort
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">{path.description}</p>
                        </div>
                      </div>

                      <ChevronDown
                        className={cn(
                          'w-5 h-5 text-slate-400 transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </div>

                    {/* New probability */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${path.newProbability * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.3 }}
                        />
                      </div>
                      <span className="text-lg font-bold text-green-400">
                        {Math.round(path.newProbability * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      New goal probability after recovery
                    </p>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-2 border-t border-white/10">
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {path.timelineImpact && (
                              <div className="p-3 bg-white/5 rounded-lg">
                                <p className="text-xs text-slate-500">Timeline</p>
                                <p className="text-sm font-medium text-white">{path.timelineImpact}</p>
                              </div>
                            )}
                            {path.savingsImpact && (
                              <div className="p-3 bg-white/5 rounded-lg">
                                <p className="text-xs text-slate-500">Savings</p>
                                <p className="text-sm font-medium text-white">{path.savingsImpact}</p>
                              </div>
                            )}
                            {path.freezeDuration && (
                              <div className="p-3 bg-white/5 rounded-lg col-span-2">
                                <p className="text-xs text-slate-500">Category Freeze</p>
                                <p className="text-sm font-medium text-white">{path.freezeDuration}</p>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleSelectPath(path.id)}
                            disabled={isSelectingPath}
                            className={cn(
                              'w-full py-3 rounded-xl font-semibold text-white',
                              'bg-gradient-to-r from-primary-500 to-secondary-500',
                              'hover:from-primary-400 hover:to-secondary-400',
                              'shadow-lg shadow-primary-500/25',
                              'transition-all duration-200',
                              'disabled:opacity-50 disabled:cursor-not-allowed',
                              'flex items-center justify-center gap-2'
                            )}
                          >
                            {isSelectingPath && selectedPathId === path.id ? (
                              <>
                                <motion.div
                                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                  animate={{ rotate: 360 }}
                                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                />
                                <span>Activating...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-5 h-5" />
                                <span>Choose This Path</span>
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
