'use client';

import { Brain, Waypoints, Users } from 'lucide-react';
import { Container, SectionHeader, FadeIn } from '@/components/ui';

const pillars = [
  {
    title: 'The Intelligence Layer',
    description:
      'Continuous monitoring of your cash flow, zombie subscriptions, and tax obligations\u2014handled by specialized AI agents.',
    icon: Brain,
  },
  {
    title: 'The Behavioral Engine',
    description:
      'Psychological guardrails that bridge the gap between your current actions and your future goals.',
    icon: Waypoints,
  },
  {
    title: 'The Social Protocol',
    description:
      'Positive social pressure and verified stakes to ensure you never break a promise to yourself.',
    icon: Users,
  },
];

export function CorePillars() {
  return (
    <section className="py-20 md:py-32 bg-cream">
      <Container>
        <FadeIn>
          <SectionHeader
            title="Three Pillars, One System"
            subtitle="Every feature in Ikpa maps to one of three pillars—intelligence, behavior, or community."
            centered={false}
          />
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map((pillar, index) => (
            <FadeIn key={pillar.title} delay={index * 0.1}>
              <div className="bg-white rounded-2xl p-8 md:p-10 h-full">
                <pillar.icon className="w-8 h-8 text-forest" strokeWidth={1.5} />

                <div className="mt-16 md:mt-20">
                  <h3 className="font-serif text-xl font-semibold text-forest mb-3">
                    {pillar.title}
                  </h3>
                  <p className="text-charcoal/70 leading-relaxed">{pillar.description}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
}
