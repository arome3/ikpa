import { Container, SectionHeader, Button } from '@/components/ui';

const comparisonData = [
  { metric: 'Net Worth', current: '₦4.2M', optimized: '₦28.4M' },
  { metric: 'Emergency Fund', current: '6 weeks', optimized: '12 months' },
  { metric: 'Housing', current: 'Renting', optimized: 'Land owner' },
  { metric: 'Family Support', current: 'Stressful', optimized: 'From position of strength' },
];

export function FutureSelf() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-primary-700 to-primary-800">
      <Container>
        <SectionHeader
          title="Meet your future self"
          subtitle="This is the feature that changes everything."
          light
        />

        {/* Description */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-primary-100 text-lg leading-relaxed mb-6">
            Ikpa&apos;s Future Self Engine builds a dynamic model of your financial life and
            projects it forward—five years, ten years, twenty years. But here&apos;s what makes it
            different: you see two futures, side by side.
          </p>
        </div>

        {/* Two Paths Comparison */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
          {/* Current Path */}
          <div className="bg-primary-600/50 backdrop-blur-sm rounded-2xl p-8 border border-primary-500/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Current Path</h3>
            </div>
            <p className="text-primary-200 mb-6">
              Where you end up if nothing changes. Your habits, your patterns, your current
              trajectory—extended into the future with unflinching honesty.
            </p>
            <div className="space-y-4">
              {comparisonData.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-primary-500/30 last:border-0">
                  <span className="text-primary-300">{item.metric}</span>
                  <span className="text-white font-medium">{item.current}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-primary-400 mt-4 text-center">At age 36</p>
          </div>

          {/* Optimized Path */}
          <div className="bg-gradient-to-br from-accent/20 to-emerald-500/20 backdrop-blur-sm rounded-2xl p-8 border border-accent/30 relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
              Achievable
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Optimized Path</h3>
            </div>
            <p className="text-primary-100 mb-6">
              Where you could be with discipline and small adjustments. Not fantasy. Not
              lottery-winner projections. Achievable outcomes based on realistic behavior change.
            </p>
            <div className="space-y-4">
              {comparisonData.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-accent/20 last:border-0">
                  <span className="text-primary-200">{item.metric}</span>
                  <span className="text-emerald-400 font-bold">{item.optimized}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-primary-300 mt-4 text-center">At age 36</p>
          </div>
        </div>

        {/* The Letter */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">The Letter</h4>
                <p className="text-primary-200">
                  Your optimized future self writes you a letter. Personalized. Specific. Honest
                  about what it took and what became possible.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Divergence Point */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full mb-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium">The Divergence Point</span>
          </div>
          <p className="text-primary-100 text-lg mb-8">
            The moment where the paths split is often surprisingly small. A monthly savings increase
            of ₦25,000. Cutting one subscription. Starting six months earlier.{' '}
            <span className="text-white font-medium">
              Ikpa shows you exactly where the leverage is.
            </span>
          </p>
          <Button size="lg">See Your Future →</Button>
        </div>
      </Container>
    </section>
  );
}
