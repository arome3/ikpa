'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Lightbulb, AlertTriangle, PartyPopper, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import type { AIInsight, AIInsightType } from '@/lib/mock/dashboard.mock';

export interface AIInsightCardProps {
  /** Additional class names */
  className?: string;
  /** Insight data */
  insight?: AIInsight | null;
  /** Callback when dismissed */
  onDismiss?: (id: string) => void;
  /** Callback when action button clicked */
  onAction?: (id: string, url: string) => void;
}

// Type configuration — flattened to stone palette with type-specific icon colors
const typeConfig: Record<
  AIInsightType,
  {
    icon: typeof Lightbulb;
    iconColor: string;
    label: string;
  }
> = {
  tip: {
    icon: Lightbulb,
    iconColor: 'text-emerald-600',
    label: 'Tip',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-orange-600',
    label: 'Heads up',
  },
  celebration: {
    icon: PartyPopper,
    iconColor: 'text-emerald-600',
    label: 'Milestone',
  },
  suggestion: {
    icon: Sparkles,
    iconColor: 'text-stone-500',
    label: 'Suggestion',
  },
};

/**
 * AI-generated insight card with editorial stone styling
 */
export function AIInsightCard({ className, insight, onDismiss, onAction }: AIInsightCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!insight || isDismissed) {
    return null;
  }

  const config = typeConfig[insight.type];
  const Icon = config.icon;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.(insight.id);
  };

  const handleAction = () => {
    if (insight.actionUrl) {
      onAction?.(insight.id, insight.actionUrl);
    }
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          className={cn(
            'relative rounded-xl border bg-stone-50 border-stone-200 p-4',
            className
          )}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
            {/* Dismiss button */}
            {insight.dismissible && (
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1 rounded-full text-stone-300 hover:text-stone-500 hover:bg-stone-100 transition-colors"
                aria-label="Dismiss insight"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="flex gap-3">
              {/* Icon */}
              <div
                className={cn(
                  'flex-shrink-0 p-2 rounded-lg bg-white',
                  config.iconColor
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6">
                {/* Type label */}
                <span
                  className="text-xs font-medium uppercase tracking-wider text-stone-400"
                >
                  {config.label}
                </span>

                {/* Title */}
                <h4 className="mt-1 text-base font-serif text-[#1A2E22]">
                  {insight.title}
                </h4>

                {/* Message */}
                <p className="mt-1 text-sm text-stone-500 leading-relaxed">
                  {insight.message}
                </p>

                {/* Action button */}
                {insight.actionLabel && insight.actionUrl && (
                  <div className="mt-3">
                    <Link href={insight.actionUrl} passHref>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleAction}
                        rightIcon={<Sparkles className="h-4 w-4" />}
                      >
                        {insight.actionLabel}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}
