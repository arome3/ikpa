'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Fish } from 'lucide-react';
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

  if (isLoadingSubscriptions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 flex items-center justify-center">
        <motion.div
          className="text-slate-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading calendar...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
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
          <button
            onClick={() => router.push('/dashboard/shark')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl backdrop-blur-sm">
              <Calendar className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Bill Calendar
              </h1>
              <p className="text-sm text-slate-400">
                Upcoming subscription charges
              </p>
            </div>
          </div>

          {/* Monthly total banner */}
          <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
            <span className="text-sm text-slate-300">Monthly total</span>
            <span className="text-lg font-bold text-white">
              {symbol}{Math.round(monthlyTotal).toLocaleString()}/mo
            </span>
          </div>
        </motion.header>

        {/* Calendar groups */}
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex p-4 bg-indigo-500/10 rounded-full mb-4">
              <Fish className="w-10 h-10 text-indigo-400/60" />
            </div>
            <p className="text-white font-medium mb-1">No upcoming charges</p>
            <p className="text-sm text-slate-400">
              Run a scan to detect your subscriptions
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([label, items], gi) => (
              <motion.section
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.1 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-medium text-slate-400">{label}</h2>
                  <span className="text-xs text-slate-500">
                    {symbol}{Math.round(items.reduce((s, i) => s + Math.abs(i.monthlyCost), 0)).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/shark/subscriptions/${item.id}`)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gi * 0.1 + i * 0.05 }}
                    >
                      {/* Date badge */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-500/15 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-indigo-400 font-medium leading-none">
                          {item.nextCharge!.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-sm text-white font-bold leading-tight">
                          {item.nextCharge!.getDate()}
                        </span>
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.name}</p>
                        <p className="text-xs text-slate-500 capitalize">
                          {item.category.toLowerCase().replace('_', '/')}
                        </p>
                      </div>

                      {/* Cost */}
                      <span className="text-sm font-semibold text-white tabular-nums flex-shrink-0">
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
    </div>
  );
}
