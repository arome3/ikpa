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
          <span className="text-xs text-slate-500 ml-auto">
            Last decision: {subscription.lastDecision.action}
          </span>
        )}
      </div>

      {/* Cost card */}
      <div className="p-5 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Monthly</p>
            <p className="text-2xl font-bold text-white tabular-nums">
              {formatCurrency(subscription.monthlyCost, subscription.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Annual</p>
            <p className="text-2xl font-bold text-white/80 tabular-nums">
              {subscription.framing.annual}
            </p>
          </div>
        </div>
        <div className="px-3 py-2.5 rounded-lg bg-white/5 text-sm text-slate-300">
          {subscription.framing.context}
        </div>
        {subscription.status === 'ZOMBIE' && (
          <div className="mt-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/15 text-sm text-amber-200/90">
            {subscription.framing.impact}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
        <h3 className="text-sm font-medium text-white mb-3">Timeline</h3>
        {subscription.firstChargeDate && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">First charge</span>
            <span className="ml-auto text-white">
              {new Date(subscription.firstChargeDate).toLocaleDateString()}
            </span>
          </div>
        )}
        {subscription.lastChargeDate && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">Last charge</span>
            <span className="ml-auto text-white">
              {new Date(subscription.lastChargeDate).toLocaleDateString()}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 text-sm">
          <Hash className="w-4 h-4 text-slate-500" />
          <span className="text-slate-400">Total charges</span>
          <span className="ml-auto text-white">{subscription.chargeCount}</span>
        </div>
        {subscription.lastUsageDate && (
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">Last used</span>
            <span className="ml-auto text-white">
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
              'flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all',
              'bg-amber-500/15 border border-amber-500/30 text-amber-300',
              'hover:bg-amber-500/25',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
          >
            Cancel
          </button>
          <button
            onClick={onReviewLater}
            disabled={isProcessing}
            className={cn(
              'px-4 py-3 rounded-xl font-medium text-sm transition-all',
              'bg-white/10 border border-white/10 text-slate-300',
              'hover:bg-white/15',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
          >
            Later
          </button>
          <button
            onClick={onKeep}
            disabled={isProcessing}
            className={cn(
              'flex-1 px-4 py-3 rounded-xl font-medium text-sm transition-all',
              'bg-teal-500/15 border border-teal-500/30 text-teal-300',
              'hover:bg-teal-500/25',
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
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white">Confirm Cancellation</h3>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <p className="text-sm text-slate-300 mb-2">
                Cancel <span className="font-medium text-white">{subscription.name}</span>?
              </p>
              <div className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/20 mb-4">
                <p className="text-xs text-teal-300/70">Annual savings</p>
                <p className="text-lg font-bold text-teal-300">
                  {subscription.framing.annual}
                </p>
              </div>

              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/20 resize-none mb-4"
                rows={2}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-slate-300 font-medium text-sm hover:bg-white/15 transition-colors"
                >
                  Nevermind
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={isProcessing}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-xl font-medium text-sm transition-all',
                    'bg-amber-500 text-white hover:bg-amber-400',
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
