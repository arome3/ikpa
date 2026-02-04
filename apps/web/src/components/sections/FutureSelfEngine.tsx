'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Container, Badge } from '@/components/landing-ui';
import { TimeTravelSlider } from '@/components/landing-ui/TimeTravelSlider';
import { SplitComparison, DifferenceHighlight } from '@/components/landing-ui/SplitComparison';
import { AmbientGlow } from '@/components/landing-ui/effects';

// Financial projection data
const financialMetrics = [
  {
    label: 'Total Savings',
    currentValue: 2400000, // ₦2.4M
    optimizedValue: 28400000, // ₦28.4M
    format: 'currency' as const,
    prefix: '₦',
  },
  {
    label: 'Monthly Runway',
    currentValue: 1.2,
    optimizedValue: 8.4,
    format: 'months' as const,
  },
  {
    label: 'Investment Returns',
    currentValue: 3.2,
    optimizedValue: 14.8,
    format: 'percentage' as const,
  },
  {
    label: 'Net Worth Growth',
    currentValue: 5.0,
    optimizedValue: 23.5,
    format: 'percentage' as const,
  },
];

export function FutureSelfEngine() {
  const [currentYear, setCurrentYear] = useState(2024);

  // Calculate progress from year (0 to 1)
  const progress = (currentYear - 2024) / 10;

  // Calculate the monthly difference
  const monthlyDifference = Math.round(67000 + progress * 120000);
  const formattedDifference = `₦${monthlyDifference.toLocaleString()}/month`;

  return (
    <section
      className="relative py-24 md:py-32 overflow-hidden"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Ambient glow background */}
      <AmbientGlow variant="subtle" />

      <Container>
        {/* Section Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-4">Future Self Engine</Badge>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-display font-bold tracking-tight mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            Talk to Your Future Self
          </h2>
          <p className="text-lg" style={{ color: 'var(--muted)' }}>
            MIT Media Lab research shows users who visualize their future selves save{' '}
            <span className="font-semibold text-emerald-600">16% more</span>. Our AI writes you letters from 2034.
          </p>
        </motion.div>

        {/* Time Travel Slider */}
        <motion.div
          className="max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <TimeTravelSlider
            startYear={2024}
            endYear={2034}
            value={currentYear}
            onChange={setCurrentYear}
          />
        </motion.div>

        {/* Split Comparison */}
        <SplitComparison
          progress={progress}
          metrics={financialMetrics}
          className="mb-12"
        />

        {/* Difference Highlight */}
        <DifferenceHighlight
          difference={formattedDifference}
          description="We show you how to find it in your existing income."
        />

        {/* CTA */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <motion.button
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Start Your Journey
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </motion.button>
        </motion.div>
      </Container>
    </section>
  );
}
