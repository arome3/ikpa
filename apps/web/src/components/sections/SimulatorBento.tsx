'use client';

import { motion } from 'framer-motion';
import { Container, Badge } from '@/components/landing-ui';
import { BentoGrid } from '@/components/landing-ui/BentoGrid';
import { BentoCard, BentoCardHeader, BentoCardContent } from '@/components/landing-ui/BentoCard';
import { ScenarioCard, EmergencyFundProgress } from '@/components/landing-ui/ScenarioCard';
import { Car, Briefcase, Shield, Sparkles } from 'lucide-react';

export function SimulatorBento() {
  return (
    <section
      className="py-24 md:py-32"
      style={{ backgroundColor: 'var(--background-secondary)' }}
    >
      <Container>
        {/* Section Header */}
        <motion.div
          className="text-center max-w-2xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-4">What-If Simulator</Badge>
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-display font-bold tracking-tight mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            10,000 Simulations Per Decision
          </h2>
          <p className="text-lg" style={{ color: 'var(--muted)' }}>
            Monte Carlo projections show probability distributions, not just single numbers.
            See where you&apos;re headed vs. where you could be.
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <BentoGrid>
          {/* Featured Card - Car Loan (2x2) */}
          <BentoCard featured className="lg:col-span-2 lg:row-span-2">
            <BentoCardHeader
              icon={<Car className="w-5 h-5" />}
              title="Major Purchase Simulator"
              subtitle="See the real cost of big decisions"
            />
            <BentoCardContent className="flex flex-col justify-center">
              <ScenarioCard type="car-loan" delay={0} />
            </BentoCardContent>
          </BentoCard>

          {/* Side Hustle Card */}
          <BentoCard>
            <BentoCardHeader
              icon={<Briefcase className="w-5 h-5" />}
              title="Income Boost"
              subtitle="Project your growth"
            />
            <BentoCardContent>
              <ScenarioCard type="side-hustle" autoPlay delay={1.5} />
            </BentoCardContent>
          </BentoCard>

          {/* Emergency Fund Card */}
          <BentoCard>
            <BentoCardHeader
              icon={<Shield className="w-5 h-5" />}
              title="Safety Buffer"
              subtitle="Build your runway"
            />
            <BentoCardContent className="flex flex-col justify-center">
              <EmergencyFundProgress autoPlay delay={3} />
            </BentoCardContent>
          </BentoCard>

          {/* Caption Card */}
          <BentoCard className="lg:col-span-1">
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <p
                className="text-lg font-display font-semibold mb-2"
                style={{ color: 'var(--foreground)' }}
              >
                Simulate any decision
              </p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                before you make it
              </p>
            </div>
          </BentoCard>
        </BentoGrid>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            No financial data required to start exploring
          </p>
          <motion.button
            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white font-medium rounded-lg hover:bg-neutral-800 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Try the Simulator
          </motion.button>
        </motion.div>
      </Container>
    </section>
  );
}
