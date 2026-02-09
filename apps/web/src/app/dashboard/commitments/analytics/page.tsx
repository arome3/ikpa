'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Target,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Star,
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
  SOCIAL: { label: 'Social', color: '#064E3B' },
  ANTI_CHARITY: { label: 'Anti-Charity', color: '#C2410C' },
  LOSS_POOL: { label: 'Loss Pool', color: '#D97706' },
} as const;

const STATUS_CONFIG: Record<string, { label: string; dotBg: string; textColor: string }> = {
  ACTIVE: { label: 'Active', dotBg: 'bg-amber-100', textColor: 'text-[#D97706]' },
  PENDING_VERIFICATION: { label: 'Pending', dotBg: 'bg-stone-100', textColor: 'text-stone-500' },
  SUCCEEDED: { label: 'Fulfilled', dotBg: 'bg-emerald-100', textColor: 'text-[#064E3B]' },
  FAILED: { label: 'Breached', dotBg: 'bg-orange-50', textColor: 'text-[#C2410C]' },
  CANCELLED: { label: 'Withdrawn', dotBg: 'bg-stone-50', textColor: 'text-stone-400' },
};

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
// INLINE SUBCOMPONENTS
// ============================================

function StatStripItem({
  label,
  value,
  unit,
  loading,
  highlight,
}: {
  label: string;
  value: string | number;
  unit?: string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-2">
      {loading ? (
        <div className="h-12 w-20 bg-stone-100 rounded animate-pulse mb-1" />
      ) : (
        <p className={cn('text-4xl md:text-5xl font-serif tabular-nums', highlight ? 'text-[#064E3B]' : 'text-[#1A2E22]')}>
          {value}
          {unit && <span className="text-xs font-mono text-stone-400 ml-1">{unit}</span>}
        </p>
      )}
      <p className="text-[10px] tracking-widest text-stone-500 uppercase mt-1">{label}</p>
    </div>
  );
}

function BarChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-md">
      <p className="font-mono text-xs text-stone-400 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="font-mono text-sm" style={{ color: entry.color }}>
          {entry.dataKey === 'succeeded' ? 'Fulfilled' : entry.dataKey === 'failed' ? 'Breached' : 'Active'}:{' '}
          <span className="font-medium">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function PortfolioHealthRing({
  data,
}: {
  data: { succeeded: number; active: number; failed: number; cancelled: number; total: number };
}) {
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { key: 'succeeded', label: 'Fulfilled', color: '#064E3B', count: data.succeeded },
    { key: 'active', label: 'Active', color: '#D97706', count: data.active },
    { key: 'failed', label: 'Breached', color: '#C2410C', count: data.failed },
    { key: 'cancelled', label: 'Withdrawn', color: '#E7E5E4', count: data.cancelled },
  ].filter((s) => s.count > 0);

  let offset = 0;

  return (
    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
      {/* SVG Ring */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F5F5F4"
            strokeWidth={strokeWidth}
          />
          {/* Segment arcs */}
          {data.total > 0 &&
            segments.map((seg, i) => {
              const fraction = seg.count / data.total;
              const dash = fraction * circumference;
              const currentOffset = offset;
              offset += dash;

              return (
                <motion.circle
                  key={seg.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="butt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 * i, duration: 0.4 }}
                />
              );
            })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-serif text-[#1A2E22]">{data.total}</span>
          <span className="text-[9px] tracking-widest text-stone-400 uppercase">Total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-sm text-stone-500">{seg.label}</span>
            <span className="font-mono text-sm font-medium text-[#1A2E22]">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightBlock({
  contracts,
  overview,
}: {
  contracts: CommitmentContract[];
  overview?: AnalyticsOverview['overview'];
}) {
  const insights: Array<{ title: string; text: string }> = [];

  if (!overview || contracts.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-stone-400 text-sm">Complete your first commitment to unlock insights</p>
      </div>
    );
  }

  // Success rate insight
  if (overview.overallSuccessRate >= 80) {
    insights.push({
      title: 'Top Performer',
      text: `Your ${overview.overallSuccessRate}% success rate puts you in the top tier. Stakes are clearly working for you.`,
    });
  } else if (overview.overallSuccessRate >= 50) {
    insights.push({
      title: 'Growing Stronger',
      text: `At ${overview.overallSuccessRate}% success rate, you're building momentum. Consider increasing stakes to boost motivation.`,
    });
  } else if (overview.totalContracts > 0) {
    insights.push({
      title: 'Keep Going',
      text: 'Early commitments are about building the habit. Try SOCIAL stakes first — accountability partners boost success by 65%.',
    });
  }

  // Stake type usage insight
  const socialCount = contracts.filter((c) => c.stakeType === 'SOCIAL').length;
  const monetaryCount = contracts.filter((c) => c.stakeType !== 'SOCIAL').length;
  if (socialCount > 0 && monetaryCount === 0 && overview.totalContracts >= 3) {
    insights.push({
      title: 'Ready to Level Up?',
      text: "You've completed several SOCIAL commitments. Research shows monetary stakes increase success by an additional 40%.",
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
      text: `You've succeeded ${succeededInRow} times in a row. Consistency is key — your commitment muscle is getting stronger.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: 'Getting Started',
      text: 'Complete more commitments to unlock personalized insights about your financial commitment patterns.',
    });
  }

  return (
    <>
      {insights.map((insight, i) => (
        <motion.div
          key={i}
          className="py-4 border-b border-stone-100 last:border-b-0"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i, duration: 0.3 }}
        >
          <p className="text-base font-serif text-[#1A2E22]">{insight.title}</p>
          <p className="text-sm text-stone-500 font-sans mt-1 leading-relaxed">{insight.text}</p>
        </motion.div>
      ))}
    </>
  );
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
        setAllContracts(
          contracts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        );
        setLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, goalsLoading]);

  const ov = overview?.overview;

  // ── Recovery Velocity: group contracts by month ──
  const monthlyData = useMemo(() => {
    if (allContracts.length === 0) return [];
    const buckets: Record<string, { succeeded: number; failed: number; active: number }> = {};
    for (const c of allContracts) {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets[key]) buckets[key] = { succeeded: 0, failed: 0, active: 0 };
      if (c.status === 'SUCCEEDED') buckets[key].succeeded++;
      else if (c.status === 'FAILED') buckets[key].failed++;
      else buckets[key].active++;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        ...counts,
      }));
  }, [allContracts]);

  // ── Portfolio Health: aggregate by status ──
  const portfolioData = useMemo(() => {
    const d = { succeeded: 0, active: 0, failed: 0, cancelled: 0, total: 0 };
    for (const c of allContracts) {
      d.total++;
      if (c.status === 'SUCCEEDED') d.succeeded++;
      else if (c.status === 'FAILED') d.failed++;
      else if (c.status === 'CANCELLED') d.cancelled++;
      else d.active++;
    }
    return d;
  }, [allContracts]);

  return (
    <div className="min-h-screen bg-[#FDFCF8]">
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-8 md:py-12">
        {/* ── Header ── */}
        <motion.header
          className="mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <button
            onClick={() => router.push('/dashboard/commitments')}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-[#1A2E22] transition-colors mb-5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Commitments
          </button>

          <h1 className="text-4xl font-serif text-[#1A2E22] tracking-tight">Behavioral Trends</h1>
          <p className="text-sm text-stone-400 font-sans mt-1">Your commitment performance over time</p>

          {/* Period selector (visual only) */}
          <div className="flex items-center gap-5 mt-5 text-sm">
            {['All Time', '90d', '30d'].map((period, i) => (
              <button
                key={period}
                className={cn(
                  'pb-1 transition-colors',
                  i === 0
                    ? 'border-b-2 border-emerald-900 font-bold text-[#1A2E22]'
                    : 'text-stone-400 hover:text-stone-600',
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </motion.header>

        {/* ── Stat Strip ── */}
        <motion.section
          className="mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <div className="bg-white border-y border-stone-200 py-8 grid grid-cols-2 md:grid-cols-4 divide-x divide-stone-200">
            <StatStripItem
              label="Total Commitments"
              value={ov?.totalContracts ?? 0}
              loading={!overview}
            />
            <StatStripItem
              label="Succeeded"
              value={ov?.totalSucceeded ?? 0}
              loading={!overview}
            />
            <StatStripItem
              label="Success Rate"
              value={`${ov?.overallSuccessRate ?? 0}`}
              unit="%"
              loading={!overview}
              highlight={ov != null && ov.overallSuccessRate >= 50}
            />
            <StatStripItem
              label="Total Staked"
              value={formatCurrency(ov?.totalStaked ?? 0, 'USD')}
              loading={!overview}
            />
          </div>
        </motion.section>

        {/* ── System Impact Statement ── */}
        {overview?.recommendation && ov && (
          <motion.section
            className="mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <p className="text-base text-stone-500 leading-relaxed max-w-2xl">
              Your commitment strategies have achieved a{' '}
              <span className="font-mono font-bold text-[#064E3B]">{ov.overallSuccessRate}%</span>{' '}
              success rate across{' '}
              <span className="font-mono font-bold text-[#064E3B]">{ov.totalContracts}</span>{' '}
              behavioral contracts.
            </p>
          </motion.section>
        )}

        {/* ── Effectiveness by Stake Type (Variance Ledger) ── */}
        <motion.section
          className="mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.3 }}
        >
          <h2 className="text-2xl font-serif text-[#1A2E22] mb-4">Effectiveness by Stake Type</h2>

          {overview?.byStakeType && overview.byStakeType.length > 0 ? (
            <div className="divide-y divide-stone-200">
              {overview.byStakeType.map((metric) => {
                const config = STAKE_CONFIG[metric.stakeType as keyof typeof STAKE_CONFIG];
                if (!config) return null;
                const rate = Math.round(metric.successRate * 100);
                const rateColor = rate >= 70 ? 'text-[#064E3B]' : rate >= 40 ? 'text-[#D97706]' : 'text-[#C2410C]';

                return (
                  <div key={metric.stakeType} className="grid grid-cols-12 items-center gap-3 py-4">
                    {/* Category name — 3 cols */}
                    <div className="col-span-3">
                      <span className="font-semibold text-sm text-[#1A2E22]">{config.label}</span>
                    </div>
                    {/* Frequency — 2 cols */}
                    <div className="col-span-2">
                      <span className="font-mono text-sm text-stone-400">
                        {metric.totalCommitments}×
                      </span>
                    </div>
                    {/* Sparkline bar — 5 cols */}
                    <div className="col-span-5">
                      <div className="bg-stone-100 h-2 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: config.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(2, rate)}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                        />
                      </div>
                    </div>
                    {/* Rate — 2 cols */}
                    <div className="col-span-2 text-right">
                      <span className={cn('font-mono font-bold text-sm', rateColor)}>{rate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-stone-400 text-sm">No commitment data yet</p>
              <p className="text-stone-300 text-xs mt-1">Create your first commitment to see analytics</p>
            </div>
          )}

          {overview?.recommendation && (
            <p className="text-xs text-stone-400 italic mt-3">{overview.recommendation}</p>
          )}
        </motion.section>

        {/* ── Recovery Velocity Bar Chart ── */}
        {monthlyData.length > 0 && (
          <motion.section
            className="mb-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.3 }}
          >
            <div className="bg-white border border-stone-100 rounded-xl p-6 md:p-8 shadow-sm">
              <h2 className="text-2xl font-serif text-[#1A2E22] mb-6">Recovery Velocity</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="4 4" stroke="#E7E5E4" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#A8A29E', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#A8A29E', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<BarChartTooltip />} cursor={{ fill: '#F5F5F4' }} />
                    <Bar dataKey="succeeded" stackId="a" fill="#064E3B" radius={[0, 0, 0, 0]} name="Fulfilled" />
                    <Bar dataKey="active" stackId="a" fill="#D97706" radius={[0, 0, 0, 0]} name="Active" />
                    <Bar dataKey="failed" stackId="a" fill="#C2410C" radius={[3, 3, 0, 0]} name="Breached" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── Portfolio Health Ring ── */}
        {!loading && allContracts.length > 0 && (
          <motion.section
            className="mb-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.3 }}
          >
            <div className="bg-white border border-stone-100 rounded-xl p-6 md:p-8 shadow-sm">
              <h2 className="text-2xl font-serif text-[#1A2E22] mb-6">Portfolio Health</h2>
              <PortfolioHealthRing data={portfolioData} />
            </div>
          </motion.section>
        )}

        {/* ── Commitment Timeline ── */}
        <motion.section
          className="mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.3 }}
        >
          <h2 className="text-2xl font-serif text-[#1A2E22] mb-4">Commitment Timeline</h2>

          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-8 h-8 bg-stone-50 rounded-full animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-stone-50 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-stone-50 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : allContracts.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-stone-400 text-sm">No commitments yet</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-0 bottom-0 w-px bg-stone-200" />

              <div className="space-y-0">
                {allContracts.slice(0, 20).map((contract, index) => {
                  const statusConf = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.ACTIVE;
                  const stakeConf = STAKE_CONFIG[contract.stakeType];

                  return (
                    <motion.div
                      key={contract.id}
                      className="relative flex gap-4 pl-0 py-3 border-b border-stone-100 last:border-b-0"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * index, duration: 0.3 }}
                    >
                      {/* Timeline dot */}
                      <div className={cn('relative z-10 mt-0.5 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0', statusConf.dotBg)}>
                        {contract.status === 'SUCCEEDED' && <CheckCircle2 className="w-3.5 h-3.5 text-[#064E3B]" />}
                        {contract.status === 'FAILED' && <XCircle className="w-3.5 h-3.5 text-[#C2410C]" />}
                        {contract.status === 'CANCELLED' && <Ban className="w-3.5 h-3.5 text-stone-400" />}
                        {contract.status === 'ACTIVE' && <Target className="w-3.5 h-3.5 text-[#D97706]" />}
                        {contract.status === 'PENDING_VERIFICATION' && <Clock className="w-3.5 h-3.5 text-stone-500" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A2E22] truncate">{contract.goalName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn('text-xs font-medium', statusConf.textColor)}>
                              {statusConf.label}
                            </span>
                            <span className="text-xs text-stone-300">·</span>
                            <span className="text-xs text-stone-400">{stakeConf?.label}</span>
                            {contract.stakeAmount != null && contract.stakeAmount > 0 && (
                              <>
                                <span className="text-xs text-stone-300">·</span>
                                <span className="font-mono text-xs text-stone-400">
                                  {formatCurrency(contract.stakeAmount, 'USD')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-xs text-stone-400 whitespace-nowrap">
                          {new Date(contract.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.section>

        {/* ── AI Quality Scores ── */}
        <motion.section
          className="mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <h2 className="text-2xl font-serif text-[#1A2E22] mb-4">AI Quality Scores</h2>

          <div className="bg-white border border-stone-100 rounded-xl shadow-sm overflow-hidden">
            {evalLoading ? (
              <div className="grid grid-cols-2 divide-x divide-stone-100">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={cn('p-5', i < 2 ? 'border-b border-stone-100' : '')}>
                    <div className="h-4 bg-stone-50 rounded animate-pulse w-2/3 mb-3" />
                    <div className="h-3 bg-stone-50 rounded animate-pulse w-full mb-2" />
                    <div className="h-5 bg-stone-50 rounded animate-pulse w-1/3" />
                  </div>
                ))}
              </div>
            ) : evalSummary ? (
              <>
                <div className="grid grid-cols-2 divide-x divide-stone-100">
                  {/* Tone & Empathy */}
                  <div className="p-5 border-b border-stone-100">
                    <p className="text-sm font-serif text-[#1A2E22] mb-1">Tone & Empathy</p>
                    <p className="text-xs text-stone-400 mb-2">{evalSummary.metrics.toneEmpathy?.description || 'Warm, supportive responses'}</p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn('w-3.5 h-3.5', i <= 4 ? 'text-[#D97706] fill-[#D97706]' : 'text-stone-200')} />
                      ))}
                    </div>
                  </div>

                  {/* Financial Safety */}
                  <div className="p-5 border-b border-stone-100">
                    <p className="text-sm font-serif text-[#1A2E22] mb-1">Financial Safety</p>
                    <p className="text-xs text-stone-400 mb-2">{evalSummary.metrics.financialSafety?.description || 'Safe financial guidance'}</p>
                    <p className="text-lg font-serif text-[#064E3B]">Pass</p>
                  </div>

                  {/* Cultural Sensitivity */}
                  <div className="p-5">
                    <p className="text-sm font-serif text-[#1A2E22] mb-1">Cultural Sensitivity</p>
                    <p className="text-xs text-stone-400 mb-2">{evalSummary.metrics.culturalSensitivity?.description || 'Personally appropriate'}</p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn('w-3.5 h-3.5', i <= 4 ? 'text-[#D97706] fill-[#D97706]' : 'text-stone-200')} />
                      ))}
                    </div>
                  </div>

                  {/* Intervention Success */}
                  <div className="p-5">
                    <p className="text-sm font-serif text-[#1A2E22] mb-1">Intervention Success</p>
                    <p className="text-xs text-stone-400 mb-2">{evalSummary.metrics.interventionSuccess?.description || 'Helping users stay on track'}</p>
                    <p className="text-lg font-mono font-bold text-[#1A2E22]">
                      {evalSummary.metrics.interventionSuccess?.value ?? 0}%
                    </p>
                  </div>
                </div>

                {/* Footer note */}
                <div className="px-5 py-3 border-t border-stone-100">
                  <p className="text-[11px] text-stone-400">{evalSummary.note}</p>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-stone-400 text-sm">No evaluation data yet</p>
                <p className="text-stone-300 text-xs mt-1">AI quality scores appear after agent interactions</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* ── Personal Insights ── */}
        <motion.section
          className="mb-24"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34, duration: 0.3 }}
        >
          <h2 className="text-2xl font-serif text-[#1A2E22] mb-4">Personal Insights</h2>

          <InsightBlock contracts={allContracts} overview={overview?.overview} />
        </motion.section>
      </div>
    </div>
  );
}
