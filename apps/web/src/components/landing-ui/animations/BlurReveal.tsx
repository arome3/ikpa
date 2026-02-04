'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useBlurReveal } from '@/hooks/useBlurReveal';

interface BlurRevealProps {
  children: ReactNode;
  /** Start revealing when element is this far into view (0-1) */
  startOffset?: number;
  /** Complete reveal when element is this far into view (0-1) */
  endOffset?: number;
  /** Initial blur amount in pixels */
  initialBlur?: number;
  /** Initial opacity */
  initialOpacity?: number;
  /** CSS class for additional styling */
  className?: string;
  /** HTML tag to render as */
  as?: 'div' | 'section' | 'article' | 'span';
}

/**
 * Wrapper component that applies blur-to-clarity effect on scroll
 * Children start blurred and snap into focus as user scrolls down
 */
export function BlurReveal({
  children,
  startOffset = 0.2,
  endOffset = 0.5,
  initialBlur = 8,
  initialOpacity = 0.6,
  className = '',
  as = 'div',
}: BlurRevealProps) {
  const { ref, blur, opacity } = useBlurReveal({
    startOffset,
    endOffset,
    initialBlur,
    initialOpacity,
  });

  const Component = motion[as];

  return (
    <Component
      ref={ref}
      className={className}
      style={{
        filter: blur,
        opacity,
      }}
    >
      {children}
    </Component>
  );
}

/**
 * Simplified blur reveal with preset timing
 */
export function QuickBlurReveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BlurReveal
      startOffset={0.1}
      endOffset={0.3}
      initialBlur={6}
      initialOpacity={0.7}
      className={className}
    >
      {children}
    </BlurReveal>
  );
}

/**
 * Staggered blur reveal for lists of items
 */
export function StaggeredBlurReveal({
  children,
  className = '',
  staggerDelay = 0.1,
}: {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <BlurReveal
          key={index}
          startOffset={0.15 + index * staggerDelay * 0.5}
          endOffset={0.35 + index * staggerDelay * 0.5}
        >
          {child}
        </BlurReveal>
      ))}
    </div>
  );
}
