'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Container, Badge } from '@/components/landing-ui';
import { GlassCard } from '@/components/landing-ui/GlassCard';
import { AmbientGlow } from '@/components/landing-ui/effects';
import {
  Fish,
  Navigation,
  Lock,
  Clock,
  Heart,
} from 'lucide-react';

const agents = [
  {
    id: 'shark-auditor',
    name: 'Shark Auditor',
    icon: Fish,
    color: 'emerald' as const,
    tagline: 'Hunts zombie subscriptions',
    description: 'Average user loses $200/month to forgotten charges. This agent audits every recurring expense and surfaces the ones you forgot.',
    defeatsMode: 'Invisible Leakage',
  },
  {
    id: 'gps-rerouter',
    name: 'GPS Re-Router',
    icon: Navigation,
    color: 'blue' as const,
    tagline: 'When you slip, it recalculates',
    description: 'Never judges, always redirects. One slip doesn\'t mean failure—it means recalculating the route to your destination.',
    defeatsMode: 'Failure Spiral',
  },
  {
    id: 'commitment-device',
    name: 'Commitment Device',
    icon: Lock,
    color: 'purple' as const,
    tagline: 'Creates real stakes',
    description: 'Social accountability through stake-based commitments. When your motivation fades, external stakes keep you on track.',
    defeatsMode: 'Commitment Decay',
  },
  {
    id: 'future-self-simulator',
    name: 'Future Self Simulator',
    icon: Clock,
    color: 'amber' as const,
    tagline: 'Letters from your 60-year-old self',
    description: 'MIT research shows users who talk to their future selves save 16% more. Our AI writes you letters from 2034.',
    defeatsMode: 'Temporal Disconnect',
  },
  {
    id: 'family-values-manager',
    name: 'Family & Values Manager',
    icon: Heart,
    color: 'rose' as const,
    tagline: 'Your values, optimized',
    description: 'Tracks family obligations without guilt. Family support isn\'t a leak—it\'s a core value. Plan for it, don\'t fight it.',
    defeatsMode: 'Values Blindness',
  },
];

const colorClasses = {
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    glow: 'emerald' as const,
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    glow: 'none' as const,
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
    glow: 'none' as const,
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    glow: 'none' as const,
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    border: 'border-rose-200',
    glow: 'none' as const,
  },
};

export function AgentShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-10%' });

  return (
    <section
      ref={sectionRef}
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
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-4">The Solution</Badge>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-display font-bold tracking-tight mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            Meet Your Financial Team
          </h2>
          <p className="text-lg" style={{ color: 'var(--muted)' }}>
            Each agent defeats a specific reason why financial resolutions fail.
            Together, they transform how you relate to money.
          </p>
        </motion.div>

        {/* Agent Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {agents.map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <p
            className="text-lg font-display font-semibold mb-2"
            style={{ color: 'var(--foreground)' }}
          >
            Five agents. One mission.
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Change your financial behavior, not just track it.
          </p>
          <motion.button
            className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Get Started with Your Team
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

function AgentCard({
  agent,
  index,
  isInView,
}: {
  agent: typeof agents[0];
  index: number;
  isInView: boolean;
}) {
  const Icon = agent.icon;
  const colors = colorClasses[agent.color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={index === 4 ? 'md:col-start-2 lg:col-start-auto' : ''}
    >
      <GlassCard className="h-full p-6 group hover:shadow-lg transition-all duration-300">
        {/* Agent Icon */}
        <div
          className={`
            w-14 h-14 rounded-xl flex items-center justify-center mb-5
            ${colors.bg} ${colors.text}
            group-hover:scale-110 transition-transform duration-300
          `}
        >
          <Icon className="w-7 h-7" />
        </div>

        {/* Agent Name */}
        <h3
          className="text-xl font-display font-semibold mb-2"
          style={{ color: 'var(--foreground)' }}
        >
          {agent.name}
        </h3>

        {/* Tagline */}
        <p className={`text-sm font-medium mb-3 ${colors.text}`}>
          {agent.tagline}
        </p>

        {/* Description */}
        <p
          className="text-sm leading-relaxed mb-4"
          style={{ color: 'var(--muted)' }}
        >
          {agent.description}
        </p>

        {/* Defeats Badge */}
        <div className="mt-auto pt-4 border-t border-neutral-100">
          <span className="text-xs uppercase tracking-wider text-neutral-400">
            Defeats:
          </span>
          <span
            className="ml-2 text-xs font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            {agent.defeatsMode}
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
