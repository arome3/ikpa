'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Check,
  Target,
  Users,
  HeartCrack,
  Lock,
  Calendar,
  UserPlus,
  Mail,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGoals, type Goal } from '@/hooks/useFinance';
import { useCommitments, type CreateStakeInput } from '@/hooks/useCommitments';
import { useCurrency } from '@/hooks';

// ============================================
// CONSTANTS
// ============================================

const STEPS = [
  { id: 1, label: 'Select Goal' },
  { id: 2, label: 'Stake Config' },
  { id: 3, label: 'Referee' },
  { id: 4, label: 'Confirm' },
];

const STAKE_TYPES = [
  {
    type: 'SOCIAL' as const,
    label: 'Social Stake',
    description: 'Your progress is shared publicly with friends. Accountability through visibility.',
    icon: Users,
    color: 'purple',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    gradient: 'from-purple-500 to-violet-600',
  },
  {
    type: 'ANTI_CHARITY' as const,
    label: 'Anti-Charity',
    description: 'If you fail, your stake goes to a cause you oppose. Strong motivator.',
    icon: HeartCrack,
    color: 'red',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30',
    text: 'text-red-400',
    gradient: 'from-red-500 to-rose-600',
  },
  {
    type: 'LOSS_POOL' as const,
    label: 'Loss Pool',
    description: 'Funds are locked. Succeed and they return. Fail and they are forfeited.',
    icon: Lock,
    color: 'amber',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    gradient: 'from-amber-500 to-yellow-600',
  },
] as const;

const VERIFICATION_METHODS = [
  { value: 'SELF_REPORT', label: 'Self Report', description: 'You verify your own progress' },
  { value: 'REFEREE_VERIFY', label: 'Referee Verify', description: 'A trusted person verifies for you' },
  { value: 'AUTO_DETECT', label: 'Auto Detect', description: 'Automatically tracked from your data' },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 200 : -200,
    opacity: 0,
  }),
};

// ============================================
// STEP 1: GOAL SELECTION
// ============================================

function GoalSelectionStep({
  goals,
  selectedGoalId,
  onSelect,
}: {
  goals: Goal[];
  selectedGoalId: string | null;
  onSelect: (id: string) => void;
}) {
  const activeGoals = goals.filter((g) => g.status === 'ACTIVE');

  if (activeGoals.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No active goals</h3>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Create a financial goal first, then come back to stake a commitment on it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">Choose which goal to commit to:</p>
      <div className="space-y-2">
        {activeGoals.map((goal) => {
          const progress = Number(goal.targetAmount) > 0
            ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
            : 0;
          const isSelected = selectedGoalId === goal.id;

          return (
            <button
              key={goal.id}
              onClick={() => onSelect(goal.id)}
              className={cn(
                'w-full text-left p-4 rounded-xl border transition-all',
                isSelected
                  ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className={cn('h-4 w-4', isSelected ? 'text-purple-400' : 'text-slate-400')} />
                  <span className="text-sm font-medium text-white">{goal.name}</span>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{formatCurrency(Number(goal.currentAmount), 'USD')} / {formatCurrency(Number(goal.targetAmount), 'USD')}</span>
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
                <span>{Math.round(progress)}%</span>
              </div>
              {goal.targetDate && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Deadline: {new Date(goal.targetDate).toLocaleDateString()}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// STEP 2: STAKE CONFIGURATION
// ============================================

function StakeConfigStep({
  selectedStakeType,
  stakeAmount,
  deadline,
  verificationMethod,
  antiCharityCause,
  antiCharityUrl,
  onUpdate,
  currencySymbol,
}: {
  selectedStakeType: string | null;
  stakeAmount: string;
  deadline: string;
  verificationMethod: string;
  antiCharityCause: string;
  antiCharityUrl: string;
  onUpdate: (field: string, value: string) => void;
  currencySymbol: string;
}) {
  return (
    <div className="space-y-6">
      {/* Stake Type Cards */}
      <div>
        <p className="text-sm text-slate-400 mb-3">Choose your accountability mechanism:</p>
        <div className="space-y-3">
          {STAKE_TYPES.map((stake) => {
            const Icon = stake.icon;
            const isSelected = selectedStakeType === stake.type;
            return (
              <button
                key={stake.type}
                onClick={() => onUpdate('stakeType', stake.type)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all',
                  isSelected
                    ? `${stake.border} ${stake.bg} ring-1 ring-${stake.color}-500/30`
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', stake.bg)}>
                    <Icon className={cn('h-5 w-5', stake.text)} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{stake.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{stake.description}</p>
                  </div>
                  {isSelected && (
                    <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', `bg-${stake.color}-500`)}>
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stake Amount */}
      {selectedStakeType && selectedStakeType !== 'SOCIAL' && (
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Stake Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
              {currencySymbol}
            </span>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => onUpdate('stakeAmount', e.target.value)}
              placeholder="50"
              min="1"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Recommended: 5-15% of your monthly discretionary spend</p>
        </div>
      )}

      {/* Anti-Charity Cause */}
      {selectedStakeType === 'ANTI_CHARITY' && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Cause you oppose</label>
            <input
              type="text"
              value={antiCharityCause}
              onChange={(e) => onUpdate('antiCharityCause', e.target.value)}
              placeholder="e.g. Flat Earth Society"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Donation URL (optional)</label>
            <input
              type="url"
              value={antiCharityUrl}
              onChange={(e) => onUpdate('antiCharityUrl', e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />
          </div>
        </div>
      )}

      {/* Deadline */}
      <div>
        <label className="text-sm font-medium text-slate-300 mb-2 block">Deadline</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => onUpdate('deadline', e.target.value)}
          min={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 [color-scheme:dark]"
        />
      </div>

      {/* Verification Method */}
      <div>
        <label className="text-sm font-medium text-slate-300 mb-2 block">Verification method</label>
        <div className="space-y-2">
          {VERIFICATION_METHODS.map((method) => (
            <button
              key={method.value}
              onClick={() => onUpdate('verificationMethod', method.value)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between',
                verificationMethod === method.value
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <div>
                <p className="text-sm text-white">{method.label}</p>
                <p className="text-xs text-slate-400">{method.description}</p>
              </div>
              {verificationMethod === method.value && (
                <Check className="h-4 w-4 text-purple-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP 3: REFEREE INVITE
// ============================================

function RefereeStep({
  verificationMethod,
  refereeName,
  refereeEmail,
  refereeRelationship,
  onUpdate,
}: {
  verificationMethod: string;
  refereeName: string;
  refereeEmail: string;
  refereeRelationship: string;
  onUpdate: (field: string, value: string) => void;
}) {
  if (verificationMethod !== 'REFEREE_VERIFY') {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="h-7 w-7 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No referee needed</h3>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          You chose {verificationMethod === 'SELF_REPORT' ? 'self-reporting' : 'auto-detection'}.
          You can skip this step.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">
        Invite someone you trust to verify your goal completion:
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Referee&apos;s name</label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={refereeName}
              onChange={(e) => onUpdate('refereeName', e.target.value)}
              placeholder="Jane Doe"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Referee&apos;s email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="email"
              value={refereeEmail}
              onChange={(e) => onUpdate('refereeEmail', e.target.value)}
              placeholder="jane@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Relationship</label>
          <select
            value={refereeRelationship}
            onChange={(e) => onUpdate('refereeRelationship', e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 [color-scheme:dark]"
          >
            <option value="">Select relationship</option>
            <option value="spouse">Spouse / Partner</option>
            <option value="friend">Close Friend</option>
            <option value="family">Family Member</option>
            <option value="mentor">Mentor / Coach</option>
            <option value="colleague">Colleague</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP 4: CONFIRMATION
// ============================================

function ConfirmationStep({
  goalName,
  stakeType,
  stakeAmount,
  deadline,
  verificationMethod,
  antiCharityCause,
  refereeName,
  currencySymbol,
}: {
  goalName: string;
  stakeType: string;
  stakeAmount: string;
  deadline: string;
  verificationMethod: string;
  antiCharityCause: string;
  refereeName: string;
  currencySymbol: string;
}) {
  const stakeConf = STAKE_TYPES.find((s) => s.type === stakeType);
  const StakeIcon = stakeConf?.icon || ShieldCheck;

  return (
    <div>
      <p className="text-sm text-slate-400 mb-4">Review your commitment before locking it in:</p>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {/* Goal */}
        <div className="p-4 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Goal</p>
          <p className="text-white font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-400" />
            {goalName}
          </p>
        </div>

        {/* Stake Type */}
        <div className="p-4 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Stake Type</p>
          <p className={cn('font-medium flex items-center gap-2', stakeConf?.text || 'text-white')}>
            <StakeIcon className="h-4 w-4" />
            {stakeConf?.label || stakeType}
          </p>
          {stakeType === 'ANTI_CHARITY' && antiCharityCause && (
            <p className="text-xs text-red-400/70 mt-1">Cause: {antiCharityCause}</p>
          )}
        </div>

        {/* Amount */}
        {stakeType !== 'SOCIAL' && stakeAmount && (
          <div className="p-4 border-b border-white/10">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Amount at Stake</p>
            <p className="text-xl font-bold text-white">
              {currencySymbol}{Number(stakeAmount).toLocaleString()}
            </p>
          </div>
        )}

        {/* Deadline */}
        <div className="p-4 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Deadline</p>
          <p className="text-white font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            {deadline ? new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '--'}
          </p>
        </div>

        {/* Verification */}
        <div className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Verification</p>
          <p className="text-white font-medium">
            {VERIFICATION_METHODS.find((m) => m.value === verificationMethod)?.label || verificationMethod}
          </p>
          {verificationMethod === 'REFEREE_VERIFY' && refereeName && (
            <p className="text-xs text-slate-400 mt-1">Referee: {refereeName}</p>
          )}
        </div>
      </div>

      {/* Warning */}
      <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80">
          Once created, your stake will be locked. You can cancel early but may incur a penalty depending on the stake type and timing.
        </p>
      </div>
    </div>
  );
}

// ============================================
// MAIN WIZARD
// ============================================

export default function NewCommitmentWizard() {
  const router = useRouter();
  const { symbol: currencySymbol } = useCurrency();
  const { items: goals, isLoading: goalsLoading } = useGoals();
  const { createStake, isCreatingStake } = useCommitments();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [stakeType, setStakeType] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('SELF_REPORT');
  const [antiCharityCause, setAntiCharityCause] = useState('');
  const [antiCharityUrl, setAntiCharityUrl] = useState('');
  const [refereeName, setRefereeName] = useState('');
  const [refereeEmail, setRefereeEmail] = useState('');
  const [refereeRelationship, setRefereeRelationship] = useState('');

  const selectedGoal = goals.find((g) => g.id === selectedGoalId);

  const handleFieldUpdate = useCallback((field: string, value: string) => {
    switch (field) {
      case 'stakeType': setStakeType(value); break;
      case 'stakeAmount': setStakeAmount(value); break;
      case 'deadline': setDeadline(value); break;
      case 'verificationMethod': setVerificationMethod(value); break;
      case 'antiCharityCause': setAntiCharityCause(value); break;
      case 'antiCharityUrl': setAntiCharityUrl(value); break;
      case 'refereeName': setRefereeName(value); break;
      case 'refereeEmail': setRefereeEmail(value); break;
      case 'refereeRelationship': setRefereeRelationship(value); break;
    }
  }, []);

  const canAdvance = () => {
    switch (step) {
      case 1: return !!selectedGoalId;
      case 2: return !!stakeType && !!deadline && !!verificationMethod &&
        (stakeType === 'SOCIAL' || Number(stakeAmount) > 0) &&
        (stakeType !== 'ANTI_CHARITY' || antiCharityCause.trim().length > 0);
      case 3:
        if (verificationMethod !== 'REFEREE_VERIFY') return true;
        return refereeName.trim().length > 0 && refereeEmail.trim().length > 0 && refereeRelationship.trim().length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (step < 4) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!selectedGoalId || !stakeType || !deadline) return;
    setError(null);

    try {
      const input: CreateStakeInput = {
        goalId: selectedGoalId,
        stakeType,
        verificationMethod,
        deadline: new Date(deadline + 'T23:59:59').toISOString(),
        idempotencyKey: `${selectedGoalId}-${stakeType}-${Date.now()}`,
      };

      if (stakeType !== 'SOCIAL' && stakeAmount) {
        input.stakeAmount = Number(stakeAmount);
      }
      if (stakeType === 'ANTI_CHARITY') {
        input.antiCharityCause = antiCharityCause;
        if (antiCharityUrl) input.antiCharityUrl = antiCharityUrl;
      }
      if (verificationMethod === 'REFEREE_VERIFY') {
        input.refereeEmail = refereeEmail;
        input.refereeName = refereeName;
        input.refereeRelationship = refereeRelationship;
      }

      await createStake(input);
      router.push('/dashboard/commitments');
    } catch (err: any) {
      setError(err?.message || 'Failed to create commitment. Please try again.');
    }
  };

  if (goalsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Ambient BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <button
            onClick={() => step > 1 ? goBack() : router.back()}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">New Commitment</h1>
            <p className="text-xs text-slate-400">Step {step} of 4: {STEPS[step - 1].label}</p>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-5 w-5 text-purple-400" />
          </div>
        </motion.header>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400"
                initial={{ width: 0 }}
                animate={{ width: step >= s.id ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {step === 1 && (
                <GoalSelectionStep
                  goals={goals}
                  selectedGoalId={selectedGoalId}
                  onSelect={setSelectedGoalId}
                />
              )}
              {step === 2 && (
                <StakeConfigStep
                  selectedStakeType={stakeType}
                  stakeAmount={stakeAmount}
                  deadline={deadline}
                  verificationMethod={verificationMethod}
                  antiCharityCause={antiCharityCause}
                  antiCharityUrl={antiCharityUrl}
                  onUpdate={handleFieldUpdate}
                  currencySymbol={currencySymbol}
                />
              )}
              {step === 3 && (
                <RefereeStep
                  verificationMethod={verificationMethod}
                  refereeName={refereeName}
                  refereeEmail={refereeEmail}
                  refereeRelationship={refereeRelationship}
                  onUpdate={handleFieldUpdate}
                />
              )}
              {step === 4 && (
                <ConfirmationStep
                  goalName={selectedGoal?.name || 'Unknown Goal'}
                  stakeType={stakeType || 'SOCIAL'}
                  stakeAmount={stakeAmount}
                  deadline={deadline}
                  verificationMethod={verificationMethod}
                  antiCharityCause={antiCharityCause}
                  refereeName={refereeName}
                  currencySymbol={currencySymbol}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </motion.div>
        )}

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 mt-8"
        >
          {step > 1 && (
            <button
              onClick={goBack}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={goNext}
              disabled={!canAdvance()}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2',
                canAdvance()
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-violet-500'
                  : 'bg-white/5 text-slate-500 cursor-not-allowed'
              )}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isCreatingStake}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-violet-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCreatingStake ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Lock In Commitment
                </>
              )}
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
