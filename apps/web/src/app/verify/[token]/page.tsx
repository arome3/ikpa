'use client';

import { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Users,
  HeartCrack,
  Lock,
  Target,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

// ============================================
// TYPES
// ============================================

interface PendingVerification {
  contractId: string;
  goalName: string;
  userName: string;
  userEmail: string;
  stakeType: string;
  stakeAmount: number | null;
  deadline: string;
  daysOverdue: number;
  createdAt: string;
}

interface VerificationResult {
  success: boolean;
  contractId: string;
  decision: boolean;
  newStatus: string;
  message: { headline: string; subtext: string };
  stakeProcessed?: number;
}

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T };
  return (r?.data ?? res) as T;
}

// ============================================
// STAKE CONFIG
// ============================================

const STAKE_CONFIG: Record<string, { icon: typeof Users; color: string; bg: string; label: string }> = {
  SOCIAL: { icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Social Stake' },
  ANTI_CHARITY: { icon: HeartCrack, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Anti-Charity' },
  LOSS_POOL: { icon: Lock, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Loss Pool' },
};

// ============================================
// VERIFICATION CARD
// ============================================

function VerificationCard({
  item,
  token,
  onVerified,
}: {
  item: PendingVerification;
  token: string;
  onVerified: (contractId: string, result: VerificationResult) => void;
}) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const conf = STAKE_CONFIG[item.stakeType] || STAKE_CONFIG.SOCIAL;
  const StakeIcon = conf.icon;
  const deadlineDate = new Date(item.deadline);
  const isOverdue = item.daysOverdue > 0;

  const handleVerify = async (decision: boolean) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiClient.post(`/commitment/verify/${item.contractId}`, {
        token,
        decision,
        notes: notes.trim() || undefined,
      });
      const result = unwrap<VerificationResult>(res);
      onVerified(item.contractId, result);
    } catch (err: any) {
      setSubmitError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('p-1.5 rounded-lg', conf.bg)}>
            <StakeIcon className={cn('h-4 w-4', conf.color)} />
          </div>
          <span className={cn('text-xs font-medium', conf.color)}>{conf.label}</span>
        </div>
        <h3 className="text-lg font-semibold text-white">{item.goalName}</h3>
        <p className="text-sm text-slate-400 mt-1">
          Committed by <span className="text-white">{item.userName}</span>
        </p>
      </div>

      {/* Details */}
      <div className="p-4 border-b border-white/10 space-y-2">
        {item.stakeAmount != null && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Stake</span>
            <span className="text-white font-medium">${item.stakeAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Deadline</span>
          <span className={cn('font-medium', isOverdue ? 'text-red-400' : 'text-white')}>
            {deadlineDate.toLocaleDateString()}
            {isOverdue && ` (${item.daysOverdue}d overdue)`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Created</span>
          <span className="text-slate-300">{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="p-4 border-b border-white/10">
        <label className="text-sm font-medium text-slate-300 mb-2 block flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this verification..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="p-4">
        {submitError && (
          <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300">{submitError}</p>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => handleVerify(true)}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:from-emerald-500 hover:to-green-500 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Goal Achieved
          </button>
          <button
            onClick={() => handleVerify(false)}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:from-red-500 hover:to-rose-500 transition-all disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Not Achieved
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// RESULT DISPLAY
// ============================================

function VerificationSuccess({ result }: { result: VerificationResult }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-8"
    >
      <div className={cn(
        'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
        result.decision ? 'bg-emerald-500/20' : 'bg-red-500/20'
      )}>
        {result.decision
          ? <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          : <XCircle className="h-8 w-8 text-red-400" />
        }
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{result.message.headline}</h3>
      <p className="text-sm text-slate-400 max-w-xs mx-auto">{result.message.subtext}</p>
      {result.stakeProcessed != null && result.stakeProcessed > 0 && (
        <p className="text-sm text-amber-400 mt-3">
          ${result.stakeProcessed.toLocaleString()} stake processed
        </p>
      )}
    </motion.div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function RefereeVerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingVerification[]>([]);
  const [refereeName, setRefereeName] = useState('');
  const [results, setResults] = useState<Record<string, VerificationResult>>({});

  // Fetch pending verifications
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await apiClient.get(`/commitment/referee/pending?token=${encodeURIComponent(token)}`);
        const data = unwrap<{
          pending: PendingVerification[];
          total: number;
          refereeId: string;
          refereeName: string;
        }>(res);
        setPending(data.pending);
        setRefereeName(data.refereeName);
      } catch (err: any) {
        setError(err?.message || 'Invalid or expired verification link.');
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
  }, [token]);

  const handleVerified = (contractId: string, result: VerificationResult) => {
    setResults((prev) => ({ ...prev, [contractId]: result }));
  };

  const remainingPending = pending.filter((p) => !results[p.contractId]);
  const completedVerifications = pending.filter((p) => results[p.contractId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Verification Error</h2>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-xl font-bold text-white">
          Hi {refereeName} <span className="text-2xl">&#128075;</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {remainingPending.length > 0
            ? `You have ${remainingPending.length} commitment${remainingPending.length !== 1 ? 's' : ''} to verify.`
            : 'All verifications complete!'}
        </p>
      </motion.div>

      {/* Pending Items */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {remainingPending.map((item) => (
            <VerificationCard
              key={item.contractId}
              item={item}
              token={token}
              onVerified={handleVerified}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Completed Results */}
      {completedVerifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Completed</h3>
          {completedVerifications.map((item) => (
            <VerificationSuccess key={item.contractId} result={results[item.contractId]} />
          ))}
        </motion.div>
      )}

      {/* All done */}
      {remainingPending.length === 0 && completedVerifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center"
        >
          <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-300 font-medium">All verifications submitted. Thank you!</p>
          <p className="text-xs text-slate-400 mt-1">You can close this page.</p>
        </motion.div>
      )}

      {/* No pending */}
      {pending.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-slate-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No pending verifications</h3>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            There are no commitments awaiting your verification at this time.
          </p>
        </div>
      )}
    </div>
  );
}
