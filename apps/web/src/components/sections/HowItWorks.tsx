'use client';

import { Container, SectionHeader } from '@/components/landing-ui';

const steps = [
  {
    number: '01',
    title: 'Build Your Picture',
    description: 'Add your income, expenses, savings, and obligations. Manual entry keeps you in control.',
  },
  {
    number: '02',
    title: 'Understand Your Position',
    description: 'Ikpa calculates your Cash Flow Score and surfaces insights about your financial health.',
  },
  {
    number: '03',
    title: 'See Your Future',
    description: 'Meet two versions of yourself—the one on your current path and the one who makes small changes.',
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 md:py-32 bg-white">
      <Container>
        <SectionHeader
          title="Three steps to clarity"
          eyebrow="How It Works"
        />

        <div className="max-w-3xl mx-auto">
          <div className="space-y-12">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-8">
                <div className="flex-shrink-0">
                  <span className="text-4xl font-mono font-bold text-neutral-200">
                    {step.number}
                  </span>
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-display font-semibold text-neutral-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-neutral-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
