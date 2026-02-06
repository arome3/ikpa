'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SwipeAction, Subscription } from '@/hooks/useShark';

interface SwipeFeedbackProps {
  action: SwipeAction | null;
  subscription: Subscription | null;
  onDismiss: () => void;
}

const feedbackConfig: Record<SwipeAction, { icon: typeof Check; label: string; color: string; bg: string }> = {
  KEEP: {
    icon: Check,
    label: 'Keeping',
    color: 'text-teal-300',
    bg: 'bg-teal-500/20 border-teal-500/30',
  },
  CANCEL: {
    icon: X,
    label: 'Marked for cancel',
    color: 'text-amber-300',
    bg: 'bg-amber-500/20 border-amber-500/30',
  },
  REVIEW_LATER: {
    icon: Clock,
    label: 'Review later',
    color: 'text-slate-300',
    bg: 'bg-slate-500/20 border-slate-500/30',
  },
};

export function SwipeFeedback({ action, subscription, onDismiss }: SwipeFeedbackProps) {
  useEffect(() => {
    if (!action) return;
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [action, onDismiss]);

  return (
    <AnimatePresence>
      {action && subscription && (
        <motion.div
          className={cn(
            'fixed top-6 left-1/2 z-50 px-4 py-3 rounded-xl border backdrop-blur-md',
            'flex items-center gap-3 shadow-lg',
            feedbackConfig[action].bg
          )}
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
        >
          {(() => {
            const config = feedbackConfig[action];
            const Icon = config.icon;
            return (
              <>
                <Icon className={cn('w-5 h-5', config.color)} />
                <div>
                  <p className={cn('text-sm font-medium', config.color)}>
                    {config.label}
                  </p>
                  <p className="text-xs text-slate-400">{subscription.name}</p>
                </div>
              </>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
