'use client';

import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getCategoryIcon, getCategoryColor } from './CategoryBadge';
import { StatusBadge } from './StatusBadge';
import type { Subscription, SwipeAction } from '@/hooks/useShark';

interface SwipeCardProps {
  subscription: Subscription;
  onSwipe: (action: SwipeAction) => void;
  isActive: boolean;
  stackIndex: number;
  isProcessing: boolean;
}

const SWIPE_THRESHOLD = 100;

export function SwipeCard({
  subscription,
  onSwipe,
  isActive,
  stackIndex,
  isProcessing,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const keepOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const cancelOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const Icon = getCategoryIcon(subscription.category);
  const categoryColor = getCategoryColor(subscription.category);

  // Stack depth styling
  const stackScale = 1 - stackIndex * 0.04;
  const stackY = -stackIndex * 8;
  const stackOpacity = stackIndex === 0 ? 1 : stackIndex === 1 ? 0.6 : 0.3;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isProcessing) return;

    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipe('KEEP');
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipe('CANCEL');
    }
  };

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        zIndex: 3 - stackIndex,
      }}
      initial={{ scale: stackScale, y: stackY, opacity: stackOpacity }}
      animate={{ scale: stackScale, y: stackY, opacity: stackOpacity }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <motion.div
        className={cn(
          'w-full h-full rounded-2xl border backdrop-blur-sm overflow-hidden cursor-grab active:cursor-grabbing',
          'bg-gradient-to-br from-slate-800/90 via-slate-800/95 to-slate-900',
          'border-white/10'
        )}
        style={isActive ? { x, rotate } : undefined}
        drag={isActive && !isProcessing ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={isActive ? handleDragEnd : undefined}
        exit={{
          x: 500,
          rotate: 30,
          opacity: 0,
          transition: { duration: 0.3 },
        }}
      >
        {/* Direction feedback overlays */}
        {isActive && (
          <>
            {/* Keep overlay (right) */}
            <motion.div
              className="absolute inset-0 bg-teal-500/20 border-2 border-teal-400/50 rounded-2xl flex items-center justify-center z-10 pointer-events-none"
              style={{ opacity: keepOpacity }}
            >
              <div className="p-4 bg-teal-500/30 rounded-full">
                <Check className="w-12 h-12 text-teal-300" />
              </div>
            </motion.div>

            {/* Cancel overlay (left) */}
            <motion.div
              className="absolute inset-0 bg-amber-500/20 border-2 border-amber-400/50 rounded-2xl flex items-center justify-center z-10 pointer-events-none"
              style={{ opacity: cancelOpacity }}
            >
              <div className="p-4 bg-amber-500/30 rounded-full">
                <X className="w-12 h-12 text-amber-300" />
              </div>
            </motion.div>
          </>
        )}

        {/* Card content */}
        <div className="relative h-full flex flex-col p-6 z-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-3 rounded-xl bg-white/10')}>
                <Icon className={cn('w-7 h-7', categoryColor)} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{subscription.name}</h3>
                <StatusBadge status={subscription.status} />
              </div>
            </div>
          </div>

          {/* Cost */}
          <div className="flex-1 flex flex-col justify-center items-center my-4">
            <p className="text-sm text-slate-400 mb-1">Monthly Cost</p>
            <p className="text-4xl font-black text-white tabular-nums">
              {formatCurrency(subscription.monthlyCost, subscription.currency)}
            </p>
            <p className="text-sm text-slate-500 mt-1">{subscription.framing.annual}</p>
          </div>

          {/* Framing */}
          <div className="space-y-3">
            {/* Context comparison */}
            <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
              <p className="text-sm text-slate-300">{subscription.framing.context}</p>
            </div>

            {/* Impact statement */}
            {subscription.status === 'ZOMBIE' && (
              <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/15">
                <p className="text-sm text-amber-200/90">{subscription.framing.impact}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {subscription.chargeCount} charge{subscription.chargeCount !== 1 ? 's' : ''}
              </span>
              {subscription.lastChargeDate && (
                <span>
                  Last charged {new Date(subscription.lastChargeDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
