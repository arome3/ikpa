'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Fish, ChevronRight, List, Bot, Calendar } from 'lucide-react';
import { useShark } from '@/hooks/useShark';
import {
  SharkSummaryCard,
  AuditTriggerCard,
  SubscriptionCard,
} from '@/components/shark';
import { OverlapWarning } from '@/components/shark/OverlapWarning';
import { SavingsHistory } from '@/components/shark/SavingsHistory';

export default function SharkCommandCenter() {
  const router = useRouter();
  const {
    subscriptions,
    summary,
    pendingReview,
    isLoadingSubscriptions,
    triggerAudit,
    isAuditing,
    auditResult,
    overlaps,
    history,
  } = useShark({ limit: 50 });

  const zombies = subscriptions.filter((s) => s.status === 'ZOMBIE');
  const previewZombies = zombies.slice(0, 3);

  const handleScan = async (force?: boolean) => {
    try {
      await triggerAudit(force);
    } catch (err) {
      console.error('Audit failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-teal-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-cyan-500/20 rounded-xl backdrop-blur-sm">
              <Fish className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Shark Auditor
              </h1>
              <p className="text-sm text-slate-400">
                Hunt zombie subscriptions
              </p>
            </div>
          </div>
        </motion.header>

        {/* Summary Card */}
        <section className="mb-6">
          <SharkSummaryCard
            summary={summary}
            isLoading={isLoadingSubscriptions}
            pendingCount={pendingReview.length}
            onScan={() => handleScan()}
            onReview={() => router.push('/dashboard/shark/review')}
          />
        </section>

        {/* Audit Trigger */}
        <section className="mb-6">
          <AuditTriggerCard
            onTrigger={handleScan}
            isAuditing={isAuditing}
            lastResult={auditResult}
          />
        </section>

        {/* Overlap Warnings */}
        {overlaps.length > 0 && (
          <motion.section
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-lg font-semibold text-white mb-3">Overlapping Services</h2>
            <OverlapWarning
              overlaps={overlaps}
              currency={summary?.currency ?? 'USD'}
              onReview={() => router.push('/dashboard/shark/review')}
            />
          </motion.section>
        )}

        {/* Zombie Preview */}
        {previewZombies.length > 0 && (
          <motion.section
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">
                Zombies Found
              </h2>
              {zombies.length > 3 && (
                <button
                  onClick={() => router.push('/dashboard/shark/review')}
                  className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  Review all
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {previewZombies.map((sub, i) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  onClick={() => router.push(`/dashboard/shark/subscriptions/${sub.id}`)}
                  delay={0.05 * i}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* No subscriptions empty state */}
        {!isLoadingSubscriptions && subscriptions.length === 0 && !auditResult && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="inline-flex p-4 bg-cyan-500/10 rounded-full mb-4">
              <Fish className="w-10 h-10 text-cyan-400/60" />
            </div>
            <p className="text-white font-medium mb-1">No subscriptions detected</p>
            <p className="text-sm text-slate-400 mb-4">
              Scan your expenses to find recurring charges
            </p>
          </motion.div>
        )}

        {/* Savings History */}
        {history && history.decisions.length > 0 && (
          <motion.section
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <SavingsHistory history={history} />
          </motion.section>
        )}

        {/* Navigation buttons */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="grid grid-cols-2 gap-3">
            {pendingReview.length > 0 && (
              <button
                onClick={() => router.push('/dashboard/shark/review')}
                className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 border border-violet-500/20 text-left hover:border-violet-500/40 transition-colors"
              >
                <Bot className="w-6 h-6 text-violet-400 mb-2" />
                <p className="font-medium text-white">AI Review</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingReview.length} to review
                </p>
              </button>
            )}
            {pendingReview.length > 0 && (
              <button
                onClick={() => router.push('/dashboard/shark/audit')}
                className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-left hover:border-amber-500/40 transition-colors"
              >
                <Fish className="w-6 h-6 text-amber-400 mb-2" />
                <p className="font-medium text-white">Swipe Review</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingReview.length} to review
                </p>
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard/shark/subscriptions')}
              className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 text-left hover:border-cyan-500/40 transition-colors"
            >
              <List className="w-6 h-6 text-cyan-400 mb-2" />
              <p className="font-medium text-white">All Subscriptions</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {subscriptions.length} tracked
              </p>
            </button>
            <button
              onClick={() => router.push('/dashboard/shark/calendar')}
              className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 text-left hover:border-indigo-500/40 transition-colors"
            >
              <Calendar className="w-6 h-6 text-indigo-400 mb-2" />
              <p className="font-medium text-white">Bill Calendar</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Upcoming charges
              </p>
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
