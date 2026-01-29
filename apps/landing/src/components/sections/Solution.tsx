import { Container, SectionHeader } from '@/components/ui';

const pillars = [
  {
    title: 'See',
    description:
      'One number that tells you where you stand. The Cash Flow Score distills your entire financial health into a metric from 0 to 100—updated in real time, tracked over time.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
    gradient: 'from-accent to-orange-500',
  },
  {
    title: 'Understand',
    description:
      'Context that makes sense of the numbers. Why did your score drop? What does "runway" actually mean for your life? Ikpa\'s AI explains finances in plain language, without the jargon.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    gradient: 'from-secondary to-blue-500',
  },
  {
    title: 'Plan',
    description:
      'Guidance that respects your choices. Multiple valid paths. Sequenced recommendations. Trade-offs explained. You decide—Ikpa illuminates the options.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
        />
      </svg>
    ),
    gradient: 'from-emerald-500 to-green-600',
  },
];

export function Solution() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-primary-600 to-primary-700">
      <Container>
        <SectionHeader
          title="Ikpa: Your financial co-pilot"
          subtitle="Ikpa is not another budgeting app. It's a financial intelligence platform—a lens to see money clearly, an educator to understand it deeply, and a guide to plan it wisely."
          light
        />

        {/* Three Pillars */}
        <div className="grid md:grid-cols-3 gap-8">
          {pillars.map((pillar, index) => (
            <div
              key={index}
              className="relative p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-center"
            >
              {/* Icon */}
              <div
                className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${pillar.gradient} text-white flex items-center justify-center mb-6`}
              >
                {pillar.icon}
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-white mb-4">{pillar.title}</h3>

              {/* Description */}
              <p className="text-primary-100 leading-relaxed">{pillar.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
