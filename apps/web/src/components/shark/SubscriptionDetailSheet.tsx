'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Hash, Clock, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { CategoryBadge } from './CategoryBadge';
import { StatusBadge } from './StatusBadge';
import type { Subscription } from '@/hooks/useShark';

interface SubscriptionDetailSheetProps {
  subscription: Subscription;
  onKeep: () => void;
  onCancel: () => void;
  onReviewLater: () => void;
  isProcessing: boolean;
}

export function SubscriptionDetailSheet({
  subscription,
  onKeep,
  onCancel,
  onReviewLater,
  isProcessing,
}: SubscriptionDetailSheetProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    onCancel();
  };

  return (
    <div className="space-y-5">
      {/* Category + Status */}
      <div className="flex items-center gap-2 flex-wrap">
        <CategoryBadge category={subscription.category} size="md" />
        <StatusBadge status={subscription.status} />
        {subscription.lastDecision && (
          <span className="text-xs text-stone-400 ml-auto">
            Last decision: {subscription.lastDecision.action}
          </span>
        )}
      </div>

      {/* Cost card */}
      <div className="p-5 rounded-lg bg-white border border-stone-200 shadow-sm">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-400 mb-1">Monthly</p>
            <p className="text-2xl font-serif font-medium text-[#1A2E22] tabular-nums">
              {formatCurrency(subscription.monthlyCost, subscription.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-400 mb-1">Annual</p>
            <p className="text-2xl font-serif font-medium text-stone-500 tabular-nums">
              {subscription.framing.annual}
            </p>
          </div>
        </div>
        <div className="px-3 py-2.5 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-600">
          {subscription.framing.context}
        </div>
        {subscription.status === 'ZOMBIE' && (
          <div className="mt-3 px-3 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-700">
            {subscription.framing.impact}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-4 rounded-lg bg-white border border-stone-200 shadow-sm space-y-3">
        <h3 className="text-sm font-serif font-medium text-[#1A2E22] mb-3">Timeline</h3>
        {subscription.firstChargeDate && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <span className="text-stone-500">First charge</span>
            <span className="ml-auto font-mono text-[#1A2E22]">
              {new Date(subscription.firstChargeDate).toLocaleDateString()}
            </span>
          </div>
        )}
        {subscription.lastChargeDate && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-stone-400" />
            <span className="text-stone-500">Last charge</span>
            <span className="ml-auto font-mono text-[#1A2E22]">
              {new Date(subscription.lastChargeDate).toLocaleDateString()}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 text-sm">
          <Hash className="w-4 h-4 text-stone-400" />
          <span className="text-stone-500">Total charges</span>
          <span className="ml-auto font-mono text-[#1A2E22]">{subscription.chargeCount}</span>
        </div>
        {subscription.lastUsageDate && (
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-stone-400" />
            <span className="text-stone-500">Last used</span>
            <span className="ml-auto font-mono text-[#1A2E22]">
              {new Date(subscription.lastUsageDate).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {subscription.status !== 'CANCELLED' && (
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className={cn(
              'flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all',
              'bg-orange-50 border border-orange-200 text-orange-700',
              'hover:bg-orange-100',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
          >
            Cancel
          </button>
          <button
            onClick={onReviewLater}
            disabled={isProcessing}
            className={cn(
              'px-4 py-3 rounded-lg font-medium text-sm transition-all',
              'bg-white border border-stone-200 text-stone-500',
              'hover:bg-stone-50',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
          >
            Later
          </button>
          <button
            onClick={onKeep}
            disabled={isProcessing}
            className={cn(
              'flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all',
              'bg-emerald-50 border border-emerald-200 text-[#064E3B]',
              'hover:bg-emerald-100',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
          >
            Keep
          </button>
        </div>
      )}

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-6"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-serif font-medium text-[#1A2E22]">Confirm Cancellation</h3>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="p-1 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>

              <p className="text-sm text-stone-600 mb-2">
                Cancel <span className="font-medium text-[#1A2E22]">{subscription.name}</span>?
              </p>
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 mb-4">
                <p className="text-xs uppercase tracking-wider text-stone-400">Annual savings</p>
                <p className="text-lg font-serif font-medium text-[#064E3B]">
                  {subscription.framing.annual}
                </p>
              </div>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full px-3 py-2.5 rounded-lg bg-stone-50 border border-stone-200 text-[#1A2E22] text-sm placeholder-stone-400 focus:outline-none focus:border-[#1A2E22] resize-none mb-4 transition-colors"
                rows={2}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-stone-200 text-stone-600 font-medium text-sm hover:bg-stone-50 transition-colors"
                >
                  Nevermind
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={isProcessing}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all',
                    'bg-orange-600 text-white hover:bg-orange-500',
                    isProcessing && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Confirm Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
