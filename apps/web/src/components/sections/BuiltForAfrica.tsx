'use client';

import { Container, SectionHeader } from '@/components/landing-ui';

const features = [
  {
    title: 'Irregular Income',
    description: 'Side hustles. Contract work. Freelancing. Ikpa models variable income realistically.',
  },
  {
    title: 'Family Obligations',
    description: 'The "Dependency Ratio" is a first-class metric. Supporting family is a value, not a leak.',
  },
  {
    title: 'Community Savings',
    description: 'Rotating savings groups and savings circles tracked as the disciplined savings they are.',
  },
  {
    title: 'Multi-Currency',
    description: 'Works with any currency. Your money, your terms.',
  },
  {
    title: 'Economic Reality',
    description: 'Inflation. Market changes. Projections account for real conditions.',
  },
  {
    title: 'No Judgment',
    description: 'We banned words like "wasted" and "irresponsible." Just solutions.',
  },
];

export function CulturalIntelligence() {
  return (
    <section className="py-24 md:py-32 bg-white">
      <Container>
        <SectionHeader
          title="Designed for reality"
          subtitle="Most financial apps assume a fixed salary, no family obligations, and a stable economy. Ikpa assumes reality."
          eyebrow="Cultural Intelligence"
        />

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <blockquote className="text-2xl font-display font-medium text-neutral-700 italic">
              "I am because we are"
            </blockquote>
            <p className="text-neutral-500 mt-4">
              Financial wellness isn't just individual. We optimize around your values, not against them.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-neutral-200"
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
        </div>
      </Container>
    </section>
  );
}

export { CulturalIntelligence as BuiltForAfrica };
