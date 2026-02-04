'use client';

import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-slate-700',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded h-4',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      style={{
        width: width,
        height: height,
        ...style,
      }}
      {...props}
    />
  );
}

// Pre-built skeleton patterns for common UI elements

export function SkeletonCard() {
  return (
    <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
      </div>
    </div>
  );
}

export function SkeletonTransaction() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton variant="circular" width={44} height={44} />
      <div className="flex-1">
        <Skeleton variant="text" width="50%" height={16} />
        <Skeleton variant="text" width="30%" height={12} className="mt-1" />
      </div>
      <Skeleton variant="text" width={80} height={20} />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" width={120} height={20} />
        <Skeleton variant="text" width={80} height={16} />
      </div>
      <Skeleton variant="rectangular" height={200} className="rounded-xl" />
    </div>
  );
}

export function SkeletonGoalCard() {
  return (
    <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1">
          <Skeleton variant="text" width="70%" height={18} />
          <Skeleton variant="text" width="40%" height={14} className="mt-1" />
        </div>
      </div>
      <Skeleton variant="rectangular" height={8} className="rounded-full" />
      <div className="flex justify-between">
        <Skeleton variant="text" width={60} height={14} />
        <Skeleton variant="text" width={80} height={14} />
      </div>
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton variant="circular" width={size} height={size} />;
}

export function SkeletonButton() {
  return <Skeleton variant="rectangular" width={100} height={40} className="rounded-xl" />;
}
