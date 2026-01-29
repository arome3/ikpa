import { Container, SectionHeader } from '@/components/ui';

const features = [
  {
    title: 'Irregular Income Support',
    description:
      "Side hustles. Contract work. Seasonal business. Ikpa models variable income because that's how most Africans earn.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Family Obligation Tracking',
    description:
      'The "Dependency Ratio" is a first-class metric. Support for parents, siblings, extended family—tracked without judgment, planned with intention.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Ajo/Susu Integration',
    description:
      'Rotating savings groups are legitimate financial instruments. Ikpa tracks contributions and treats them as the disciplined savings they are.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    title: 'Multi-Currency Handling',
    description:
      'Earn in USD or GBP, spend in Naira or Cedis. Ikpa models foreign exchange exposure and currency risk.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
        />
      </svg>
    ),
  },
  {
    title: 'Economic Reality Modeling',
    description:
      "Inflation. Devaluation. Purchasing power erosion. Ikpa's projections account for the economic conditions you actually navigate.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
        />
      </svg>
    ),
  },
  {
    title: 'Mobile-First Design',
    description:
      'Built for mobile as the primary interface. Works offline for core features. Respects your data plan.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
  },
];

export function BuiltForAfrica() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <Container>
        <SectionHeader
          title="Designed for how you actually live"
          subtitle="Most financial apps assume you have a fixed salary, no family obligations, and live in a stable economy. Ikpa assumes reality."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-primary-900 mb-2">{feature.title}</h3>
                  <p className="text-primary-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Africa Map Visual Indicator */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 text-primary-500">
            <span className="text-2xl">🌍</span>
            <span className="text-sm font-medium">
              Launching in Nigeria, Ghana, Kenya, and South Africa
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
