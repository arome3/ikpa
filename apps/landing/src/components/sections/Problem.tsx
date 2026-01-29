import { Container, SectionHeader } from '@/components/ui';

const problems = [
  {
    title: "You don't know where you actually stand",
    description:
      'Most people can\'t answer a simple question: "How healthy are my finances right now?" Not vaguely. Precisely.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    title: "You can't see the consequences",
    description:
      "That subscription seems small. That family request feels manageable. But what do these choices compound into over five years? Ten? You're making decisions blind.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    ),
  },
  {
    title: "The advice doesn't translate",
    description:
      '"Pay yourself first." "Build six months of savings." Reasonable—if you have a predictable salary, no extended family obligations, and live in an economy that doesn\'t devalue your currency overnight.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
    ),
  },
  {
    title: 'Shame replaces agency',
    description:
      "When money feels tight, the instinct is to avoid looking. Apps that show red numbers and declining graphs create anxiety, not action.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

export function Problem() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <Container>
        <SectionHeader title="The clarity you've been missing" />

        {/* Lead Paragraph */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xl md:text-2xl text-primary-700 leading-relaxed mb-4">
            You track expenses. You read the advice. You download the apps.
          </p>
          <p className="text-xl md:text-2xl text-primary-600 leading-relaxed">
            And still, money disappears. Goals stay dreams. The future remains a blur.
          </p>
        </div>

        {/* Problem Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="p-6 md:p-8 rounded-2xl bg-primary-50 border border-primary-100"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-500 text-white flex items-center justify-center mb-4">
                {problem.icon}
              </div>
              <h3 className="text-xl font-semibold text-primary-900 mb-3">{problem.title}</h3>
              <p className="text-primary-600 leading-relaxed">{problem.description}</p>
            </div>
          ))}
        </div>

        {/* Transition Statement */}
        <div className="text-center">
          <p className="text-xl md:text-2xl font-medium text-primary-800 max-w-3xl mx-auto">
            Young Africans don&apos;t have a financial literacy problem.{' '}
            <span className="text-accent">They have a financial clarity problem.</span>
          </p>
        </div>
      </Container>
    </section>
  );
}
