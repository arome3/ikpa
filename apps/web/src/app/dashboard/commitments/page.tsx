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
  Trophy,
  Target,
  BarChart3,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Medal,
  Award,
  Flame,
  Share2,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useCommitments } from '@/hooks/useCommitments';
import { useGoals } from '@/hooks/useFinance';
import type { CommitmentContract, StakeEffectiveness } from '@/hooks/useCommitments';

// ============================================
// STAKE TYPE CONFIG
// ============================================

const STAKE_CONFIG = {
  SOCIAL: { label: 'Social', icon: Users, color: 'purple', gradient: 'from-purple-500/20 to-violet-500/10', border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/20' },
  ANTI_CHARITY: { label: 'Anti-Charity', icon: HeartCrack, color: 'red', gradient: 'from-red-500/20 to-rose-500/10', border: 'border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/20' },
  LOSS_POOL: { label: 'Loss Pool', icon: Lock, color: 'amber', gradient: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/20' },
} as const;

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', icon: Target, color: 'text-green-400', bg: 'bg-green-500/20' },
  PENDING_VERIFICATION: { label: 'Pending', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  SUCCEEDED: { label: 'Succeeded', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  FAILED: { label: 'Failed', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  CANCELLED: { label: 'Cancelled', icon: Ban, color: 'text-slate-400', bg: 'bg-slate-500/20' },
} as const;

// ============================================
// COMMITMENT DASHBOARD
// ============================================

export default function CommitmentDashboard() {
  const router = useRouter();
  const { getStakesByGoal, cancelStake, isCancellingStake, getEffectiveness } = useCommitments();
  const { items: goals, isLoading: goalsLoading } = useGoals();

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
  const successCount = allContracts.filter((c) => c.status === 'SUCCEEDED').length;
  const successRate = allContracts.length > 0 ? Math.round((successCount / allContracts.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-amber-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto md:max-w-4xl px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/20 rounded-xl backdrop-blur-sm">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Commitments</h1>
                <p className="text-sm text-slate-400">Stakes that drive results</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/dashboard/commitments/groups')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-all border border-white/10"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/dashboard/commitments/analytics')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-all border border-white/10"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/dashboard/commitments/new')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-purple-500/25"
              >
                <Plus className="w-4 h-4" />
                New Stake
              </button>
            </div>
          </div>
        </motion.header>

        {/* Quick Stats */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-bold text-white">{activeContracts.length}</p>
              <p className="text-xs text-slate-400 mt-1">Active</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-bold text-white">{successRate}%</p>
              <p className="text-xs text-slate-400 mt-1">Success Rate</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(totalStaked, 'USD')}</p>
              <p className="text-xs text-slate-400 mt-1">Staked</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-bold text-orange-400 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5" />0
              </p>
              <p className="text-xs text-slate-400 mt-1">Streak</p>
            </div>
          </div>
        </motion.section>

        {/* Active Contracts */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-green-400" />
            Active Contracts
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : activeContracts.length === 0 ? (
            <motion.div
              className="p-8 rounded-xl bg-white/5 border border-white/10 text-center"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <div className="inline-flex p-3 bg-purple-500/20 rounded-full mb-3">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-white font-medium">No active commitments</p>
              <p className="text-sm text-slate-400 mt-1 mb-4">
                Create your first staked commitment to boost goal achievement by 3x
              </p>
              <button
                onClick={() => router.push('/dashboard/commitments/new')}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium rounded-xl"
              >
                Create Commitment
              </button>
            </motion.div>
          ) : (
            <div className="space-y-3">
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

        {/* Effectiveness Chart */}
        {effectiveness && effectiveness.metrics.some((m) => m.totalCommitments > 0) && (
          <motion.section
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-400" />
              Effectiveness
            </h2>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="space-y-3">
                {effectiveness.metrics
                  .filter((m) => m.totalCommitments > 0)
                  .map((metric) => {
                    const config = STAKE_CONFIG[metric.stakeType as keyof typeof STAKE_CONFIG];
                    return (
                      <div key={metric.stakeType} className="flex items-center gap-3">
                        <span className={cn('text-xs font-medium px-2 py-1 rounded-full', config?.bg, config?.text)}>
                          {config?.label || metric.stakeType}
                        </span>
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round(metric.successRate * 100)}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                          />
                        </div>
                        <span className="text-sm font-medium text-white w-12 text-right">
                          {Math.round(metric.successRate * 100)}%
                        </span>
                      </div>
                    );
                  })}
              </div>
              <p className="text-xs text-slate-400 mt-3 italic">{effectiveness.recommendation}</p>
            </div>
          </motion.section>
        )}

        {/* Past Contracts */}
        {completedContracts.length > 0 && (
          <motion.section
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              History
            </h2>
            <div className="space-y-2">
              {completedContracts.slice(0, 5).map((contract) => {
                const statusConf = STATUS_CONFIG[contract.status];
                const stakeConf = STAKE_CONFIG[contract.stakeType];
                const StatusIcon = statusConf.icon;
                return (
                  <div key={contract.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className={cn('p-1.5 rounded-lg', statusConf.bg)}>
                      <StatusIcon className={cn('w-4 h-4', statusConf.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{contract.goalName}</p>
                      <p className="text-xs text-slate-400">{stakeConf.label} &middot; {new Date(contract.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {contract.achievementTier === 'GOLD' && (
                        <span className="flex items-center gap-1 text-xs font-medium text-yellow-400">
                          <Medal className="w-3.5 h-3.5" /> Gold
                        </span>
                      )}
                      {contract.achievementTier === 'SILVER' && (
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-300">
                          <Award className="w-3.5 h-3.5" /> Silver {contract.tierRefundPercentage ? `(${contract.tierRefundPercentage}% refund)` : ''}
                        </span>
                      )}
                      {contract.achievementTier === 'BRONZE' && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Award className="w-3.5 h-3.5" /> Bronze {contract.tierRefundPercentage ? `(${contract.tierRefundPercentage}% refund)` : ''}
                        </span>
                      )}
                      <span className={cn('text-xs font-medium', statusConf.color)}>{statusConf.label}</span>
                      {contract.status === 'SUCCEEDED' && (
                        <button className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Share achievement">
                          <Share2 className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
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
  const StakeIcon = stakeConf.icon;
  const isUrgent = contract.daysRemaining <= 7;

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-xl border backdrop-blur-sm p-4',
        `bg-gradient-to-br ${stakeConf.gradient} ${stakeConf.border}`,
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
    >
      {/* Stake type badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', stakeConf.bg)}>
            <StakeIcon className={cn('w-5 h-5', stakeConf.text)} />
          </div>
          <div>
            <p className="font-semibold text-white">{contract.goalName}</p>
            <p className={cn('text-xs font-medium', stakeConf.text)}>{stakeConf.label} Stake</p>
          </div>
        </div>
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-bold',
          stakeConf.bg, stakeConf.text,
        )}>
          {Math.round(contract.successProbability * 100)}% likely
        </span>
      </div>

      {/* Details */}
      <div className="flex items-center gap-4 text-sm mb-3">
        {contract.stakeAmount && (
          <span className="text-slate-300">
            Staked: <span className="text-white font-medium">{formatCurrency(contract.stakeAmount, 'USD')}</span>
          </span>
        )}
        <span className="text-slate-400">&middot;</span>
        <span className={cn('flex items-center gap-1', isUrgent ? 'text-amber-400' : 'text-slate-300')}>
          <Clock className="w-3.5 h-3.5" />
          {contract.daysRemaining}d left
        </span>
      </div>

      {/* Countdown bar */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <motion.div
          className={cn(
            'h-full rounded-full',
            isUrgent ? 'bg-gradient-to-r from-amber-500 to-orange-400' : `bg-gradient-to-r from-purple-500 to-violet-400`,
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(5, 100 - (contract.daysRemaining / 90) * 100)}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>

      {/* Self-verify banner */}
      {contract.selfVerifyOfferedAt && contract.selfVerifyExpiresAt && new Date(contract.selfVerifyExpiresAt) > new Date() && (
        <div className="mt-3 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30">
          <p className="text-xs text-amber-300 font-medium">
            Self-verify available - your referee hasn&apos;t responded yet.
          </p>
        </div>
      )}

      {/* Message + Referee */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 italic truncate max-w-[70%]">
          &ldquo;{contract.message.headline}&rdquo;
        </p>
        {contract.referee && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> {contract.referee.name}
          </span>
        )}
      </div>
    </motion.div>
  );
}
