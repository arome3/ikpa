'use client';

import { Container, SectionHeader } from '@/components/landing-ui';

const features = [
  {
    title: 'Cash Flow Score (0-100)',
    description: 'A single number: (Savings×30) + (Runway×25) + (Debt×20) + (Family×15) + (Goals×10). Know exactly where you stand.',
  },
  {
    title: 'Agent Orchestra',
    description: 'Not one AI—a team of 5 specialists that collaborate on your behalf. Shark Auditor, GPS Re-Router, and more.',
  },
  {
    title: 'Values-Aware Design',
    description: 'Family support isn\'t a leak—it\'s a value. Your obligations, optimized without guilt or judgment.',
  },
  {
    title: 'Non-Judgmental Design',
    description: 'Banned words: wasted, bad, failed, irresponsible. Orange for caution, never red. No shame, ever.',
  },
  {
    title: 'G-Eval Quality',
    description: 'LLM-as-Judge ensures every piece of advice is empathetic, safe, and personally sensitive before it reaches you.',
  },
  {
    title: 'Story Cards',
    description: 'Shareable achievements, privacy-safe. Celebrate your wins without exposing amounts or specifics.',
  },
];

export function Features() {
  return (
    <section className="py-24 md:py-32 bg-neutral-50">
      <Container>
        <SectionHeader
          title="Built for behavior change"
          subtitle="Every feature is designed to help you build lasting financial habits."
          eyebrow="Features"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-neutral-200 p-6"
            >
              <h3 className="text-base font-display font-semibold text-neutral-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
