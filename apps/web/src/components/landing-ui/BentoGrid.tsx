'use client';

import { ReactNode } from 'react';

interface BentoGridProps {
  children: ReactNode;
  /** CSS class for additional styling */
  className?: string;
}

/**
 * Bento grid layout container
 * Uses CSS Grid with template areas for flexible layouts
 */
export function BentoGrid({ children, className = '' }: BentoGridProps) {
  return (
    <div
      className={`
        grid gap-4 md:gap-6
        grid-cols-1 md:grid-cols-2 lg:grid-cols-3
        auto-rows-[minmax(180px,auto)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * Alternative layout with specific template areas
 */
export function BentoGridFeatured({ children, className = '' }: BentoGridProps) {
  return (
    <div
      className={`
        grid gap-4 md:gap-6
        grid-cols-1 md:grid-cols-2 lg:grid-cols-3
        ${className}
      `}
      style={{
        gridTemplateRows: 'repeat(2, minmax(200px, auto))',
      }}
    >
      {children}
    </div>
  );
}
