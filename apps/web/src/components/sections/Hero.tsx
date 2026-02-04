'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Container, Badge, Button } from '@/components/landing-ui';
import { GlassCard } from '@/components/landing-ui/GlassCard';
import { AmbientGlow } from '@/components/landing-ui/effects';
import { TrendingUp, Wallet, Target, PiggyBank, BarChart3 } from 'lucide-react';

// Floating UI fragment data
const floatingFragments = [
  {
    icon: TrendingUp,
    label: 'Cash Flow',
    value: '78/100',
    color: 'emerald' as const,
    position: { x: '15%', y: '35%' },
    offset: { x: -80, y: -60, rotate: -8 },
    delay: 0,
  },
  {
    icon: Wallet,
    label: 'Monthly Runway',
    value: '4.2 months',
    color: 'emerald' as const,
    position: { x: '85%', y: '30%' },
    offset: { x: 100, y: -80, rotate: 12 },
    delay: 0.2,
  },
  {
    icon: Target,
    label: 'Savings Goal',
    value: '67%',
    color: 'amber' as const,
    position: { x: '10%', y: '70%' },
    offset: { x: -120, y: 60, rotate: -15 },
    delay: 0.4,
  },
  {
    icon: PiggyBank,
    label: 'Net Worth',
    value: '₦2.4M',
    color: 'emerald' as const,
    position: { x: '90%', y: '75%' },
    offset: { x: 80, y: 40, rotate: 10 },
    delay: 0.6,
  },
  {
    icon: BarChart3,
    label: 'Investments',
    value: '+12.4%',
    color: 'emerald' as const,
    position: { x: '25%', y: '85%' },
    offset: { x: -40, y: 100, rotate: -5 },
    delay: 0.8,
  },
];

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Smooth spring animation
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });

  // Transform values for main content
  const textBlur = useTransform(smoothProgress, [0, 0.3], [0, 0]);
  const textOpacity = useTransform(smoothProgress, [0, 0.5], [1, 0.3]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ backgroundColor: 'var(--background)' }}
    >
      {/* Ambient glow background */}
      <AmbientGlow variant="hero" />

      {/* Geometric grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating UI Fragments */}
      <div className="pointer-events-none absolute inset-0">
        {floatingFragments.map((fragment, index) => (
          <FloatingFragment
            key={index}
            {...fragment}
            scrollProgress={smoothProgress}
          />
        ))}
      </div>

      {/* Main Content */}
      <Container className="relative z-10">
        <motion.div
          className="max-w-3xl mx-auto text-center py-20"
          style={{
            filter: useTransform(textBlur, (v) => `blur(${v}px)`),
            opacity: textOpacity,
          }}
        >
          {/* Badge */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge>5 AI Agents Working For You</Badge>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ color: 'var(--foreground)' }}
          >
            Change your financial
            <br />
            <span className="text-emerald-500">behavior.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{ color: 'var(--muted)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--foreground)' }}>92% of financial resolutions fail.</span>{' '}
            Ikpa deploys five specialized AI agents that defeat the five reasons why—transforming how you relate to money.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Button size="lg" variant="primary">
              Meet Your AI Agents
            </Button>
            <Button size="lg" variant="ghost">
              See How It Works
            </Button>
          </motion.div>

          {/* Social Proof */}
          <motion.p
            className="mt-10 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            style={{ color: 'var(--muted-foreground)' }}
          >
            <span className="font-medium" style={{ color: 'var(--foreground)' }}>
              2,847
            </span>{' '}
            people already on the waitlist
          </motion.p>
        </motion.div>
      </Container>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <motion.div
          className="w-6 h-10 rounded-full border-2 border-neutral-300 flex items-start justify-center p-2"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

// Individual floating fragment component
function FloatingFragment({
  icon: Icon,
  label,
  value,
  color,
  position,
  offset,
  delay,
  scrollProgress,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'emerald' | 'amber';
  position: { x: string; y: string };
  offset: { x: number; y: number; rotate: number };
  delay: number;
  scrollProgress: ReturnType<typeof useSpring>;
}) {
  // Transform based on scroll
  const x = useTransform(scrollProgress, [0, 0.4], [offset.x, 0]);
  const y = useTransform(scrollProgress, [0, 0.4], [offset.y, 0]);
  const rotate = useTransform(scrollProgress, [0, 0.4], [offset.rotate, 0]);
  const opacity = useTransform(scrollProgress, [0, 0.2], [0.4, 0.9]);
  const blur = useTransform(scrollProgress, [0, 0.3], [6, 0]);
  const scale = useTransform(scrollProgress, [0, 0.4], [0.9, 1]);

  const colorClasses = {
    emerald: 'text-emerald-500 bg-emerald-50',
    amber: 'text-amber-500 bg-amber-50',
  };

  return (
    <motion.div
      className="absolute hidden md:block"
      style={{
        left: position.x,
        top: position.y,
        x,
        y,
        rotate,
        opacity,
        scale,
        filter: useTransform(blur, (v) => `blur(${v}px)`),
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 0.4, scale: 0.9 }}
      transition={{ duration: 0.6, delay }}
    >
      <GlassCard size="sm" className="min-w-[140px]">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="text-sm font-semibold text-neutral-900">{value}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
