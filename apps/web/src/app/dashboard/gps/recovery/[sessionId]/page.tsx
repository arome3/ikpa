'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  ShieldCheck,
  Users,
  HeartCrack,
  Lock,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGps, RecoveryPath, GoalImpact, BudgetStatus, NonJudgmentalMessage, CommitmentAtRisk } from '@/hooks/useGps';

// ============================================
// RECOVERY PATH SELECTION PAGE
// "Strategic Decision Memo" — Editorial Style
// ============================================

interface RecoveryData {
  sessionId: string;
  budgetStatus: BudgetStatus;
  goalImpact: GoalImpact | null;
  recoveryPaths: RecoveryPath[];
  message: NonJudgmentalMessage;
  commitmentAtRisk?: CommitmentAtRisk;
}

const STAKE_TYPE_ICONS: Record<string, typeof Users> = {
  SOCIAL: Users,
  ANTI_CHARITY: HeartCrack,
  LOSS_POOL: Lock,
};

const STAKE_TYPE_COLORS: Record<string, string> = {
  SOCIAL: 'text-purple-700',
  ANTI_CHARITY: 'text-red-700',
  LOSS_POOL: 'text-amber-700',
};

const PATH_TOP_BORDER: Record<string, string> = {
  category_rebalance: 'border-t-4 border-t-amber-400',
  time_adjustment: 'border-t-4 border-t-teal-400',
  rate_adjustment: 'border-t-4 border-t-amber-400',
  freeze_protocol: 'border-t-4 border-t-red-400',
};

const RISK_LEVEL_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  high: { border: 'border-red-400', bg: 'bg-red-50/50', text: 'text-red-700' },
  medium: { border: 'border-amber-400', bg: 'bg-amber-50/50', text: 'text-amber-700' },
  low: { border: 'border-stone-300', bg: 'bg-stone-50', text: 'text-stone-600' },
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function RecoverySessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { getRecoveryPaths, getSession, getSpendingVelocity, selectPath, isSelectingPath, recalculateData } = useGps();

  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{
    message: string;
    nextSteps: string[];
  } | null>(null);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  // Prevent duplicate fetches from dependency changes
  const hasFetched = useRef(false);

  // Load recovery data
  useEffect(() => {
    // If we already have data from recalculate, use it immediately
    if (recalculateData && recalculateData.sessionId === sessionId) {
      setRecoveryData({
        sessionId: recalculateData.sessionId,
        budgetStatus: recalculateData.budgetStatus,
        goalImpact: recalculateData.goalImpact ?? null,
        recoveryPaths: recalculateData.recoveryPaths,
        message: recalculateData.message,
        commitmentAtRisk: recalculateData.commitmentAtRisk,
      });
      setIsLoading(false);
      hasFetched.current = true;
      return;
    }

    // Skip if we already fetched for this session
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Fetch real session data + recovery paths from API
    const loadData = async () => {
      try {
        const [session, pathsResult] = await Promise.all([
          getSession(sessionId),
          getRecoveryPaths(sessionId),
        ]);

        // Try to get budget details for the category
        let budgetAmount = 0;
        let spentAmount = 0;
        let currency = 'USD';
        let overagePercent = 0;
        try {
          const velocity = await getSpendingVelocity(session.category);
          budgetAmount = velocity.budget.budgeted.amount;
          spentAmount = velocity.budget.spent.amount;
          currency = velocity.budget.budgeted.currency;
          overagePercent = budgetAmount > 0
            ? Math.max(0, ((spentAmount - budgetAmount) / budgetAmount) * 100)
            : 0;
        } catch {
          // If velocity unavailable, derive from session overspend
          spentAmount = session.overspendAmount;
          overagePercent = 100;
        }

        const probabilityDrop = session.newProbability - session.previousProbability;

        setRecoveryData({
          sessionId: session.id,
          budgetStatus: {
            category: session.category,
            categoryId: '',
            budgeted: { amount: budgetAmount, formatted: formatCurrency(budgetAmount, currency), currency },
            spent: { amount: spentAmount, formatted: formatCurrency(spentAmount, currency), currency },
            remaining: { amount: budgetAmount - spentAmount, formatted: formatCurrency(budgetAmount - spentAmount, currency), currency },
            overagePercent,
            trigger: overagePercent >= 20 ? 'BUDGET_CRITICAL' : 'BUDGET_EXCEEDED',
            period: 'MONTHLY',
          },
          goalImpact: session.goalId ? {
            goalId: session.goalId,
            goalName: session.goalName || session.category,
            goalAmount: { amount: 0, formatted: '', currency },
            goalDeadline: '',
            previousProbability: session.previousProbability,
            newProbability: session.newProbability,
            probabilityDrop,
            message: probabilityDrop < 0
              ? `Probability decreased by ${Math.abs(probabilityDrop * 100).toFixed(1)} percentage points`
              : 'Probability unchanged',
          } : null,
          recoveryPaths: pathsResult.paths,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, recalculateData]);

  const handleSelectPath = async () => {
    if (!selectedPathId) return;
    try {
      const result = await selectPath({ pathId: selectedPathId, sessionId });
      setSuccessData({
        message: result.message,
        nextSteps: result.nextSteps,
      });
      setShowSuccess(true);
    } catch (error) {
      console.error('Failed to select path:', error);
      // Keep selection visible — user can retry
    }
  };

  // ── Loading State: Editorial Skeleton ──────────────

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 md:py-12">
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Back link skeleton */}
          <div className="h-4 w-16 bg-stone-200 rounded animate-pulse" />

          {/* Header skeleton */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-stone-200 rounded animate-pulse" />
              <div className="h-8 w-64 bg-stone-200 rounded animate-pulse" />
            </div>
            <div className="h-4 w-80 bg-stone-100 rounded animate-pulse" />
          </div>

          {/* Alert strip skeleton */}
          <div className="border-l-4 border-stone-200 bg-stone-50 rounded-r-lg p-6">
            <div className="space-y-3">
              <div className="h-3 w-32 bg-stone-200 rounded animate-pulse" />
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-stone-200 animate-pulse" />
                <div className="w-4 h-4 bg-stone-100 rounded animate-pulse" />
                <div className="w-12 h-12 rounded-full bg-stone-200 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Path cards skeleton */}
          <div className="space-y-2">
            <div className="h-3 w-28 bg-stone-200 rounded animate-pulse" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="border-t-4 border-t-stone-200 bg-white border border-stone-100 rounded-lg p-6"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-20 bg-stone-100 rounded animate-pulse" />
                      <div className="h-5 w-40 bg-stone-200 rounded animate-pulse" />
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 border-stone-200 animate-pulse" />
                  </div>
                  <div className="h-4 w-full bg-stone-50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Button skeleton */}
          <div className="flex justify-center pt-4">
            <div className="h-12 w-48 bg-stone-200 rounded-full animate-pulse" />
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Success Screen: Editorial Confirmation ─────────

  if (showSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 md:py-12">
        <motion.div
          className="flex flex-col items-center justify-center min-h-[70vh] text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {/* Checkmark */}
          <motion.div
            className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-700" />
          </motion.div>

          <motion.h1
            className="text-3xl font-serif text-[#1A2E22] tracking-tight mb-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            Strategy Applied
          </motion.h1>

          <motion.p
            className="text-stone-500 font-sans mb-8 max-w-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {successData?.message}
          </motion.p>

          {/* Next Steps */}
          {successData?.nextSteps && successData.nextSteps.length > 0 && (
            <motion.div
              className="w-full max-w-sm mb-8"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <h3 className="text-xs uppercase tracking-wider text-stone-400 font-sans font-medium mb-3 text-left">
                Next Steps
              </h3>
              <div className="space-y-2">
                {successData.nextSteps.map((step, index) => (
                  <motion.div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-white border border-stone-100 rounded-lg text-left"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-medium font-mono text-emerald-700">{index + 1}</span>
                    </div>
                    <p className="text-sm text-stone-600 font-sans">{step}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.button
            onClick={() => router.push('/dashboard/gps')}
            className="rounded-full bg-[#064E3B] text-white px-8 py-3 font-sans font-medium hover:bg-[#053F30] transition-colors"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            Return to GPS
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Main Page: Strategic Decision Memo ─────────────

  const overspendAmount = Math.abs(recoveryData?.budgetStatus.remaining.amount ?? 0);
  const overspendFormatted = formatCurrency(
    overspendAmount,
    recoveryData?.budgetStatus.remaining.currency ?? 'NGN',
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 md:py-12">
      {/* Back link */}
      <motion.button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-stone-400 hover:text-stone-600 transition-colors text-sm font-sans mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </motion.button>

      {/* Header — "Course Correction Strategy" */}
      <motion.header
        className="mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <Compass className="w-6 h-6 text-stone-400" strokeWidth={1.5} />
          <h1 className="text-3xl font-serif text-[#1A2E22] tracking-tight">
            Course Correction Strategy
          </h1>
        </div>
        <p className="text-stone-500 font-sans mt-2">
          Variance Detected: <strong className="text-[#1A2E22]">{recoveryData?.budgetStatus.category}</strong> is{' '}
          <strong className="text-[#1A2E22]">{overspendFormatted}</strong> over budget.
        </p>
        {recoveryData?.message.subtext && (
          <p className="text-sm text-stone-400 mt-1 font-sans">
            {recoveryData.message.subtext}
          </p>
        )}
      </motion.header>

      {/* Stakes at Risk Banner — Editorial Alert Strip */}
      {recoveryData?.commitmentAtRisk?.hasActiveCommitment && (
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {(() => {
            const risk = recoveryData.commitmentAtRisk!;
            const riskColors = RISK_LEVEL_COLORS[risk.riskLevel] || RISK_LEVEL_COLORS.low;
            return (
              <div className={cn('border-l-4 p-4 rounded-r-lg', riskColors.border, riskColors.bg)}>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className={cn('h-4 w-4', riskColors.text)} />
                  <span className={cn('text-xs uppercase tracking-wider font-sans font-medium', riskColors.text)}>
                    Stakes at Risk
                  </span>
                  {risk.totalStakeAtRisk > 0 && (
                    <span className="ml-auto font-mono text-sm text-[#1A2E22] font-medium">
                      {formatCurrency(risk.totalStakeAtRisk, 'USD')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mb-3 font-sans">{risk.message}</p>
                <div className="space-y-1.5">
                  {risk.contracts.slice(0, 3).map((c) => {
                    const StakeIcon = STAKE_TYPE_ICONS[c.stakeType] || ShieldCheck;
                    const stakeColor = STAKE_TYPE_COLORS[c.stakeType] || 'text-stone-500';
                    return (
                      <div key={c.id} className="flex items-center gap-2 text-xs font-sans">
                        <StakeIcon className={cn('h-3.5 w-3.5', stakeColor)} />
                        <span className="text-stone-600 truncate flex-1">{c.goalName}</span>
                        <span className="text-stone-400">{c.daysRemaining}d left</span>
                        {c.stakeAmount != null && (
                          <span className="text-[#1A2E22] font-mono font-medium">
                            {formatCurrency(c.stakeAmount, 'USD')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => router.push('/dashboard/commitments')}
                  className="mt-3 text-xs underline text-stone-500 hover:text-stone-700 transition-colors font-sans"
                >
                  View Commitments
                </button>
              </div>
            );
          })()}
        </motion.section>
      )}

      {/* Impact Summary — "Ripple Effect" Warning Strip */}
      <motion.section
        className="mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: recoveryData?.commitmentAtRisk?.hasActiveCommitment ? 0.15 : 0.1 }}
      >
        {recoveryData?.goalImpact ? (
          <div className="border-l-4 border-orange-400 bg-orange-50/50 p-6 rounded-r-lg">
            <p className="text-xs uppercase tracking-wider text-orange-700 font-sans font-medium mb-4">
              Goal Impact Warning
            </p>

            {/* Probability circles */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center">
                  <span className="font-mono text-sm font-semibold text-emerald-700">
                    {Math.round((recoveryData.goalImpact.previousProbability ?? 0) * 100)}%
                  </span>
                </div>
                <span className="text-[10px] text-stone-400 font-sans">Before</span>
              </div>

              <ArrowRight className="w-4 h-4 text-stone-400 flex-shrink-0" />

              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-orange-50 border-2 border-orange-400 flex items-center justify-center">
                  <span className="font-mono text-sm font-semibold text-orange-700">
                    {Math.round((recoveryData.goalImpact.newProbability ?? 0) * 100)}%
                  </span>
                </div>
                <span className="text-[10px] text-stone-400 font-sans">After</span>
              </div>

              <div className="flex-1 ml-2">
                <p className="text-sm text-[#1A2E22] font-sans font-medium">
                  {recoveryData.goalImpact.goalName}
                </p>
                {recoveryData.goalImpact.humanReadable && (
                  <p className="text-xs text-stone-500 font-sans mt-0.5">
                    {recoveryData.goalImpact.humanReadable}
                  </p>
                )}
                {recoveryData.goalImpact.scheduleStatus && (
                  <p className="text-xs text-orange-600 font-sans mt-0.5">
                    {recoveryData.goalImpact.scheduleStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border-l-4 border-stone-300 bg-stone-50 p-6 rounded-r-lg">
            <p className="text-xs uppercase tracking-wider text-stone-500 font-sans font-medium mb-3">
              Budget Variance Summary
            </p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-mono text-lg text-[#1A2E22] font-semibold">{overspendFormatted}</span>
              <span className="text-sm text-stone-400 font-sans">overspent</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm text-stone-500">
                {Math.round(100 + (recoveryData?.budgetStatus.overagePercent ?? 0))}%
              </span>
              <span className="text-xs text-stone-400 font-sans">of budget used</span>
            </div>
            <p className="text-xs text-stone-400 mt-3 font-sans">
              No active financial goals. Recovery paths focus on getting your spending back on track.
            </p>
          </div>
        )}
      </motion.section>

      {/* Recovery Paths — "Decision Dossiers" */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <p className="text-xs uppercase tracking-wider text-stone-400 font-sans mb-4">
          Strategic Options
        </p>

        <div className="space-y-3">
          {recoveryData?.recoveryPaths.map((path, index) => {
            const isSelected = selectedPathId === path.id;
            const isExpanded = expandedPath === path.id;
            const topBorder = PATH_TOP_BORDER[path.id] || 'border-t-4 border-t-stone-300';

            return (
              <motion.div
                key={path.id}
                className={cn(
                  'bg-white border rounded-lg overflow-hidden transition-all',
                  topBorder,
                  isSelected
                    ? 'border-emerald-500 ring-1 ring-emerald-500/20'
                    : 'border-stone-200 hover:border-emerald-500',
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * index }}
              >
                {/* Card body — click to select */}
                <button
                  onClick={() => setSelectedPathId(path.id)}
                  className="w-full p-6 text-left"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="text-xs text-stone-400 font-sans mb-1">
                        Option {OPTION_LABELS[index] || index + 1}
                      </p>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#1A2E22] font-sans">{path.name}</h3>
                        <span className="text-xs text-stone-400 font-sans px-2 py-0.5 bg-stone-50 rounded-full">
                          {path.effort} effort
                        </span>
                      </div>
                    </div>

                    {/* Radio circle */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-colors',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-stone-300',
                      )}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-stone-500 font-sans leading-relaxed">
                    {path.description}
                  </p>

                  {/* New probability or budget impact — inline */}
                  {path.newProbability !== null ? (
                    <p className="text-sm font-sans mt-3">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline mr-1.5 -mt-0.5" />
                      <span className="text-stone-600">
                        Keeps goal on track —{' '}
                      </span>
                      <span className="font-mono text-emerald-700 font-medium">
                        {Math.round(path.newProbability * 100)}%
                      </span>
                      {path.timelineEffect && (
                        <span className="text-stone-400 ml-1">
                          ({path.timelineEffect})
                        </span>
                      )}
                    </p>
                  ) : path.budgetImpact ? (
                    <p className="text-sm text-stone-500 font-sans mt-3">
                      {path.budgetImpact}
                    </p>
                  ) : null}
                </button>

                {/* Show details toggle */}
                <div className="px-6 pb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedPath(isExpanded ? null : path.id);
                    }}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors font-sans"
                  >
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                    />
                    <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
                  </button>
                </div>

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
                      <div className="px-6 pb-6 pt-2">
                        {/* Detail grid */}
                        {(path.rebalanceInfo || path.timelineImpact || path.savingsImpact || path.freezeDuration) && (
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            {path.rebalanceInfo && (
                              <>
                                <div className="p-3 bg-stone-50 rounded-lg">
                                  <p className="text-xs text-stone-400 font-sans">From</p>
                                  <p className="text-sm font-medium text-[#1A2E22] font-sans">{path.rebalanceInfo.fromCategory}</p>
                                </div>
                                <div className="p-3 bg-stone-50 rounded-lg">
                                  <p className="text-xs text-stone-400 font-sans">Coverage</p>
                                  <p className="text-sm font-medium text-[#1A2E22] font-sans">
                                    {path.rebalanceInfo.isFullCoverage ? 'Full' : 'Partial'}
                                  </p>
                                </div>
                                <div className="p-3 bg-stone-50 rounded-lg col-span-2">
                                  <p className="text-xs text-stone-400 font-sans">Surplus Available</p>
                                  <p className="text-sm font-sans text-[#1A2E22]">
                                    <span className="font-mono font-medium">
                                      {formatCurrency(path.rebalanceInfo.availableSurplus, recoveryData?.budgetStatus.remaining.currency ?? 'NGN')}
                                    </span>
                                    {' '}covers{' '}
                                    <span className="font-mono font-medium">
                                      {formatCurrency(path.rebalanceInfo.coverageAmount, recoveryData?.budgetStatus.remaining.currency ?? 'NGN')}
                                    </span>
                                    {' '}of overage
                                  </p>
                                </div>
                              </>
                            )}
                            {path.timelineImpact && (
                              <div className="p-3 bg-stone-50 rounded-lg">
                                <p className="text-xs text-stone-400 font-sans">Timeline</p>
                                <p className="text-sm font-medium text-[#1A2E22] font-sans">{path.timelineImpact}</p>
                              </div>
                            )}
                            {path.savingsImpact && (
                              <div className="p-3 bg-stone-50 rounded-lg">
                                <p className="text-xs text-stone-400 font-sans">Savings</p>
                                <p className="text-sm font-medium text-[#1A2E22] font-sans">{path.savingsImpact}</p>
                              </div>
                            )}
                            {path.freezeDuration && (
                              <div className="p-3 bg-stone-50 rounded-lg col-span-2">
                                <p className="text-xs text-stone-400 font-sans">Category Freeze</p>
                                <p className="text-sm font-medium text-[#1A2E22] font-sans">{path.freezeDuration}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Concrete Daily Actions */}
                        {path.concreteActions && path.concreteActions.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <ListChecks className="w-4 h-4 text-stone-400" />
                              <p className="text-xs text-stone-500 font-sans font-medium">Things you can do today</p>
                            </div>
                            <div className="space-y-1.5">
                              {path.concreteActions.map((action, actionIdx) => (
                                <div
                                  key={actionIdx}
                                  className="flex items-start gap-2.5 text-sm"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                  <p className="text-stone-600 font-sans">{action}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Footer — "Apply Strategy" Button */}
      <motion.div
        className="flex justify-center pt-8 pb-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <button
          onClick={handleSelectPath}
          disabled={!selectedPathId || isSelectingPath}
          className={cn(
            'rounded-full bg-[#064E3B] text-white px-8 py-3 font-sans font-medium',
            'hover:bg-[#053F30] transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'flex items-center gap-2',
          )}
        >
          {isSelectingPath ? (
            <>
              <motion.div
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              />
              <span>Applying...</span>
            </>
          ) : (
            <span>Apply Strategy</span>
          )}
        </button>
      </motion.div>
    </div>
  );
}
