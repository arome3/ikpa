'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  useScroll,
  useSpring,
  MotionValue,
} from 'framer-motion';

interface UseScrollProgressOptions {
  /** Scroll offset for start (default "start end" - when element top hits viewport bottom) */
  startOffset?: string;
  /** Scroll offset for end (default "end start" - when element bottom hits viewport top) */
  endOffset?: string;
  /** Spring stiffness (default 100) */
  stiffness?: number;
  /** Spring damping (default 30) */
  damping?: number;
  /** Whether to use spring smoothing (default true) */
  smooth?: boolean;
}

interface ScrollProgressReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  /** Raw scroll progress from 0 to 1 */
  progress: MotionValue<number>;
  /** Smoothed progress with spring physics */
  smoothProgress: MotionValue<number>;
  /** Current progress value (for conditional rendering) */
  progressValue: number;
  /** Whether element is currently in viewport */
  isInView: boolean;
}

/**
 * Generic hook for tracking scroll progress of any element
 * Useful for building custom scroll-triggered animations
 */
export function useScrollProgress(options: UseScrollProgressOptions = {}): ScrollProgressReturn {
  const {
    stiffness = 100,
    damping = 30,
    smooth = true,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [isInView, setIsInView] = useState(false);

  // Track scroll progress
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Add spring smoothing
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness,
    damping,
    restDelta: 0.001,
  });

  // Update progress value for conditional rendering
  useEffect(() => {
    const unsubscribe = (smooth ? smoothProgress : scrollYProgress).on('change', (v) => {
      setProgressValue(v);
    });
    return unsubscribe;
  }, [scrollYProgress, smoothProgress, smooth]);

  // Track viewport intersection
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return {
    ref,
    progress: scrollYProgress,
    smoothProgress: smooth ? smoothProgress : scrollYProgress,
    progressValue,
    isInView,
  };
}

/**
 * Hook for horizontal scroll progress (for carousel/scroller sections)
 */
export function useHorizontalScrollProgress(containerRef: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateProgress = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll > 0) {
      setProgress(scrollLeft / maxScroll);
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < maxScroll - 1);
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress(); // Initial check

    // Also update on resize
    const resizeObserver = new ResizeObserver(updateProgress);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateProgress);
      resizeObserver.disconnect();
    };
  }, [containerRef, updateProgress]);

  const scrollTo = useCallback((direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }, [containerRef]);

  return {
    progress,
    canScrollLeft,
    canScrollRight,
    scrollTo,
  };
}
