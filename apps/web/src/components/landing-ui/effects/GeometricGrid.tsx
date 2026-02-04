'use client';

import { memo } from 'react';

interface GeometricGridProps {
  /** Grid line color (default emerald) */
  color?: 'emerald' | 'amber' | 'neutral';
  /** Grid size in pixels (default 40) */
  size?: number;
  /** Line opacity (default 0.05) */
  opacity?: number;
  /** CSS class for additional styling */
  className?: string;
}

const colorMap = {
  emerald: 'rgba(16, 185, 129, VAR)',
  amber: 'rgba(245, 158, 11, VAR)',
  neutral: 'rgba(107, 114, 128, VAR)',
};

/**
 * Variable opacity grid lines inspired by African fractal patterns
 * Creates subtle geometric texture for backgrounds
 */
export const GeometricGrid = memo(function GeometricGrid({
  color = 'emerald',
  size = 40,
  opacity = 0.05,
  className = '',
}: GeometricGridProps) {
  const colorValue = colorMap[color].replace('VAR', String(opacity));

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(${colorValue} 1px, transparent 1px),
          linear-gradient(90deg, ${colorValue} 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
      }}
      aria-hidden="true"
    />
  );
});

/**
 * Fractal-inspired diagonal grid pattern
 * More complex pattern inspired by African textile designs
 */
export const FractalGrid = memo(function FractalGrid({
  color = 'emerald',
  opacity = 0.03,
  className = '',
}: Omit<GeometricGridProps, 'size'>) {
  const colorValue = colorMap[color].replace('VAR', String(opacity));

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(45deg, ${colorValue} 1px, transparent 1px),
          linear-gradient(-45deg, ${colorValue} 1px, transparent 1px),
          linear-gradient(${colorValue} 1px, transparent 1px),
          linear-gradient(90deg, ${colorValue} 1px, transparent 1px)
        `,
        backgroundSize: `60px 60px, 60px 60px, 30px 30px, 30px 30px`,
      }}
      aria-hidden="true"
    />
  );
});
