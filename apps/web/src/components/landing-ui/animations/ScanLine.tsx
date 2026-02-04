'use client';

import { memo, useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface ScanLineProps {
  /** Whether the scan line is active */
  active?: boolean;
  /** Color of the scan line */
  color?: 'emerald' | 'amber';
  /** Duration of one sweep in seconds */
  duration?: number;
  /** Delay between sweeps */
  delay?: number;
  /** CSS class for additional styling */
  className?: string;
  /** Callback when scan completes */
  onScanComplete?: () => void;
}

const colorMap = {
  emerald: 'rgba(16, 185, 129, 0.4)',
  amber: 'rgba(245, 158, 11, 0.4)',
};

/**
 * Horizontal glowing scan line effect
 * Sweeps across container, useful for "analyzing" animations
 */
export const ScanLine = memo(function ScanLine({
  active = true,
  color = 'emerald',
  duration = 2,
  delay = 1,
  className = '',
  onScanComplete,
}: ScanLineProps) {
  const controls = useAnimation();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !active) {
      controls.stop();
      return;
    }

    const animate = async () => {
      while (active) {
        await controls.start({
          x: ['calc(-100%)', 'calc(100%)'],
          opacity: [0, 1, 1, 0],
          transition: {
            duration,
            ease: 'easeInOut',
            times: [0, 0.1, 0.9, 1],
          },
        });
        onScanComplete?.();
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      }
    };

    animate();
  }, [active, controls, duration, delay, prefersReducedMotion, onScanComplete]);

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <motion.div
      className={`pointer-events-none absolute inset-y-0 left-0 w-32 ${className}`}
      animate={controls}
      initial={{ x: 'calc(-100%)', opacity: 0 }}
      style={{
        background: `linear-gradient(90deg, transparent, ${colorMap[color]}, transparent)`,
      }}
      aria-hidden="true"
    />
  );
});

/**
 * Vertical scan line variant
 */
export const VerticalScanLine = memo(function VerticalScanLine({
  active = true,
  color = 'emerald',
  duration = 2,
  delay = 1,
  className = '',
}: Omit<ScanLineProps, 'onScanComplete'>) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
  }, []);

  if (prefersReducedMotion || !active) {
    return null;
  }

  return (
    <motion.div
      className={`pointer-events-none absolute inset-x-0 top-0 h-16 ${className}`}
      initial={{ y: 'calc(-100%)' }}
      animate={{
        y: ['calc(-100%)', 'calc(100vh)'],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatDelay: delay,
        times: [0, 0.1, 0.9, 1],
      }}
      style={{
        background: `linear-gradient(180deg, transparent, ${colorMap[color]}, transparent)`,
      }}
      aria-hidden="true"
    />
  );
});
