'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { useShark, type Subscription, type SwipeAction } from '@/hooks/useShark';
import { getCategoryIcon } from '@/components/shark/CategoryBadge';
import { SubscriptionDetailSheet } from '@/components/shark';

export default function SubscriptionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { getById, swipe, isSwiping, cancelSubscription, isCancelling } = useShark();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getById(id)
      .then((data) => {
        if (!cancelled) setSubscription(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load subscription');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, getById]);

  const handleSwipe = useCallback(
    async (action: SwipeAction) => {
      if (!subscription) return;
      try {
        await swipe({ subscriptionId: subscription.id, action });
        // Refresh data
        const updated = await getById(id);
        setSubscription(updated);
      } catch (err) {
        console.error('Swipe failed:', err);
      }
    },
    [subscription, swipe, getById, id]
  );

  const handleCancel = useCallback(async () => {
    if (!subscription) return;
    try {
      await cancelSubscription({ subscriptionId: subscription.id });
      const updated = await getById(id);
      setSubscription(updated);
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  }, [subscription, cancelSubscription, getById, id]);

  // ─── Loading state ──────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    );
  }

  // ─── Error / not found ──────────────────────
  if (error || !subscription) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 safe-top text-center">
        <div className="inline-flex p-4 bg-stone-100 rounded-full mb-4">
          <ClipboardCheck className="w-8 h-8 text-stone-400" />
        </div>
        <p className="font-serif text-[#1A2E22] font-medium mb-2">Subscription not found</p>
        <p className="text-sm text-stone-500 mb-4">{error}</p>
        <button
          onClick={() => router.push('/dashboard/shark/subscriptions')}
          className="px-4 py-2 rounded-lg bg-[#064E3B] text-white text-sm font-medium hover:bg-[#053D2E] transition-colors"
        >
          Back to list
        </button>
      </div>
    );
  }

  const Icon = getCategoryIcon(subscription.category);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 safe-top">
      {/* Header */}
      <motion.header
        className="mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          onClick={() => router.back()}
          className="text-stone-500 hover:text-[#1A2E22] font-serif text-sm transition-colors mb-6"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-stone-100">
            <Icon className="w-5 h-5 text-stone-500 stroke-[1.5]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-serif text-[#1A2E22] tracking-tight truncate">
            {subscription.name}
          </h1>
        </div>
      </motion.header>

      {/* Detail content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SubscriptionDetailSheet
          subscription={subscription}
          onKeep={() => handleSwipe('KEEP')}
          onCancel={handleCancel}
          onReviewLater={() => handleSwipe('REVIEW_LATER')}
          isProcessing={isSwiping || isCancelling}
        />
      </motion.div>
    </div>
  );
}
