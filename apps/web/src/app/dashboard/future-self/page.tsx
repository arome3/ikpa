'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Send,
  MessageCircle,
  BookOpen,
  BarChart3,
  Sparkles,
  ChevronRight,
  Loader2,
  HandHeart,
  CheckCircle2,
  Minus,
  Plus,
  GitBranch,
  Bell,
  BellOff,
  Eye,
  Pause,
  Play,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
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
    <div className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm text-slate-300">Current: <span className="text-white font-medium">{formatCurrency(current, 'USD', { compact: true })}</span></p>
      <p className="text-sm text-emerald-400">With IKPA: <span className="font-medium">{formatCurrency(optimized, 'USD', { compact: true })}</span></p>
      <p className="text-xs text-amber-400 mt-1 border-t border-white/10 pt-1">Gap: +{formatCurrency(diff, 'USD', { compact: true })}</p>
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
        <span className="inline-block w-0.5 h-4 bg-amber-400 animate-pulse ml-0.5 align-text-bottom" />
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
  } = useFutureSelf();

  const [selectedHorizon, setSelectedHorizon] = useState<number>(4); // Default: 20yr
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
  const [commitmentAmount, setCommitmentAmount] = useState(500);
  const [commitmentCreated, setCommitmentCreated] = useState(false);

  // Letter detail modal
  const [selectedLetter, setSelectedLetter] = useState<LetterDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Timeline detail
  const [timelineDetail, setTimelineDetail] = useState<TimelineProjection | null>(null);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // Conversation history loading
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  // Build chart data from simulation
  const chartData = simulation
    ? TIME_HORIZONS.map(h => ({
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
      setLetterLetterId((result as unknown as { id?: string }).id ?? null);
      setLetterMode('gratitude');
      setTypewriterDone(false);
      setReadStartTime(Date.now());
      setShowChat(false);
      setChatMessages([]);
      setShowCommitment(false);
      setCommitmentCreated(false);

      // Compute default commitment amount from simulation data
      if (simulation) {
        const gap = (simulation.withIKPA.savingsRate - simulation.currentBehavior.savingsRate) * 100;
        const dailyGap = Math.ceil((gap * 100) / 30 / 100) * 100;
        setCommitmentAmount(Math.max(dailyGap, 500));
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
      setLetterLetterId((result as unknown as { id?: string }).id ?? null);
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
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto md:max-w-4xl px-4 py-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Future Self Simulator</h1>
            <p className="text-sm text-slate-400">See where your money takes you</p>
          </div>
          <button
            onClick={() => updatePreferences({ weeklyLettersEnabled: !preferences?.weeklyLettersEnabled })}
            disabled={isLoadingPreferences || isUpdatingPreferences}
            className="ml-auto p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
            title={preferences?.weeklyLettersEnabled ? 'Disable weekly letters' : 'Enable weekly letters'}
          >
            {preferences?.weeklyLettersEnabled
              ? <Bell className="w-4 h-4 text-amber-400" />
              : <BellOff className="w-4 h-4 text-slate-500" />
            }
          </button>
        </motion.header>

        {/* Active Commitment Banner */}
        {activeCommitment && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-xl border',
              activeCommitment.status === 'ACTIVE'
                ? 'bg-gradient-to-r from-emerald-500/10 to-amber-500/10 border-emerald-500/20'
                : 'bg-white/5 border-white/10',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HandHeart className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">
                    {activeCommitment.status === 'ACTIVE' ? 'Active Commitment' : 'Commitment Paused'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(activeCommitment.dailyAmount, activeCommitment.currency)}/day
                    {activeCommitment.streakDays > 0 && ` \u2022 ${activeCommitment.streakDays} day streak`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateCommitment({
                    id: activeCommitment.id,
                    status: activeCommitment.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                  })}
                  disabled={isUpdatingCommitment}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                  title={activeCommitment.status === 'ACTIVE' ? 'Pause commitment' : 'Resume commitment'}
                >
                  {activeCommitment.status === 'ACTIVE'
                    ? <Pause className="w-3.5 h-3.5 text-slate-400" />
                    : <Play className="w-3.5 h-3.5 text-emerald-400" />
                  }
                </button>
                <div className="text-2xl font-bold text-emerald-400">
                  {activeCommitment.streakDays}
                  <span className="text-xs text-slate-400 ml-1">days</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Dual-Path Chart */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-white/5 border border-white/10"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Two Futures
          </h2>

          {isLoadingSimulation ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : simulation ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="grayGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => formatCurrency(v, 'USD', { compact: true })}
                      width={65}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="currentPath"
                      stroke="#6b7280"
                      strokeWidth={2}
                      fill="url(#grayGradient)"
                      name="Current Path"
                    />
                    <Area
                      type="monotone"
                      dataKey="optimizedPath"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#greenGradient)"
                      name="With IKPA"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Time Slider */}
              <div className="mt-4">
                <div className="flex justify-between mb-2">
                  {TIME_HORIZONS.map((h, i) => (
                    <button
                      key={h.key}
                      onClick={() => setSelectedHorizon(i)}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full transition-colors',
                        selectedHorizon === i
                          ? 'bg-amber-500/20 text-amber-400 font-medium'
                          : 'text-slate-500 hover:text-slate-300',
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
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <motion.div
                  key={selectedHorizon}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-3"
                >
                  <p className="text-sm text-slate-400">
                    In <span className="text-white font-medium">{TIME_HORIZONS[selectedHorizon].label}</span>, you could have
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">
                    {formatCurrency(horizonDifference, 'USD', { compact: true })}
                    <span className="text-sm font-normal text-slate-400 ml-2">more</span>
                  </p>
                </motion.div>

                {/* Timeline Detail Card */}
                <AnimatePresence mode="wait">
                  {timelineDetail && !isLoadingTimeline && (
                    <motion.div
                      key={`detail-${selectedHorizon}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 grid grid-cols-3 gap-2 text-center"
                    >
                      <div className="p-2 rounded-lg bg-white/5">
                        <p className="text-[10px] text-slate-500">Current Path</p>
                        <p className="text-sm font-medium text-slate-300">
                          {formatCurrency(timelineDetail.currentPath, 'USD', { compact: true })}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5">
                        <p className="text-[10px] text-slate-500">With IKPA</p>
                        <p className="text-sm font-medium text-emerald-400">
                          {formatCurrency(timelineDetail.optimizedPath, 'USD', { compact: true })}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5">
                        <p className="text-[10px] text-slate-500">Difference</p>
                        <p className="text-sm font-medium text-amber-400">
                          +{formatCurrency(timelineDetail.difference, 'USD', { compact: true })}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-500 rounded-full inline-block" /> Current Path
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" /> With IKPA
                </span>
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              No simulation data available
            </div>
          )}
        </motion.section>

        {/* Letter Generation */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-2xl bg-white/5 border border-white/10"
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Letter from 2045
          </h2>

          {!letterContent ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">
                Your future self has something to tell you...
              </p>
              <button
                onClick={handleGenerateLetter}
                disabled={isGeneratingLetter}
                className={cn(
                  'px-6 py-3 rounded-xl font-medium transition-all',
                  'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
                  'hover:from-amber-600 hover:to-orange-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'shadow-lg shadow-amber-500/20',
                )}
              >
                {isGeneratingLetter ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Your future self is writing...
                  </span>
                ) : (
                  'Generate Letter from 2045'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Letter mode indicator */}
              {letterMode === 'regret' && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                  <span>Letter from the path not taken</span>
                </div>
              )}

              {/* Letter content with typewriter effect */}
              <div className={cn(
                'p-6 rounded-xl bg-slate-800/50 font-serif text-slate-200 leading-relaxed whitespace-pre-wrap',
                letterMode === 'regret'
                  ? 'border border-slate-500/20'
                  : 'border border-amber-500/10',
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
                    className="space-y-3"
                  >
                    {/* Micro-commitment card */}
                    {showCommitment && !commitmentCreated && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-amber-500/20"
                      >
                        <p className="text-sm font-medium text-amber-400 mb-2">
                          Make a micro-commitment
                        </p>
                        <p className="text-xs text-slate-400 mb-3">
                          Set aside a small daily amount to bridge the gap between your two futures.
                        </p>
                        <div className="flex items-center justify-center gap-4 mb-3">
                          <button
                            onClick={() => setCommitmentAmount(prev => Math.max(100, prev - 100))}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-white">
                              {formatCurrency(commitmentAmount, 'USD')}
                            </p>
                            <p className="text-xs text-slate-400">per day</p>
                          </div>
                          <button
                            onClick={() => setCommitmentAmount(prev => prev + 100)}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateCommitment}
                            disabled={isCreatingCommitment}
                            className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {isCreatingCommitment ? (
                              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                            ) : (
                              'I commit'
                            )}
                          </button>
                          <button
                            onClick={() => setShowCommitment(false)}
                            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 text-sm transition-colors"
                          >
                            Maybe later
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {commitmentCreated && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-emerald-400">Commitment set!</p>
                          <p className="text-xs text-slate-400">
                            {formatCurrency(commitmentAmount, 'USD')}/day — your future self is proud.
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Ask your future self CTA */}
                    <button
                      onClick={() => setShowChat(prev => !prev)}
                      className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-left flex items-center gap-3 transition-colors"
                    >
                      <MessageCircle className="w-5 h-5 text-amber-400" />
                      <span className="text-sm text-slate-300">
                        {showChat ? 'Hide conversation' : 'Ask your future self...'}
                      </span>
                      <ChevronRight className={cn(
                        'w-4 h-4 text-slate-500 ml-auto transition-transform',
                        showChat && 'rotate-90'
                      )} />
                    </button>

                    {/* See your other future / Back to gratitude */}
                    <button
                      onClick={letterMode === 'gratitude' ? handleGenerateRegretLetter : handleGenerateLetter}
                      disabled={isGeneratingRegretLetter || isGeneratingLetter}
                      className={cn(
                        'w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-colors disabled:opacity-50',
                        letterMode === 'gratitude'
                          ? 'bg-slate-800/50 border-slate-500/20 hover:bg-slate-700/50'
                          : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10',
                      )}
                    >
                      <GitBranch className={cn(
                        'w-5 h-5',
                        letterMode === 'gratitude' ? 'text-slate-400' : 'text-amber-400',
                      )} />
                      <div className="flex-1">
                        <span className={cn(
                          'text-sm font-medium',
                          letterMode === 'gratitude' ? 'text-slate-300' : 'text-amber-400',
                        )}>
                          {letterMode === 'gratitude' ? 'See your other future' : 'Back to the bright path'}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {letterMode === 'gratitude'
                            ? 'A letter from the future where you didn\u2019t change'
                            : 'Read from your successful future self again'}
                        </p>
                      </div>
                      {(isGeneratingRegretLetter || isGeneratingLetter) && (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      )}
                    </button>

                    {/* Generate new letter (same mode) */}
                    <button
                      onClick={letterMode === 'regret' ? handleGenerateRegretLetter : handleGenerateLetter}
                      disabled={isGeneratingLetter || isGeneratingRegretLetter}
                      className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-center text-sm text-slate-400 transition-colors disabled:opacity-50"
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
        </motion.section>

        {/* Chat Panel */}
        <AnimatePresence>
          {showChat && letterLetterId && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Conversation with your future self
                </h3>

                {/* Messages */}
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {chatMessages.length === 0 && (
                    isLoadingConversation ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-4">
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
                          ? 'ml-auto bg-slate-700 text-white'
                          : 'bg-amber-500/10 border border-amber-500/20 text-slate-200',
                      )}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {isSendingMessage && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl max-w-[85%]">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-amber-400/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-amber-400/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-amber-400/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                      disabled={isSendingMessage}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isSendingMessage || !chatInput.trim()}
                      className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center">
                    Conversation limit reached. Generate a new letter to start over.
                  </p>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Letter History */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-2xl bg-white/5 border border-white/10"
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            Letter History
          </h2>

          {isLoadingHistory ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : letterHistory?.letters?.length ? (
            <div className="space-y-2">
              {letterHistory.letters.map((letter) => (
                <div
                  key={letter.id}
                  onClick={() => !isLoadingDetail && handleLetterClick(letter.id)}
                  className={cn(
                    'p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors cursor-pointer group',
                    isLoadingDetail && 'opacity-50 pointer-events-none',
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        letter.trigger === 'USER_REQUEST' && 'bg-amber-500/20 text-amber-400',
                        letter.trigger === 'WEEKLY_SCHEDULED' && 'bg-blue-500/20 text-blue-400',
                        letter.trigger === 'POST_DECISION' && 'bg-rose-500/20 text-rose-400',
                        letter.trigger === 'GOAL_MILESTONE' && 'bg-emerald-500/20 text-emerald-400',
                      )}>
                        {letter.trigger.replace('_', ' ')}
                      </span>
                      {letter.toneScore && (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                i < letter.toneScore! ? 'bg-amber-400' : 'bg-slate-700',
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Eye className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {new Date(letter.generatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {letter.preview}
                  </p>
                  {!letter.readAt && (
                    <span className="text-[10px] text-amber-400 font-medium mt-1 inline-block">
                      Unread
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              No letters yet. Generate your first letter above.
            </p>
          )}
        </motion.section>

        {/* Stats Bar */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-4 gap-2"
        >
          {isLoadingStats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))
          ) : stats ? (
            <>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-xl font-bold text-white">{stats.totalLetters}</p>
                <p className="text-[10px] text-slate-500">Total</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-xl font-bold text-emerald-400">{stats.lettersRead}</p>
                <p className="text-[10px] text-slate-500">Read</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-xl font-bold text-amber-400">
                  {stats.avgToneScore ? stats.avgToneScore.toFixed(1) : '-'}
                </p>
                <p className="text-[10px] text-slate-500">Tone</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <p className="text-xl font-bold text-white">{stats.thisMonth}</p>
                <p className="text-[10px] text-slate-500">This Month</p>
              </div>
            </>
          ) : null}
        </motion.section>
      </div>

      {/* Letter Detail Modal */}
      <Modal
        isOpen={!!selectedLetter}
        onClose={() => setSelectedLetter(null)}
        title="Letter Detail"
        size="lg"
        className="!bg-slate-800 !border-slate-700"
      >
        {selectedLetter && (
          <div className="space-y-4">
            {/* Metadata grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-xs text-slate-500">Savings Rate</p>
                <p className="text-sm font-medium text-white">
                  {(selectedLetter.currentSavingsRate * 100).toFixed(0)}%
                  <span className="text-emerald-400 text-xs ml-1">
                    → {(selectedLetter.optimizedSavingsRate * 100).toFixed(0)}%
                  </span>
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-xs text-slate-500">20yr Gap</p>
                <p className="text-sm font-medium text-emerald-400">
                  +{formatCurrency(selectedLetter.wealthDifference20yr, 'USD', { compact: true })}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-xs text-slate-500">Tone</p>
                <p className="text-sm font-medium text-amber-400">
                  {selectedLetter.toneScore ? `${selectedLetter.toneScore}/5` : '—'}
                </p>
              </div>
            </div>
            {/* Full letter content */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-white/5 font-serif text-slate-200 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
              {selectedLetter.content}
            </div>
            {/* Footer metadata */}
            <div className="flex justify-between text-xs text-slate-500">
              <span>{selectedLetter.trigger.replace('_', ' ')}</span>
              <span>{new Date(selectedLetter.generatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
