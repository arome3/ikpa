'use client';

import { useEffect, useState } from 'react';

interface Orb {
  id: number;
  size: 'sm' | 'md' | 'lg';
  x: number;
  y: number;
  delay: number;
  duration: number;
}

interface AmbientBackgroundProps {
  /** Number of floating orbs */
  orbCount?: number;
  /** Orb color variant */
  variant?: 'gold' | 'forest' | 'mixed';
  /** Additional CSS classes */
  className?: string;
}

/**
 * AmbientBackground creates floating golden orbs that drift slowly,
 * adding visual warmth and depth to sections.
 */
export function AmbientBackground({
  orbCount = 3,
  variant = 'gold',
  className = '',
}: AmbientBackgroundProps) {
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Generate random orb positions on client side to avoid hydration mismatch
    const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];
    const generatedOrbs: Orb[] = Array.from({ length: orbCount }, (_, i) => ({
      id: i,
      size: sizes[i % sizes.length],
      x: Math.random() * 80 + 10, // 10-90% to keep within bounds
      y: Math.random() * 80 + 10,
      delay: Math.random() * 4,
      duration: 6 + Math.random() * 4, // 6-10 seconds
    }));
    setOrbs(generatedOrbs);
  }, [orbCount]);

  const getOrbColor = (index: number) => {
    if (variant === 'gold') {
      return 'radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.4), rgba(245, 158, 11, 0.05))';
    }
    if (variant === 'forest') {
      return 'radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.05))';
    }
    // Mixed: alternate between gold and forest
    return index % 2 === 0
      ? 'radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.35), rgba(245, 158, 11, 0.05))'
      : 'radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.25), rgba(16, 185, 129, 0.05))';
  };

  const getOrbSize = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return 'w-24 h-24 md:w-32 md:h-32';
      case 'md':
        return 'w-40 h-40 md:w-56 md:h-56';
      case 'lg':
        return 'w-56 h-56 md:w-80 md:h-80';
    }
  };

  if (!isClient) {
    return <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} />;
  }

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {orbs.map((orb) => (
        <div
          key={orb.id}
          className={`absolute rounded-full ${getOrbSize(orb.size)}`}
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            background: getOrbColor(orb.id),
            filter: 'blur(40px)',
            animation: `float ${orb.duration}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}
