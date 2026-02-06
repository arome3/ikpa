'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Fish } from 'lucide-react';
import { useShark, type Subscription, type SwipeAction } from '@/hooks/useShark';
import { getCategoryIcon, getCategoryColor } from '@/components/shark/CategoryBadge';
import { SubscriptionDetailSheet } from '@/components/shark';
import { cn } from '@/lib/utils';

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        >
          <Fish className="w-10 h-10 text-cyan-400" />
        </motion.div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
        <div className="max-w-lg mx-auto px-4 py-6 safe-top text-center">
          <p className="text-white font-medium mb-2">Subscription not found</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/shark/subscriptions')}
            className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  const Icon = getCategoryIcon(subscription.category);
  const categoryColor = getCategoryColor(subscription.category);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900">
      {/* Ambient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-teal-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-6 safe-top">
        {/* Header */}
        <motion.header
          className="flex items-center gap-3 mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className={cn('p-2 rounded-lg bg-white/10')}>
              <Icon className={cn('w-5 h-5', categoryColor)} />
            </div>
            <h1 className="text-xl font-bold text-white truncate">
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
    </div>
  );
}
