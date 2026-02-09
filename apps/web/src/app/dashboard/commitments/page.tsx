'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Plus,
  Users,
  HeartCrack,
  Lock,
  Clock,
  Target,
  BarChart3,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Medal,
  Award,
  Share2,
  AlertTriangle,
  Scan,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useCommitments, useSlipDetection } from '@/hooks/useCommitments';
import { useGoals } from '@/hooks/useFinance';
import type { CommitmentContract, StakeEffectiveness, SlipAlert } from '@/hooks/useCommitments';

// ============================================
// STAKE TYPE CONFIG
// ============================================

const STAKE_CONFIG = {
  SOCIAL: {
    label: 'Social Accountability',
    icon: Users,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    badgeColor: 'bg-slate-100 text-slate-700 border border-slate-200',
    barColor: 'bg-emerald-600',
  },
  ANTI_CHARITY: {
    label: 'Anti-Charity Escrow',
    icon: HeartCrack,
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-200',
    badgeColor: 'bg-orange-50 text-orange-800 border border-orange-200',
    barColor: 'bg-orange-600',
  },
  LOSS_POOL: {
    label: 'Loss Pool',
    icon: Lock,
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200',
    barColor: 'bg-amber-600',
  },
} as const;

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', icon: Target, color: 'text-emerald-700', bg: 'bg-emerald-50', badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  PENDING_VERIFICATION: { label: 'Pending', icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50', badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200' },
  SUCCEEDED: { label: 'Fulfilled', icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  FAILED: { label: 'Breached', icon: XCircle, color: 'text-red-700', bg: 'bg-red-50', badgeColor: 'bg-red-50 text-red-700 border border-red-200' },
  CANCELLED: { label: 'Withdrawn', icon: Ban, color: 'text-stone-500', bg: 'bg-stone-50', badgeColor: 'bg-stone-50 text-stone-500 border border-stone-200' },
} as const;

// ============================================
// COMMITMENT DASHBOARD
// ============================================

export default function CommitmentDashboard() {
  const router = useRouter();
  const { getStakesByGoal, cancelStake, isCancellingStake, getEffectiveness } = useCommitments();
  const { items: goals, isLoading: goalsLoading } = useGoals();
  const { alerts: slipAlerts, triggerScan, isScanning } = useSlipDetection();

  const [allContracts, setAllContracts] = useState<CommitmentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [effectiveness, setEffectiveness] = useState<{ metrics: StakeEffectiveness[]; recommendation: string } | null>(null);

  // Fetch all contracts across all goals
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

  // Fetch effectiveness
  useEffect(() => {
    getEffectiveness().then(setEffectiveness).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeContracts = allContracts.filter((c) => c.status === 'ACTIVE' || c.status === 'PENDING_VERIFICATION');
  const completedContracts = allContracts.filter((c) => c.status === 'SUCCEEDED' || c.status === 'FAILED' || c.status === 'CANCELLED');
  const totalStaked = activeContracts.reduce((sum, c) => sum + (c.stakeAmount || 0), 0);
  const atRiskAmount = activeContracts.filter((c) => c.daysRemaining <= 7).reduce((sum, c) => sum + (c.stakeAmount || 0), 0);
  const successCount = allContracts.filter((c) => c.status === 'SUCCEEDED').length;
  const successRate = allContracts.length > 0 ? Math.round((successCount / allContracts.length) * 100) : 0;
  const breachCount = allContracts.filter((c) => c.status === 'FAILED').length;

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-12 py-8">
      {/* Header — The Escrow Office */}
      <motion.header
        className="mb-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-[#1A2E22] tracking-tight">
              Active Contracts
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              Binding agreements and accountability protocols.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard/commitments/groups')}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 hover:border-stone-400 text-stone-700 px-4 py-2 text-sm font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              Groups
            </button>
            <button
              onClick={() => router.push('/dashboard/commitments/analytics')}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 hover:border-stone-400 text-stone-700 px-4 py-2 text-sm font-medium transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </button>
            <button
              onClick={() => router.push('/dashboard/commitments/new')}
              className="inline-flex items-center gap-2 rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-5 py-2.5 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Draft New Contract
            </button>
          </div>
        </div>
      </motion.header>

      {/* Escrow Summary — Value Locked Strip */}
      <motion.section
        className="border-y border-stone-200 py-8 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex flex-col sm:flex-row sm:divide-x divide-stone-200 gap-6 sm:gap-0">
          <div className="sm:pr-8">
            <p className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-1">
              Total Value Locked
            </p>
            <span className="text-5xl font-serif text-[#1A2E22] tabular-nums">
              {formatCurrency(totalStaked, 'USD')}
            </span>
          </div>
          <div className="sm:px-8">
            <p className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-1">
              At Risk
            </p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-mono text-orange-700 tabular-nums">
                {formatCurrency(atRiskAmount, 'USD')}
              </span>
              {breachCount > 0 && (
                <span className="text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5">
                  {breachCount} breach{breachCount !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="sm:pl-8">
            <p className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-1">
              Contract Success Rate
            </p>
            <span className="text-3xl font-serif text-[#064E3B] tabular-nums">
              {successRate}%
            </span>
          </div>
        </div>
      </motion.section>

      {/* Compliance Notices — Slip Detection */}
      {activeContracts.length > 0 && (
        <motion.section
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif text-[#1A2E22]">
              Compliance Notices
            </h2>
            <button
              onClick={() => triggerScan()}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 hover:border-stone-400 text-stone-700 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Scan className={cn('w-3.5 h-3.5', isScanning && 'animate-spin')} />
              {isScanning ? 'Scanning...' : 'Run Compliance Scan'}
            </button>
          </div>
          {slipAlerts.length > 0 ? (
            <div className="space-y-3">
              {slipAlerts.filter((a) => !a.readAt).slice(0, 3).map((alert, i) => (
                <SlipAlertCard key={alert.id} alert={alert} index={i} />
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-stone-50 border border-stone-200 text-center">
              <p className="text-sm text-stone-500">
                {isScanning ? 'Scanning contracts for compliance drift...' : 'No compliance notices. Run a scan to check for goal drift.'}
              </p>
            </div>
          )}
        </motion.section>
      )}

      {/* Active Contracts */}
      <motion.section
        className="mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-xl font-serif text-[#1A2E22] mb-4">
          Active Contracts
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
          </div>
        ) : activeContracts.length === 0 ? (
          <motion.div
            className="p-8 rounded-lg bg-white border border-stone-200 shadow-sm text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="inline-flex p-3 bg-stone-100 rounded-full mb-3">
              <ShieldCheck className="w-6 h-6 text-stone-500" />
            </div>
            <p className="text-[#1A2E22] font-medium">No active contracts</p>
            <p className="text-sm text-stone-500 mt-1 mb-4">
              Draft your first binding commitment to boost goal achievement by 3x
            </p>
            <button
              onClick={() => router.push('/dashboard/commitments/new')}
              className="rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-5 py-2.5 text-sm font-medium transition-colors"
            >
              Draft Contract
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {activeContracts.map((contract, index) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                index={index}
                onCancel={async (id) => {
                  await cancelStake(id);
                  setAllContracts((prev) => prev.map((c) => c.id === id ? { ...c, status: 'CANCELLED' as const } : c));
                }}
                isCancelling={isCancellingStake}
              />
            ))}
          </div>
        )}
      </motion.section>

      {/* Contract Effectiveness */}
      {effectiveness && effectiveness.metrics.some((m) => m.totalCommitments > 0) && (
        <motion.section
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-serif text-[#1A2E22] mb-4">
            Contract Effectiveness
          </h2>

          <div className="p-6 rounded-lg bg-white border border-stone-200 shadow-sm">
            <div className="space-y-4">
              {effectiveness.metrics
                .filter((m) => m.totalCommitments > 0)
                .map((metric) => {
                  const config = STAKE_CONFIG[metric.stakeType as keyof typeof STAKE_CONFIG];
                  return (
                    <div key={metric.stakeType} className="flex items-center gap-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', config?.badgeColor)}>
                        {config?.label || metric.stakeType}
                      </span>
                      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', config?.barColor || 'bg-emerald-600')}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(metric.successRate * 100)}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                      </div>
                      <span className="text-sm font-mono text-stone-700 w-12 text-right tabular-nums">
                        {Math.round(metric.successRate * 100)}%
                      </span>
                    </div>
                  );
                })}
            </div>
            <p className="text-sm text-stone-400 mt-4 italic font-serif">{effectiveness.recommendation}</p>
          </div>
        </motion.section>
      )}

      {/* Archived Contracts */}
      {completedContracts.length > 0 && (
        <motion.section
          className="mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xl font-serif text-[#1A2E22] mb-4">
            Archived Contracts
          </h2>
          <div className="space-y-3">
            {completedContracts.slice(0, 5).map((contract) => {
              const statusConf = STATUS_CONFIG[contract.status];
              const stakeConf = STAKE_CONFIG[contract.stakeType];
              const StatusIcon = statusConf.icon;
              return (
                <div key={contract.id} className="flex items-center gap-3 p-4 rounded-lg bg-white border border-stone-200 shadow-sm">
                  <div className={cn('p-1.5 rounded-lg', statusConf.bg)}>
                    <StatusIcon className={cn('w-4 h-4', statusConf.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A2E22] truncate">{contract.goalName}</p>
                    <p className="text-xs text-stone-400">{stakeConf.label} &middot; {new Date(contract.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {contract.achievementTier === 'GOLD' && (
                      <span className="flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
                        <Medal className="w-3.5 h-3.5" /> Gold
                      </span>
                    )}
                    {contract.achievementTier === 'SILVER' && (
                      <span className="flex items-center gap-1 text-xs font-medium bg-stone-50 text-stone-600 border border-stone-200 rounded-full px-2.5 py-0.5">
                        <Award className="w-3.5 h-3.5" /> Silver {contract.tierRefundPercentage ? `(${contract.tierRefundPercentage}%)` : ''}
                      </span>
                    )}
                    {contract.achievementTier === 'BRONZE' && (
                      <span className="flex items-center gap-1 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5">
                        <Award className="w-3.5 h-3.5" /> Bronze {contract.tierRefundPercentage ? `(${contract.tierRefundPercentage}%)` : ''}
                      </span>
                    )}
                    <span className={cn('text-xs font-medium rounded-full px-2.5 py-0.5', statusConf.badgeColor)}>{statusConf.label}</span>
                    {contract.status === 'SUCCEEDED' && (
                      <button className="p-1 rounded-full hover:bg-stone-100 transition-colors" title="Share achievement">
                        <Share2 className="w-3.5 h-3.5 text-stone-400 hover:text-stone-600" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </div>
  );
}

// ============================================
// CONTRACT CARD COMPONENT
// ============================================

function ContractCard({
  contract,
  index,
}: {
  contract: CommitmentContract;
  index: number;
  onCancel: (id: string) => Promise<void>;
  isCancelling: boolean;
}) {
  const stakeConf = STAKE_CONFIG[contract.stakeType];
  const isUrgent = contract.daysRemaining <= 7;
  const deadlineDate = new Date(contract.createdAt);
  deadlineDate.setDate(deadlineDate.getDate() + (contract.daysRemaining || 0));

  return (
    <motion.div
      className="relative bg-white border border-stone-200 rounded-lg p-8 shadow-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.05 * index }}
    >
      {/* Decorative corner ornaments */}
      <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-stone-300" />
      <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-stone-300" />
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-stone-300" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-stone-300" />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-serif text-lg text-[#1A2E22]">{contract.goalName}</h3>
          <span className={cn('inline-flex text-xs font-medium rounded-full px-2.5 py-0.5 mt-1', stakeConf.badgeColor)}>
            {stakeConf.label}
          </span>
        </div>
        <span className="text-xs font-mono bg-stone-50 border border-stone-200 rounded-full px-3 py-1 text-stone-600 tabular-nums">
          {Math.round(contract.successProbability * 100)}% likely
        </span>
      </div>

      {/* Contract oath */}
      <p className="text-sm text-stone-600 italic mb-5" style={{ fontFamily: 'Merriweather, serif' }}>
        &ldquo;I hereby promise to achieve {contract.goalName} by {deadlineDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, binding {contract.stakeAmount ? formatCurrency(contract.stakeAmount, 'USD') : 'my word'} in escrow under {stakeConf.label.toLowerCase()} terms.&rdquo;
      </p>

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {contract.stakeAmount && (
          <div>
            <p className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-0.5">Value Locked</p>
            <p className="text-sm font-mono text-[#1A2E22] tabular-nums">{formatCurrency(contract.stakeAmount, 'USD')}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-bold tracking-widest text-stone-400 uppercase mb-0.5">Time Remaining</p>
          <p className={cn('text-sm font-mono tabular-nums', isUrgent ? 'text-orange-700' : 'text-[#1A2E22]')}>
            {contract.daysRemaining} days
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-4">
        <motion.div
          className={cn(
            'h-full rounded-full',
            isUrgent ? 'bg-orange-600' : 'bg-[#064E3B]',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(5, 100 - (contract.daysRemaining / 90) * 100)}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      {/* Self-verify banner */}
      {contract.selfVerifyOfferedAt && contract.selfVerifyExpiresAt && new Date(contract.selfVerifyExpiresAt) > new Date() && (
        <div className="mt-2 mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-800 font-medium">
            Self-verification available — your referee has not yet responded.
          </p>
        </div>
      )}

      {/* Footer: message + referee */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
        <p className="text-xs text-stone-400 italic truncate max-w-[70%]">
          &ldquo;{contract.message.headline}&rdquo;
        </p>
        {contract.referee && (
          <span className="text-xs text-stone-500">
            Witnessed by: <span className="font-medium text-stone-600">{contract.referee.name}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// SLIP ALERT CARD COMPONENT
// ============================================

const RISK_COLORS = {
  high: { accent: 'border-l-4 border-red-400', bg: 'bg-red-50', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  medium: { accent: 'border-l-4 border-amber-400', bg: 'bg-amber-50', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  low: { accent: 'border-l-4 border-blue-400', bg: 'bg-blue-50', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  unknown: { accent: 'border-l-4 border-stone-400', bg: 'bg-stone-50', text: 'text-stone-700', badge: 'bg-stone-100 text-stone-600' },
} as const;

function SlipAlertCard({ alert, index }: { alert: SlipAlert; index: number }) {
  const colors = RISK_COLORS[alert.riskLevel] || RISK_COLORS.unknown;

  return (
    <motion.div
      className={cn(
        'p-4 rounded-r-lg',
        colors.accent,
        colors.bg,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.05 * index }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0', colors.text)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-stone-800">Compliance Warning: {alert.title}</p>
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase', colors.badge)}>
              {alert.riskLevel}
            </span>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed line-clamp-2 font-serif">{alert.message}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-stone-400">
              {alert.goalName} &middot; {new Date(alert.createdAt).toLocaleDateString()}
            </p>
            <button className="text-xs font-medium text-orange-700 underline underline-offset-2 hover:text-orange-800 transition-colors">
              View Breach
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
