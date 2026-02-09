'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { CancellationGuide } from './chat/CancellationGuide';
import { KeepRecommendation } from './chat/KeepRecommendation';
import type { Subscription, CancellationGuide as CancellationGuideType, KeepRecommendation as KeepRecommendationType } from '@/hooks/useShark';

// ─── Types ───────────────────────────────────

interface ActionItemsWalkthroughProps {
  cancelledSubs: Array<{ sub: Subscription; action: 'CANCEL' }>;
  keptSubs: Array<{ sub: Subscription; action: 'KEEP' }>;
  fetchGuide: (id: string) => Promise<CancellationGuideType>;
  fetchTips: (id: string) => Promise<KeepRecommendationType>;
}

type TabId = 'cancelled' | 'kept';

// ─── Animation variants ─────────────────────

const cardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ─── Component ──────────────────────────────

export function ActionItemsWalkthrough({
  cancelledSubs,
  keptSubs,
  fetchGuide,
  fetchTips,
}: ActionItemsWalkthroughProps) {
  const hasCancelled = cancelledSubs.length > 0;
  const hasKept = keptSubs.length > 0;
  const hasBoth = hasCancelled && hasKept;

  // Default to whichever tab has items (cancelled first)
  const defaultTab: TabId = hasCancelled ? 'cancelled' : 'kept';

  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [cancelledIndex, setCancelledIndex] = useState(0);
  const [keptIndex, setKeptIndex] = useState(0);
  const [cancelledViewed, setCancelledViewed] = useState(0); // highest viewed + 1
  const [keptViewed, setKeptViewed] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  const cancelledFinished = cancelledViewed >= cancelledSubs.length;
  const keptFinished = keptViewed >= keptSubs.length;
  const allFinished = (cancelledFinished || !hasCancelled) && (keptFinished || !hasKept);

  const currentIndex = activeTab === 'cancelled' ? cancelledIndex : keptIndex;
  const currentList = activeTab === 'cancelled' ? cancelledSubs : keptSubs;
  const currentTotal = currentList.length;

  // Unique key for AnimatePresence — includes tab so switching tabs also animates
  const cardKey = `${activeTab}-${currentIndex}`;

  // ─── Handlers ─────────────────────────────

  const switchTab = useCallback((tab: TabId) => {
    if (tab === activeTab) return;
    setDirection(tab === 'kept' ? 1 : -1);
    setActiveTab(tab);
  }, [activeTab]);

  const handleGotIt = useCallback(() => {
    if (allFinished) return;

    const isLastInTab = currentIndex >= currentTotal - 1;

    if (!isLastInTab) {
      // Advance within current tab
      setDirection(1);
      if (activeTab === 'cancelled') {
        const next = cancelledIndex + 1;
        setCancelledIndex(next);
        setCancelledViewed((v) => Math.max(v, next + 1));
      } else {
        const next = keptIndex + 1;
        setKeptIndex(next);
        setKeptViewed((v) => Math.max(v, next + 1));
      }
    } else {
      // Mark current tab as finished
      if (activeTab === 'cancelled') {
        setCancelledViewed(cancelledSubs.length);
      } else {
        setKeptViewed(keptSubs.length);
      }

      // Auto-switch to the other tab if it has unfinished items
      if (activeTab === 'cancelled' && hasKept && !keptFinished) {
        setDirection(1);
        setActiveTab('kept');
      } else if (activeTab === 'kept' && hasCancelled && !cancelledFinished) {
        setDirection(-1);
        setActiveTab('cancelled');
      }
    }
  }, [
    allFinished, currentIndex, currentTotal, activeTab,
    cancelledIndex, keptIndex, cancelledSubs.length, keptSubs.length,
    hasKept, hasCancelled, keptFinished, cancelledFinished,
  ]);

  // Don't render if no decisions at all
  if (!hasCancelled && !hasKept) return null;

  // ─── Render ───────────────────────────────

  return (
    <motion.div
      className="mt-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
    >
      {/* Header — tabs when both categories, plain header for single category */}
      {hasBoth ? (
        <>
          <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider text-center mb-4">
            Your Action Items
          </h3>
          <div className="flex gap-2 mb-4 px-4">
            <button
              onClick={() => switchTab('cancelled')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'cancelled'
                  ? 'bg-stone-800 text-white'
                  : 'bg-white border border-stone-200 text-stone-500 hover:text-stone-700'
              }`}
            >
              Cancelled ({cancelledSubs.length})
              {cancelledFinished && <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => switchTab('kept')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'kept'
                  ? 'bg-[#064E3B] text-white'
                  : 'bg-white border border-stone-200 text-stone-500 hover:text-stone-700'
              }`}
            >
              Kept ({keptSubs.length})
              {keptFinished && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
        </>
      ) : (
        <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-wider text-center mb-4">
          {hasCancelled ? 'Cancellation Guides' : 'Savings Tips'}
        </h3>
      )}

      {/* Counter */}
      {currentTotal > 1 && (
        <p className="text-center font-mono text-xs text-stone-400 mb-3">
          {currentIndex + 1} of {currentTotal}
        </p>
      )}

      {/* Card — one at a time with slide animation */}
      <div className="relative overflow-hidden min-h-[120px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={cardKey}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {activeTab === 'cancelled' && cancelledSubs[cancelledIndex] ? (
              <CancellationGuide
                subscriptionId={cancelledSubs[cancelledIndex].sub.id}
                subscriptionName={cancelledSubs[cancelledIndex].sub.name}
                fetchGuide={fetchGuide}
              />
            ) : activeTab === 'kept' && keptSubs[keptIndex] ? (
              <KeepRecommendation
                subscriptionId={keptSubs[keptIndex].sub.id}
                subscriptionName={keptSubs[keptIndex].sub.name}
                fetchRecommendation={fetchTips}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots + Got It button */}
      <div className="flex items-center justify-between px-4 mt-2">
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: currentTotal }).map((_, i) => {
            const isActive = i === currentIndex;
            const isViewed = activeTab === 'cancelled'
              ? i < cancelledViewed
              : i < keptViewed;
            return (
              <motion.div
                key={i}
                className="rounded-full"
                animate={{
                  width: isActive ? 16 : 6,
                  height: 6,
                  backgroundColor: isActive
                    ? (activeTab === 'cancelled' ? 'rgb(41, 37, 36)' : 'rgb(6, 78, 59)')
                    : isViewed
                      ? 'rgb(168, 162, 158)'
                      : 'rgb(214, 211, 209)',
                }}
                transition={{ duration: 0.2 }}
              />
            );
          })}
        </div>

        {/* Got it / All done button */}
        <button
          onClick={handleGotIt}
          disabled={allFinished}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            allFinished
              ? 'bg-emerald-50 border border-emerald-200 text-[#064E3B]'
              : 'bg-[#064E3B] text-white hover:bg-[#053D2E] active:scale-[0.97]'
          }`}
        >
          {allFinished ? (
            <>
              <Check className="w-4 h-4" />
              All done
            </>
          ) : (
            <>
              Got it, next
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
