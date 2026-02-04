'use client';

import { Container, SectionHeader } from '@/components/landing-ui';

const problems = [
  {
    title: 'Invisible Leakage',
    description: 'Forgotten subscriptions and recurring charges silently drain your money. The average person loses $200/month to payments they forgot about.',
  },
  {
    title: 'Failure Spiral',
    description: 'One slip leads to shame, which leads to giving up entirely. 88% of people quit financial goals within two weeks of the first setback.',
  },
  {
    title: 'Temporal Disconnect',
    description: 'Future consequences feel abstract. That $50 subscription seems harmless until you realize it compounds to $15,000 over 10 years.',
  },
  {
    title: 'Commitment Decay',
    description: 'Initial motivation fades over time. It takes 66 days to form a financial habit, but most apps abandon you after day one.',
  },
  {
    title: 'Cultural Blindness',
    description: 'Finance apps assume you live alone with no family obligations. They treat supporting your parents as a "budget leak" instead of a core value.',
  },
];

export function Problem() {
  return (
    <section className="py-24 md:py-32 bg-neutral-50">
      <Container>
        <SectionHeader
          title="Why 92% of financial resolutions fail"
          eyebrow="The Problem"
        />

        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xl text-neutral-700 leading-relaxed">
            You don't have a financial literacy problem.
            <br />
            <span className="text-neutral-500">You have a financial clarity problem.</span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-neutral-200 p-6"
            >
              <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center mb-4 text-sm font-mono">
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3 className="text-lg font-display font-semibold text-neutral-900 mb-2">
                {problem.title}
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <p className="text-lg text-neutral-700">
            Financial apps fail because they treat money as math.
            <br />
            <span className="font-medium text-neutral-900">Ikpa treats money as behavior.</span>
          </p>
        </div>
      </Container>
    </section>
  );
}
