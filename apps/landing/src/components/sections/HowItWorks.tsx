import { Container, SectionHeader } from '@/components/ui';

const steps = [
  {
    number: '01',
    title: 'Build Your Financial Picture',
    description:
      'Add your income sources, expenses, savings, debts, and obligations. Manual entry keeps you in control—no forced bank connections, no data anxiety.',
    time: '15 minutes',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Understand Your Position',
    description:
      "Ikpa calculates your Cash Flow Score and surfaces insights about your financial health. Where you're strong. Where you're vulnerable. What the numbers actually mean.",
    time: 'Instant analysis',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'See Your Future',
    description:
      "Meet two versions of yourself—the one on your current path and the one who makes small, consistent changes. Choose which future you want to build toward.",
    time: 'Updated as your situation changes',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-white">
      <Container>
        <SectionHeader title="Three steps to financial clarity" />

        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`relative flex flex-col md:flex-row gap-6 md:gap-12 ${
                index !== steps.length - 1 ? 'pb-12 md:pb-16' : ''
              }`}
            >
              {/* Connector Line */}
              {index !== steps.length - 1 && (
                <div className="hidden md:block absolute left-8 top-20 w-0.5 h-full bg-gradient-to-b from-accent to-primary-200" />
              )}

              {/* Step Number */}
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-orange-500 text-white flex items-center justify-center relative z-10">
                  {step.icon}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-accent">{step.number}</span>
                  <h3 className="text-xl md:text-2xl font-bold text-primary-900">{step.title}</h3>
                </div>
                <p className="text-primary-600 leading-relaxed mb-3">{step.description}</p>
                <span className="inline-flex items-center gap-2 text-sm text-primary-500 bg-primary-50 px-3 py-1 rounded-full">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {step.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
