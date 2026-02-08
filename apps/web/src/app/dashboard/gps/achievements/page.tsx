'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy,
  ArrowLeft,
  Flame,
  Target,
  Zap,
  Star,
  Shield,
  Award,
  Crown,
  Lock,
  Rocket,
  Snowflake,
  Medal,
  Flag,
  Footprints,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useGps } from '@/hooks/useGps';

// ============================================
// ACHIEVEMENTS PAGE
// ============================================

const achievementIcons: Record<string, typeof Trophy> = {
  trophy: Trophy,
  flame: Flame,
  target: Target,
  zap: Zap,
  star: Star,
  shield: Shield,
  award: Award,
  crown: Crown,
  rocket: Rocket,
  snowflake: Snowflake,
  medal: Medal,
  flag: Flag,
  footprints: Footprints,
};

export default function AchievementsPage() {
  const router = useRouter();
  const { achievements, streaks, isLoadingAchievements } = useGps();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top pb-32">
        {/* Back button */}
        <motion.button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        {/* Header */}
        <motion.header
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex p-4 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-2xl mb-4 backdrop-blur-sm">
            <Trophy className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Achievements</h1>
          <p className="text-slate-400">Your financial milestones</p>
        </motion.header>

        {/* Stats Summary */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-bold text-white">
                {achievements?.totalEarned ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">Earned</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {streaks?.currentStreak ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">Day Streak</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
              <p className="text-2xl font-bold text-slate-400">
                {achievements?.totalAvailable ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">Total</p>
            </div>
          </div>
        </motion.section>

        {/* Earned Achievements */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            Earned
            <span className="ml-auto text-sm text-slate-500">
              {achievements?.earned?.length ?? 0}
            </span>
          </h2>

          {isLoadingAchievements ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : achievements?.earned?.length === 0 ? (
            <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
              <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No achievements yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Complete challenges to earn badges
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {achievements?.earned?.map((achievement, index) => {
                const Icon = achievementIcons[achievement.icon] || Trophy;

                return (
                  <motion.div
                    key={achievement.id}
                    className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 via-amber-500/10 to-orange-500/10 border border-yellow-500/20"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />

                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center mb-3 shadow-lg shadow-yellow-500/20">
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      <h3 className="font-semibold text-white text-sm">
                        {achievement.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {achievement.description}
                      </p>

                      {achievement.earnedAt && (
                        <p className="text-xs text-yellow-400/70 mt-2">
                          {formatDate(achievement.earnedAt, { relative: true })}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* Locked Achievements */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-500" />
            Locked
            <span className="ml-auto text-sm text-slate-500">
              {achievements?.available?.length ?? 0}
            </span>
          </h2>

          {isLoadingAchievements ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : achievements?.available?.length === 0 ? (
            <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
              <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <p className="text-white font-medium">All achievements unlocked!</p>
              <p className="text-sm text-slate-400 mt-1">
                You&apos;ve mastered your finances
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {achievements?.available?.map((achievement, index) => {
                const Icon = achievementIcons[achievement.icon] || Trophy;

                return (
                  <motion.div
                    key={achievement.id}
                    className="relative overflow-hidden p-4 rounded-xl bg-white/5 border border-white/10"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center mb-3">
                        <Icon className="w-6 h-6 text-slate-500" />
                      </div>

                      <h3 className="font-semibold text-slate-400 text-sm">
                        {achievement.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {achievement.description}
                      </p>

                      {/* Lock overlay */}
                      <div className="absolute top-2 right-2">
                        <Lock className="w-4 h-4 text-slate-600" />
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
