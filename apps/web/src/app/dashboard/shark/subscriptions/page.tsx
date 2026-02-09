'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ClipboardCheck } from 'lucide-react';
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
    <div className="max-w-3xl mx-auto px-4 py-6 safe-top">
      {/* Header */}
      <motion.header
        className="mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => router.push('/dashboard/shark')}
          className="text-stone-500 hover:text-[#1A2E22] font-serif text-sm transition-colors mb-6"
        >
          &larr; Back to Shark Auditor
        </button>
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-[#1A2E22] tracking-tight">
            Subscriptions
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {subscriptions.length} tracked
          </p>
        </div>
      </motion.header>

      {/* Summary mini */}
      {summary && (
        <motion.div
          className="mb-5 px-5 py-4 rounded-lg bg-white border border-stone-200 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <p className="text-xs uppercase tracking-wider text-stone-400 mb-0.5">Total monthly cost</p>
          <p className="text-xl font-serif font-medium text-[#1A2E22] tabular-nums">
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          placeholder="Search subscriptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white border border-stone-200 text-[#1A2E22] text-sm placeholder-stone-400 focus:outline-none focus:border-[#1A2E22] transition-colors"
        />
      </motion.div>

      {/* Filter pills */}
      <motion.div
        className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'flex-shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all border',
              statusFilter === value
                ? 'bg-stone-800 border-stone-800 text-white'
                : 'bg-white border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
            )}
          >
            {label}
          </button>
        ))}
      </motion.div>

      {/* Subscription list */}
      <div>
        {isLoadingSubscriptions ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-stone-100 animate-pulse rounded-lg mb-2" />
          ))
        ) : filtered.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="inline-flex p-4 bg-stone-100 rounded-full mb-4">
              <ClipboardCheck className="w-8 h-8 text-stone-400" />
            </div>
            <p className="font-serif text-[#1A2E22] font-medium mb-1">
              {searchQuery ? 'No matches found' : 'No subscriptions'}
            </p>
            <p className="text-sm text-stone-500">
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
  );
}
