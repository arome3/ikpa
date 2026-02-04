'use client';

import { ReactNode } from 'react';

interface GlowingBorderProps {
  /** Child content */
  children: ReactNode;
  /** Color variant */
  variant?: 'gold' | 'forest' | 'copper';
  /** Intensity of the glow */
  intensity?: 'subtle' | 'medium' | 'strong';
  /** Border radius */
  rounded?: 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  /** Whether to animate the glow */
  animated?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * GlowingBorder wraps content with a beautiful glowing border effect.
 * Perfect for highlighting important cards or CTAs.
 */
export function GlowingBorder({
  children,
  variant = 'gold',
  intensity = 'medium',
  rounded = '2xl',
  animated = false,
  className = '',
}: GlowingBorderProps) {
  const getGlowColor = () => {
    switch (variant) {
      case 'gold':
        return {
          border: '#F59E0B',
          glow: 'rgba(245, 158, 11, VAR)',
          bg: 'rgba(245, 158, 11, 0.05)',
        };
      case 'forest':
        return {
          border: '#10B981',
          glow: 'rgba(16, 185, 129, VAR)',
          bg: 'rgba(16, 185, 129, 0.05)',
        };
      case 'copper':
        return {
          border: '#C87941',
          glow: 'rgba(200, 121, 65, VAR)',
          bg: 'rgba(200, 121, 65, 0.05)',
        };
    }
  };

  const getIntensity = () => {
    switch (intensity) {
      case 'subtle':
        return { opacity: 0.15, blur: 20 };
      case 'medium':
        return { opacity: 0.3, blur: 30 };
      case 'strong':
        return { opacity: 0.45, blur: 40 };
    }
  };

  const getRoundedClass = () => {
    switch (rounded) {
      case 'lg':
        return 'rounded-lg';
      case 'xl':
        return 'rounded-xl';
      case '2xl':
        return 'rounded-2xl';
      case '3xl':
        return 'rounded-3xl';
      case 'full':
        return 'rounded-full';
    }
  };

  const colors = getGlowColor();
  const intensityValues = getIntensity();
  const roundedClass = getRoundedClass();

  const glowStyle = {
    boxShadow: `0 0 ${intensityValues.blur}px ${colors.glow.replace('VAR', String(intensityValues.opacity))}`,
    border: `2px solid ${colors.border}`,
    background: colors.bg,
  };

  return (
    <div
      className={`
        relative ${roundedClass}
        ${animated ? 'animate-glow-pulse' : ''}
        ${className}
      `}
      style={glowStyle}
    >
      {children}
    </div>
  );
}

/**
 * A simpler version that just adds a glowing outline without the wrapper div
 */
interface GlowOutlineProps {
  /** Color variant */
  variant?: 'gold' | 'forest';
  /** Intensity */
  intensity?: 'subtle' | 'medium' | 'strong';
}

export function getGlowOutlineStyles({ variant = 'gold', intensity = 'medium' }: GlowOutlineProps = {}) {
  const colors = {
    gold: 'rgba(245, 158, 11, VAR)',
    forest: 'rgba(16, 185, 129, VAR)',
  };

  const intensities = {
    subtle: { opacity: 0.2, blur: 15 },
    medium: { opacity: 0.35, blur: 25 },
    strong: { opacity: 0.5, blur: 40 },
  };

  const i = intensities[intensity];
  const color = colors[variant].replace('VAR', String(i.opacity));

  return {
    boxShadow: `0 0 ${i.blur}px ${color}`,
  };
}
