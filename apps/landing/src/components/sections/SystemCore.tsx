'use client';

import { motion } from 'motion/react';
import {
  Compass,
  SearchCheck,
  BrainCircuit,
  Target,
  Users,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { Container, FadeIn } from '@/components/ui';
import { cn } from '@/lib/utils';

interface PipelineNode {
  title: string;
  description: string;
  icon: LucideIcon;
  x: number;
  y: number;
  glow?: boolean;
}

const nodes: PipelineNode[] = [
  {
    title: 'Financial GPS',
    description: 'One score that shows exactly where your money stands — income, spending, and obligations included',
    icon: Compass,
    x: 14,
    y: 28,
  },
  {
    title: 'Shark Auditor',
    description: 'Surfaces forgotten subscriptions draining your account and shows what they really cost you per year',
    icon: SearchCheck,
    x: 42,
    y: 28,
  },
  {
    title: 'Multi-Agent Team',
    description: 'Three specialized AI agents that analyze, nudge, and coach you through every financial decision',
    icon: BrainCircuit,
    x: 70,
    y: 28,
    glow: true,
  },
  {
    title: 'Commitment Engine',
    description: 'Put real stakes behind your goals — because promises with consequences actually stick',
    icon: Target,
    x: 70,
    y: 72,
  },
  {
    title: 'Group Accountability',
    description: 'Your inner circle sees your progress status — no amounts, just accountability that works',
    icon: Users,
    x: 42,
    y: 72,
  },
  {
    title: 'Future Self',
    description: 'Meet your future self — see where you\'re heading vs. where you could be',
    icon: Eye,
    x: 14,
    y: 72,
  },
];

// Smooth cubic-bezier S-curve flowing organically through all 6 nodes.
// Control points offset y by ±13 to create subtle undulation along
// horizontal runs. The U-turn uses far-right control points (x=880)
// for a wide, fluid arc. At t=0.5, each horizontal segment passes
// exactly through its midpoint node (verified algebraically).
const S_CURVE = `
  M 140 168
  C 280 155, 560 181, 700 168
  C 880 155, 880 445, 700 432
  C 560 419, 280 445, 140 432
`;

// SVG positions matching each node's CSS % position in the viewBox
const junctions = [
  { cx: 140, cy: 168 },
  { cx: 420, cy: 168 },
  { cx: 700, cy: 168 },
  { cx: 700, cy: 432 },
  { cx: 420, cy: 432 },
  { cx: 140, cy: 432 },
];

function NodeCard({ node }: { node: PipelineNode }) {
  const Icon = node.icon;
  const isGlow = node.glow;

  return (
    <div className="w-44">
      {/* Floating icon — overlaps card top via negative margin */}
      <div className="flex justify-center relative z-10 mb-[-16px]">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            isGlow
              ? 'bg-sage-200 ring-[3px] ring-sage-300/50 shadow-[0_0_14px_rgba(74,122,85,0.25)]'
              : 'bg-sage-100 shadow-sm',
          )}
        >
          <Icon className={cn('w-5 h-5', isGlow ? 'text-sage-700' : 'text-forest')} />
        </div>
      </div>

      {/* Glass card */}
      <div
        className={cn(
          'pt-7 pb-3.5 px-3.5 rounded-xl text-center backdrop-blur-sm',
          isGlow
            ? 'bg-white/50 border-2 border-sage-300/60 shadow-[0_0_24px_rgba(74,122,85,0.1)]'
            : 'bg-white/40 border border-sage-100/50',
        )}
      >
        <h4 className="font-serif text-sm font-semibold text-forest">{node.title}</h4>
        <p className="text-[11px] text-charcoal/50 mt-1.5 leading-relaxed">
          {node.description}
        </p>
      </div>
    </div>
  );
}

export function SystemCore() {
  return (
    <section className="py-20 md:py-32 bg-cream">
      <Container size="xl">
        {/* Headline */}
        <FadeIn>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-forest mb-12 lg:mb-16">
            Six systems working together
            <br />
            to change how you handle money.
          </h2>
        </FadeIn>

        {/* ── Desktop: SVG pipeline with glassmorphic cards ── */}
        <FadeIn delay={0.1} className="hidden lg:block">
          <div
            className="relative rounded-xl border border-sage-100 overflow-hidden"
            style={{
              aspectRatio: '16 / 9',
              backgroundColor: '#F0F4F1',
              backgroundImage:
                'linear-gradient(to right, rgba(217,227,219,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(217,227,219,0.5) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          >
            {/* SVG S-curve overlay — always visible (no motion dependency) */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 600"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Soft ambient glow behind the curve */}
              <path
                d={S_CURVE}
                stroke="#B8CDB9"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                opacity="0.5"
                style={{ filter: 'blur(6px)' }}
              />

              {/* Main dashed path with flowing animation */}
              <path
                d={S_CURVE}
                stroke="#97B69A"
                strokeWidth="2"
                strokeDasharray="6 6"
                strokeLinecap="round"
                fill="none"
                className="animate-dash-flow"
              />

              {/* Junction dots at each node center */}
              {junctions.map((j, i) => (
                <circle
                  key={i}
                  cx={j.cx}
                  cy={j.cy}
                  r="4"
                  fill="#97B69A"
                />
              ))}
            </svg>

            {/* Node cards — absolutely positioned on the grid */}
            {nodes.map((node, i) => (
              <motion.div
                key={node.title}
                className="absolute"
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{
                  delay: 0.2 + i * 0.12,
                  duration: 0.5,
                  ease: 'easeOut',
                }}
              >
                <NodeCard node={node} />
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* ── Mobile: vertical stack ── */}
        <div className="lg:hidden relative">
          {/* Dashed center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-l-2 border-dashed border-sage-200" />

          <div className="flex flex-col items-center gap-8 py-4">
            {nodes.map((node, i) => (
              <FadeIn key={node.title} delay={i * 0.08}>
                <NodeCard node={node} />
              </FadeIn>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
