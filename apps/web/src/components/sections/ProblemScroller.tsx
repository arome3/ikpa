'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Container } from '@/components/landing-ui';
import { GlassCard } from '@/components/landing-ui/GlassCard';
import { HorizontalScroller, ScrollItem } from '@/components/landing-ui/animations';
import { ScanLine } from '@/components/landing-ui/animations';
import {
  Eye,
  RefreshCcw,
  Timer,
  Clock,
  Users,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

const painPoints = [
  {
    icon: Eye,
    anxiety: 'Invisible Leakage',
    clarity: 'Shark Auditor Deployed',
    description: 'Forgotten subscriptions drain $200/month silently. We hunt every zombie charge.',
    stat: '$200/month lost',
  },
  {
    icon: RefreshCcw,
    anxiety: 'Failure Spiral',
    clarity: 'GPS Re-Router Active',
    description: 'One slip → shame → give up. 88% quit after their first budget failure.',
    stat: '88% quit after first slip',
  },
  {
    icon: Timer,
    anxiety: 'Commitment Decay',
    clarity: 'Commitment Device Set',
    description: 'Initial motivation fades over 66 days. Social stakes keep you accountable.',
    stat: '66 days to habit death',
  },
  {
    icon: Clock,
    anxiety: 'Temporal Disconnect',
    clarity: 'Future Self Connected',
    description: 'Future consequences feel abstract. Letters from your 60-year-old self make them real.',
    stat: '16% more savings (MIT)',
  },
  {
    icon: Users,
    anxiety: 'Values Blindness',
    clarity: 'Family Values Manager',
    description: 'Other apps ignore family obligations. We treat them as core values, not leaks.',
    stat: '45% feel guilt about family support',
  },
];

export function ProblemScroller() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: false, margin: '-20%' });
  const [activeCard, setActiveCard] = useState<number | null>(null);

  // Auto-cycle through cards when in view
  useEffect(() => {
    if (!isInView) return;

    const interval = setInterval(() => {
      setActiveCard((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % painPoints.length;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 overflow-hidden"
      style={{ backgroundColor: 'var(--background-secondary)' }}
    >
      <Container className="mb-12">
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p
            className="text-sm font-medium uppercase tracking-wider mb-4"
            style={{ color: 'var(--ikpa-green)' }}
          >
            The Problem
          </p>
          <h2
            className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            Why 92% of Resolutions Fail
          </h2>
          <p style={{ color: 'var(--muted)' }}>
            Financial resolutions fail for five predictable reasons. Each one has an AI agent designed to defeat it.
          </p>
        </motion.div>
      </Container>

      {/* Horizontal Scroller */}
      <HorizontalScroller
        showArrows={true}
        showProgress={true}
        itemCount={painPoints.length}
        gap={24}
        padding={48}
        className="pb-8"
      >
        {painPoints.map((point, index) => (
          <ScrollItem key={index} className="w-[320px] md:w-[380px]">
            <PainPointCard
              {...point}
              index={index}
              isActive={activeCard === index}
              onHover={() => setActiveCard(index)}
            />
          </ScrollItem>
        ))}
      </HorizontalScroller>

      {/* Closing statement */}
      <Container>
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <p
            className="text-xl md:text-2xl font-display font-semibold max-w-xl mx-auto"
            style={{ color: 'var(--foreground)' }}
          >
            You don&apos;t have a literacy problem.
            <br />
            <span className="text-emerald-500">You have a clarity problem.</span>
          </p>
        </motion.div>
      </Container>
    </section>
  );
}

function PainPointCard({
  icon: Icon,
  anxiety,
  clarity,
  description,
  stat,
  index,
  isActive,
  onHover,
}: {
  icon: React.ElementType;
  anxiety: string;
  clarity: string;
  description: string;
  stat: string;
  index: number;
  isActive: boolean;
  onHover: () => void;
}) {
  return (
    <motion.div
      className="relative h-[280px]"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onHoverStart={onHover}
    >
      <GlassCard
        className={`
          h-full p-6 transition-all duration-500 overflow-hidden
          ${isActive ? 'glow-emerald' : ''}
        `}
        glow={isActive ? 'emerald' : 'none'}
      >
        {/* Scan line effect when active */}
        {isActive && <ScanLine active={isActive} duration={1.5} delay={2} />}

        {/* Icon */}
        <div
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center mb-6
            transition-colors duration-500
            ${isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-500'}
          `}
        >
          <Icon className="w-6 h-6" />
        </div>

        {/* Content with state transition */}
        <AnimatePresence mode="wait">
          {isActive ? (
            <motion.div
              key="clarity"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
                  The Solution
                </span>
              </div>
              <p
                className="text-xl font-display font-semibold mb-3"
                style={{ color: 'var(--foreground)' }}
              >
                {clarity}
              </p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {description}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="anxiety"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  Failure Mode #{index + 1}
                </span>
              </div>
              <p
                className="text-xl font-display font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                {anxiety}
              </p>
              <p className="text-sm mt-2 font-medium text-amber-600">
                {stat}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arrow indicator */}
        <motion.div
          className="absolute bottom-6 right-6"
          animate={{
            x: isActive ? [0, 4, 0] : 0,
            opacity: isActive ? 1 : 0.3,
          }}
          transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
        >
          <ArrowRight
            className={`w-5 h-5 ${isActive ? 'text-emerald-500' : 'text-neutral-300'}`}
          />
        </motion.div>
      </GlassCard>
    </motion.div>
  );
}
