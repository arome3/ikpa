'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Radar, ChevronRight, List, Bot, Calendar, Fish } from 'lucide-react';
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
    <div className="max-w-3xl mx-auto px-6 md:px-12 py-8">
      {/* Header Row — matches Income page pattern */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif text-[#1A2E22] tracking-tight">
            Subscription Audit
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Find and eliminate zombie subscriptions
          </p>
        </div>
        <button
          onClick={() => handleScan()}
          className="inline-flex items-center gap-2 rounded-full bg-[#064E3B] hover:bg-[#053D2E] text-white px-5 py-2.5 text-sm font-medium transition-colors"
        >
          <Radar className="w-4 h-4" />
          Run New Scan
        </button>
      </div>

      {/* Summary Strip */}
      <section className="mb-8">
        <SharkSummaryCard
          summary={summary}
          isLoading={isLoadingSubscriptions}
          pendingCount={pendingReview.length}
          onScan={() => handleScan()}
          onReview={() => router.push('/dashboard/shark/review')}
        />
      </section>

      {/* Audit Trigger */}
      <section className="mb-8">
        <AuditTriggerCard
          onTrigger={handleScan}
          isAuditing={isAuditing}
          lastResult={auditResult}
        />
      </section>

      {/* Overlap Warnings */}
      {overlaps.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-serif text-[#1A2E22] mb-3">Overlapping Services</h2>
          <OverlapWarning
            overlaps={overlaps}
            currency={summary?.currency ?? 'USD'}
            onReview={() => router.push('/dashboard/shark/review')}
          />
        </section>
      )}

      {/* Zombie Preview */}
      {previewZombies.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-serif text-[#1A2E22]">
              Zombies Found
            </h2>
            {zombies.length > 3 && (
              <button
                onClick={() => router.push('/dashboard/shark/review')}
                className="text-sm text-[#C2410C] hover:text-[#9A3412] flex items-center gap-1 font-medium"
              >
                Review all
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div>
            {previewZombies.map((sub, i) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onClick={() => router.push(`/dashboard/shark/subscriptions/${sub.id}`)}
                delay={0.05 * i}
              />
            ))}
          </div>
        </section>
      )}

      {/* No subscriptions empty state */}
      {!isLoadingSubscriptions && subscriptions.length === 0 && !auditResult && (
        <motion.div
          className="text-center py-16 bg-stone-50 rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Fish className="w-12 h-12 mx-auto text-stone-400 stroke-[1.5] mb-4" />
          <p className="text-[#1A2E22] font-medium mb-1">No subscriptions detected</p>
          <p className="text-sm text-stone-400 mb-4">
            Scan your expenses to find recurring charges
          </p>
        </motion.div>
      )}

      {/* Savings History */}
      {history && history.decisions.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-serif text-[#1A2E22] mb-3">Savings History</h2>
          <SavingsHistory history={history} />
        </section>
      )}

      {/* Navigation grid */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 gap-3">
          {pendingReview.length > 0 && (
            <button
              onClick={() => router.push('/dashboard/shark/review')}
              className="p-4 rounded-xl bg-white border border-stone-100 text-left hover:-translate-y-0.5 transition-all"
            >
              <Bot className="w-6 h-6 text-stone-400 stroke-[1.5] mb-2" />
              <p className="font-serif text-[#1A2E22]">AI Review</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {pendingReview.length} to review
              </p>
            </button>
          )}
          {pendingReview.length > 0 && (
            <button
              onClick={() => router.push('/dashboard/shark/audit')}
              className="p-4 rounded-xl bg-white border border-stone-100 text-left hover:-translate-y-0.5 transition-all"
            >
              <Fish className="w-6 h-6 text-stone-400 stroke-[1.5] mb-2" />
              <p className="font-serif text-[#1A2E22]">Swipe Review</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {pendingReview.length} to review
              </p>
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard/shark/subscriptions')}
            className="p-4 rounded-xl bg-white border border-stone-100 text-left hover:-translate-y-0.5 transition-all"
          >
            <List className="w-6 h-6 text-stone-400 stroke-[1.5] mb-2" />
            <p className="font-serif text-[#1A2E22]">All Subscriptions</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {subscriptions.length} tracked
            </p>
          </button>
          <button
            onClick={() => router.push('/dashboard/shark/calendar')}
            className="p-4 rounded-xl bg-white border border-stone-100 text-left hover:-translate-y-0.5 transition-all"
          >
            <Calendar className="w-6 h-6 text-stone-400 stroke-[1.5] mb-2" />
            <p className="font-serif text-[#1A2E22]">Bill Calendar</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Upcoming charges
            </p>
          </button>
        </div>
      </section>
    </div>
  );
}
