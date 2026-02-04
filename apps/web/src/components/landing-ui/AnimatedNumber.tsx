'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  /** The final value to count up to */
  value: number;
  /** Duration of the animation in milliseconds */
  duration?: number;
  /** Format function for display (e.g., add currency symbol) */
  format?: (value: number) => string;
  /** Prefix to display before the number */
  prefix?: string;
  /** Suffix to display after the number */
  suffix?: string;
  /** Number of decimal places */
  decimals?: number;
  /** Additional CSS classes */
  className?: string;
  /** Start animation on mount or wait for visibility */
  autoStart?: boolean;
}

/**
 * AnimatedNumber displays a count-up animation from 0 to the target value.
 * Uses Intersection Observer to trigger animation when visible.
 */
export function AnimatedNumber({
  value,
  duration = 2000,
  format,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  autoStart = false,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const startAnimation = () => {
      if (hasAnimated) return;
      setHasAnimated(true);

      const startTime = performance.now();
      const startValue = 0;
      const endValue = value;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const current = startValue + (endValue - startValue) * easeOut;
        setDisplayValue(current);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(endValue);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    if (autoStart) {
      startAnimation();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, hasAnimated, autoStart]);

  const formatValue = (val: number): string => {
    if (format) {
      return format(val);
    }
    return val.toFixed(decimals);
  };

  return (
    <span
      ref={elementRef}
      className={`font-mono tabular-nums ${className}`}
    >
      {prefix}
      {formatValue(displayValue)}
      {suffix}
    </span>
  );
}

/**
 * Preset formats for common use cases
 */
export const numberFormats = {
  /** Format as currency (e.g., "₦2,500") */
  currency: (symbol: string = '₦') => (value: number) =>
    `${symbol}${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`,

  /** Format as percentage (e.g., "30%") */
  percentage: (value: number) => `${Math.round(value)}%`,

  /** Format with thousands separator (e.g., "2,847") */
  thousands: (value: number) =>
    value.toLocaleString('en-US', { maximumFractionDigits: 0 }),

  /** Format as compact number (e.g., "2.8K", "1.2M") */
  compact: (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  },
};
