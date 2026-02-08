'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  Crown,
  Flame,
  Medal,
  Trophy,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLeaderboard } from '@/hooks/useLeaderboard';

const rankIcons = [Crown, Medal, Medal]; // gold, silver, bronze
const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];
const rankBg = ['bg-amber-500/10 border-amber-500/20', 'bg-slate-500/10 border-slate-500/20', 'bg-amber-700/10 border-amber-700/20'];

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 -right-10 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-10 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top pb-32">
        {/* Header */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/dashboard/future-self"
              className="p-2 bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                Streak Leaderboard
              </h1>
              <p className="text-sm text-slate-400">Top micro-commitment streakers</p>
            </div>
          </div>

          {/* Opt-in Toggle */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Show me on leaderboard</p>
              <p className="text-xs text-slate-400">Others see your streak (name anonymized)</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={isTogglingOptIn}
              className="flex items-center"
            >
              {isOptedIn ? (
                <ToggleRight className="w-10 h-10 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-slate-500" />
              )}
            </button>
          </div>

          {/* My Rank Card */}
          {myRank && myRank.rank && (
            <motion.div
              className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-400/80 uppercase font-medium">Your Rank</p>
                  <p className="text-3xl font-bold text-amber-400">#{myRank.rank}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-lg font-bold text-white">{myRank.streakDays}d</span>
                  </div>
                  <p className="text-xs text-slate-400">Best: {myRank.longestStreak}d</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.header>

        {/* Pull to refresh */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Leaderboard List */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No one on the leaderboard yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Start a micro-commitment and opt in!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => {
                const isTop3 = entry.rank <= 3;
                const RankIcon = isTop3 ? rankIcons[entry.rank - 1] : null;

                return (
                  <motion.div
                    key={`${entry.rank}-${entry.displayName}`}
                    className={cn(
                      'p-4 rounded-xl border backdrop-blur-sm transition-all',
                      entry.isCurrentUser
                        ? 'bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/20'
                        : isTop3
                          ? rankBg[entry.rank - 1]
                          : 'bg-white/5 border-white/10',
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * index }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank */}
                      <div className="w-10 text-center">
                        {RankIcon ? (
                          <RankIcon className={cn('w-6 h-6 mx-auto', rankColors[entry.rank - 1])} />
                        ) : (
                          <span className="text-lg font-bold text-slate-400">
                            {entry.rank}
                          </span>
                        )}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">
                          {entry.displayName}
                          {entry.isCurrentUser && (
                            <span className="ml-2 px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
                              You
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Streak */}
                      <div className="flex items-center gap-1.5">
                        <Flame
                          className={cn(
                            'w-4 h-4',
                            entry.longestStreak >= 30
                              ? 'text-red-400'
                              : entry.longestStreak >= 7
                                ? 'text-orange-400'
                                : 'text-amber-400',
                          )}
                        />
                        <span className="text-lg font-bold text-white">
                          {entry.longestStreak}
                        </span>
                        <span className="text-xs text-slate-400">days</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
