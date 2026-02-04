'use client';

import { cn } from '@/lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
  xl: 'h-12 w-12 border-4',
};

export function Spinner({ size = 'md', className, label = 'Loading...' }: SpinnerProps) {
  return (
    <div className="inline-flex items-center justify-center" role="status" aria-label={label}>
      <div
        className={cn(
          'animate-spin rounded-full',
          'border-primary-500 border-t-transparent',
          sizeStyles[size],
          className
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// Full page loading state
export interface PageSpinnerProps {
  message?: string;
}

export function PageSpinner({ message = 'Loading...' }: PageSpinnerProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50">
      <Spinner size="xl" />
      {message && (
        <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );
}

// Inline loading with optional text
export interface InlineSpinnerProps {
  text?: string;
  size?: SpinnerSize;
}

export function InlineSpinner({ text, size = 'sm' }: InlineSpinnerProps) {
  return (
    <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
      <Spinner size={size} />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}
