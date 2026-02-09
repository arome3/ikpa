'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, Skeleton } from '@/components/ui';
import type { LucideIcon } from 'lucide-react';

export type MetricFormat = 'currency' | 'percent' | 'months' | 'number';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card label */
  label: string;
  /** Metric value */
  value: number;
  /** Change from previous period */
  change?: number;
  /** Format type for the value */
  format?: MetricFormat;
  /** Currency code for currency format */
  currency?: 'NGN' | 'USD' | 'GBP' | 'EUR' | 'GHS' | 'KES' | 'ZAR';
  /** Icon component to display */
  icon: LucideIcon;
  /** Icon background color class (kept for interface compat, not rendered) */
  iconBgColor?: string;
  /** Whether the card is clickable */
  onClick?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Animation delay for stagger effect */
  delay?: number;
}

/**
 * Format value based on type
 */
function formatValue(
  value: number,
  format: MetricFormat,
  currency: MetricCardProps['currency'] = 'USD'
): string {
  switch (format) {
    case 'currency':
      return formatCurrency(value, currency, { compact: value >= 100000 });
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'months':
      return `${value.toFixed(1)} mo`;
    case 'number':
    default:
      return value.toLocaleString('en-NG');
  }
}

/**
 * Financial metric card with editorial paper styling
 */
export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      className,
      label,
      value,
      change,
      format = 'currency',
      currency = 'NGN',
      icon: Icon,
      iconBgColor: _iconBgColor,
      onClick,
      isLoading = false,
      delay = 0,
      ...props
    },
    ref
  ) => {
    if (isLoading) {
      return (
        <Card
          ref={ref}
          variant="paper"
          padding="md"
          className={cn('min-h-[100px]', className)}
          {...props}
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="rectangular" width={40} height={16} className="rounded-full" />
          </div>
          <div className="mt-3 space-y-1">
            <Skeleton variant="text" width="50%" height={12} />
            <Skeleton variant="text" width="70%" height={24} />
          </div>
        </Card>
      );
    }

    const formattedValue = formatValue(value, format, currency);
    const isClickable = !!onClick;

    // Inline change indicator
    const changeColor =
      change !== undefined && change > 0
        ? 'text-emerald-700'
        : change !== undefined && change < 0
          ? 'text-orange-600'
          : 'text-stone-400';

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      >
        <Card
          ref={ref}
          variant="paper"
          padding="md"
          className={cn(
            'min-h-[100px] transition-all duration-200',
            isClickable && [
              'cursor-pointer',
              'hover:-translate-y-0.5 hover:shadow-md',
              'active:translate-y-0',
            ],
            className
          )}
          onClick={onClick}
          role={isClickable ? 'button' : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onKeyDown={
            isClickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.();
                  }
                }
              : undefined
          }
          {...props}
        >
          {/* Top row: Icon and change */}
          <div className="flex items-start justify-between gap-2">
            <Icon className="h-5 w-5 text-stone-400" strokeWidth={1.5} />
            {change !== undefined && (
              <span className={cn('font-mono text-xs tabular-nums', changeColor)}>
                {change > 0 ? '+' : ''}
                {change.toFixed(1)}%
              </span>
            )}
          </div>

          {/* Bottom row: Label and value */}
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wider text-stone-400 font-sans">{label}</p>
            <p className="text-2xl font-serif text-[#1A2E22] tabular-nums mt-0.5">
              {formattedValue}
            </p>
          </div>
        </Card>
      </motion.div>
    );
  }
);

MetricCard.displayName = 'MetricCard';

/**
 * Skeleton version for loading state
 */
export function MetricCardSkeleton() {
  return (
    <Card variant="paper" padding="md" className="min-h-[100px]">
      <div className="flex items-start justify-between gap-2">
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="rectangular" width={40} height={16} className="rounded-full" />
      </div>
      <div className="mt-3 space-y-1">
        <Skeleton variant="text" width="50%" height={12} />
        <Skeleton variant="text" width="70%" height={24} />
      </div>
    </Card>
  );
}
