'use client';

import { ReactNode } from 'react';

interface KentePatternProps {
  /** Child content */
  children?: ReactNode;
  /** Pattern variant */
  variant?: 'diagonal' | 'cross' | 'subtle-diagonal';
  /** Color of the pattern lines */
  color?: 'gold' | 'forest' | 'white' | 'current';
  /** Opacity of the pattern (0-1) */
  opacity?: number;
  /** Whether pattern should be a background or overlay */
  mode?: 'background' | 'overlay';
  /** Additional CSS classes */
  className?: string;
}

/**
 * KentePattern creates subtle Kente cloth-inspired diagonal line patterns.
 * Inspired by traditional African textile geometry.
 */
export function KentePattern({
  children,
  variant = 'diagonal',
  color = 'gold',
  opacity = 0.05,
  mode = 'overlay',
  className = '',
}: KentePatternProps) {
  const getColor = () => {
    switch (color) {
      case 'gold':
        return 'rgba(245, 158, 11, OPACITY)';
      case 'forest':
        return 'rgba(6, 78, 59, OPACITY)';
      case 'white':
        return 'rgba(255, 255, 255, OPACITY)';
      case 'current':
        return 'currentColor';
    }
  };

  const getPattern = () => {
    const c = getColor().replace('OPACITY', String(opacity));

    switch (variant) {
      case 'diagonal':
        return `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 30px,
          ${c} 30px,
          ${c} 31px
        )`;
      case 'cross':
        return `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 20px,
          ${c} 20px,
          ${c} 21px
        ),
        repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 20px,
          ${c} 20px,
          ${c} 21px
        )`;
      case 'subtle-diagonal':
        return `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 50px,
          ${c} 50px,
          ${c} 51px
        )`;
    }
  };

  if (mode === 'background') {
    return (
      <div
        className={className}
        style={{
          backgroundImage: getPattern(),
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {children}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: getPattern(),
        }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Standalone function to get Kente pattern CSS for inline use
 */
export function getKentePatternCSS(
  variant: 'diagonal' | 'cross' | 'subtle-diagonal' = 'diagonal',
  color: string = 'rgba(245, 158, 11, 0.05)'
): string {
  switch (variant) {
    case 'diagonal':
      return `repeating-linear-gradient(
        45deg,
        transparent,
        transparent 30px,
        ${color} 30px,
        ${color} 31px
      )`;
    case 'cross':
      return `repeating-linear-gradient(
        45deg,
        transparent,
        transparent 20px,
        ${color} 20px,
        ${color} 21px
      ),
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 20px,
        ${color} 20px,
        ${color} 21px
      )`;
    case 'subtle-diagonal':
      return `repeating-linear-gradient(
        45deg,
        transparent,
        transparent 50px,
        ${color} 50px,
        ${color} 51px
      )`;
  }
}
