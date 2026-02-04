'use client';

import { memo, ReactNode } from 'react';

interface PaperTextureProps {
  children: ReactNode;
  /** Paper color variant */
  variant?: 'warm' | 'cream' | 'aged';
  /** Whether to show fold lines */
  showFolds?: boolean;
  /** CSS class for additional styling */
  className?: string;
}

const variantStyles = {
  warm: 'bg-amber-50',
  cream: 'bg-[#FFFEF5]',
  aged: 'bg-[#F5F0E1]',
};

/**
 * Paper-textured container for "Letter from 2034" and similar content
 * Creates an aged paper feel with optional fold lines
 */
export const PaperTexture = memo(function PaperTexture({
  children,
  variant = 'warm',
  showFolds = false,
  className = '',
}: PaperTextureProps) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-lg
        ${variantStyles[variant]}
        ${className}
      `}
      style={{
        backgroundImage: `
          linear-gradient(rgba(245, 158, 11, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(245, 158, 11, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        boxShadow: `
          0 1px 3px rgba(0, 0, 0, 0.05),
          0 4px 8px rgba(0, 0, 0, 0.03),
          inset 0 0 60px rgba(245, 158, 11, 0.03)
        `,
      }}
    >
      {/* Subtle vignette effect */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.02) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Fold lines */}
      {showFolds && (
        <>
          <div
            className="pointer-events-none absolute left-1/3 top-0 h-full w-px"
            style={{
              background: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.03), transparent)',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-2/3 top-0 h-full w-px"
            style={{
              background: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.03), transparent)',
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Paper edge effect */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-1"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.02), transparent)',
        }}
        aria-hidden="true"
      />

      {children}
    </div>
  );
});

/**
 * Handwriting-style text treatment
 */
export const HandwritingText = memo(function HandwritingText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-serif italic ${className}`}
      style={{
        color: '#1E3A5F',
        textShadow: '0 0 1px rgba(0, 0, 0, 0.05)',
      }}
    >
      {children}
    </span>
  );
});
