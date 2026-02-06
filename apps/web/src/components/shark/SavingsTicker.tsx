'use client';

import { useCountUp, formatWithSeparators } from '@/hooks/useCountUp';
import { getCurrencySymbol } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface SavingsTickerProps {
  amount: number;
  currency: string;
  duration?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  prefix?: string;
}

export function SavingsTicker({
  amount,
  currency,
  duration = 1200,
  className,
  size = 'md',
  prefix,
}: SavingsTickerProps) {
  const symbol = getCurrencySymbol(currency);
  const { value } = useCountUp({
    to: amount,
    duration,
    decimals: 0,
    easing: 'easeOut',
  });

  return (
    <span
      className={cn(
        'tabular-nums font-bold',
        size === 'sm' && 'text-lg',
        size === 'md' && 'text-2xl',
        size === 'lg' && 'text-4xl',
        className
      )}
    >
      {prefix}
      {symbol}
      {formatWithSeparators(value)}
    </span>
  );
}
