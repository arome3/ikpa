'use client';

import { useRef, useEffect, useState } from 'react';
import {
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
} from 'framer-motion';

interface UseBlurRevealOptions {
  /** Start revealing when element is this far into view (0-1, default 0.2) */
  startOffset?: number;
  /** Complete reveal when element is this far into view (0-1, default 0.5) */
  endOffset?: number;
  /** Initial blur amount in pixels (default 8) */
  initialBlur?: number;
  /** Initial opacity (default 0.6) */
  initialOpacity?: number;
  /** Spring stiffness (default 100) */
  stiffness?: number;
  /** Spring damping (default 30) */
  damping?: number;
}

interface BlurRevealReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  blur: MotionValue<string>;
  opacity: MotionValue<number>;
  progress: MotionValue<number>;
  isInView: boolean;
}

/**
 * Hook for scroll-triggered blur-to-clarity effect
 * Elements start blurred and snap into clarity as user scrolls
 */
export function useBlurReveal(options: UseBlurRevealOptions = {}): BlurRevealReturn {
  const {
    startOffset = 0.2,
    endOffset = 0.5,
    initialBlur = 8,
    initialOpacity = 0.6,
    stiffness = 100,
    damping = 30,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Track scroll progress relative to element
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [`start end`, `end start`],
  });

  // Map scroll progress to reveal progress (0 to 1)
  const revealProgress = useTransform(
    scrollYProgress,
    [startOffset, endOffset],
    [0, 1]
  );

  // Add spring smoothing
  const smoothProgress = useSpring(revealProgress, {
    stiffness,
    damping,
    restDelta: 0.001,
  });

  // Transform progress to blur value
  const blurValue = useTransform(
    smoothProgress,
    [0, 1],
    prefersReducedMotion ? [0, 0] : [initialBlur, 0]
  );

  // Format blur for CSS filter
  const blur = useTransform(blurValue, (v) => `blur(${v}px)`);

  // Transform progress to opacity
  const opacity = useTransform(
    smoothProgress,
    [0, 1],
    prefersReducedMotion ? [1, 1] : [initialOpacity, 1]
  );

  // Track when element enters view
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return {
    ref,
    blur,
    opacity,
    progress: smoothProgress,
    isInView,
  };
}
