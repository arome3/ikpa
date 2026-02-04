'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Car, Briefcase, Shield, MessageSquare } from 'lucide-react';

type ScenarioType = 'car-loan' | 'side-hustle' | 'emergency' | 'caption';

interface ScenarioCardProps {
  type: ScenarioType;
  /** Whether to auto-play the animation */
  autoPlay?: boolean;
  /** Delay before starting animation */
  delay?: number;
  /** CSS class for additional styling */
  className?: string;
}

const scenarios = {
  'car-loan': {
    icon: Car,
    title: 'Car Purchase',
    input: 'Buy ₦3M car',
    result: 'Runway: 0.4 months',
    impact: 'negative',
    description: 'Major purchase impact analysis',
  },
  'side-hustle': {
    icon: Briefcase,
    title: 'Side Income',
    input: '+₦80k side hustle',
    result: 'Net worth +₦4.1M in 2 years',
    impact: 'positive',
    description: 'Additional income projection',
  },
  'emergency': {
    icon: Shield,
    title: 'Emergency Fund',
    input: 'Build 6-month runway',
    result: 'Protection: 94%',
    impact: 'positive',
    description: 'Financial safety buffer',
  },
  'caption': {
    icon: MessageSquare,
    title: 'What-If Simulator',
    input: '',
    result: 'Simulate any decision before you make it',
    impact: 'neutral',
    description: 'Try scenarios risk-free',
  },
};

/**
 * Animated scenario card showing what-if simulations
 * Auto-plays through typing and result animations
 */
export function ScenarioCard({
  type,
  autoPlay = true,
  delay = 0,
  className = '',
}: ScenarioCardProps) {
  const scenario = scenarios[type];
  const [phase, setPhase] = useState<'idle' | 'typing' | 'processing' | 'result'>('idle');
  const [displayedInput, setDisplayedInput] = useState('');

  // Auto-play animation cycle
  useEffect(() => {
    if (!autoPlay) return;

    const startAnimation = async () => {
      // Wait for initial delay
      await new Promise((r) => setTimeout(r, delay * 1000));

      // Cycle through phases
      const cycle = async () => {
        // Reset
        setPhase('idle');
        setDisplayedInput('');
        await new Promise((r) => setTimeout(r, 500));

        // Typing phase
        if (scenario.input) {
          setPhase('typing');
          for (let i = 0; i <= scenario.input.length; i++) {
            setDisplayedInput(scenario.input.slice(0, i));
            await new Promise((r) => setTimeout(r, 50));
          }
        }

        // Processing phase
        setPhase('processing');
        await new Promise((r) => setTimeout(r, 800));

        // Result phase
        setPhase('result');
        await new Promise((r) => setTimeout(r, 3000));

        // Loop
        cycle();
      };

      cycle();
    };

    startAnimation();
  }, [autoPlay, delay, scenario.input]);

  const Icon = scenario.icon;
  const isPositive = scenario.impact === 'positive';
  const isNegative = scenario.impact === 'negative';

  return (
    <GlassCard
      className={`h-full p-5 transition-all duration-500 ${className}`}
      glow={
        phase === 'result'
          ? isPositive
            ? 'emerald'
            : isNegative
            ? 'caution'
            : 'none'
          : 'none'
      }
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`
            p-2 rounded-lg transition-colors duration-500
            ${phase === 'result' && isPositive ? 'bg-emerald-100 text-emerald-600' : ''}
            ${phase === 'result' && isNegative ? 'bg-orange-100 text-orange-600' : ''}
            ${phase !== 'result' || scenario.impact === 'neutral' ? 'bg-neutral-100 text-neutral-600' : ''}
          `}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
            {scenario.title}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {scenario.description}
          </p>
        </div>
      </div>

      {/* Input area */}
      {type !== 'caption' && (
        <div className="mb-4">
          <div
            className="px-3 py-2 bg-neutral-50 rounded-lg border border-neutral-200 font-mono text-sm min-h-[40px] flex items-center"
          >
            <span style={{ color: 'var(--foreground)' }}>
              {displayedInput}
            </span>
            {phase === 'typing' && (
              <motion.span
                className="w-0.5 h-4 bg-emerald-500 ml-0.5"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
          </div>
        </div>
      )}

      {/* Result area */}
      <AnimatePresence mode="wait">
        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            <span className="text-sm text-emerald-600">Simulating...</span>
          </motion.div>
        )}

        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`
              px-3 py-2 rounded-lg font-medium text-sm
              ${isPositive ? 'bg-emerald-50 text-emerald-700' : ''}
              ${isNegative ? 'bg-orange-50 text-orange-700' : ''}
              ${scenario.impact === 'neutral' ? 'bg-neutral-100 text-neutral-700' : ''}
            `}
          >
            {scenario.result}
          </motion.div>
        )}

        {type === 'caption' && phase !== 'result' && (
          <motion.div
            key="caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-4"
          >
            <p
              className="text-lg font-display font-semibold"
              style={{ color: 'var(--foreground)' }}
            >
              {scenario.result}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

/**
 * Progress bar animation for emergency fund
 */
export function EmergencyFundProgress({
  autoPlay = true,
  delay = 0,
}: {
  autoPlay?: boolean;
  delay?: number;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!autoPlay) return;

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            setTimeout(() => setProgress(0), 2000);
            return 100;
          }
          return p + 2;
        });
      }, 50);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [autoPlay, delay]);

  const months = Math.round((progress / 100) * 6 * 10) / 10;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span style={{ color: 'var(--muted)' }}>Emergency Runway</span>
        <span className="font-mono font-medium text-emerald-600">
          {months.toFixed(1)} months
        </span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-emerald-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        Target: 6 months of expenses
      </p>
    </div>
  );
}
