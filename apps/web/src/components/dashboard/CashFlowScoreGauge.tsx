'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp, formatWithSeparators } from '@/hooks';
import { getScoreStatus } from '@/lib/mock/dashboard.mock';
import type { CashFlowScoreData } from '@/lib/mock/dashboard.mock';
import { Skeleton } from '@/components/ui';

export interface CashFlowScoreGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: CashFlowScoreData;
  isLoading?: boolean;
}

// Progress ring dimensions
const RING_SIZE = 80;
const STROKE_WIDTH = 5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Horizontal score card with monochrome green progress ring.
 * Replaces the previous semi-circular rainbow gauge.
 */
export const CashFlowScoreGauge = forwardRef<HTMLDivElement, CashFlowScoreGaugeProps>(
  ({ className, data, isLoading = false, ...props }, ref) => {
    const score = data?.score ?? 0;
    const previousScore = data?.previousScore ?? 0;
    const change = score - previousScore;
    const status = data?.status ?? getScoreStatus(score);

    // Animated score display
    const { value: animatedScore } = useCountUp({
      from: 0,
      to: score,
      duration: 600,
      autoStart: !isLoading && !!data,
    });

    // Calculate stroke dashoffset for ring progress
    const progress = score / 100;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    // Trend indicator
    const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
    const trendColor = change > 0 ? 'text-emerald-700' : change < 0 ? 'text-orange-600' : 'text-stone-400';

    if (isLoading) {
      return (
        <div
          ref={ref}
          className={cn(
            'bg-white border border-stone-100 rounded-xl shadow-sm p-6 md:p-8',
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-6">
            <Skeleton variant="circular" width={RING_SIZE} height={RING_SIZE} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width={100} height={16} />
              <Skeleton variant="text" width={60} height={12} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'bg-white border border-stone-100 rounded-xl shadow-sm p-6 md:p-8',
          className
        )}
        {...props}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Left: Progress ring + status */}
          <div className="flex items-center gap-5">
            {/* Monochrome green progress ring */}
            <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                className="transform -rotate-90"
              >
                {/* Background track */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="#E7E5E4"
                  strokeWidth={STROKE_WIDTH}
                />
                {/* Progress arc */}
                <motion.circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="#064E3B"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  initial={{ strokeDashoffset: CIRCUMFERENCE }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </svg>

              {/* Score in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span
                  className="font-serif text-lg text-[#1A2E22] tabular-nums"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  {formatWithSeparators(animatedScore)}
                </motion.span>
              </div>
            </div>

            {/* Status + trend */}
            <div>
              <motion.div
                className="text-xs uppercase tracking-widest text-emerald-700 font-sans"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                {status}
              </motion.div>
              <motion.div
                className={cn('flex items-center gap-1 mt-1 font-mono text-xs', trendColor)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                <TrendIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="tabular-nums">
                  {change > 0 ? '+' : ''}
                  {change} from last month
                </span>
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    );
  }
);

CashFlowScoreGauge.displayName = 'CashFlowScoreGauge';
