'use client';

import { useEffect, useRef, useState } from 'react';

interface PathVisualizationProps {
  /** Show the animation */
  animate?: boolean;
  /** Animation duration in seconds */
  duration?: number;
  /** Width of the SVG */
  width?: number;
  /** Height of the SVG */
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PathVisualization creates an animated forking path SVG showing two futures diverging.
 * The golden "optimized" path rises upward while the muted "current" path stays flat.
 */
export function PathVisualization({
  animate = true,
  duration = 2,
  width = 400,
  height = 300,
  className = '',
}: PathVisualizationProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const pathRef2 = useRef<SVGPathElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [animate]);

  useEffect(() => {
    if (isVisible && pathRef.current && pathRef2.current) {
      const path1 = pathRef.current;
      const path2 = pathRef2.current;

      const length1 = path1.getTotalLength();
      const length2 = path2.getTotalLength();

      path1.style.strokeDasharray = `${length1}`;
      path1.style.strokeDashoffset = `${length1}`;

      path2.style.strokeDasharray = `${length2}`;
      path2.style.strokeDashoffset = `${length2}`;

      // Trigger animation
      requestAnimationFrame(() => {
        path1.style.transition = `stroke-dashoffset ${duration}s ease-out`;
        path1.style.strokeDashoffset = '0';

        path2.style.transition = `stroke-dashoffset ${duration}s ease-out 0.3s`;
        path2.style.strokeDashoffset = '0';
      });
    }
  }, [isVisible, duration]);

  // Define the diverging paths
  // Common start point, then fork
  const startX = 50;
  const startY = height - 50;
  const forkX = width * 0.35;
  const forkY = height - 80;

  // Current path - stays relatively flat with slight decline
  const currentPath = `M ${startX} ${startY}
    Q ${forkX - 30} ${startY - 20} ${forkX} ${forkY}
    Q ${forkX + 60} ${forkY + 30} ${width - 60} ${forkY + 50}`;

  // Optimized path - curves upward dramatically
  const optimizedPath = `M ${startX} ${startY}
    Q ${forkX - 30} ${startY - 20} ${forkX} ${forkY}
    Q ${forkX + 40} ${forkY - 60} ${forkX + 100} ${forkY - 100}
    Q ${forkX + 160} ${forkY - 140} ${width - 60} ${60}`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="goldPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FBBF24" />
          </linearGradient>
          <linearGradient id="mutedPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9CA3AF" />
            <stop offset="100%" stopColor="#D1D5DB" />
          </linearGradient>
          <filter id="pathGlow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Current path (muted) */}
        <path
          ref={pathRef}
          d={currentPath}
          fill="none"
          stroke="url(#mutedPathGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Optimized path (golden, glowing) */}
        <path
          ref={pathRef2}
          d={optimizedPath}
          fill="none"
          stroke="url(#goldPathGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#pathGlow)"
        />

        {/* Start point marker */}
        <circle
          cx={startX}
          cy={startY}
          r="8"
          fill="#064E3B"
          className={isVisible ? 'animate-scale-in' : 'opacity-0'}
        />

        {/* Fork point marker */}
        <circle
          cx={forkX}
          cy={forkY}
          r="6"
          fill="#F59E0B"
          className={isVisible ? 'animate-scale-in stagger-2' : 'opacity-0'}
          style={{ animationDelay: '0.5s' }}
        />

        {/* End point markers */}
        <circle
          cx={width - 60}
          cy={forkY + 50}
          r="5"
          fill="#9CA3AF"
          className={isVisible ? 'animate-scale-in' : 'opacity-0'}
          style={{ animationDelay: '1.5s' }}
        />
        <circle
          cx={width - 60}
          cy={60}
          r="8"
          fill="#F59E0B"
          className={isVisible ? 'animate-scale-in' : 'opacity-0'}
          style={{ animationDelay: '1.8s' }}
        >
          <animate
            attributeName="r"
            values="8;10;8"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {/* Labels */}
      <div
        className={`absolute text-sm font-medium transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          top: '20px',
          right: '20px',
          transitionDelay: '2s'
        }}
      >
        <span className="text-gold-500 font-semibold">Optimized</span>
      </div>
      <div
        className={`absolute text-sm font-medium transition-opacity duration-500 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          bottom: '60px',
          right: '20px',
          transitionDelay: '2s'
        }}
      >
        <span className="text-gray-400">Current</span>
      </div>
    </div>
  );
}
