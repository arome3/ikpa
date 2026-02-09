'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Send,
  MessageCircle,
  Mail,
  FileText,
  TrendingUp,
  Circle,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Minus,
  Plus,
  GitBranch,
  Pause,
  Play,
  BarChart3,
  ScrollText,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { useFutureSelf } from '@/hooks/useFutureSelf';
import type { ConversationMessage, LetterDetail, TimelineProjection } from '@/hooks/useFutureSelf';

// ============================================
// CONSTANTS
// ============================================

const TIME_HORIZONS = [
  { key: '6mo', label: '6 months', years: 0.5 },
  { key: '1yr', label: '1 year', years: 1 },
  { key: '5yr', label: '5 years', years: 5 },
  { key: '10yr', label: '10 years', years: 10 },
  { key: '20yr', label: '20 years', years: 20 },
] as const;

type HorizonKey = '6mo' | '1yr' | '5yr' | '10yr' | '20yr';

// ============================================
// CUSTOM TOOLTIP
// ============================================

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  const current = payload.find(p => p.dataKey === 'currentPath')?.value ?? 0;
  const optimized = payload.find(p => p.dataKey === 'optimizedPath')?.value ?? 0;
  const diff = optimized - current;

  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-md">
      <p className="font-mono text-xs text-stone-400 mb-1">{label}</p>
      <p className="font-mono text-sm text-[#44403C]">Current: <span className="font-medium">{formatCurrency(current, 'USD', { compact: true })}</span></p>
      <p className="font-mono text-sm text-[#064E3B]">With IKPA: <span className="font-medium">{formatCurrency(optimized, 'USD', { compact: true })}</span></p>
      <p className="font-mono text-xs text-[#3F6212] mt-1 border-t border-stone-100 pt-1">Gap: +{formatCurrency(diff, 'USD', { compact: true })}</p>
    </div>
  );
}

// ============================================
// TYPEWRITER COMPONENT
// ============================================

function TypewriterText({ text, speed = 15, onComplete }: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        indexRef.current++;
        setDisplayed(text.slice(0, indexRef.current));
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-4 bg-[#064E3B] animate-pulse ml-0.5 align-text-bottom" />
      )}
    </span>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function FutureSelfPage() {
  const {
    simulation,
    isLoadingSimulation,
    generateLetter,
    isGeneratingLetter,
    generateRegretLetter,
    isGeneratingRegretLetter,
    letterHistory,
    isLoadingHistory,
    stats,
    isLoadingStats,
    preferences,
    isLoadingPreferences,
    updatePreferences,
    isUpdatingPreferences,
    updateEngagement,
    sendMessage,
    isSendingMessage,
    getLetterDetail,
    getConversation,
    getTimeline,
    commitments,
    createCommitment,
    isCreatingCommitment,
    updateCommitment,
    isUpdatingCommitment,
    checkinStatus,
    isLoadingCheckinStatus,
    checkin,
    isCheckingIn,
    debriefs,
    isLoadingDebriefs,
  } = useFutureSelf();

  const [selectedHorizon, setSelectedHorizon] = useState<number>(2); // Default: 5yr
  const [letterContent, setLetterContent] = useState<string | null>(null);
  const [letterLetterId, setLetterLetterId] = useState<string | null>(null);
  const [letterMode, setLetterMode] = useState<'gratitude' | 'regret'>('gratitude');
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [readStartTime, setReadStartTime] = useState<number | null>(null);

  // Conversation state
  const [chatMessages, setChatMessages] = useState<ConversationMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Commitment state
  const [showCommitment, setShowCommitment] = useState(false);
  const [commitmentAmount, setCommitmentAmount] = useState(10);
  const [commitmentCreated, setCommitmentCreated] = useState(false);

  // Letter detail modal
  const [selectedLetter, setSelectedLetter] = useState<LetterDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Timeline detail
  const [timelineDetail, setTimelineDetail] = useState<TimelineProjection | null>(null);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // Conversation history loading
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // Build chart data from simulation, scoped to selected horizon
  // This ensures the y-axis auto-scales to the visible range,
  // making differences visible at shorter horizons
  const chartData = simulation
    ? TIME_HORIZONS.slice(0, selectedHorizon + 1).map(h => ({
        name: h.label,
        currentPath: simulation.currentBehavior.projectedNetWorth[h.key as HorizonKey],
        optimizedPath: simulation.withIKPA.projectedNetWorth[h.key as HorizonKey],
      }))
    : [];

  // Current horizon values
  const horizonKey = TIME_HORIZONS[selectedHorizon].key as HorizonKey;
  const currentValue = simulation?.currentBehavior.projectedNetWorth[horizonKey] ?? 0;
  const optimizedValue = simulation?.withIKPA.projectedNetWorth[horizonKey] ?? 0;
  const horizonDifference = optimizedValue - currentValue;

  // Handle letter generation
  const handleGenerateLetter = async () => {
    try {
      const result = await generateLetter();
      setLetterContent(result.content);
      setLetterLetterId(result.id ?? null);
      setLetterMode('gratitude');
      setTypewriterDone(false);
      setReadStartTime(Date.now());
      setShowChat(false);
      setChatMessages([]);
      setShowCommitment(false);
      setCommitmentCreated(false);

      // Compute default commitment amount from the 6-month projected wealth gap
      if (simulation) {
        const sixMonthGap =
          (simulation.withIKPA.projectedNetWorth['6mo'] ?? 0) -
          (simulation.currentBehavior.projectedNetWorth['6mo'] ?? 0);
        const dailyAmount = Math.round(sixMonthGap / 180);
        // Round up to nearest $5, minimum $5
        setCommitmentAmount(Math.max(Math.ceil(dailyAmount / 5) * 5, 5));
      }
    } catch {
      // Error handled by React Query
    }
  };

  // Handle regret letter generation
  const handleGenerateRegretLetter = async () => {
    try {
      const result = await generateRegretLetter();
      setLetterContent(result.content);
      setLetterLetterId(result.id ?? null);
      setLetterMode('regret');
      setTypewriterDone(false);
      setReadStartTime(Date.now());
      setShowChat(false);
      setChatMessages([]);
      setShowCommitment(false);
      setCommitmentCreated(false);
    } catch {
      // Error handled by React Query
    }
  };

  // Track engagement when typewriter completes
  const handleTypewriterComplete = useCallback(() => {
    setTypewriterDone(true);
    setShowCommitment(true);
    if (letterLetterId && readStartTime) {
      const duration = Date.now() - readStartTime;
      updateEngagement({ letterId: letterLetterId, readDurationMs: duration }).catch(() => {});
    }
  }, [letterLetterId, readStartTime, updateEngagement]);

  // Handle sending chat message
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !letterLetterId) return;

    const userMsg: ConversationMessage = {
      role: 'user',
      content: chatInput,
      createdAt: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    try {
      const result = await sendMessage({ letterId: letterLetterId, message: chatInput });
      setChatMessages(result.messages);
    } catch {
      // Show error inline
      setChatMessages(prev => [...prev, {
        role: 'future_self' as const,
        content: 'I had trouble responding. Please try again.',
        createdAt: new Date().toISOString(),
      }]);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load previous conversation history when chat opens
  useEffect(() => {
    if (!showChat || !letterLetterId || chatMessages.length > 0) return;
    let cancelled = false;
    setIsLoadingConversation(true);
    getConversation(letterLetterId)
      .then((data) => {
        if (!cancelled && data.messages?.length > 0) {
          setChatMessages(data.messages);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingConversation(false); });
    return () => { cancelled = true; };
  }, [showChat, letterLetterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch timeline detail when horizon changes
  useEffect(() => {
    const years = TIME_HORIZONS[selectedHorizon].years;
    if (years < 1) { setTimelineDetail(null); return; }
    let cancelled = false;
    setIsLoadingTimeline(true);
    getTimeline(years)
      .then((data) => { if (!cancelled) setTimelineDetail(data); })
      .catch(() => { if (!cancelled) setTimelineDetail(null); })
      .finally(() => { if (!cancelled) setIsLoadingTimeline(false); });
    return () => { cancelled = true; };
  }, [selectedHorizon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle commitment creation
  const handleCreateCommitment = async () => {
    if (!letterLetterId) return;
    try {
      await createCommitment({ letterId: letterLetterId, dailyAmount: commitmentAmount });
      setCommitmentCreated(true);
    } catch {
      // Error handled by React Query
    }
  };

  // Handle letter detail click
  const handleLetterClick = async (letterId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await getLetterDetail(letterId);
      setSelectedLetter(detail);
    } catch {
      // silently fail
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Check if user has active commitment
  const activeCommitment = commitments?.find(c => c.status === 'ACTIVE' || c.status === 'PAUSED');

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-8 md:py-12 space-y-8">
      {/* Header — "The Vision Statement" */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-[#1A2E22] tracking-tight">
            Long-Term Projection
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Visualizing the compound impact of your daily choices.
          </p>
        </div>
        <button
          onClick={() => updatePreferences({ weeklyLettersEnabled: !preferences?.weeklyLettersEnabled })}
          disabled={isLoadingPreferences || isUpdatingPreferences}
          className="p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
          title={preferences?.weeklyLettersEnabled ? 'Disable weekly letters' : 'Enable weekly letters'}
        >
          <Settings className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </motion.header>

      {/* Active Commitment — "Daily Ledger" Card */}
      {activeCommitment && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Card
            variant="paper"
            padding="lg"
            className={cn(
              activeCommitment.status === 'ACTIVE' && checkinStatus?.checkedInToday
                ? 'bg-emerald-50 border-emerald-200'
                : '',
            )}
          >
            <div className="flex items-center justify-between">
              {/* Left side */}
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-stone-400">
                  Daily Micro-Commitment
                </p>
                <p className="text-xl font-serif text-[#1A2E22]">
                  Save {formatCurrency(activeCommitment.dailyAmount, activeCommitment.currency)} today.
                </p>
                <p className="font-mono text-sm text-stone-400">
                  Consistency: {checkinStatus?.streakDays ?? activeCommitment.streakDays} Days
                </p>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2">
                {activeCommitment.status === 'ACTIVE' && (
                  <>
                    {isLoadingCheckinStatus ? (
                      <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                    ) : checkinStatus?.checkedInToday ? (
                      <CheckCircle2 className="w-6 h-6 text-[#3F6212]" />
                    ) : (
                      <button
                        onClick={() => checkin({ commitmentId: activeCommitment.id })}
                        disabled={isCheckingIn}
                        className={cn(
                          'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                          'bg-[#064E3B] text-white hover:bg-[#053D2E]',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        )}
                      >
                        {isCheckingIn ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Checking in...
                          </span>
                        ) : (
                          'Confirm Deposit'
                        )}
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => updateCommitment({
                    id: activeCommitment.id,
                    status: activeCommitment.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                  })}
                  disabled={isUpdatingCommitment}
                  className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors disabled:opacity-50"
                  title={activeCommitment.status === 'ACTIVE' ? 'Pause commitment' : 'Resume commitment'}
                >
                  {activeCommitment.status === 'ACTIVE'
                    ? <Pause className="w-4 h-4" strokeWidth={1.5} />
                    : <Play className="w-4 h-4" strokeWidth={1.5} />
                  }
                </button>
              </div>
            </div>

            {/* Longest streak & paused indicator */}
            <div className="flex items-center justify-between mt-3 text-xs text-stone-400">
              <span className="font-mono">
                Longest streak: {checkinStatus?.longestStreak ?? activeCommitment.longestStreak} days
              </span>
              {activeCommitment.status === 'PAUSED' && (
                <span className="text-stone-500 uppercase tracking-wider">Paused</span>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Leaderboard Link */}
      <Link href="/dashboard/future-self/leaderboard">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <Card
            variant="paper"
            padding="md"
            className="flex items-center gap-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
          >
            <BarChart3 className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="font-serif text-[#1A2E22]">Community Benchmarks</p>
              <p className="text-xs text-stone-400">See how your consistency compares</p>
            </div>
            {activeCommitment && (
              <span className="font-mono text-xs text-stone-500">
                {checkinStatus?.streakDays ?? activeCommitment.streakDays}d
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
          </Card>
        </motion.div>
      </Link>

      {/* Chart — "Scientific Projection" */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3, ease: 'easeOut' }}
      >
        <Card variant="paper" padding="lg">
          <h2 className="text-lg font-serif text-[#1A2E22] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
            Net Worth Trajectory
          </h2>

          {isLoadingSimulation ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
          ) : simulation ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#064E3B" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#064E3B" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="stoneGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A8A29E" stopOpacity={0.06} />
                        <stop offset="100%" stopColor="#A8A29E" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#A8A29E', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                      axisLine={{ stroke: '#E7E5E4' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#A8A29E', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => formatCurrency(v, 'USD', { compact: true })}
                      width={65}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="currentPath"
                      stroke="#A8A29E"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      fill="url(#stoneGradient)"
                      dot={{ r: 3, fill: '#A8A29E', strokeWidth: 0 }}
                      name="Current Path"
                    />
                    <Area
                      type="monotone"
                      dataKey="optimizedPath"
                      stroke="#064E3B"
                      strokeWidth={2}
                      fill="url(#emeraldGradient)"
                      dot={{ r: 4, fill: '#064E3B', strokeWidth: 0 }}
                      name="With IKPA"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Time Horizon Pills */}
              <div className="mt-4">
                <div className="flex justify-between mb-2">
                  {TIME_HORIZONS.map((h, i) => (
                    <button
                      key={h.key}
                      onClick={() => setSelectedHorizon(i)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full transition-colors font-mono',
                        selectedHorizon === i
                          ? 'bg-[#064E3B] text-white'
                          : 'text-stone-400 hover:bg-stone-100',
                      )}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={selectedHorizon}
                  onChange={(e) => setSelectedHorizon(Number(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-900"
                />
                <motion.div
                  key={selectedHorizon}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="text-center mt-3"
                >
                  <p className="text-sm text-stone-400">
                    In <span className="font-serif text-[#1A2E22] font-medium">{TIME_HORIZONS[selectedHorizon].label}</span>, you could have
                  </p>
                  <p className="text-2xl font-serif text-[#1A2E22] mt-1">
                    {formatCurrency(horizonDifference, 'USD', { compact: true })}
                    <span className="text-sm font-normal text-stone-400 ml-2">more</span>
                  </p>
                </motion.div>

                {/* Timeline Detail Cards */}
                <AnimatePresence mode="wait">
                  {timelineDetail && !isLoadingTimeline && (
                    <motion.div
                      key={`detail-${selectedHorizon}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="mt-3 grid grid-cols-3 gap-2 text-center"
                    >
                      <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                        <p className="text-[10px] uppercase tracking-wider text-stone-400">Current Path</p>
                        <p className="font-mono text-sm text-[#44403C]">
                          {formatCurrency(timelineDetail.currentPath, 'USD', { compact: true })}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                        <p className="text-[10px] uppercase tracking-wider text-stone-400">With IKPA</p>
                        <p className="font-mono text-sm text-[#064E3B]">
                          {formatCurrency(timelineDetail.optimizedPath, 'USD', { compact: true })}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                        <p className="text-[10px] uppercase tracking-wider text-stone-400">Difference</p>
                        <p className="font-mono text-sm text-[#3F6212]">
                          +{formatCurrency(timelineDetail.difference, 'USD', { compact: true })}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-stone-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0 border-t border-dashed border-stone-400 inline-block" /> Current Path
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0 border-t-2 border-[#064E3B] inline-block" /> With IKPA
                </span>
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-stone-400">
              No simulation data available
            </div>
          )}
        </Card>
      </motion.section>

      {/* Letter Section — "Correspondence" */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
      >
        <Card variant="paper" padding="lg">
          <h2 className="text-lg font-serif text-[#1A2E22] mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
            Correspondence
          </h2>

          {!letterContent ? (
            <div className="text-center py-8">
              <p className="text-stone-400 mb-4">
                Your future self has something to tell you...
              </p>
              <button
                onClick={handleGenerateLetter}
                disabled={isGeneratingLetter}
                className={cn(
                  'px-6 py-3 rounded-full font-medium transition-all',
                  'border border-[#064E3B] text-[#064E3B]',
                  'hover:bg-[#064E3B] hover:text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {isGeneratingLetter ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Your future self is writing...
                  </span>
                ) : (
                  'Generate Letter'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Letter mode indicator */}
              {letterMode === 'regret' && (
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <GitBranch className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
                  <span>Letter from the path not taken</span>
                </div>
              )}

              {/* Letter content — stationery feel */}
              <div className={cn(
                'p-8 rounded-xl bg-[#FDFCF8] border font-serif text-[#44403C] leading-relaxed whitespace-pre-wrap',
                letterMode === 'regret'
                  ? 'border-stone-200'
                  : 'border-stone-200',
              )}>
                <TypewriterText
                  text={letterContent}
                  speed={12}
                  onComplete={handleTypewriterComplete}
                />
              </div>

              {/* Post-letter actions */}
              <AnimatePresence>
                {typewriterDone && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="space-y-3"
                  >
                    {/* Micro-commitment card */}
                    {showCommitment && !commitmentCreated && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      >
                        <Card variant="paper" padding="lg">
                          <p className="text-xs uppercase tracking-wider text-stone-400 mb-2">
                            Make a micro-commitment
                          </p>
                          <p className="text-sm text-stone-400 mb-3">
                            Set aside a small daily amount to bridge the gap between your two futures.
                          </p>
                          <div className="flex items-center justify-center gap-4 mb-4">
                            <button
                              onClick={() => setCommitmentAmount(prev => Math.max(5, prev - 5))}
                              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="text-center">
                              <p className="text-2xl font-serif text-[#1A2E22]">
                                {formatCurrency(commitmentAmount, 'USD')}
                              </p>
                              <p className="text-xs text-stone-400">per day</p>
                            </div>
                            <button
                              onClick={() => setCommitmentAmount(prev => prev + 5)}
                              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleCreateCommitment}
                              disabled={isCreatingCommitment}
                              className="flex-1 px-4 py-2 rounded-full bg-[#064E3B] text-white text-sm font-medium transition-colors hover:bg-[#053D2E] disabled:opacity-50"
                            >
                              {isCreatingCommitment ? (
                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                              ) : (
                                'I commit'
                              )}
                            </button>
                            <button
                              onClick={() => setShowCommitment(false)}
                              className="px-4 py-2 rounded-full border border-stone-200 text-stone-400 hover:bg-stone-50 text-sm transition-colors"
                            >
                              Maybe later
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    )}

                    {commitmentCreated && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      >
                        <Card variant="paper" padding="md" className="bg-emerald-50 border-emerald-200 flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-[#3F6212] flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-[#064E3B]">Commitment set!</p>
                            <p className="text-xs text-stone-400">
                              {formatCurrency(commitmentAmount, 'USD')}/day — check in daily to build your streak!
                            </p>
                          </div>
                        </Card>
                      </motion.div>
                    )}

                    {/* Ask your future self CTA */}
                    <Card
                      variant="paper"
                      padding="md"
                      className="cursor-pointer hover:shadow-md transition-all duration-200"
                      onClick={() => setShowChat(prev => !prev)}
                    >
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                        <span className="text-sm text-[#44403C]">
                          {showChat ? 'Hide conversation' : 'Ask your future self...'}
                        </span>
                        <ChevronRight className={cn(
                          'w-4 h-4 text-stone-400 ml-auto transition-transform',
                          showChat && 'rotate-90'
                        )} />
                      </div>
                    </Card>

                    {/* Regret toggle */}
                    <Card
                      variant="paper"
                      padding="md"
                      className="cursor-pointer hover:shadow-md transition-all duration-200"
                      onClick={letterMode === 'gratitude' ? handleGenerateRegretLetter : handleGenerateLetter}
                    >
                      <div className={cn(
                        'flex items-center gap-3',
                        (isGeneratingRegretLetter || isGeneratingLetter) && 'opacity-50 pointer-events-none',
                      )}>
                        <GitBranch className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
                        <div className="flex-1">
                          <span className="text-sm text-[#44403C]">
                            {letterMode === 'gratitude' ? 'See your other future' : 'Back to the bright path'}
                          </span>
                          <p className="text-[10px] text-stone-400 mt-0.5">
                            {letterMode === 'gratitude'
                              ? 'A letter from the future where you didn\u2019t change'
                              : 'Read from your successful future self again'}
                          </p>
                        </div>
                        {(isGeneratingRegretLetter || isGeneratingLetter) && (
                          <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                        )}
                      </div>
                    </Card>

                    {/* Generate new letter (same mode) */}
                    <button
                      onClick={letterMode === 'regret' ? handleGenerateRegretLetter : handleGenerateLetter}
                      disabled={isGeneratingLetter || isGeneratingRegretLetter}
                      className="w-full py-3 rounded-full border border-stone-200 text-center text-sm text-stone-400 hover:bg-stone-50 transition-colors disabled:opacity-50"
                    >
                      {(isGeneratingLetter || isGeneratingRegretLetter) ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Writing...
                        </span>
                      ) : (
                        'Generate another letter'
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </motion.section>

      {/* Chat Panel */}
      <AnimatePresence>
        {showChat && letterLetterId && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <Card variant="paper" padding="lg" className="space-y-3">
              <h3 className="text-sm font-serif text-[#1A2E22] flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                Conversation with your future self
              </h3>

              {/* Messages */}
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {chatMessages.length === 0 && (
                  isLoadingConversation ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 text-center py-4">
                      Ask a question about your financial future...
                    </p>
                  )
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'max-w-[85%] p-3 rounded-xl text-sm',
                      msg.role === 'user'
                        ? 'ml-auto bg-stone-100 text-[#44403C]'
                        : 'bg-[#FDFCF8] border border-stone-200 font-serif text-[#44403C]',
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                {isSendingMessage && (
                  <div className="bg-[#FDFCF8] border border-stone-200 p-3 rounded-xl max-w-[85%]">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              {chatMessages.length < 20 ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask your future self..."
                    className="flex-1 px-4 py-2 rounded-full bg-white border border-stone-200 text-sm text-[#44403C] placeholder-stone-400 focus:outline-none focus:border-[#064E3B] transition-colors"
                    disabled={isSendingMessage}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || !chatInput.trim()}
                    className="p-2.5 rounded-full bg-[#064E3B] text-white hover:bg-[#053D2E] transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-stone-400 text-center">
                  Conversation limit reached. Generate a new letter to start over.
                </p>
              )}
            </Card>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Letter History — "Archive" */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3, ease: 'easeOut' }}
      >
        <Card variant="paper" padding="lg">
          <h2 className="text-lg font-serif text-[#1A2E22] mb-3 flex items-center gap-2">
            <Mail className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
            Archive
          </h2>

          {isLoadingHistory ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-lg bg-stone-50 animate-pulse" />
              ))}
            </div>
          ) : letterHistory?.letters?.length ? (
            <div className="divide-y divide-stone-100">
              {letterHistory.letters.map((letter) => (
                <div
                  key={letter.id}
                  onClick={() => !isLoadingDetail && handleLetterClick(letter.id)}
                  className={cn(
                    'py-3 cursor-pointer transition-colors hover:bg-stone-50 -mx-2 px-2 rounded-lg',
                    isLoadingDetail && 'opacity-50 pointer-events-none',
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider text-stone-400">
                        {letter.trigger.replace('_', ' ')}
                      </span>
                      {!letter.readAt && (
                        <Circle className="w-2 h-2 fill-[#064E3B] text-[#064E3B]" />
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-stone-400">
                      {new Date(letter.generatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-serif italic text-sm text-[#44403C] line-clamp-2">
                    {letter.preview}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 text-center py-4">
              No letters yet. Generate your first letter above.
            </p>
          )}
        </Card>
      </motion.section>

      {/* Weekly Debriefs — "Weekly Review" */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3, ease: 'easeOut' }}
      >
        <Card variant="paper" padding="lg">
          <h2 className="text-lg font-serif text-[#1A2E22] mb-3 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
            Weekly Review
          </h2>

          {isLoadingDebriefs ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-20 rounded-lg bg-stone-50 animate-pulse" />
              ))}
            </div>
          ) : debriefs?.length ? (
            <div className="divide-y divide-stone-100">
              {debriefs.map((debrief) => (
                <motion.div
                  key={debrief.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="py-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider text-stone-400">
                        Weekly Debrief
                      </span>
                      {!debrief.readAt && (
                        <Circle className="w-2 h-2 fill-[#064E3B] text-[#064E3B]" />
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-stone-400">
                      {new Date(debrief.generatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-[#44403C] line-clamp-3 leading-relaxed">
                    {debrief.content.slice(0, 250)}
                    {debrief.content.length > 250 ? '...' : ''}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 text-center py-4">
              No weekly debriefs yet. They arrive every Sunday evening.
            </p>
          )}
        </Card>
      </motion.section>

      {/* Stats Bar — "Summary" */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3, ease: 'easeOut' }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {isLoadingStats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-stone-50 animate-pulse" />
          ))
        ) : stats ? (
          <>
            <Card variant="paper" padding="md" className="text-center">
              <p className="text-xs uppercase tracking-wider text-stone-400">Total</p>
              <p className="text-2xl font-serif text-[#1A2E22] tabular-nums mt-1">{stats.totalLetters}</p>
            </Card>
            <Card variant="paper" padding="md" className="text-center">
              <p className="text-xs uppercase tracking-wider text-stone-400">Read</p>
              <p className="text-2xl font-serif text-[#1A2E22] tabular-nums mt-1">{stats.lettersRead}</p>
            </Card>
            <Card variant="paper" padding="md" className="text-center">
              <p className="text-xs uppercase tracking-wider text-stone-400">Tone</p>
              <p className="text-2xl font-serif text-[#1A2E22] tabular-nums mt-1">
                {stats.avgToneScore ? stats.avgToneScore.toFixed(1) : '-'}
              </p>
            </Card>
            <Card variant="paper" padding="md" className="text-center">
              <p className="text-xs uppercase tracking-wider text-stone-400">This Month</p>
              <p className="text-2xl font-serif text-[#1A2E22] tabular-nums mt-1">{stats.thisMonth}</p>
            </Card>
          </>
        ) : null}
      </motion.section>

      {/* Letter Detail Modal */}
      <Modal
        isOpen={!!selectedLetter}
        onClose={() => setSelectedLetter(null)}
        title="Letter Detail"
        size="lg"
        className="!bg-[#FDFCF8] !border-stone-200"
      >
        {selectedLetter && (
          <div className="space-y-4">
            {/* Metadata grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                <p className="text-xs uppercase tracking-wider text-stone-400">Savings Rate</p>
                <p className="font-mono text-sm text-[#44403C]">
                  {(selectedLetter.currentSavingsRate * 100).toFixed(0)}%
                  <span className="text-[#064E3B] text-xs ml-1">
                    &rarr; {(selectedLetter.optimizedSavingsRate * 100).toFixed(0)}%
                  </span>
                </p>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                <p className="text-xs uppercase tracking-wider text-stone-400">20yr Gap</p>
                <p className="font-mono text-sm text-[#064E3B]">
                  +{formatCurrency(selectedLetter.wealthDifference20yr, 'USD', { compact: true })}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                <p className="text-xs uppercase tracking-wider text-stone-400">Tone</p>
                <p className="font-mono text-sm text-[#44403C]">
                  {selectedLetter.toneScore ? `${selectedLetter.toneScore}/5` : '\u2014'}
                </p>
              </div>
            </div>
            {/* Full letter content */}
            <div className="p-6 rounded-xl bg-white border border-stone-100 font-serif text-[#44403C] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
              {selectedLetter.content}
            </div>
            {/* Footer metadata */}
            <div className="flex justify-between text-xs text-stone-400">
              <span className="uppercase tracking-wider">{selectedLetter.trigger.replace('_', ' ')}</span>
              <span className="font-mono">{new Date(selectedLetter.generatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
