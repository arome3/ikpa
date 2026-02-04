'use client';

import { forwardRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';
import { useCountUp, formatWithSeparators } from '@/hooks';
import { getScoreStatus, statusColors } from '@/lib/mock/dashboard.mock';
import type { CashFlowScoreData } from '@/lib/mock/dashboard.mock';
import { Skeleton } from '@/components/ui';

export interface CashFlowScoreGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: CashFlowScoreData;
  isLoading?: boolean;
}

// SVG dimensions and arc calculations
const SIZE = 240;
const STROKE_WIDTH = 16;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = Math.PI * RADIUS; // Semi-circle

/**
 * Animated semi-circular gauge displaying Cash Flow Score
 * The signature component of the IKPA dashboard
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

    // Calculate stroke dashoffset for arc progress
    const progress = score / 100;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    // Get gradient ID for the score range
    const gradientId = 'scoreGradient';

    // Trend indicator
    const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
    const trendColor = change > 0 ? 'text-primary-500' : change < 0 ? 'text-caution-500' : 'text-gray-400';

    // Memoize arc path for performance
    const arcPath = useMemo(() => {
      // Create semi-circular arc (180 degrees, from left to right)
      const startX = CENTER - RADIUS;
      const startY = CENTER;
      const endX = CENTER + RADIUS;
      const endY = CENTER;

      return `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 0 1 ${endX} ${endY}`;
    }, []);

    // Calculate glow position on the arc
    const glowAngle = Math.PI * (1 - progress);
    const glowX = CENTER + RADIUS * Math.cos(glowAngle);
    const glowY = CENTER - RADIUS * Math.sin(glowAngle);

    if (isLoading) {
      return (
        <Card ref={ref} variant="glass" padding="lg" className={cn('text-center', className)} {...props}>
          <div className="flex flex-col items-center">
            <Skeleton variant="circular" width={SIZE} height={SIZE / 2 + 20} />
            <Skeleton variant="text" width={100} height={20} className="mt-4" />
            <Skeleton variant="text" width={60} height={16} className="mt-2" />
          </div>
        </Card>
      );
    }

    return (
      <Card
        ref={ref}
        variant="glass"
        padding="lg"
        className={cn('text-center overflow-visible', className)}
        {...props}
      >
        <div className="flex flex-col items-center">
          {/* SVG Gauge */}
          <div className="relative" style={{ width: SIZE, height: SIZE / 2 + 40 }}>
            <svg
              width={SIZE}
              height={SIZE / 2 + 20}
              viewBox={`0 0 ${SIZE} ${SIZE / 2 + 20}`}
              className="overflow-visible"
            >
              {/* Gradient definition */}
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F97316" /> {/* Orange */}
                  <stop offset="40%" stopColor="#FBBF24" /> {/* Yellow/Amber */}
                  <stop offset="100%" stopColor="#10B981" /> {/* Green */}
                </linearGradient>

                {/* Glow filter */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background track */}
              <path
                d={arcPath}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                className="text-gray-200 dark:text-slate-700"
              />

              {/* Animated progress arc */}
              <motion.path
                d={arcPath}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />

              {/* Glow indicator at current position */}
              {data && (
                <motion.circle
                  cx={glowX}
                  cy={glowY}
                  r={STROKE_WIDTH / 2 + 4}
                  fill="white"
                  filter="url(#glow)"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className="dark:fill-slate-200"
                />
              )}
            </svg>

            {/* Score display in center */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: SIZE / 2 - 40 }}
            >
              <motion.div
                className="text-5xl font-bold tabular-nums text-gray-900 dark:text-white"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                {formatWithSeparators(animatedScore)}
              </motion.div>
            </div>
          </div>

          {/* Status label */}
          <motion.div
            className={cn('text-lg font-semibold tracking-wide', statusColors[status])}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            {status}
          </motion.div>

          {/* Change indicator */}
          <motion.div
            className={cn('flex items-center gap-1 mt-2 text-sm', trendColor)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <TrendIcon className="h-4 w-4" />
            <span className="tabular-nums">
              {change > 0 ? '+' : ''}
              {change} from last month
            </span>
          </motion.div>
        </div>
      </Card>
    );
  }
);

CashFlowScoreGauge.displayName = 'CashFlowScoreGauge';
