'use client';

import { Compass, Eye, Target, Users, BrainCircuit, SearchCheck } from 'lucide-react';
import { Container, SectionHeader, Card, CardIcon, FadeIn } from '@/components/ui';

const features = [
  {
    title: 'Financial GPS',
    description: 'One number that tells you exactly how healthy your finances are — updated daily, always honest.',
    icon: Compass,
  },
  {
    title: 'Future Self Visualization',
    description: "See two futures: where you're heading now, and where you could be. The gap is your opportunity.",
    icon: Eye,
  },
  {
    title: 'Commitment Device Engine',
    description: 'Set a goal, put something real on the line, and watch your follow-through rate triple.',
    icon: Target,
  },
  {
    title: 'Group Accountability',
    description: "Invite your circle. They see if you're on track or behind — no amounts, just the push you need.",
    icon: Users,
  },
  {
    title: 'Multi-Agent Team',
    description: 'Three AI agents — one analyzes your data, one sends timely nudges, one coaches you through decisions.',
    icon: BrainCircuit,
  },
  {
    title: 'Shark Auditor',
    description: "Finds the subscriptions you forgot about and shows you what they're really costing you each year.",
    icon: SearchCheck,
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-32 bg-ivory">
      <Container>
        <FadeIn>
          <SectionHeader title="Everything you need to finally follow through" subtitle="Six integrated systems that tackle the real reasons financial goals fail." />
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FadeIn key={feature.title} delay={index * 0.1}>
              <Card hover>
                <CardIcon>
                  <feature.icon className="w-6 h-6" />
                </CardIcon>
                <h3 className="font-serif text-lg font-semibold text-forest mb-2">{feature.title}</h3>
                <p className="text-charcoal/70 text-sm leading-relaxed">{feature.description}</p>
              </Card>
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  );
}
