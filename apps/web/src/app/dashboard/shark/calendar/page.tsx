'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, ClipboardCheck } from 'lucide-react';
import { useShark } from '@/hooks/useShark';
import { getCurrencySymbol, formatCurrency } from '@/lib/utils';
import type { Subscription } from '@/hooks/useShark';

/** Estimate next charge day from lastChargeDate (monthly recurrence) */
function estimateNextCharge(sub: Subscription): Date | null {
  const ref = sub.lastChargeDate ?? sub.firstChargeDate;
  if (!ref) return null;
  const d = new Date(ref);
  const now = new Date();
  // Advance month-by-month until in the future
  while (d <= now) {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export default function BillCalendarPage() {
  const router = useRouter();
  const { subscriptions, isLoadingSubscriptions, summary } = useShark({ limit: 100 });
  const currency = summary?.currency ?? 'USD';
  const symbol = getCurrencySymbol(currency);

  // Active subscriptions with estimated charge dates
  const billItems = useMemo(() => {
    return subscriptions
      .filter((s) => s.status !== 'CANCELLED')
      .map((s) => ({
        ...s,
        nextCharge: estimateNextCharge(s),
      }))
      .filter((s) => s.nextCharge !== null)
      .sort((a, b) => (a.nextCharge!.getTime() - b.nextCharge!.getTime()));
  }, [subscriptions]);

  // Group by week for calendar-like view
  const grouped = useMemo(() => {
    const groups: Record<string, typeof billItems> = {};
    const now = new Date();

    for (const item of billItems) {
      const d = item.nextCharge!;
      const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);

      let label: string;
      if (diffDays <= 0) label = 'Today';
      else if (diffDays <= 7) label = 'This Week';
      else if (diffDays <= 14) label = 'Next Week';
      else if (diffDays <= 30) label = 'This Month';
      else label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }

    return groups;
  }, [billItems]);

  // Monthly total
  const monthlyTotal = billItems.reduce((sum, s) => sum + Math.abs(s.monthlyCost), 0);

  // ─── Loading state ──────────────────────────
  if (isLoadingSubscriptions) {
    return (
      <div className="flex items-center justify-center py-24">
        <motion.p
          className="font-serif text-stone-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading calendar...
        </motion.p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 safe-top">
      {/* Header */}
      <motion.header
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => router.push('/dashboard/shark')}
          className="text-stone-500 hover:text-[#1A2E22] font-serif text-sm transition-colors mb-6"
        >
          &larr; Back to Shark Auditor
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-stone-100 rounded-lg">
            <Calendar className="w-6 h-6 text-stone-500" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-serif text-[#1A2E22] tracking-tight">
              Bill Calendar
            </h1>
            <p className="text-sm text-stone-500">
              Upcoming subscription charges
            </p>
          </div>
        </div>

        {/* Monthly total banner */}
        <div className="mt-5 px-5 py-4 rounded-lg bg-white border border-stone-200 shadow-sm flex items-center justify-between">
          <span className="text-sm text-stone-500">Monthly total</span>
          <span className="text-xl font-serif font-medium text-[#1A2E22]">
            {symbol}{Math.round(monthlyTotal).toLocaleString()}<span className="text-sm text-stone-400 font-sans font-normal">/mo</span>
          </span>
        </div>
      </motion.header>

      {/* Calendar groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex p-4 bg-stone-100 rounded-full mb-4">
            <ClipboardCheck className="w-10 h-10 text-stone-400" />
          </div>
          <p className="font-serif text-[#1A2E22] font-medium mb-1">No upcoming charges</p>
          <p className="text-sm text-stone-500">
            Run a scan to detect your subscriptions
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([label, items], gi) => (
            <motion.section
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.1 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">{label}</h2>
                <span className="font-mono text-xs text-stone-400">
                  {symbol}{Math.round(items.reduce((s, i) => s + Math.abs(i.monthlyCost), 0)).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white border border-stone-200 hover:border-[#064E3B] hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => router.push(`/dashboard/shark/subscriptions/${item.id}`)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: gi * 0.1 + i * 0.05 }}
                  >
                    {/* Date badge */}
                    <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-stone-50 border border-stone-200 flex flex-col items-center justify-center group-hover:border-[#064E3B]/30 transition-colors">
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium leading-none">
                        {item.nextCharge!.toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="text-sm text-[#1A2E22] font-serif font-bold leading-tight">
                        {item.nextCharge!.getDate()}
                      </span>
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A2E22] truncate">{item.name}</p>
                      <p className="text-xs text-stone-400 capitalize">
                        {item.category.toLowerCase().replace('_', '/')}
                      </p>
                    </div>

                    {/* Cost */}
                    <span className="text-sm font-mono font-semibold text-[#1A2E22] tabular-nums flex-shrink-0">
                      {formatCurrency(item.monthlyCost, item.currency)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
