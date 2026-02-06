'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Fish, X } from 'lucide-react';
import { useShark } from '@/hooks/useShark';
import { useCurrency } from '@/hooks';
import {
  SwipeStack,
  SwipeActionBar,
  SwipeFeedback,
  CompletionCelebration,
  CancellationGuide,
  KeepRecommendation,
} from '@/components/shark';
import type { SwipeAction, Subscription } from '@/hooks/useShark';

export default function SharkAuditPage() {
  const router = useRouter();
  const { currency } = useCurrency();
  const { pendingReview, isLoadingSubscriptions, swipe, isSwiping, getCancellationGuide, getKeepRecommendation } = useShark({ limit: 100 });

  const [isComplete, setIsComplete] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [keptCount, setKeptCount] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);

  // Feedback toast state
  const [feedbackAction, setFeedbackAction] = useState<SwipeAction | null>(null);
  const [feedbackSub, setFeedbackSub] = useState<Subscription | null>(null);

  // Cancellation guide state
  const [guideSub, setGuideSub] = useState<Subscription | null>(null);

  // Keep tips state
  const [keepTipsSub, setKeepTipsSub] = useState<Subscription | null>(null);

  // Ref for the current index (so SwipeActionBar can trigger swipes)
  const currentIndexRef = useRef(0);

  const handleSwipe = useCallback(
    async (subscriptionId: string, action: SwipeAction) => {
      const sub = pendingReview.find((s) => s.id === subscriptionId);

      try {
        await swipe({ subscriptionId, action });
      } catch (err) {
        console.error('Swipe failed:', err);
        return;
      }

      setReviewedCount((c) => c + 1);
      currentIndexRef.current += 1;

      if (action === 'CANCEL') {
        setCancelledCount((c) => c + 1);
        setKeepTipsSub(null);
        if (sub) {
          setTotalSaved((s) => s + sub.annualCost);
          setGuideSub(sub);
        }
      } else if (action === 'KEEP') {
        setKeptCount((c) => c + 1);
        setGuideSub(null);
        if (sub) {
          setKeepTipsSub(sub);
        }
      }

      // Show feedback
      setFeedbackAction(action);
      setFeedbackSub(sub ?? null);
    },
    [pendingReview, swipe]
  );

  const handleComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  const handleActionBarSwipe = useCallback(
    (action: SwipeAction) => {
      const current = pendingReview[currentIndexRef.current];
      if (!current) return;
      handleSwipe(current.id, action);
    },
    [pendingReview, handleSwipe]
  );

  const dismissFeedback = useCallback(() => {
    setFeedbackAction(null);
    setFeedbackSub(null);
  }, []);

  if (isLoadingSubscriptions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          >
            <Fish className="w-10 h-10 text-cyan-400" />
          </motion.div>
          <p className="text-slate-400">Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
      {/* Ambient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-teal-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top flex flex-col min-h-screen">
        {/* Header */}
        <motion.header
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.push('/dashboard/shark')}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Review</p>
            {!isComplete && pendingReview.length > 0 && (
              <p className="text-xs text-slate-400">
                {Math.min(reviewedCount + 1, pendingReview.length)} of {pendingReview.length}
              </p>
            )}
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </motion.header>

        {/* Progress bar */}
        {!isComplete && pendingReview.length > 0 && (
          <div className="h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 to-teal-400 rounded-full"
              animate={{ width: `${(reviewedCount / pendingReview.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col justify-center">
          {isComplete ? (
            <CompletionCelebration
              totalReviewed={reviewedCount}
              totalSaved={totalSaved}
              currency={currency}
              cancelledCount={cancelledCount}
              keptCount={keptCount}
            />
          ) : pendingReview.length === 0 ? (
            // No items to review
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="inline-flex p-4 bg-teal-500/10 rounded-full mb-4">
                <Fish className="w-10 h-10 text-teal-400/60" />
              </div>
              <p className="text-white font-medium mb-1">All clear!</p>
              <p className="text-sm text-slate-400 mb-4">
                No subscriptions need review right now
              </p>
              <button
                onClick={() => router.push('/dashboard/shark')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
              >
                Back to Command Center
              </button>
            </motion.div>
          ) : (
            <SwipeStack
              subscriptions={pendingReview}
              onSwipe={handleSwipe}
              onComplete={handleComplete}
              isSwiping={isSwiping}
            />
          )}
        </div>

        {/* Action bar (fixed bottom) */}
        {!isComplete && pendingReview.length > 0 && (
          <div className="py-6">
            <SwipeActionBar
              onKeep={() => handleActionBarSwipe('KEEP')}
              onCancel={() => handleActionBarSwipe('CANCEL')}
              onReviewLater={() => handleActionBarSwipe('REVIEW_LATER')}
              isProcessing={isSwiping}
            />
            <div className="flex justify-center gap-8 mt-3">
              <span className="text-xs text-slate-500">Cancel</span>
              <span className="text-xs text-slate-500">Later</span>
              <span className="text-xs text-slate-500">Keep</span>
            </div>
          </div>
        )}

        {/* Return button after completion */}
        {isComplete && (
          <motion.div
            className="py-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <button
              onClick={() => router.push('/dashboard/shark')}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold text-sm hover:from-cyan-400 hover:to-teal-400 transition-all"
            >
              Back to Command Center
            </button>
          </motion.div>
        )}
      </div>

      {/* Cancellation guide overlay */}
      <AnimatePresence>
        {guideSub && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGuideSub(null)}
          >
            <motion.div
              className="w-full max-w-lg pb-safe"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <button
                  onClick={() => setGuideSub(null)}
                  className="absolute -top-10 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <CancellationGuide
                  subscriptionId={guideSub.id}
                  subscriptionName={guideSub.name}
                  fetchGuide={getCancellationGuide}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keep recommendation overlay */}
      <AnimatePresence>
        {keepTipsSub && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setKeepTipsSub(null)}
          >
            <motion.div
              className="w-full max-w-lg pb-safe"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <button
                  onClick={() => setKeepTipsSub(null)}
                  className="absolute -top-10 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <KeepRecommendation
                  subscriptionId={keepTipsSub.id}
                  subscriptionName={keepTipsSub.name}
                  fetchRecommendation={getKeepRecommendation}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback toast */}
      <SwipeFeedback
        action={feedbackAction}
        subscription={feedbackSub}
        onDismiss={dismissFeedback}
      />
    </div>
  );
}
