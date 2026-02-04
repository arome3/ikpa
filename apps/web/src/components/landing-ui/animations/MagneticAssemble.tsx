'use client';

import { ReactNode, useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

interface AssembleItem {
  /** Content to display */
  content: ReactNode;
  /** Initial X offset from final position (px) */
  offsetX?: number;
  /** Initial Y offset from final position (px) */
  offsetY?: number;
  /** Initial rotation (degrees) */
  rotation?: number;
  /** Z-index for layering */
  zIndex?: number;
  /** Final position (percentage) */
  finalPosition?: { x: string; y: string };
}

interface MagneticAssembleProps {
  /** Items to animate */
  items: AssembleItem[];
  /** Container height */
  height?: string;
  /** CSS class for container */
  className?: string;
  /** Scroll trigger start (0-1, default 0.2) */
  startOffset?: number;
  /** Scroll trigger end (0-1, default 0.6) */
  endOffset?: number;
}

/**
 * Scattered elements that magnetically assemble into position on scroll
 * Creates the "fog lifting" effect with UI fragments coming together
 */
export function MagneticAssemble({
  items,
  height = '600px',
  className = '',
  startOffset = 0.2,
  endOffset = 0.6,
}: MagneticAssembleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const progress = useTransform(scrollYProgress, [startOffset, endOffset], [0, 1]);
  const smoothProgress = useSpring(progress, { stiffness: 100, damping: 30 });

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ height }}
    >
      {items.map((item, index) => (
        <AssembleElement
          key={index}
          item={item}
          progress={smoothProgress}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </div>
  );
}

function AssembleElement({
  item,
  progress,
  prefersReducedMotion,
}: {
  item: AssembleItem;
  progress: ReturnType<typeof useSpring>;
  prefersReducedMotion: boolean;
}) {
  const {
    content,
    offsetX = 0,
    offsetY = 0,
    rotation = 0,
    zIndex = 1,
    finalPosition = { x: '50%', y: '50%' },
  } = item;

  const x = useTransform(progress, [0, 1], prefersReducedMotion ? [0, 0] : [offsetX, 0]);
  const y = useTransform(progress, [0, 1], prefersReducedMotion ? [0, 0] : [offsetY, 0]);
  const rotate = useTransform(progress, [0, 1], prefersReducedMotion ? [0, 0] : [rotation, 0]);
  const opacity = useTransform(progress, [0, 0.3, 1], prefersReducedMotion ? [1, 1, 1] : [0.4, 0.8, 1]);
  const blur = useTransform(progress, [0, 0.5, 1], prefersReducedMotion ? [0, 0, 0] : [4, 2, 0]);
  const scale = useTransform(progress, [0, 1], prefersReducedMotion ? [1, 1] : [0.95, 1]);

  return (
    <motion.div
      className="absolute"
      style={{
        left: finalPosition.x,
        top: finalPosition.y,
        x,
        y,
        rotate,
        opacity,
        scale,
        filter: useTransform(blur, (v) => `blur(${v}px)`),
        zIndex,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {content}
    </motion.div>
  );
}

/**
 * Preset configuration for hero floating UI fragments
 */
export const heroFragmentPositions: AssembleItem[] = [
  // Center main card
  {
    content: null, // Will be replaced
    offsetX: -100,
    offsetY: -80,
    rotation: -8,
    zIndex: 5,
    finalPosition: { x: '50%', y: '50%' },
  },
  // Top right card
  {
    content: null,
    offsetX: 150,
    offsetY: -120,
    rotation: 12,
    zIndex: 3,
    finalPosition: { x: '75%', y: '25%' },
  },
  // Bottom left card
  {
    content: null,
    offsetX: -180,
    offsetY: 100,
    rotation: -15,
    zIndex: 2,
    finalPosition: { x: '20%', y: '70%' },
  },
  // Top left small
  {
    content: null,
    offsetX: -60,
    offsetY: -150,
    rotation: 5,
    zIndex: 1,
    finalPosition: { x: '25%', y: '20%' },
  },
  // Bottom right small
  {
    content: null,
    offsetX: 120,
    offsetY: 80,
    rotation: -10,
    zIndex: 1,
    finalPosition: { x: '80%', y: '75%' },
  },
];
