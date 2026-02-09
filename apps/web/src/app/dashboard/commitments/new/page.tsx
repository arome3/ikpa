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
  AlertTriangle,
  Lock,
  UserPlus,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useGoals, type Goal } from '@/hooks/useFinance';
import { useCommitments, type CreateStakeInput } from '@/hooks/useCommitments';
import { useCurrency } from '@/hooks';

// ============================================
// CONSTANTS
// ============================================

const STEPS = [
  { id: 1, label: 'Subject Matter', shortLabel: 'I' },
  { id: 2, label: 'Protocol Selection', shortLabel: 'II' },
  { id: 3, label: 'Witness Appointment', shortLabel: 'III' },
  { id: 4, label: 'Execution', shortLabel: 'IV' },
];

const STAKE_TYPES = [
  {
    type: 'SOCIAL' as const,
    label: 'Option A: Social Accountability',
    subtitle: 'Public Disclosure Protocol',
    description: 'Your progress is shared publicly with friends. Accountability through visibility.',
    icon: Users,
    selectedBorder: 'border-emerald-600',
  },
  {
    type: 'ANTI_CHARITY' as const,
    label: 'Option B: Anti-Charity Escrow',
    subtitle: 'Adversarial Donation Protocol',
    description: 'If you fail, your stake goes to a cause you oppose. Strong motivator.',
    icon: AlertTriangle,
    selectedBorder: 'border-orange-500',
  },
  {
    type: 'LOSS_POOL' as const,
    label: 'Option C: Loss Pool Lockup',
    subtitle: 'Capital Forfeiture Protocol',
    description: 'Funds are locked. Succeed and they return. Fail and they are forfeited.',
    icon: Lock,
    selectedBorder: 'border-amber-500',
  },
] as const;

const VERIFICATION_METHODS = [
  { value: 'SELF_REPORT', label: 'Self-Attestation', description: 'You verify your own progress' },
  { value: 'REFEREE_VERIFY', label: 'Third-Party Verification', description: 'A trusted person verifies for you' },
  { value: 'AUTO_DETECT', label: 'Automated Surveillance', description: 'Automatically tracked from your data' },
];

const slideVariants = {
  enter: () => ({
    y: 20,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: () => ({
    y: -20,
    opacity: 0,
  }),
};

function generateProtocolNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `IKPA-${year}${month}-${rand}`;
}

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
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-[#A8A29E]" />
        </div>
        <h3 className="text-lg font-serif font-semibold text-[#1A2E22] mb-2">No active goals</h3>
        <p className="text-sm text-[#A8A29E] max-w-xs mx-auto">
          Create a financial goal first, then come back to stake a commitment on it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-serif text-[#1A2E22] mb-1">Select the Subject Matter</h2>
      <p className="text-sm text-[#A8A29E] mb-5">Choose which goal this contract will bind you to.</p>
      <div className="space-y-3">
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
                'w-full text-left p-4 rounded-lg border transition-all duration-200',
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                  : 'bg-white border-stone-200 hover:border-stone-300 hover:-translate-y-0.5'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className={cn('h-4 w-4', isSelected ? 'text-emerald-700' : 'text-[#A8A29E]')} />
                  <span className="text-sm font-medium text-[#1A2E22]">{goal.name}</span>
                </div>
                {isSelected && (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#44403C]">
                <span>{formatCurrency(Number(goal.currentAmount), 'USD')} / {formatCurrency(Number(goal.targetAmount), 'USD')}</span>
                <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
                <span>{Math.round(progress)}%</span>
              </div>
              {goal.targetDate && (
                <p className="text-xs text-[#A8A29E] mt-1.5">
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
    <div className="space-y-8">
      {/* Part A: Protocol Selection Cards */}
      <div>
        <h2 className="text-xl font-serif text-[#1A2E22] mb-1">Select Enforcement Protocol</h2>
        <p className="text-sm text-[#A8A29E] mb-5">Choose how your commitment will be enforced.</p>
        <div className="space-y-3">
          {STAKE_TYPES.map((stake) => {
            const Icon = stake.icon;
            const isSelected = selectedStakeType === stake.type;
            return (
              <button
                key={stake.type}
                onClick={() => onUpdate('stakeType', stake.type)}
                className={cn(
                  'w-full text-left p-6 rounded-lg border transition-all duration-200',
                  isSelected
                    ? `${stake.selectedBorder} bg-white shadow-sm`
                    : 'bg-white border-stone-200 hover:border-stone-300 hover:-translate-y-0.5'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-stone-50 flex-shrink-0">
                    <Icon className="h-5 w-5 text-[#44403C]" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#A8A29E] mb-1">{stake.subtitle}</p>
                    <p className="text-sm font-serif font-medium text-[#1A2E22]">{stake.label}</p>
                    <p className="text-sm text-[#44403C] leading-relaxed mt-1">{stake.description}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle className={cn('h-5 w-5 flex-shrink-0', {
                      'text-emerald-600': stake.type === 'SOCIAL',
                      'text-orange-500': stake.type === 'ANTI_CHARITY',
                      'text-amber-500': stake.type === 'LOSS_POOL',
                    })} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Part B: Natural Language Form (shown after protocol selected) */}
      {selectedStakeType && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Sentence-completion form */}
          <div className="bg-white border border-stone-200 rounded-lg p-6">
            <p
              className="text-[#44403C] leading-loose text-[15px]"
              style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic' }}
            >
              I commit to achieving this goal by{' '}
              <input
                type="date"
                value={deadline}
                onChange={(e) => onUpdate('deadline', e.target.value)}
                min={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
                className="inline-block border-b-2 border-stone-300 bg-transparent text-[#1A2E22] font-sans text-sm not-italic px-1 py-0.5 focus:outline-none focus:border-emerald-600 transition-colors"
              />
              {selectedStakeType !== 'SOCIAL' && (
                <>
                  {' '}with{' '}
                  <span className="inline-flex items-center">
                    <span className="text-[#A8A29E] text-sm font-sans not-italic mr-0.5">{currencySymbol}</span>
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => onUpdate('stakeAmount', e.target.value)}
                      placeholder="0"
                      min="1"
                      className="inline-block w-24 border-b-2 border-stone-300 bg-transparent text-[#1A2E22] font-sans text-sm not-italic px-1 py-0.5 focus:outline-none focus:border-emerald-600 transition-colors text-center"
                    />
                  </span>
                  {' '}held in escrow
                </>
              )}
              , verified by:
            </p>

            {/* Verification Method Pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {VERIFICATION_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => onUpdate('verificationMethod', method.value)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                    verificationMethod === method.value
                      ? 'bg-[#064E3B] text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  )}
                >
                  {method.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#A8A29E] mt-2">
              {VERIFICATION_METHODS.find((m) => m.value === verificationMethod)?.description}
            </p>
          </div>

          {/* Stake Amount Helper Text */}
          {selectedStakeType !== 'SOCIAL' && (
            <p className="text-xs text-[#A8A29E] -mt-4 px-1">
              Min: {currencySymbol}1 · Max: {currencySymbol}500,000 · Recommended: 5–15% of monthly discretionary spend
            </p>
          )}

          {/* Anti-Charity Clause */}
          {selectedStakeType === 'ANTI_CHARITY' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 p-5 rounded-lg space-y-3"
            >
              <p className="text-sm font-serif font-medium text-red-900">Adversarial Donation Clause</p>
              <p className="text-xs text-red-800 leading-relaxed">
                Upon failure to meet the stated objective, the escrowed sum shall be donated irrevocably to the cause specified below.
              </p>
              <div>
                <label className="text-xs font-medium text-red-800 uppercase tracking-wider mb-1.5 block">Cause You Oppose</label>
                <input
                  type="text"
                  value={antiCharityCause}
                  onChange={(e) => onUpdate('antiCharityCause', e.target.value)}
                  placeholder="e.g. Flat Earth Society"
                  className="w-full px-3 py-2.5 rounded-md bg-white border border-red-200 text-[#1A2E22] placeholder:text-red-300 focus:outline-none focus:border-red-400 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-red-800 uppercase tracking-wider mb-1.5 block">Donation URL (optional)</label>
                <input
                  type="url"
                  value={antiCharityUrl}
                  onChange={(e) => onUpdate('antiCharityUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-md bg-white border border-red-200 text-[#1A2E22] placeholder:text-red-300 focus:outline-none focus:border-red-400 text-sm"
                />
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
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
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <Check className="h-7 w-7 text-emerald-700" />
        </div>
        <h3 className="text-lg font-serif font-semibold text-[#1A2E22] mb-2">No Witness Required</h3>
        <p className="text-sm text-[#A8A29E] max-w-xs mx-auto">
          You chose {verificationMethod === 'SELF_REPORT' ? 'self-attestation' : 'automated surveillance'}.
          You can proceed to the next step.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-serif text-[#1A2E22] mb-1">Appoint a Witness</h2>
      <p className="text-sm text-[#A8A29E] mb-5">
        Invite someone you trust to verify your goal completion.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-[#44403C] uppercase tracking-wider mb-2 block">Witness Name</label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8A29E]" />
            <input
              type="text"
              value={refereeName}
              onChange={(e) => onUpdate('refereeName', e.target.value)}
              placeholder="Jane Doe"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white border border-stone-200 text-[#1A2E22] placeholder:text-stone-400 focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[#44403C] uppercase tracking-wider mb-2 block">Witness Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A8A29E]" />
            <input
              type="email"
              value={refereeEmail}
              onChange={(e) => onUpdate('refereeEmail', e.target.value)}
              placeholder="jane@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white border border-stone-200 text-[#1A2E22] placeholder:text-stone-400 focus:outline-none focus:border-emerald-600 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[#44403C] uppercase tracking-wider mb-2 block">Relationship</label>
          <select
            value={refereeRelationship}
            onChange={(e) => onUpdate('refereeRelationship', e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white border border-stone-200 text-[#1A2E22] focus:outline-none focus:border-emerald-600 transition-colors"
          >
            <option value="">Select relationship</option>
            <option value="FAMILY">Spouse / Family</option>
            <option value="FRIEND">Close Friend</option>
            <option value="COLLEAGUE">Colleague</option>
            <option value="COACH">Mentor / Coach</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP 4: SIGNATURE PAGE
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
  protocolNumber,
}: {
  goalName: string;
  stakeType: string;
  stakeAmount: string;
  deadline: string;
  verificationMethod: string;
  antiCharityCause: string;
  refereeName: string;
  currencySymbol: string;
  protocolNumber: string;
}) {
  const stakeConf = STAKE_TYPES.find((s) => s.type === stakeType);
  const verificationLabel = VERIFICATION_METHODS.find((m) => m.value === verificationMethod)?.label || verificationMethod;
  const formattedDeadline = deadline
    ? new Date(deadline + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Determine clause numbering (shifts if anti-charity clause is present)
  const isAntiCharity = stakeType === 'ANTI_CHARITY' && antiCharityCause;
  const governingClauseNum = isAntiCharity ? 'IV' : 'III';

  return (
    <div>
      {/* Document */}
      <div className="bg-white shadow-xl max-w-2xl mx-auto p-8 md:p-12 min-h-[500px] md:min-h-[600px] border border-stone-100 rounded-sm relative overflow-hidden">
        {/* DRAFT Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[80px] md:text-[120px] font-serif font-bold text-stone-100 -rotate-12">
            DRAFT
          </span>
        </div>

        {/* Document Content (above watermark) */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex justify-between items-start text-xs font-mono text-[#A8A29E] mb-6">
            <span>{protocolNumber}</span>
            <span>{today}</span>
          </div>

          <div className="text-center mb-8">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-[#A8A29E] mb-3">
              Commitment Protocol
            </p>
            <h2
              className="text-2xl md:text-3xl font-serif text-[#1A2E22] mb-4"
            >
              {goalName}
            </h2>
            <div className="w-16 h-px bg-stone-300 mx-auto" />
          </div>

          {/* Contract Body */}
          <div className="space-y-5 text-[15px] text-[#44403C] leading-relaxed">
            {/* Clause I */}
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#A8A29E] mb-2">Clause I. Objective</p>
              <p style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic' }}>
                The undersigned hereby commits to the achievement of &ldquo;{goalName}&rdquo;
                {stakeType !== 'SOCIAL' && stakeAmount && (
                  <> with {currencySymbol}{Number(stakeAmount).toLocaleString()} placed in escrow</>
                )}
                , to be completed no later than {formattedDeadline}.
              </p>
            </div>

            {/* Clause II */}
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#A8A29E] mb-2">Clause II. Enforcement Mechanism</p>
              <p style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic' }}>
                This commitment shall be enforced under the {stakeConf?.subtitle || 'selected protocol'} terms.
                Compliance shall be determined via {verificationLabel.toLowerCase()}
                {verificationMethod === 'REFEREE_VERIFY' && refereeName && (
                  <>, witnessed by {refereeName}</>
                )}
                .
              </p>
            </div>

            {/* Clause III (Anti-Charity only) */}
            {isAntiCharity && (
              <div className="bg-red-50 border border-red-100 p-4 rounded">
                <p className="font-mono text-xs uppercase tracking-wider text-red-800 mb-2">Clause III. Adversarial Donation</p>
                <p className="text-red-900 text-sm" style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic' }}>
                  In the event of failure, the escrowed sum shall be donated irrevocably to &ldquo;{antiCharityCause}&rdquo;.
                  This clause is non-negotiable and shall take effect immediately upon deadline expiry without achievement.
                </p>
              </div>
            )}

            {/* Governing Terms */}
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-[#A8A29E] mb-2">Clause {governingClauseNum}. Governing Terms</p>
              <p className="text-sm text-[#A8A29E]" style={{ fontFamily: 'Merriweather, Georgia, serif', fontStyle: 'italic' }}>
                This protocol is self-enforcing and operates under the rules of the IKPA Commitment Engine.
                Early withdrawal may incur penalties as determined by the stake type and elapsed time.
                The committed party acknowledges the irrevocable nature of this agreement upon execution.
              </p>
            </div>
          </div>

          {/* Signature Line */}
          <div className="mt-12 pt-8">
            <div className="max-w-xs">
              <div className="border-b border-stone-400 mb-2 h-8" />
              <p className="text-xs text-[#A8A29E] font-mono">Signature of the Committed Party</p>
              <p className="text-xs text-[#A8A29E] font-mono mt-1">{today}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Warning below document */}
      <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Once executed, your stake will be locked. You can cancel early but may incur a penalty depending on the stake type and timing.
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
  const [protocolNumber] = useState(() => generateProtocolNumber());

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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-stone-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 md:px-12 py-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <button
          onClick={() => step > 1 ? goBack() : router.back()}
          className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[#44403C]" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-serif text-[#1A2E22]">Draft New Contract</h1>
          <p className="text-xs text-[#A8A29E] font-mono mt-0.5">{protocolNumber}</p>
        </div>
        <FileText className="h-5 w-5 text-[#A8A29E]" strokeWidth={1.5} />
      </motion.header>

      {/* Progress Breadcrumbs */}
      <div className="flex items-center gap-1 mb-8 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1">
            <span
              className={cn(
                'text-xs font-medium transition-colors',
                step > s.id
                  ? 'text-emerald-700'
                  : step === s.id
                    ? 'text-[#1A2E22] font-semibold'
                    : 'text-[#A8A29E]'
              )}
            >
              {s.shortLabel}. {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-[#A8A29E] flex-shrink-0" />
            )}
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
            transition={{ duration: 0.4, ease: 'easeInOut' }}
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
                protocolNumber={protocolNumber}
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
          className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2"
        >
          <AlertCircle className="h-4 w-4 text-red-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
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
            className="flex-1 py-3 rounded-full border border-stone-300 text-[#44403C] text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Back
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={goNext}
            disabled={!canAdvance()}
            className={cn(
              'flex-1 py-3 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2',
              canAdvance()
                ? 'bg-[#064E3B] text-white hover:bg-[#053F30] shadow-md'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            )}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isCreatingStake}
            className="flex-1 py-3.5 rounded-full bg-[#064E3B] text-white text-sm font-medium shadow-lg hover:bg-[#053F30] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isCreatingStake ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Sign &amp; Execute Protocol
              </>
            )}
          </button>
        )}
      </motion.div>
    </div>
  );
}
