'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

interface GlowOrbProps {
  /** Color of the glow (default emerald) */
  color?: 'emerald' | 'amber';
  /** Size of the orb in pixels (default 200) */
  size?: number;
  /** Position as percentage from top-left */
  position?: { x: number; y: number };
  /** Whether to animate (default true) */
  animate?: boolean;
  /** Animation delay in seconds */
  delay?: number;
  /** Blur radius in pixels (default size/2) */
  blur?: number;
  /** Opacity (default 0.3) */
  opacity?: number;
  /** CSS class for additional styling */
  className?: string;
}

const colorMap = {
  emerald: '#10B981',
  amber: '#F59E0B',
};

/**
 * Animated glowing orb for ambient backgrounds
 * Creates a soft, pulsing glow effect
 */
export const GlowOrb = memo(function GlowOrb({
  color = 'emerald',
  size = 200,
  position = { x: 50, y: 50 },
  animate = true,
  delay = 0,
  blur,
  opacity = 0.3,
  className = '',
}: GlowOrbProps) {
  const blurRadius = blur ?? size / 2;
  const orbColor = colorMap[color];

  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle, ${orbColor} 0%, transparent 70%)`,
        filter: `blur(${blurRadius}px)`,
        opacity,
      }}
      initial={animate ? { scale: 1, opacity: opacity * 0.5 } : undefined}
      animate={
        animate
          ? {
              scale: [1, 1.1, 1],
              opacity: [opacity * 0.5, opacity, opacity * 0.5],
            }
          : undefined
      }
      transition={
        animate
          ? {
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            }
          : undefined
      }
      aria-hidden="true"
    />
  );
});

/**
 * Multiple orbs with preset positions for backgrounds
 */
export const AmbientGlow = memo(function AmbientGlow({
  variant = 'default',
  className = '',
}: {
  variant?: 'default' | 'hero' | 'subtle';
  className?: string;
}) {
  const configs = {
    default: [
      { color: 'emerald' as const, position: { x: 20, y: 30 }, size: 300, delay: 0 },
      { color: 'amber' as const, position: { x: 80, y: 70 }, size: 250, delay: 1 },
    ],
    hero: [
      { color: 'emerald' as const, position: { x: 30, y: 40 }, size: 400, delay: 0, opacity: 0.2 },
      { color: 'emerald' as const, position: { x: 70, y: 60 }, size: 350, delay: 0.5, opacity: 0.15 },
      { color: 'amber' as const, position: { x: 85, y: 25 }, size: 200, delay: 1, opacity: 0.2 },
    ],
    subtle: [
      { color: 'emerald' as const, position: { x: 25, y: 50 }, size: 200, delay: 0, opacity: 0.1 },
      { color: 'emerald' as const, position: { x: 75, y: 50 }, size: 200, delay: 1, opacity: 0.1 },
    ],
  };

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {configs[variant].map((config, i) => (
        <GlowOrb key={i} {...config} />
      ))}
    </div>
  );
});
