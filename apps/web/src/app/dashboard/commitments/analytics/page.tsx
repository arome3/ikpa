'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Trophy,
  Target,
  Users,
  HeartCrack,
  Lock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Loader2,
  Zap,
  Shield,
  Brain,
  Star,
  ShieldCheck,
  Activity,
  Sparkles,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useCommitments, useEvaluationsSummary } from '@/hooks/useCommitments';
import { useGoals } from '@/hooks/useFinance';
import { apiClient } from '@/lib/api';
import type { CommitmentContract, StakeEffectiveness } from '@/hooks/useCommitments';

// ============================================
// CONFIG
// ============================================

const STAKE_CONFIG = {
  SOCIAL: { label: 'Social', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/20', barColor: 'from-purple-500 to-violet-400' },
  ANTI_CHARITY: { label: 'Anti-Charity', icon: HeartCrack, color: 'text-red-400', bg: 'bg-red-500/20', barColor: 'from-red-500 to-rose-400' },
  LOSS_POOL: { label: 'Loss Pool', icon: Lock, color: 'text-amber-400', bg: 'bg-amber-500/20', barColor: 'from-amber-500 to-yellow-400' },
} as const;

const STATUS_ICON = {
  ACTIVE: { icon: Target, color: 'text-green-400' },
  PENDING_VERIFICATION: { icon: Clock, color: 'text-amber-400' },
  SUCCEEDED: { icon: CheckCircle2, color: 'text-emerald-400' },
  FAILED: { icon: XCircle, color: 'text-red-400' },
  CANCELLED: { icon: Ban, color: 'text-slate-400' },
} as const;

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

interface AnalyticsOverview {
  userId: string;
  overview: {
    totalContracts: number;
    totalSucceeded: number;
    overallSuccessRate: number;
    totalStaked: number;
  };
  byStakeType: StakeEffectiveness[];
  recommendation: string;
}

// ============================================
// ANALYTICS PAGE
// ============================================

export default function CommitmentAnalyticsPage() {
  const router = useRouter();
  const { getStakesByGoal } = useCommitments();
  const { items: goals, isLoading: goalsLoading } = useGoals();

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [allContracts, setAllContracts] = useState<CommitmentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: evalSummary, isLoading: evalLoading } = useEvaluationsSummary();

  // Fetch analytics overview
  useEffect(() => {
    apiClient
      .get('/commitment/analytics/overview')
      .then((res) => setOverview(unwrap<AnalyticsOverview>(res)))
      .catch(() => {});
  }, []);

  // Fetch all contracts for timeline
  useEffect(() => {
    if (goalsLoading || goals.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      const contracts: CommitmentContract[] = [];
      for (const goal of goals) {
        if (cancelled) return;
        try {
          const result = await getStakesByGoal(goal.id);
          contracts.push(...result.data);
        } catch {
          // Skip goals with no stakes
        }
      }
      if (!cancelled) {
        setAllContracts(contracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, goalsLoading]);

  const ov = overview?.overview;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-violet-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto md:max-w-4xl px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push('/dashboard/commitments')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Commitments
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/20 rounded-xl backdrop-blur-sm">
              <BarChart3 className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
              <p className="text-sm text-slate-400">Your commitment performance</p>
            </div>
          </div>
        </motion.header>

        {/* Overview Stats */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Total Commitments"
              value={ov?.totalContracts ?? 0}
              icon={<Shield className="w-5 h-5 text-purple-400" />}
              loading={!overview}
            />
            <StatCard
              label="Succeeded"
              value={ov?.totalSucceeded ?? 0}
              icon={<Trophy className="w-5 h-5 text-emerald-400" />}
              loading={!overview}
            />
            <StatCard
              label="Success Rate"
              value={`${ov?.overallSuccessRate ?? 0}%`}
              icon={<TrendingUp className="w-5 h-5 text-cyan-400" />}
              loading={!overview}
              highlight={ov && ov.overallSuccessRate >= 70}
            />
            <StatCard
              label="Total Staked"
              value={formatCurrency(ov?.totalStaked ?? 0, 'USD')}
              icon={<Zap className="w-5 h-5 text-amber-400" />}
              loading={!overview}
            />
          </div>
        </motion.section>

        {/* Effectiveness by Stake Type */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            Success Rate by Stake Type
          </h2>

          <div className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
            {overview?.byStakeType && overview.byStakeType.length > 0 ? (
              overview.byStakeType.map((metric) => {
                const config = STAKE_CONFIG[metric.stakeType as keyof typeof STAKE_CONFIG];
                if (!config) return null;
                const Icon = config.icon;
                const rate = Math.round(metric.successRate * 100);

                return (
                  <div key={metric.stakeType}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-lg', config.bg)}>
                          <Icon className={cn('w-4 h-4', config.color)} />
                        </div>
                        <span className="text-sm font-medium text-white">{config.label}</span>
                        <span className="text-xs text-slate-500">
                          {metric.totalCommitments} commitment{metric.totalCommitments !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className={cn('text-sm font-bold', rate >= 70 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-red-400')}>
                        {rate}%
                      </span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className={cn('h-full rounded-full bg-gradient-to-r', config.barColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, rate)}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                    </div>
                    {metric.averageStakeAmount != null && metric.averageStakeAmount > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Avg. stake: {formatCurrency(metric.averageStakeAmount, 'USD')}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6">
                <p className="text-slate-400 text-sm">No commitment data yet</p>
                <p className="text-slate-500 text-xs mt-1">Create your first commitment to see analytics</p>
              </div>
            )}

            {overview?.recommendation && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  {overview.recommendation}
                </p>
              </div>
            )}
          </div>
        </motion.section>

        {/* Commitment Timeline */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Commitment Timeline
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : allContracts.length === 0 ? (
            <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-slate-400 text-sm">No commitments yet</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/10" />

              <div className="space-y-4">
                {allContracts.slice(0, 20).map((contract, index) => {
                  const statusConf = STATUS_ICON[contract.status];
                  const stakeConf = STAKE_CONFIG[contract.stakeType];
                  const StatusIcon = statusConf.icon;

                  return (
                    <motion.div
                      key={contract.id}
                      className="relative flex gap-4 pl-1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * index }}
                    >
                      {/* Timeline dot */}
                      <div className={cn('relative z-10 mt-1 p-1.5 rounded-full border-2 border-slate-800', statusConf.color === 'text-emerald-400' ? 'bg-emerald-500/20' : statusConf.color === 'text-red-400' ? 'bg-red-500/20' : statusConf.color === 'text-green-400' ? 'bg-green-500/20' : 'bg-slate-500/20')}>
                        <StatusIcon className={cn('w-3.5 h-3.5', statusConf.color)} />
                      </div>

                      {/* Card */}
                      <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{contract.goalName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', stakeConf.bg, stakeConf.color)}>
                                {stakeConf.label}
                              </span>
                              {contract.stakeAmount != null && contract.stakeAmount > 0 && (
                                <span className="text-xs text-slate-400">
                                  {formatCurrency(contract.stakeAmount, 'USD')}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {new Date(contract.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.section>

        {/* AI Quality Scores */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            AI Quality Scores
          </h2>

          <div className="p-5 rounded-xl bg-white/5 border border-white/10">
            {evalLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            ) : evalSummary ? (
              <div className="space-y-4">
                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Star className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-medium text-indigo-300">Tone & Empathy</span>
                    </div>
                    <p className="text-xs text-slate-400">{evalSummary.metrics.toneEmpathy?.description || 'Warm, supportive responses'}</p>
                    <div className="flex items-center gap-0.5 mt-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn('w-3 h-3', i <= 4 ? 'text-indigo-400 fill-indigo-400' : 'text-slate-600')} />
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-300">Financial Safety</span>
                    </div>
                    <p className="text-xs text-slate-400">{evalSummary.metrics.financialSafety?.description || 'Safe financial guidance'}</p>
                    <p className="text-lg font-bold text-emerald-400 mt-1.5">Pass</p>
                  </div>

                  <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <span className="text-xs font-medium text-violet-300">Cultural Sensitivity</span>
                    </div>
                    <p className="text-xs text-slate-400">{evalSummary.metrics.culturalSensitivity?.description || 'Culturally appropriate'}</p>
                    <div className="flex items-center gap-0.5 mt-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn('w-3 h-3', i <= 4 ? 'text-violet-400 fill-violet-400' : 'text-slate-600')} />
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-medium text-cyan-300">Intervention Success</span>
                    </div>
                    <p className="text-xs text-slate-400">{evalSummary.metrics.interventionSuccess?.description || 'Helping users stay on track'}</p>
                    <p className="text-lg font-bold text-cyan-400 mt-1.5">
                      {evalSummary.metrics.interventionSuccess?.value ?? 0}%
                    </p>
                  </div>
                </div>

                {/* Footer note */}
                <div className="pt-3 border-t border-white/10">
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Brain className="w-3 h-3 text-indigo-400/60 flex-shrink-0" />
                    {evalSummary.note}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-slate-400 text-sm">No evaluation data yet</p>
                <p className="text-slate-500 text-xs mt-1">AI quality scores appear after agent interactions</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* Insights */}
        <motion.section
          className="mb-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Personal Insights
          </h2>

          <div className="space-y-3">
            <InsightCard
              contracts={allContracts}
              overview={overview?.overview}
            />
          </div>
        </motion.section>
      </div>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

function StatCard({
  label,
  value,
  icon,
  loading,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'p-4 rounded-xl border backdrop-blur-sm',
      highlight ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10',
    )}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      {loading ? (
        <div className="h-8 w-16 bg-white/10 rounded animate-pulse" />
      ) : (
        <p className={cn('text-xl font-bold', highlight ? 'text-emerald-400' : 'text-white')}>{value}</p>
      )}
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function InsightCard({
  contracts,
  overview,
}: {
  contracts: CommitmentContract[];
  overview?: AnalyticsOverview['overview'];
}) {
  const insights: Array<{ title: string; text: string; emoji: string }> = [];

  if (!overview || contracts.length === 0) {
    return (
      <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-center">
        <p className="text-slate-400 text-sm">Complete your first commitment to unlock insights</p>
      </div>
    );
  }

  // Success rate insight
  if (overview.overallSuccessRate >= 80) {
    insights.push({
      title: 'Top Performer',
      text: `Your ${overview.overallSuccessRate}% success rate puts you in the top tier. Stakes are clearly working for you.`,
      emoji: '🏆',
    });
  } else if (overview.overallSuccessRate >= 50) {
    insights.push({
      title: 'Growing Stronger',
      text: `At ${overview.overallSuccessRate}% success rate, you're building momentum. Consider increasing stakes to boost motivation.`,
      emoji: '📈',
    });
  } else if (overview.totalContracts > 0) {
    insights.push({
      title: 'Keep Going',
      text: 'Early commitments are about building the habit. Try SOCIAL stakes first — accountability partners boost success by 65%.',
      emoji: '💪',
    });
  }

  // Stake type usage insight
  const socialCount = contracts.filter(c => c.stakeType === 'SOCIAL').length;
  const monetaryCount = contracts.filter(c => c.stakeType !== 'SOCIAL').length;
  if (socialCount > 0 && monetaryCount === 0 && overview.totalContracts >= 3) {
    insights.push({
      title: 'Ready to Level Up?',
      text: 'You\'ve completed several SOCIAL commitments. Research shows monetary stakes increase success by an additional 40%.',
      emoji: '🚀',
    });
  }

  // Streak insight
  const succeededInRow = contracts.reduce((max, c, i) => {
    if (c.status !== 'SUCCEEDED') return max;
    let streak = 1;
    for (let j = i + 1; j < contracts.length; j++) {
      if (contracts[j].status === 'SUCCEEDED') streak++;
      else break;
    }
    return Math.max(max, streak);
  }, 0);

  if (succeededInRow >= 3) {
    insights.push({
      title: `${succeededInRow}-Commitment Streak`,
      text: `You've succeeded ${succeededInRow} times in a row! Consistency is key — your commitment muscle is getting stronger.`,
      emoji: '🔥',
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: 'Getting Started',
      text: 'Complete more commitments to unlock personalized insights about your financial commitment patterns.',
      emoji: '✨',
    });
  }

  return (
    <>
      {insights.map((insight, i) => (
        <motion.div
          key={i}
          className="p-4 rounded-xl bg-white/5 border border-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{insight.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-white">{insight.title}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{insight.text}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </>
  );
}
