'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Fish } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useShark, type SubscriptionStatus } from '@/hooks/useShark';
import { SubscriptionCard } from '@/components/shark';

type FilterStatus = SubscriptionStatus | 'ALL';

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ZOMBIE', label: 'Zombie' },
  { value: 'UNKNOWN', label: 'Unknown' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function SharkSubscriptionsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { subscriptions, summary, isLoadingSubscriptions } = useShark({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    limit: 100,
  });

  // Client-side search filtering
  const filtered = searchQuery
    ? subscriptions.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : subscriptions;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
      {/* Ambient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          className="flex items-center gap-3 mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push('/dashboard/shark')}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Subscriptions</h1>
            <p className="text-xs text-slate-400">
              {subscriptions.length} tracked
            </p>
          </div>
        </motion.header>

        {/* Summary mini */}
        {summary && (
          <motion.div
            className="mb-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <p className="text-xs text-slate-400 mb-0.5">Total monthly cost</p>
            <p className="text-xl font-bold text-white tabular-nums">
              {formatCurrency(summary.totalMonthlyCost, summary.currency)}
            </p>
          </motion.div>
        )}

        {/* Search */}
        <motion.div
          className="relative mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search subscriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/20"
          />
        </motion.div>

        {/* Filter pills */}
        <motion.div
          className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                'flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all border',
                statusFilter === value
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              )}
            >
              {label}
            </button>
          ))}
        </motion.div>

        {/* Subscription list */}
        <div className="space-y-2">
          {isLoadingSubscriptions ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
            ))
          ) : filtered.length === 0 ? (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="inline-flex p-4 bg-cyan-500/10 rounded-full mb-4">
                <Fish className="w-8 h-8 text-cyan-400/60" />
              </div>
              <p className="text-white font-medium mb-1">
                {searchQuery ? 'No matches found' : 'No subscriptions'}
              </p>
              <p className="text-sm text-slate-400">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Run a scan to detect recurring charges'}
              </p>
            </motion.div>
          ) : (
            filtered.map((sub, i) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onClick={() => router.push(`/dashboard/shark/subscriptions/${sub.id}`)}
                delay={0.02 * i}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
