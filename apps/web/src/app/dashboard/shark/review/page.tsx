'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardCheck, Send, AlertCircle, Scale, Flame, Heart, Undo2, ChevronRight, Check, X } from 'lucide-react';
import { useShark } from '@/hooks/useShark';
import { useSharkChat } from '@/hooks/useSharkChat';
import type { ChatMode } from '@/hooks/useSharkChat';
import {
  ChatSubscriptionHeader,
  ChatMessageList,
  QuickReplyBar,
  DecisionBar,
  CompletionCelebration,
  SavingsTicker,
  ActionItemsWalkthrough,
} from '@/components/shark';
import type { Subscription, SwipeAction } from '@/hooks/useShark';

// Intent detection for free-text keep/cancel messages
const KEEP_PATTERN = /^(keep|keep it|i('ll| will| want to) keep( it)?|keeping( it)?|yes,? keep)[.!]?$/i;
const CANCEL_PATTERN = /^(cancel|cancel it|i('ll| will| want to) cancel( it)?|cancelling( it)?|yes,? cancel|get rid of it|drop it|remove it)[.!]?$/i;

const MODE_CONFIG: Record<ChatMode, { icon: typeof Scale; label: string; activeColor: string }> = {
  advisor: { icon: Scale, label: 'Advisor', activeColor: 'bg-stone-800 text-white' },
  roast: { icon: Flame, label: 'Roast', activeColor: 'bg-orange-600 text-white' },
  supportive: { icon: Heart, label: 'Support', activeColor: 'bg-rose-600 text-white' },
};

export default function SharkAIReviewPage() {
  const router = useRouter();
  const { pendingReview, isLoadingSubscriptions, summary, getCancellationGuide, getKeepRecommendation } = useShark({ limit: 100 });
  const chat = useSharkChat();

  // Snapshot the pending list on first load so query invalidation
  // doesn't shift items out from under our index
  const [queue, setQueue] = useState<Subscription[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [keptCount, setKeptCount] = useState(0);
  const [cancelledNames, setCancelledNames] = useState<string[]>([]);
  const [keptNames, setKeptNames] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<'KEEP' | 'CANCEL' | null>(null);

  // Track decisions for the results page (background-fetched guides/tips)
  const [decisionLog, setDecisionLog] = useState<Array<{ sub: Subscription; action: 'KEEP' | 'CANCEL' }>>([]);
  const guideCacheRef = useRef<Map<string, import('@/hooks/useShark').CancellationGuide>>(new Map());
  const tipsCacheRef = useRef<Map<string, import('@/hooks/useShark').KeepRecommendation>>(new Map());

  // Undo state
  const [undoAction, setUndoAction] = useState<{ action: SwipeAction; sub: Subscription } | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const queueInitialized = useRef(false);

  // Snapshot pendingReview into queue once on first load
  useEffect(() => {
    if (!queueInitialized.current && pendingReview.length > 0) {
      setQueue([...pendingReview]);
      queueInitialized.current = true;
    }
  }, [pendingReview]);

  const currentSub = queue[currentIndex] ?? null;
  const totalToReview = queue.length;
  const progressPercent = totalToReview > 0 ? ((currentIndex) / totalToReview) * 100 : 0;

  // Update session context whenever decisions change
  useEffect(() => {
    chat.updateSessionContext({
      cancelledNames,
      cancelledTotal: totalSaved,
      keptNames,
      remainingCount: totalToReview - currentIndex,
    });
  }, [cancelledNames, keptNames, totalSaved, totalToReview, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start chat when subscription changes
  useEffect(() => {
    if (currentSub && chat.phase === 'idle') {
      chat.startChat(currentSub.id);
    }
  }, [currentSub, chat.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear transient state when advancing
  useEffect(() => {
    setDecisionError(null);
    setPendingIntent(null);
  }, [currentIndex]);

  // Advance to next subscription
  const advanceToNext = useCallback(() => {
    setShowConfetti(false);
    setPendingIntent(null);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalToReview) {
      setAllDone(true);
    } else {
      setCurrentIndex(nextIndex);
      chat.reset();
    }
  }, [currentIndex, totalToReview, chat]);

  // Handle decision — auto-advances; guides/tips fetched in background for results page
  const handleDecision = useCallback(
    async (action: SwipeAction) => {
      if (!currentSub) return;

      setDecisionError(null);

      try {
        await chat.recordDecision(action);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save decision';
        setDecisionError(message);
        return;
      }

      // Log decision for the results page
      if (action === 'CANCEL' || action === 'KEEP') {
        setDecisionLog((prev) => [...prev, { sub: currentSub, action }]);
      }

      if (action === 'CANCEL') {
        setTotalSaved((prev) => prev + Math.abs(currentSub.annualCost));
        setCancelledCount((prev) => prev + 1);
        setCancelledNames((prev) => [...prev, currentSub.name]);
        setShowConfetti(true);

        // Background fetch cancellation guide
        const subId = currentSub.id;
        getCancellationGuide(subId).then((guide) => {
          guideCacheRef.current.set(subId, guide);
        }).catch(() => {});
      } else if (action === 'KEEP') {
        setKeptCount((prev) => prev + 1);
        setKeptNames((prev) => [...prev, currentSub.name]);

        // Background fetch keep tips
        const subId = currentSub.id;
        getKeepRecommendation(subId).then((tips) => {
          tipsCacheRef.current.set(subId, tips);
        }).catch(() => {});
      }

      // Set undo state (10 second window)
      setUndoAction({ action, sub: currentSub });
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setUndoAction(null);
      }, 10000);

      // Auto-advance (brief delay for confetti on CANCEL)
      setTimeout(() => {
        advanceToNext();
      }, action === 'CANCEL' ? 1500 : 800);
    },
    [currentSub, chat, advanceToNext, getCancellationGuide, getKeepRecommendation],
  );

  // Handle skip (REVIEW_LATER)
  const handleSkip = useCallback(async () => {
    if (!currentSub) return;
    setDecisionError(null);
    try {
      await chat.recordDecision('REVIEW_LATER');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save decision';
      setDecisionError(message);
      return;
    }
    setTimeout(() => advanceToNext(), 500);
  }, [currentSub, chat, advanceToNext]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (!undoAction) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    // Reverse the tracking
    if (undoAction.action === 'CANCEL') {
      setTotalSaved((prev) => prev - Math.abs(undoAction.sub.annualCost));
      setCancelledCount((prev) => prev - 1);
      setCancelledNames((prev) => prev.filter((n) => n !== undoAction.sub.name));
    } else if (undoAction.action === 'KEEP') {
      setKeptCount((prev) => prev - 1);
      setKeptNames((prev) => prev.filter((n) => n !== undoAction.sub.name));
    }

    setUndoAction(null);
  }, [undoAction]);

  // Send message handler — detects decision intent from free-text
  const handleSend = useCallback(() => {
    if (!inputValue.trim() || chat.isSending) return;
    const text = inputValue.trim();

    if (KEEP_PATTERN.test(text)) {
      setPendingIntent('KEEP');
      setInputValue('');
      return;
    }
    if (CANCEL_PATTERN.test(text)) {
      setPendingIntent('CANCEL');
      setInputValue('');
      return;
    }

    chat.sendMessage(text);
    setInputValue('');
  }, [inputValue, chat]);

  // Quick reply handler — also detects decision intent
  const handleQuickReply = useCallback(
    (reply: string) => {
      if (KEEP_PATTERN.test(reply)) {
        setPendingIntent('KEEP');
        return;
      }
      if (CANCEL_PATTERN.test(reply)) {
        setPendingIntent('CANCEL');
        return;
      }
      chat.sendMessage(reply);
    },
    [chat],
  );

  // Cached fetch functions for the results page — return pre-fetched data
  // instantly if available, otherwise fall back to a live fetch
  const cachedFetchGuide = useCallback(
    async (id: string) => {
      const cached = guideCacheRef.current.get(id);
      if (cached) return cached;
      return getCancellationGuide(id);
    },
    [getCancellationGuide],
  );

  const cachedFetchTips = useCallback(
    async (id: string) => {
      const cached = tipsCacheRef.current.get(id);
      if (cached) return cached;
      return getKeepRecommendation(id);
    },
    [getKeepRecommendation],
  );

  // Split decision log for the results page
  const cancelledSubs = useMemo(
    () => decisionLog.filter((d): d is { sub: Subscription; action: 'CANCEL' } => d.action === 'CANCEL'),
    [decisionLog],
  );
  const keptSubs = useMemo(
    () => decisionLog.filter((d): d is { sub: Subscription; action: 'KEEP' } => d.action === 'KEEP'),
    [decisionLog],
  );

  // ─── Loading state ──────────────────────────
  if (isLoadingSubscriptions) {
    return (
      <div className="flex items-center justify-center py-24">
        <motion.p
          className="font-serif text-stone-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading audit items...
        </motion.p>
      </div>
    );
  }

  // ─── Empty state ────────────────────────────
  if (totalToReview === 0 && !allDone) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 safe-top">
        <button
          onClick={() => router.push('/dashboard/shark')}
          className="text-stone-500 hover:text-[#1A2E22] font-serif text-sm transition-colors mb-8"
        >
          &larr; Back to Audit List
        </button>
        <div className="text-center py-12">
          <div className="inline-flex p-4 bg-stone-100 rounded-full mb-4">
            <ClipboardCheck className="w-10 h-10 text-stone-400" />
          </div>
          <p className="font-serif text-[#1A2E22] font-medium mb-1">Nothing to review</p>
          <p className="text-sm text-stone-500">
            All your subscriptions have been reviewed. Run a new scan to check for changes.
          </p>
        </div>
      </div>
    );
  }

  // ─── All-done state ─────────────────────────
  if (allDone) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 safe-top overflow-y-auto">
        <CompletionCelebration
          totalReviewed={totalToReview}
          totalSaved={totalSaved}
          currency={summary?.currency ?? 'USD'}
          cancelledCount={cancelledCount}
          keptCount={keptCount}
        />

        {/* Action items — tabbed card-by-card walkthrough */}
        <ActionItemsWalkthrough
          cancelledSubs={cancelledSubs}
          keptSubs={keptSubs}
          fetchGuide={cachedFetchGuide}
          fetchTips={cachedFetchTips}
        />

        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <button
            onClick={() => router.push('/dashboard/shark')}
            className="px-6 py-3 rounded-lg bg-[#064E3B] text-white hover:bg-[#053D2E] transition-colors font-medium text-sm"
          >
            Back to Shark Auditor
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── Main chat view ─────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="relative max-w-3xl mx-auto w-full flex flex-col flex-1 safe-top">
        {/* Progress bar */}
        <div className="h-1 bg-stone-200">
          <motion.div
            className="h-full bg-[#064E3B]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Top header bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push('/dashboard/shark')}
            className="text-stone-500 hover:text-[#1A2E22] font-serif text-sm transition-colors"
          >
            &larr; Back to Audit List
          </button>

          {/* Mode selector — segmented control */}
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
            {(Object.keys(MODE_CONFIG) as ChatMode[]).map((m) => {
              const config = MODE_CONFIG[m];
              const Icon = config.icon;
              const isActive = chat.mode === m;
              return (
                <button
                  key={m}
                  onClick={() => chat.setMode(m)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? config.activeColor
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                  title={config.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {isActive && <span>{config.label}</span>}
                </button>
              );
            })}
          </div>

          <span className="font-mono text-xs text-stone-400">
            {currentIndex + 1} of {totalToReview} Detected
          </span>
        </div>

        {/* Savings counter */}
        {totalSaved > 0 && (
          <motion.div
            className="flex items-center justify-center gap-2 py-2 bg-emerald-50 border-b border-emerald-100"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <span className="text-xs text-stone-400 uppercase tracking-wider">Saved so far</span>
            <SavingsTicker
              amount={totalSaved}
              currency={summary?.currency ?? 'USD'}
              size="sm"
              className="text-[#064E3B] font-serif !text-sm"
              duration={800}
            />
          </motion.div>
        )}

        {/* Subscription header */}
        {currentSub && (
          <ChatSubscriptionHeader
            subscription={currentSub}
          />
        )}

        {/* Chat messages */}
        <ChatMessageList
          messages={chat.messages}
          isTyping={chat.isSending && chat.messages[chat.messages.length - 1]?.role === 'user'}
        />

        {/* Decision error banner */}
        <AnimatePresence>
          {decisionError && (
            <motion.div
              className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{decisionError}</span>
              <button
                onClick={() => setDecisionError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Undo toast */}
        <AnimatePresence>
          {undoAction && (
            <motion.div
              className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-stone-200 shadow-md"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <span className="text-xs text-stone-600 flex-1">
                {undoAction.action === 'CANCEL' ? 'Cancelled' : 'Keeping'} {undoAction.sub.name}
              </span>
              <button
                onClick={handleUndo}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 text-xs text-[#1A2E22] hover:bg-stone-200 transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confetti replacement → editorial stamp animation */}
        <AnimatePresence>
          {showConfetti && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Radial emerald pulse */}
              <motion.div
                className="absolute w-48 h-48 rounded-full bg-emerald-100"
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
              {/* Stamp card */}
              <motion.div
                className="bg-white border border-stone-200 shadow-lg rounded-lg px-6 py-4 text-center"
                initial={{ scale: 0, rotate: -5 }}
                animate={{ scale: [0, 1.1, 1], rotate: [0, 2, 0] }}
                transition={{ duration: 0.5 }}
              >
                <p className="font-serif text-lg text-[#064E3B] font-medium">
                  Marked for cancellation
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom input area */}
        {pendingIntent && currentSub ? (
          /* Single-action confirmation — user typed "keep" or "cancel" */
          <motion.div
            className="border-t border-stone-200 px-4 py-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => { handleDecision(pendingIntent); setPendingIntent(null); }}
              className={`w-full py-3.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                pendingIntent === 'KEEP'
                  ? 'bg-[#064E3B] text-white'
                  : 'bg-orange-600 text-white'
              }`}
            >
              {pendingIntent === 'KEEP' ? (
                <><Check className="w-4 h-4" /> Keep {currentSub.name}</>
              ) : (
                <><X className="w-4 h-4" /> Cancel {currentSub.name}</>
              )}
            </button>
            <button
              onClick={() => setPendingIntent(null)}
              className="w-full mt-2 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Never mind, keep chatting
            </button>
          </motion.div>
        ) : chat.phase === 'deciding' && currentSub ? (
          <DecisionBar
            recommendation={chat.meta?.recommendation ?? null}
            subscriptionName={currentSub.name}
            annualCost={currentSub.annualCost}
            currency={currentSub.currency}
            onKeep={() => handleDecision('KEEP')}
            onCancel={() => handleDecision('CANCEL')}
            onSkip={handleSkip}
            isProcessing={chat.isSending}
          />
        ) : chat.phase === 'decided' ? null : (
          <div className="border-t border-stone-200 bg-[#FDFCF8]">
            {/* Decision prompt — shown after first full exchange (AI → user → AI) */}
            {chat.phase === 'chatting' && chat.messages.length >= 3 && !chat.isSending && (
              <motion.div
                className="mx-4 mt-3 p-2.5 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="text-sm font-serif italic text-stone-500">Ready to record your verdict?</span>
                <button
                  onClick={() => chat.forceDeciding()}
                  className="px-3 py-1.5 rounded-lg bg-[#064E3B] text-xs text-white font-medium hover:bg-[#053D2E] transition-colors flex items-center gap-1"
                >
                  Record Decision
                  <ChevronRight className="w-3 h-3" />
                </button>
              </motion.div>
            )}

            {/* Quick replies */}
            {chat.meta?.quickReplies && chat.meta.quickReplies.length > 0 && !chat.isSending && (
              <QuickReplyBar
                replies={chat.meta.quickReplies}
                onSelect={handleQuickReply}
                disabled={chat.isSending}
              />
            )}

            {/* Text input — "Field Note Input" */}
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Add a note for the record..."
                disabled={chat.isSending || chat.phase === 'loading'}
                className="flex-1 border-b-2 border-stone-200 focus:border-[#1A2E22] bg-transparent text-lg font-serif outline-none placeholder:text-stone-300 placeholder:italic text-[#1A2E22] py-2 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || chat.isSending}
                className="p-2 text-[#064E3B] hover:text-[#053D2E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
