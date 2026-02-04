'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface UseCountUpOptions {
  /** Starting value (default: 0) */
  from?: number;
  /** Target value to count up to */
  to: number;
  /** Animation duration in ms (default: 600) */
  duration?: number;
  /** Decimal places to show (default: 0) */
  decimals?: number;
  /** Easing function (default: easeOut) */
  easing?: 'linear' | 'easeOut' | 'easeInOut';
  /** Whether to start animation automatically (default: true) */
  autoStart?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

// Easing functions
const easingFunctions = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/**
 * Hook for animating number count-up with easing
 * Respects prefers-reduced-motion for accessibility
 */
export function useCountUp({
  from = 0,
  to,
  duration = 600,
  decimals = 0,
  easing = 'easeOut',
  autoStart = true,
  onComplete,
}: UseCountUpOptions) {
  const [value, setValue] = useState(autoStart ? from : to);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const animate = useCallback(
    (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFunctions[easing](progress);
      const currentValue = from + (to - from) * easedProgress;

      setValue(Number(currentValue.toFixed(decimals)));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        onComplete?.();
      }
    },
    [from, to, duration, decimals, easing, onComplete]
  );

  const start = useCallback(() => {
    // Skip animation for reduced motion preference
    if (prefersReducedMotion) {
      setValue(to);
      onComplete?.();
      return;
    }

    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    setIsAnimating(true);
    startTimeRef.current = null;
    animationRef.current = requestAnimationFrame(animate);
  }, [animate, to, prefersReducedMotion, onComplete]);

  const reset = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsAnimating(false);
    startTimeRef.current = null;
    setValue(from);
  }, [from]);

  // Auto-start animation
  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoStart, start]);

  // Re-animate when 'to' value changes
  useEffect(() => {
    if (autoStart && !isAnimating) {
      start();
    }
  }, [to, autoStart, isAnimating, start]);

  return {
    value,
    isAnimating,
    start,
    reset,
  };
}

/**
 * Format a number with thousands separators
 */
export function formatWithSeparators(value: number, decimals: number = 0): string {
  return value.toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
