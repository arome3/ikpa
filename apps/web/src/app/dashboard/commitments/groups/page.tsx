'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  UserPlus,
  Crown,
  Copy,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGroups } from '@/hooks/useGroups';
import type { GroupInfo } from '@/hooks/useGroups';

// ============================================
// STATUS BADGE CONFIG
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  FORMING: { label: 'Forming', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  ACTIVE: { label: 'Active', color: 'text-green-400', bg: 'bg-green-500/20' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  DISBANDED: { label: 'Disbanded', color: 'text-slate-400', bg: 'bg-slate-500/20' },
};

// ============================================
// GROUPS HUB PAGE
// ============================================

export default function GroupsHubPage() {
  const router = useRouter();
  const {
    myGroups,
    isLoadingGroups,
    createGroup,
    isCreatingGroup,
    joinGroup,
    isJoiningGroup,
  } = useGroups();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

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
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/commitments')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div className="p-2.5 bg-indigo-500/20 rounded-xl backdrop-blur-sm">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Groups</h1>
                <p className="text-sm text-slate-400">Accountability partners</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowJoinModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-sm font-medium rounded-xl transition-all border border-white/10"
              >
                <UserPlus className="w-4 h-4" />
                Join
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25"
              >
                <Plus className="w-4 h-4" />
                Create
              </button>
            </div>
          </div>
        </motion.header>

        {/* Groups List */}
        {isLoadingGroups ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : myGroups.length === 0 ? (
          <motion.div
            className="p-8 rounded-xl bg-white/5 border border-white/10 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="inline-flex p-3 bg-indigo-500/20 rounded-full mb-3">
              <Users className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-white font-medium">No groups yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-4 max-w-xs mx-auto">
              Create a group and invite friends to boost your goal achievement by 2x
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-xl"
              >
                Create Group
              </button>
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 text-sm font-medium rounded-xl border border-white/10"
              >
                Join Group
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {myGroups.map((group, index) => (
              <GroupCard key={group.id} group={group} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateGroupModal
            onClose={() => setShowCreateModal(false)}
            onCreate={createGroup}
            isCreating={isCreatingGroup}
          />
        )}
      </AnimatePresence>

      {/* Join Group Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <JoinGroupModal
            onClose={() => setShowJoinModal(false)}
            onJoin={joinGroup}
            isJoining={isJoiningGroup}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// GROUP CARD
// ============================================

function GroupCard({ group, index }: { group: GroupInfo; index: number }) {
  const router = useRouter();
  const status = STATUS_CONFIG[group.status] ?? STATUS_CONFIG.FORMING;

  return (
    <motion.button
      onClick={() => router.push(`/dashboard/commitments/groups/${group.id}`)}
      className="w-full text-left p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 hover:border-indigo-500/40 transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="font-semibold text-white">{group.name}</p>
            {group.description && (
              <p className="text-xs text-slate-400 truncate max-w-[200px]">
                {group.description}
              </p>
            )}
          </div>
        </div>
        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', status.bg, status.color)}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-300 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {group.memberCount}/{group.maxMembers}
        </span>
        {group.myRole === 'OWNER' && (
          <span className="text-amber-400 flex items-center gap-1 text-xs">
            <Crown className="w-3 h-3" /> Owner
          </span>
        )}
      </div>
    </motion.button>
  );
}

// ============================================
// CREATE GROUP MODAL
// ============================================

function CreateGroupModal({
  onClose,
  onCreate,
  isCreating,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; sharedGoalAmount?: number; sharedGoalLabel?: string }) => Promise<any>;
  isCreating: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sharedGoalAmount, setSharedGoalAmount] = useState('');
  const [sharedGoalLabel, setSharedGoalLabel] = useState('');
  const [result, setResult] = useState<{ inviteCode: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setError('');
    try {
      const res = await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        sharedGoalAmount: sharedGoalAmount ? parseFloat(sharedGoalAmount) : undefined,
        sharedGoalLabel: sharedGoalLabel.trim() || undefined,
      });
      setResult({ inviteCode: res.inviteCode, id: res.id });
    } catch (e: any) {
      setError(e?.message || 'Failed to create group');
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md bg-slate-800 border border-white/10 rounded-2xl p-6"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            {result ? 'Group Created!' : 'Create Group'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Share this invite code with your accountability partners:
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-center">
                <span className="text-xl font-mono font-bold text-indigo-400 tracking-wider">
                  {result.inviteCode}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className={cn(
                  'p-3 rounded-xl transition-all',
                  copied
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-white/10 hover:bg-white/15 text-slate-300',
                )}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={() => {
                const msg = `Join my accountability group on IKPA! Code: ${result.inviteCode}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Share via WhatsApp
            </button>
            <p className="text-xs text-slate-400">
              Members can join with this code. Your group supports 2-5 members.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">Group Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Savings Squad Q2"
                maxLength={100}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">
                Description <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Let's hit our savings goals together"
                maxLength={500}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
            {/* Shared Goal (optional) */}
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-3">
              <p className="text-sm text-slate-300 font-medium">Shared Goal <span className="text-slate-500">(optional)</span></p>
              <p className="text-xs text-slate-400">Set a collective target for your group</p>
              <input
                type="number"
                value={sharedGoalAmount}
                onChange={(e) => setSharedGoalAmount(e.target.value)}
                placeholder="Amount (e.g., 10000)"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
              />
              <input
                type="text"
                value={sharedGoalLabel}
                onChange={(e) => setSharedGoalLabel(e.target.value)}
                placeholder="Together we'll save $10K"
                maxLength={200}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={!name.trim() || isCreating}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Group
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================
// JOIN GROUP MODAL
// ============================================

function JoinGroupModal({
  onClose,
  onJoin,
  isJoining,
}: {
  onClose: () => void;
  onJoin: (data: { inviteCode: string }) => Promise<any>;
  isJoining: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (code.length !== 8) return;
    setError('');
    try {
      const res = await onJoin({ inviteCode: code.trim().toLowerCase() });
      onClose();
      router.push(`/dashboard/commitments/groups/${res.groupId}`);
    } catch (e: any) {
      setError(e?.message || 'Invalid invite code');
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md bg-slate-800 border border-white/10 rounded-2xl p-6"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            Join Group
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Invite Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 8))}
              placeholder="a1b2c3d4"
              maxLength={8}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-center font-mono text-lg tracking-wider placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Enter the 8-character code shared by the group owner
            </p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={code.length !== 8 || isJoining}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isJoining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Join Group
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
