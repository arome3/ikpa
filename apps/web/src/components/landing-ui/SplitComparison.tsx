'use client';

import { motion } from 'framer-motion';
import { GlassCard } from '@/components/landing-ui/GlassCard';
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles } from 'lucide-react';

interface FinancialMetric {
  label: string;
  currentValue: number;
  optimizedValue: number;
  format?: 'currency' | 'percentage' | 'months' | 'number';
  prefix?: string;
}

interface SplitComparisonProps {
  /** Progress value from 0 to 1 (from slider) */
  progress: number;
  /** Financial metrics to display */
  metrics: FinancialMetric[];
  /** CSS class for additional styling */
  className?: string;
}

const formatValue = (
  value: number,
  format: 'currency' | 'percentage' | 'months' | 'number' = 'number',
  prefix = ''
) => {
  switch (format) {
    case 'currency':
      return `${prefix}${(value / 1000000).toFixed(1)}M`;
    case 'percentage':
      return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
    case 'months':
      return `${value.toFixed(1)} months`;
    default:
      return `${prefix}${value.toLocaleString()}`;
  }
};

/**
 * Split view comparison showing Current Path vs Optimized Path
 * Values interpolate based on the year slider progress
 */
export function SplitComparison({
  progress,
  metrics,
  className = '',
}: SplitComparisonProps) {
  // Interpolate values based on progress
  const interpolateValue = (start: number, end: number) => {
    return start + (end - start) * progress;
  };

  return (
    <div className={`grid md:grid-cols-2 gap-6 ${className}`}>
      {/* Current Path */}
      <PathCard
        title="Current Path"
        subtitle="If nothing changes"
        variant="caution"
        icon={AlertTriangle}
        metrics={metrics.map((m) => ({
          ...m,
          value: interpolateValue(m.currentValue, m.currentValue * (1 + progress * 0.75)),
        }))}
        progress={progress}
      />

      {/* Optimized Path */}
      <PathCard
        title="Optimized Path"
        subtitle="With Ikpa guiding you"
        variant="emerald"
        icon={Sparkles}
        metrics={metrics.map((m) => ({
          ...m,
          value: interpolateValue(m.currentValue, m.optimizedValue),
        }))}
        progress={progress}
      />
    </div>
  );
}

function PathCard({
  title,
  subtitle,
  variant,
  icon: Icon,
  metrics,
  progress,
}: {
  title: string;
  subtitle: string;
  variant: 'caution' | 'emerald';
  icon: React.ElementType;
  metrics: (FinancialMetric & { value: number })[];
  progress: number;
}) {
  const glowIntensity = Math.min(progress * 1.5, 1);

  const variantStyles = {
    caution: {
      border: `rgba(249, 115, 22, ${0.2 + glowIntensity * 0.3})`,
      icon: 'text-orange-500 bg-orange-50',
      badge: 'bg-orange-50 text-orange-700',
      trend: 'text-orange-500',
    },
    emerald: {
      border: `rgba(16, 185, 129, ${0.2 + glowIntensity * 0.3})`,
      icon: 'text-emerald-500 bg-emerald-50',
      badge: 'bg-emerald-50 text-emerald-700',
      trend: 'text-emerald-500',
    },
  };

  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard
        className="h-full transition-all duration-500"
        glow={progress > 0.3 ? variant : 'none'}
        style={{
          borderColor: styles.border,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-lg ${styles.icon}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold" style={{ color: 'var(--foreground)' }}>
              {title}
            </h3>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <MetricRow
              key={index}
              label={metric.label}
              value={formatValue(metric.value, metric.format, metric.prefix)}
              trend={variant === 'emerald' ? 'up' : 'down'}
              trendClass={styles.trend}
            />
          ))}
        </div>

        {/* Year badge */}
        <div className="mt-6 pt-4 border-t border-neutral-200">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${styles.badge}`}>
            Year {2024 + Math.round(progress * 10)}
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function MetricRow({
  label,
  value,
  trend,
  trendClass,
}: {
  label: string;
  value: string;
  trend: 'up' | 'down';
  trendClass: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono font-semibold" style={{ color: 'var(--foreground)' }}>
          {value}
        </span>
        {trend === 'up' ? (
          <TrendingUp className={`w-4 h-4 ${trendClass}`} />
        ) : (
          <TrendingDown className={`w-4 h-4 ${trendClass}`} />
        )}
      </div>
    </div>
  );
}

/**
 * Difference highlight component
 */
export function DifferenceHighlight({
  difference,
  description,
  className = '',
}: {
  difference: string;
  description: string;
  className?: string;
}) {
  return (
    <motion.div
      className={`text-center py-6 ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        The difference is
      </p>
      <p className="text-3xl md:text-4xl font-display font-bold text-emerald-500 my-2">
        {difference}
      </p>
      <p style={{ color: 'var(--muted)' }}>{description}</p>
    </motion.div>
  );
}
