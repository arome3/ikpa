'use client';

import { forwardRef, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type GlowColor = 'emerald' | 'amber' | 'caution' | 'none';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Whether to show hover effect */
  hoverable?: boolean;
  /** Glow color for the border */
  glow?: GlowColor;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** CSS class for additional styling */
  className?: string;
}

const sizeStyles = {
  sm: 'p-4 rounded-lg',
  md: 'p-6 rounded-xl',
  lg: 'p-8 rounded-2xl',
};

const glowStyles: Record<GlowColor, string> = {
  emerald: 'shadow-glow-emerald border-emerald-300/40',
  amber: 'shadow-glow-amber border-amber-300/40',
  caution: 'shadow-glow-caution border-orange-300/40',
  none: '',
};

/**
 * Glassmorphism card component
 *
 * Properties from UI guide:
 * - Background: rgba(255, 255, 255, 0.7)
 * - backdrop-filter: blur(12px)
 * - Border: 1px solid rgba(255, 255, 255, 0.3)
 * - Border-radius: 16px
 * - Box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05)
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCard(
    {
      children,
      hoverable = false,
      glow = 'none',
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) {
    return (
      <motion.div
        ref={ref}
        className={`
          glass-card
          ${sizeStyles[size]}
          ${glow !== 'none' ? glowStyles[glow] : ''}
          ${hoverable ? 'glass-card-hover cursor-pointer' : ''}
          ${className}
        `}
        whileHover={
          hoverable
            ? {
                y: -2,
                transition: { duration: 0.2 },
              }
            : undefined
        }
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

/**
 * Large glass card variant with more blur
 */
export const GlassCardLarge = forwardRef<HTMLDivElement, GlassCardProps>(
  function GlassCardLarge(
    {
      children,
      hoverable = false,
      glow = 'none',
      className = '',
      ...props
    },
    ref
  ) {
    return (
      <motion.div
        ref={ref}
        className={`
          glass-card-lg p-8
          ${glow !== 'none' ? glowStyles[glow] : ''}
          ${hoverable ? 'glass-card-hover cursor-pointer' : ''}
          ${className}
        `}
        whileHover={
          hoverable
            ? {
                y: -4,
                transition: { duration: 0.2 },
              }
            : undefined
        }
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

/**
 * Floating glass card with animation
 */
export const FloatingGlassCard = forwardRef<HTMLDivElement, GlassCardProps & { delay?: number }>(
  function FloatingGlassCard(
    {
      children,
      glow = 'none',
      size = 'md',
      delay = 0,
      className = '',
      ...props
    },
    ref
  ) {
    return (
      <motion.div
        ref={ref}
        className={`
          glass-card
          ${sizeStyles[size]}
          ${glow !== 'none' ? glowStyles[glow] : ''}
          ${className}
        `}
        initial={{ y: 0 }}
        animate={{
          y: [-5, 5, -5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
