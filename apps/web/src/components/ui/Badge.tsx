'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'caution' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: `
    bg-primary-100 text-primary-700
    dark:bg-primary-900/30 dark:text-primary-400
  `,
  warning: `
    bg-secondary-100 text-secondary-700
    dark:bg-secondary-900/30 dark:text-secondary-400
  `,
  caution: `
    bg-caution-100 text-caution-700
    dark:bg-caution-900/30 dark:text-caution-400
  `,
  info: `
    bg-info-100 text-info-700
    dark:bg-info-900/30 dark:text-info-400
  `,
  neutral: `
    bg-gray-100 text-gray-700
    dark:bg-gray-800 dark:text-gray-300
  `,
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-primary-500',
  warning: 'bg-secondary-500',
  caution: 'bg-caution-500',
  info: 'bg-info-500',
  neutral: 'bg-gray-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', size = 'md', dot = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 font-medium rounded-full',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Specialized badge for financial changes
export interface ChangeBadgeProps extends Omit<BadgeProps, 'variant'> {
  value: number;
  format?: 'percent' | 'currency';
  currencySymbol?: string;
}

export const ChangeBadge = forwardRef<HTMLSpanElement, ChangeBadgeProps>(
  ({ value, format = 'percent', currencySymbol = '₦', className, ...props }, ref) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;

    const variant: BadgeVariant = isNeutral
      ? 'neutral'
      : isPositive
      ? 'success'
      : 'caution';

    const formattedValue =
      format === 'percent'
        ? `${isPositive ? '+' : ''}${value.toFixed(1)}%`
        : `${isPositive ? '+' : ''}${currencySymbol}${Math.abs(value).toLocaleString()}`;

    return (
      <Badge ref={ref} variant={variant} className={className} {...props}>
        {formattedValue}
      </Badge>
    );
  }
);

ChangeBadge.displayName = 'ChangeBadge';
