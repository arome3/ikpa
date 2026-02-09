'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, BarChart3, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { useLeaderboard } from '@/hooks/useLeaderboard';

// ─── Helpers ────────────────────────────────────

function getStatusLabel(rank: number, streakDays: number): { text: string; className: string } | null {
  if (rank <= 3) return { text: 'Top Performer', className: 'text-[#064E3B] bg-emerald-50' };
  if (streakDays >= 7) return { text: 'Rising', className: 'text-stone-500 bg-stone-100' };
  return null;
}

function computeTopPercent(rank: number, total: number): string {
  if (total <= 0 || rank <= 0) return 'Top —%';
  const pct = Math.max(1, Math.round((rank / total) * 100));
  return `Top ${pct}%`;
}

// ─── Page ───────────────────────────────────────

export default function LeaderboardPage() {
  const {
    entries,
    myRank,
    isLoading,
    refetch,
    optIn,
    optOut,
    isTogglingOptIn,
  } = useLeaderboard();

  const isOptedIn = myRank?.optedIn ?? false;

  const handleToggle = async () => {
    if (isOptedIn) {
      await optOut();
    } else {
      await optIn();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 py-8 md:py-12 space-y-8">
      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex items-start justify-between"
      >
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/future-self"
            className="mt-1.5 p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-serif text-[#1A2E22] tracking-tight">
              Community Benchmarks
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Comparing your micro-commitment consistency against the top 1%.
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-1.5 p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          title="Refresh rankings"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </motion.header>

      {/* ── Your Standing (Performance Certificate) ── */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
        >
          <Card variant="paper" padding="lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              {/* Left: standing */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-stone-400">
                  Current Standing
                </p>
                <p className="text-5xl md:text-6xl font-serif text-[#1A2E22] leading-none">
                  {myRank.rank
                    ? computeTopPercent(myRank.rank, entries.length)
                    : 'Unranked'}
                </p>
                {myRank.rank && (
                  <p className="text-sm text-[#064E3B] font-mono">
                    Rank #{String(myRank.rank).padStart(2, '0')} of {entries.length} member{entries.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Right: visibility toggle */}
              <div className="flex flex-col items-start md:items-end gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-stone-500">
                    {isOptedIn ? 'Visible' : 'Hidden'}
                  </span>
                  <button
                    role="switch"
                    aria-checked={isOptedIn}
                    onClick={handleToggle}
                    disabled={isTogglingOptIn}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50',
                      isOptedIn ? 'bg-[#064E3B]' : 'bg-stone-300',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm',
                        isOptedIn ? 'translate-x-6' : 'translate-x-1',
                      )}
                    />
                  </button>
                </div>
                <p className="text-xs text-stone-400">
                  Your name is always anonymized.
                </p>
              </div>
            </div>

            {/* Streak stats */}
            <div className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400">
                  Current Streak
                </p>
                <p className="font-mono text-lg text-[#1A2E22]">
                  {myRank.streakDays} Days
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400">
                  Longest Streak
                </p>
                <p className="font-mono text-lg text-[#1A2E22]">
                  {myRank.longestStreak} Days
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Consistency Ledger ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
      >
        <Card variant="paper" padding="none">
          <div className="px-6 pt-6 pb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
            <h2 className="text-lg font-serif text-[#1A2E22]">
              Consistency Ledger
            </h2>
          </div>

          {/* Table header (desktop) */}
          <div className="hidden md:flex items-center px-6 py-2 border-b border-stone-100 text-[10px] uppercase tracking-widest text-stone-400">
            <div className="w-16">Rank</div>
            <div className="flex-1">Member</div>
            <div className="w-36 text-right">Consistency Streak</div>
            <div className="w-32 text-right">Status</div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="divide-y divide-stone-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-5 bg-stone-100 rounded animate-pulse" />
                  <div className="flex-1 h-4 bg-stone-100 rounded animate-pulse" />
                  <div className="w-20 h-4 bg-stone-100 rounded animate-pulse" />
                  <div className="hidden md:block w-24 h-4 bg-stone-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            /* Empty state */
            <div className="text-center py-16 px-6">
              <BarChart3 className="w-10 h-10 text-stone-300 mx-auto mb-4" strokeWidth={1} />
              <p className="font-serif text-lg text-[#1A2E22] mb-1">
                No benchmarks yet
              </p>
              <p className="text-sm text-stone-400 max-w-xs mx-auto">
                Start a micro-commitment and opt in to see how your consistency compares.
              </p>
            </div>
          ) : (
            /* Entries */
            <div className="divide-y divide-stone-100">
              {entries.map((entry, index) => {
                const status = getStatusLabel(entry.rank, entry.longestStreak);

                return (
                  <motion.div
                    key={`${entry.rank}-${entry.displayName}`}
                    className={cn(
                      'flex items-center px-6 py-4 transition-colors hover:bg-stone-50',
                      entry.rank === 1 && 'bg-emerald-50/50',
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * index, duration: 0.3, ease: 'easeOut' }}
                  >
                    {/* Rank */}
                    <div className="w-16 flex-shrink-0">
                      <span
                        className={cn(
                          'font-serif italic',
                          entry.rank === 1 && 'text-xl text-[#1A2E22]',
                          entry.rank >= 2 && entry.rank <= 3 && 'text-lg text-[#1A2E22]',
                          entry.rank > 3 && 'text-base text-stone-500',
                        )}
                      >
                        #{String(entry.rank).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Member */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'truncate',
                          entry.rank <= 3
                            ? 'font-medium text-[#1A2E22]'
                            : 'text-stone-500',
                        )}
                      >
                        {entry.displayName}
                        {entry.isCurrentUser && (
                          <span className="ml-2 inline-flex px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-[#064E3B] rounded-full">
                            You
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Streak */}
                    <div className="w-36 text-right flex-shrink-0">
                      <span className="font-mono text-sm text-[#1A2E22]">
                        {entry.longestStreak} Days
                      </span>
                    </div>

                    {/* Status (desktop) */}
                    <div className="hidden md:block w-32 text-right flex-shrink-0">
                      {status && (
                        <span
                          className={cn(
                            'inline-flex px-2.5 py-0.5 text-[10px] font-medium rounded-full',
                            status.className,
                          )}
                        >
                          {status.text}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </motion.section>
    </div>
  );
}
