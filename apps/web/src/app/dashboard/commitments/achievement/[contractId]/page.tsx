'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Share2,
  Trophy,
  Medal,
  Flame,
  Users,
  HeartCrack,
  Lock,
  Loader2,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useCommitments } from '@/hooks/useCommitments';
import type { AchievementCard } from '@/hooks/useCommitments';

const STAKE_GRADIENTS = {
  SOCIAL: 'from-purple-600 via-violet-600 to-indigo-600',
  ANTI_CHARITY: 'from-red-600 via-rose-600 to-pink-600',
  LOSS_POOL: 'from-amber-600 via-yellow-600 to-orange-600',
} as const;

const STAKE_ICONS = {
  SOCIAL: Users,
  ANTI_CHARITY: HeartCrack,
  LOSS_POOL: Lock,
} as const;

export default function AchievementPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;
  const { getAchievement } = useCommitments();

  const [achievement, setAchievement] = useState<AchievementCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAchievement(contractId)
      .then(setAchievement)
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const handleShare = async () => {
    if (!achievement) return;
    const text = `I just achieved my goal "${achievement.goalName}" on IKPA! ${
      achievement.streakCount && achievement.streakCount > 1 ? `That's ${achievement.streakCount} in a row!` : ''
    }`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'IKPA Achievement', text, url: window.location.href });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!achievement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Achievement not found</p>
      </div>
    );
  }

  const gradient = STAKE_GRADIENTS[achievement.stakeType as keyof typeof STAKE_GRADIENTS] || STAKE_GRADIENTS.SOCIAL;
  const StakeIcon = STAKE_ICONS[achievement.stakeType as keyof typeof STAKE_ICONS] || Users;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>

        {/* Achievement Card */}
        <motion.div
          id="achievement-card"
          className={cn(
            'relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br shadow-2xl',
            gradient,
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12" />

          {/* Content */}
          <div className="relative z-10 text-center">
            <div className="inline-flex p-3 bg-white/20 rounded-full mb-4">
              <Trophy className="w-8 h-8 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">Goal Achieved!</h2>
            <p className="text-white/80 text-lg mb-6">{achievement.goalName}</p>

            {achievement.achievementTier && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full mb-4">
                <Medal className="w-4 h-4 text-white" />
                <span className="text-sm font-bold text-white">{achievement.achievementTier} Tier</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-1.5 text-white/80">
                <StakeIcon className="w-4 h-4" />
                <span className="text-sm">{achievement.stakeType.replace('_', ' ')}</span>
              </div>
              {achievement.stakeAmount && (
                <span className="text-sm text-white/80">
                  {formatCurrency(achievement.stakeAmount, achievement.currency as any)}
                </span>
              )}
            </div>

            {achievement.streakCount && achievement.streakCount > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-white/90 mb-4">
                <Flame className="w-5 h-5" />
                <span className="font-bold">{achievement.streakCount} in a row!</span>
              </div>
            )}

            <p className="text-xs text-white/50 mt-4">
              {new Date(achievement.succeededAt).toLocaleDateString()} &middot; {achievement.userName} &middot; IKPA
            </p>
          </div>
        </motion.div>

        {/* Share actions */}
        <motion.div
          className="mt-6 space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium rounded-xl"
          >
            <Share2 className="w-5 h-5" />
            Share Achievement
          </button>
        </motion.div>
      </div>
    </div>
  );
}
