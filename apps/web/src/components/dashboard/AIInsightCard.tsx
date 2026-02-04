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

// Type configuration
const typeConfig: Record<
  AIInsightType,
  {
    icon: typeof Lightbulb;
    bgColor: string;
    iconColor: string;
    borderColor: string;
    label: string;
  }
> = {
  tip: {
    icon: Lightbulb,
    bgColor: 'bg-info-50 dark:bg-info-900/20',
    iconColor: 'text-info-500 dark:text-info-400',
    borderColor: 'border-info-200 dark:border-info-800',
    label: 'Tip',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-secondary-50 dark:bg-secondary-900/20',
    iconColor: 'text-secondary-500 dark:text-secondary-400',
    borderColor: 'border-secondary-200 dark:border-secondary-800',
    label: 'Heads up',
  },
  celebration: {
    icon: PartyPopper,
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    iconColor: 'text-primary-500 dark:text-primary-400',
    borderColor: 'border-primary-200 dark:border-primary-800',
    label: 'Milestone',
  },
  suggestion: {
    icon: Sparkles,
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    iconColor: 'text-purple-500 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
    label: 'Suggestion',
  },
};

/**
 * AI-generated insight card with type-specific styling
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
            'relative rounded-2xl border p-4',
            config.bgColor,
            config.borderColor,
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
                className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                aria-label="Dismiss insight"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="flex gap-3">
              {/* Icon */}
              <div
                className={cn(
                  'flex-shrink-0 p-2 rounded-xl bg-white/50 dark:bg-white/10',
                  config.iconColor
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6">
                {/* Type label */}
                <span
                  className={cn('text-xs font-medium uppercase tracking-wider', config.iconColor)}
                >
                  {config.label}
                </span>

                {/* Title */}
                <h4 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                  {insight.title}
                </h4>

                {/* Message */}
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
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
