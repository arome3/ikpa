'use client';

import { ReactNode, useRef } from 'react';
import { motion } from 'framer-motion';
import { useHorizontalScrollProgress } from '@/hooks/useScrollProgress';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollerProps {
  children: ReactNode;
  /** Show navigation arrows */
  showArrows?: boolean;
  /** Show progress indicator dots */
  showProgress?: boolean;
  /** Number of items (for progress dots) */
  itemCount?: number;
  /** Gap between items in pixels */
  gap?: number;
  /** Padding at ends in pixels */
  padding?: number;
  /** CSS class for container */
  className?: string;
  /** CSS class for scroll area */
  scrollClassName?: string;
}

/**
 * Horizontal snap-scroll container with progress indicator
 * Used for problem scroller and feature showcases
 */
export function HorizontalScroller({
  children,
  showArrows = true,
  showProgress = true,
  itemCount = 0,
  gap = 24,
  padding = 24,
  className = '',
  scrollClassName = '',
}: HorizontalScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { progress, canScrollLeft, canScrollRight, scrollTo } = useHorizontalScrollProgress(scrollRef);

  // Calculate current active index from progress
  const activeIndex = itemCount > 0 ? Math.round(progress * (itemCount - 1)) : 0;

  return (
    <div className={`relative ${className}`}>
      {/* Scroll Container */}
      <div
        ref={scrollRef}
        className={`
          flex overflow-x-auto scrollbar-hide
          snap-x-mandatory scroll-smooth
          ${scrollClassName}
        `}
        style={{
          gap: `${gap}px`,
          padding: `0 ${padding}px`,
        }}
      >
        {children}
      </div>

      {/* Navigation Arrows */}
      {showArrows && (
        <>
          <ScrollArrow
            direction="left"
            onClick={() => scrollTo('left')}
            visible={canScrollLeft}
          />
          <ScrollArrow
            direction="right"
            onClick={() => scrollTo('right')}
            visible={canScrollRight}
          />
        </>
      )}

      {/* Progress Indicator */}
      {showProgress && itemCount > 1 && (
        <ProgressDots
          count={itemCount}
          activeIndex={activeIndex}
          className="mt-6"
        />
      )}
    </div>
  );
}

function ScrollArrow({
  direction,
  onClick,
  visible,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  visible: boolean;
}) {
  return (
    <motion.button
      className={`
        absolute top-1/2 -translate-y-1/2 z-10
        w-10 h-10 rounded-full
        bg-white/90 backdrop-blur-sm
        border border-neutral-200
        flex items-center justify-center
        text-neutral-600 hover:text-emerald-600
        shadow-md hover:shadow-lg
        transition-all duration-200
        ${direction === 'left' ? 'left-2' : 'right-2'}
      `}
      onClick={onClick}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.8,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      transition={{ duration: 0.2 }}
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
    >
      {direction === 'left' ? (
        <ChevronLeft className="w-5 h-5" />
      ) : (
        <ChevronRight className="w-5 h-5" />
      )}
    </motion.button>
  );
}

function ProgressDots({
  count,
  activeIndex,
  className = '',
}: {
  count: number;
  activeIndex: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          className="rounded-full"
          initial={false}
          animate={{
            width: index === activeIndex ? 24 : 8,
            backgroundColor: index === activeIndex ? '#10B981' : '#D1D5DB',
          }}
          transition={{ duration: 0.3 }}
          style={{ height: 8 }}
        />
      ))}
    </div>
  );
}

/**
 * Individual scroll item with snap alignment
 */
export function ScrollItem({
  children,
  className = '',
  snapAlign = 'center',
}: {
  children: ReactNode;
  className?: string;
  snapAlign?: 'start' | 'center' | 'end';
}) {
  const alignClass = {
    start: 'snap-start',
    center: 'snap-center',
    end: 'snap-end',
  };

  return (
    <div className={`flex-shrink-0 ${alignClass[snapAlign]} ${className}`}>
      {children}
    </div>
  );
}
