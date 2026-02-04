'use client';

import { memo } from 'react';

interface NoiseTextureProps {
  /** Opacity of the noise overlay (default 0.03) */
  opacity?: number;
  /** CSS class for additional styling */
  className?: string;
}

/**
 * SVG noise filter overlay for premium texture feel
 * Adds subtle grain that makes digital interfaces feel more organic
 */
export const NoiseTexture = memo(function NoiseTexture({
  opacity = 0.03,
  className = '',
}: NoiseTextureProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ opacity, mixBlendMode: 'overlay' }}
      aria-hidden="true"
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="noise-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#noise-filter)" />
      </svg>
    </div>
  );
});
