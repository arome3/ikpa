'use client';

import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { GlassCard } from './GlassCard';

type BentoSize = 'sm' | 'md' | 'lg' | 'xl';

interface BentoCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  /** Size of the card (affects grid span) */
  size?: BentoSize;
  /** Glow color */
  glow?: 'emerald' | 'amber' | 'caution' | 'none';
  /** Whether the card is featured (larger) */
  featured?: boolean;
  /** CSS class for additional styling */
  className?: string;
}

const sizeClasses: Record<BentoSize, string> = {
  sm: 'col-span-1 row-span-1',
  md: 'col-span-1 md:col-span-1 row-span-1',
  lg: 'col-span-1 md:col-span-2 row-span-1',
  xl: 'col-span-1 md:col-span-2 row-span-2',
};

/**
 * Individual Bento card component
 * Supports different sizes and glow states
 */
export function BentoCard({
  children,
  size = 'md',
  glow = 'none',
  featured = false,
  className = '',
  ...props
}: BentoCardProps) {
  const sizeClass = featured ? sizeClasses.xl : sizeClasses[size];

  return (
    <motion.div
      className={`${sizeClass} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      {...props}
    >
      <GlassCard
        className="h-full p-6 flex flex-col"
        glow={glow}
        hoverable
      >
        {children}
      </GlassCard>
    </motion.div>
  );
}

/**
 * Bento card header component
 */
export function BentoCardHeader({
  icon,
  title,
  subtitle,
  badge,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 rounded-lg bg-neutral-100 text-neutral-600">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-display font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {badge}
    </div>
  );
}

/**
 * Bento card content area
 */
export function BentoCardContent({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex-1 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Bento card footer
 */
export function BentoCardFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-auto pt-4 border-t border-neutral-200 ${className}`}>
      {children}
    </div>
  );
}
