'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

interface TimeTravelSliderProps {
  /** Start year */
  startYear?: number;
  /** End year */
  endYear?: number;
  /** Current year value */
  value?: number;
  /** Callback when year changes */
  onChange?: (year: number) => void;
  /** CSS class for additional styling */
  className?: string;
}

/**
 * Interactive year slider with drag functionality
 * Used for the Future Self Engine to travel through time
 */
export function TimeTravelSlider({
  startYear = 2024,
  endYear = 2034,
  value,
  onChange,
  className = '',
}: TimeTravelSliderProps) {
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [displayYear, setDisplayYear] = useState(startYear);

  // Motion values for drag
  const x = useMotionValue(0);
  const xSmooth = useSpring(x, { stiffness: 300, damping: 30 });

  // Calculate year from position
  const progress = useTransform(x, [0, containerWidth - 24], [0, 1]);
  const year = useTransform(progress, [0, 1], [startYear, endYear]);

  // Get container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (constraintsRef.current) {
        setContainerWidth(constraintsRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Update position when controlled value changes
  useEffect(() => {
    if (value !== undefined && containerWidth > 0) {
      const newProgress = (value - startYear) / (endYear - startYear);
      const newX = newProgress * (containerWidth - 24);
      x.set(newX);
    }
  }, [value, containerWidth, startYear, endYear, x]);

  // Notify parent of year changes and update display
  useEffect(() => {
    const unsubscribe = year.on('change', (v) => {
      const roundedYear = Math.round(v);
      setDisplayYear(roundedYear);
      onChange?.(roundedYear);
    });
    return unsubscribe;
  }, [year, onChange]);

  const handleDragEnd = () => {
    // Snap to nearest year
    const currentProgress = (x.get()) / (containerWidth - 24);
    const currentYear = startYear + currentProgress * (endYear - startYear);
    const snappedYear = Math.round(currentYear);
    const snappedProgress = (snappedYear - startYear) / (endYear - startYear);
    const snappedX = snappedProgress * (containerWidth - 24);

    x.set(snappedX);
  };

  const yearRange = endYear - startYear;
  const years = Array.from({ length: yearRange + 1 }, (_, i) => startYear + i);

  return (
    <div className={`w-full ${className}`}>
      {/* Year labels */}
      <div className="flex justify-between mb-3 px-3">
        <span className="text-sm font-medium text-neutral-500">{startYear}</span>
        <span className="text-sm font-medium text-emerald-600">Your Future</span>
        <span className="text-sm font-medium text-neutral-500">{endYear}</span>
      </div>

      {/* Track */}
      <div
        ref={constraintsRef}
        className="relative h-12 bg-neutral-100 rounded-full overflow-hidden"
        style={{
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Progress fill */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
          style={{
            width: useTransform(xSmooth, (v) => `${v + 24}px`),
          }}
        />

        {/* Year tick marks */}
        <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
          {years.filter((_, i) => i % 2 === 0).map((yr) => (
            <div
              key={yr}
              className="w-px h-3 bg-neutral-300 opacity-50"
            />
          ))}
        </div>

        {/* Draggable handle */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
          style={{ x: xSmooth }}
          drag="x"
          dragConstraints={constraintsRef}
          dragElastic={0}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.1 }}
          whileHover={{ scale: 1.05 }}
        >
          <div
            className="w-12 h-12 rounded-full bg-white shadow-lg border-4 border-emerald-500 flex items-center justify-center"
            style={{
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            <span className="text-xs font-bold text-emerald-600">
              {displayYear}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Current year indicator */}
      <motion.div
        className="flex justify-center mt-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="text-sm font-semibold text-emerald-700">
            Year: {displayYear}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Simple display component showing current year from slider
 */
export function YearDisplay({ year }: { year: number }) {
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
      <span className="text-sm text-neutral-600">Viewing:</span>
      <span className="text-lg font-bold text-emerald-600">{year}</span>
    </div>
  );
}
