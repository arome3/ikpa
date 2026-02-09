'use client';

import { Brain, Eye, Users, type LucideIcon } from 'lucide-react';
import { Container, FadeIn } from '@/components/ui';

interface Pillar {
  title: string;
  description: string;
  icon: LucideIcon;
}

const pillars: Pillar[] = [
  {
    title: "Beating the 'I\u2019ll start tomorrow' trap",
    description:
      'Your brain is wired to choose now over later. The Commitment Engine creates real stakes so your future self actually wins.',
    icon: Brain,
  },
  {
    title: 'No more hiding from the hard numbers',
    description:
      'Those subscriptions you avoid thinking about? The Shark Auditor finds them, adds up the real annual cost, and makes them impossible to ignore.',
    icon: Eye,
  },
  {
    title: 'Accountability that multiplies results',
    description:
      'People who share their goals with an accountability group are 3x more likely to achieve them. Ikpa makes that effortless.',
    icon: Users,
  },
];

export function BehavioralScience() {
  return (
    <section className="py-24 md:py-32 bg-cream">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column: feature image */}
          <FadeIn direction="left">
            <div className="max-w-sm mx-auto lg:max-w-none">
              <img
                src="/feature.png"
                alt="Ikpa behavioral change features"
                className="w-full rounded-2xl"
              />
            </div>
          </FadeIn>

          {/* Right column: headline + technical list */}
          <div>
            <FadeIn>
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-forest">
                Engineered for behavioral change.
              </h2>
              <p className="text-charcoal/60 text-lg mt-4 mb-12 md:mb-16">
                We don&apos;t just track your money. We rewire the habits that hold you back.
              </p>
            </FadeIn>

            <div className="divide-y divide-sage-100">
              {pillars.map((pillar, index) => (
                <FadeIn key={pillar.title} delay={index * 0.1}>
                  <div className={`py-6 ${index === 0 ? 'pt-0' : ''} ${index === pillars.length - 1 ? 'pb-0' : ''}`}>
                    <div className="flex items-start gap-4">
                      <pillar.icon className="w-5 h-5 text-sage-500 mt-1 shrink-0" strokeWidth={1.5} />
                      <div>
                        <h3 className="font-serif text-lg font-semibold text-forest">
                          {pillar.title}
                        </h3>
                        <p className="text-charcoal/60 mt-1.5 leading-relaxed">
                          {pillar.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
