'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Users,
  ArrowLeft,
  Copy,
  Check,
  Crown,
  Trophy,
  Loader2,
  LogOut,
  Trash2,
  Sparkles,
  Heart,
  TrendingUp,
  Send,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGroups } from '@/hooks/useGroups';
import type { GroupMemberProgress } from '@/hooks/useGroups';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ============================================
// PROGRESS STATUS CONFIG
// ============================================

const PROGRESS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  on_track: { label: 'On Track', color: 'text-green-400', bg: 'bg-green-500/20', dot: 'bg-green-400' },
  behind: { label: 'Behind', color: 'text-amber-400', bg: 'bg-amber-500/20', dot: 'bg-amber-400' },
  completed: { label: 'Goal Achieved!', color: 'text-emerald-400', bg: 'bg-emerald-500/20', dot: 'bg-emerald-400' },
  failed: { label: "Didn't Make It", color: 'text-red-400', bg: 'bg-red-500/20', dot: 'bg-red-400' },
  pending: { label: 'Setting Up...', color: 'text-slate-400', bg: 'bg-slate-500/20', dot: 'bg-slate-400' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  FORMING: { label: 'Forming', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  ACTIVE: { label: 'Active', color: 'text-green-400', bg: 'bg-green-500/20' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  DISBANDED: { label: 'Disbanded', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

// ============================================
// GROUP DASHBOARD PAGE
// ============================================

export default function GroupDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;

  const {
    useGroupDashboard,
    useGroupTimeline,
    leaveGroup,
    isLeavingGroup,
    disbandGroup,
    isDisbandingGroup,
    sendEncouragement,
    isSendingEncouragement,
    toggleReaction,
    isTogglingReaction,
  } = useGroups();

  const { data: dashboard, isLoading } = useGroupDashboard(groupId);
  const { data: timeline } = useGroupTimeline(groupId);
  const [copied, setCopied] = useState(false);
  const [encourageTarget, setEncourageTarget] = useState<string | null>(null);
  const [encourageMessage, setEncourageMessage] = useState('');

  const handleCopyCode = () => {
    if (!dashboard) return;
    navigator.clipboard.writeText(dashboard.group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    await leaveGroup(groupId);
    router.push('/dashboard/commitments/groups');
  };

  const handleDisband = async () => {
    if (!confirm('This will disband the group for all members. Are you sure?')) return;
    await disbandGroup(groupId);
    router.push('/dashboard/commitments/groups');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Group not found</p>
      </div>
    );
  }

  const { group, members, allSucceeded, groupBonusAwarded } = dashboard;
  const groupStatus = STATUS_CONFIG[group.status] ?? STATUS_CONFIG.FORMING;
  const isOwner = group.myRole === 'OWNER';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-purple-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto md:max-w-4xl px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push('/dashboard/commitments/groups')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">{group.name}</h1>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', groupStatus.bg, groupStatus.color)}>
                  {groupStatus.label}
                </span>
              </div>
              {group.description && (
                <p className="text-sm text-slate-400 mt-0.5">{group.description}</p>
              )}
            </div>
          </div>

          {/* Invite Code Bar */}
          <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Invite Code</span>
            <span className="flex-1 font-mono font-bold text-indigo-400 tracking-wider">
              {group.inviteCode}
            </span>
            <button
              onClick={handleCopyCode}
              className={cn(
                'p-1.5 rounded-lg transition-all',
                copied ? 'bg-green-500/20 text-green-400' : 'hover:bg-white/10 text-slate-400',
              )}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <span className="text-xs text-slate-400">
              {group.memberCount}/{group.maxMembers} members
            </span>
          </div>
        </motion.header>

        {/* Group Bonus Banner */}
        {(allSucceeded || groupBonusAwarded) && (
          <motion.div
            className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-full">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-amber-300 text-lg">Group Champions!</p>
                <p className="text-sm text-amber-400/80">
                  Every member achieved their goal. That&apos;s the power of accountability.
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-amber-400 ml-auto" />
            </div>
          </motion.div>
        )}

        {/* Shared Goal */}
        {dashboard.sharedGoal && (
          <motion.section
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-500/15 to-purple-500/10 border border-indigo-500/20">
              {dashboard.sharedGoal.label && (
                <p className="text-lg font-bold text-white mb-2">{dashboard.sharedGoal.label}</p>
              )}
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-300">
                  {formatCurrency(dashboard.sharedGoal.current, dashboard.sharedGoal.currency as any)} of {formatCurrency(dashboard.sharedGoal.target, dashboard.sharedGoal.currency as any)}
                </span>
                <span className="text-indigo-400 font-bold">{dashboard.sharedGoal.percentage}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${dashboard.sharedGoal.percentage}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>
          </motion.section>
        )}

        {/* Member Progress Grid */}
        <motion.section
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Members
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((member, index) => (
              <MemberCard
                key={member.userId}
                member={member}
                index={index}
                isMe={member.userId === dashboard.group.myRole}
                onEncourage={(toUserId) => setEncourageTarget(toUserId)}
                onReact={(targetId, emoji) => toggleReaction({ groupId, targetId, emoji })}
                isTogglingReaction={isTogglingReaction}
              />
            ))}
          </div>
        </motion.section>

        {/* Encouragement Modal */}
        {encourageTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              className="w-full max-w-sm bg-slate-800 border border-white/10 rounded-2xl p-5"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-400" />
                Send Encouragement
              </h3>
              <input
                type="text"
                value={encourageMessage}
                onChange={(e) => setEncourageMessage(e.target.value)}
                placeholder="You got this!"
                maxLength={200}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEncourageTarget(null); setEncourageMessage(''); }}
                  className="flex-1 py-2 bg-white/10 text-slate-300 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await sendEncouragement({ groupId, toUserId: encourageTarget, message: encourageMessage || undefined });
                    setEncourageTarget(null);
                    setEncourageMessage('');
                  }}
                  disabled={isSendingEncouragement}
                  className="flex-1 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-sm flex items-center justify-center gap-1.5"
                >
                  {isSendingEncouragement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Recent Encouragements */}
        {dashboard.recentEncouragements && dashboard.recentEncouragements.length > 0 && (
          <motion.section className="mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              Recent Encouragements
            </h2>
            <div className="space-y-2">
              {dashboard.recentEncouragements.map((e) => (
                <div key={e.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 text-sm">
                  <span className="text-indigo-400 font-medium">{e.fromName}</span>
                  <span className="text-slate-400">cheered</span>
                  <span className="text-indigo-400 font-medium">{e.toName}</span>
                  <span className="text-slate-500 ml-auto text-xs">{new Date(e.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Timeline Chart */}
        {timeline && timeline.weeks && timeline.weeks.length > 1 && (
          <motion.section className="mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Progress Timeline
            </h2>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeline.weeks}>
                  <XAxis dataKey="weekStart" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: '#fff' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="onTrack" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="On Track" />
                  <Area type="monotone" dataKey="completed" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Completed" />
                  <Area type="monotone" dataKey="behind" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Behind" />
                  <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Failed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.section>
        )}

        {/* Actions */}
        <motion.section
          className="mb-6 space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-white mb-3">Actions</h2>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm text-slate-300"
            >
              <Copy className="w-4 h-4 text-indigo-400" />
              Share Invite Code
            </button>

            <button
              onClick={handleLeave}
              disabled={isLeavingGroup}
              className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/10 hover:border-red-500/20 transition-all text-sm text-slate-300"
            >
              {isLeavingGroup ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 text-red-400" />
              )}
              Leave Group
            </button>

            {isOwner && (
              <button
                onClick={handleDisband}
                disabled={isDisbandingGroup}
                className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/10 hover:border-red-500/20 transition-all text-sm text-slate-300 sm:col-span-2"
              >
                {isDisbandingGroup ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-red-400" />
                )}
                Disband Group
              </button>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}

// ============================================
// MEMBER CARD
// ============================================

const EMOJI_MAP: Record<string, string> = {
  thumbsup: '\uD83D\uDC4D',
  fire: '\uD83D\uDD25',
  clap: '\uD83D\uDC4F',
  heart: '\u2764\uFE0F',
  star: '\u2B50',
};

function MemberCard({
  member,
  index,
  onEncourage,
  onReact,
  isTogglingReaction,
}: {
  member: GroupMemberProgress;
  index: number;
  isMe?: boolean;
  onEncourage: (toUserId: string) => void;
  onReact: (targetId: string, emoji: string) => void;
  isTogglingReaction: boolean;
}) {
  const progress = PROGRESS_CONFIG[member.progress] ?? PROGRESS_CONFIG.pending;

  return (
    <motion.div
      className="p-4 rounded-xl bg-white/5 border border-white/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Avatar placeholder */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {member.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-white flex items-center gap-1">
              {member.name}
              {member.role === 'OWNER' && (
                <Crown className="w-3 h-3 text-amber-400" />
              )}
            </p>
            <p className="text-xs text-slate-400">
              Joined {new Date(member.joinedAt).toLocaleDateString()}
              {member.encouragementCount ? ` \u00B7 ${member.encouragementCount} cheers` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {member.groupBonusAwarded && (
            <div className="p-1 bg-amber-500/20 rounded-full">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
            </div>
          )}
          <button
            onClick={() => onEncourage(member.userId)}
            className="p-1.5 hover:bg-pink-500/20 rounded-lg transition-colors"
            title="Send encouragement"
          >
            <Heart className="w-3.5 h-3.5 text-pink-400" />
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2.5 h-2.5 rounded-full', progress.dot)} />
        <span className={cn('text-sm font-medium', progress.color)}>
          {progress.label}
        </span>
      </div>

      {/* Emoji Reactions */}
      <div className="flex items-center gap-1 flex-wrap">
        {['thumbsup', 'fire', 'clap', 'heart', 'star'].map((emoji) => {
          const existing = member.reactions?.find((r) => r.emoji === emoji);
          return (
            <button
              key={emoji}
              onClick={() => onReact(member.userId, emoji)}
              disabled={isTogglingReaction}
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all border',
                existing?.myReaction
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10',
              )}
            >
              <span>{EMOJI_MAP[emoji]}</span>
              {existing && existing.count > 0 && <span>{existing.count}</span>}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
