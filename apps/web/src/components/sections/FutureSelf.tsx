'use client';

import { Container, SectionHeader, Button } from '@/components/landing-ui';

export function FutureSelf() {
  return (
    <section className="py-24 md:py-32 bg-neutral-950">
      <Container>
        <SectionHeader
          title="Meet your future self"
          subtitle="MIT research shows users who connect with their future selves save 16% more. Ikpa makes that connection real."
          eyebrow="Future Self Simulator"
          light
        />

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Current Path */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8">
              <div className="text-sm text-neutral-500 uppercase tracking-wide mb-4">
                Current Path
              </div>
              <div className="space-y-4">
                <div className="flex justify-between border-b border-neutral-800 pb-3">
                  <span className="text-neutral-400">Net Worth</span>
                  <span className="text-white font-mono">$85K</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-3">
                  <span className="text-neutral-400">Emergency Fund</span>
                  <span className="text-white font-mono">6 weeks</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-3">
                  <span className="text-neutral-400">Housing</span>
                  <span className="text-white font-mono">Renting</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Family Support</span>
                  <span className="text-white font-mono">Stressful</span>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-6 text-center">At age 40</p>
            </div>

            {/* Optimized Path */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-700 p-8">
              <div className="text-sm text-neutral-400 uppercase tracking-wide mb-4">
                Optimized Path
              </div>
              <div className="space-y-4">
                <div className="flex justify-between border-b border-neutral-800 pb-3">
                  <span className="text-neutral-400">Net Worth</span>
                  <span className="text-white font-mono font-medium">$340K</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-3">
                  <span className="text-neutral-400">Emergency Fund</span>
                  <span className="text-white font-mono font-medium">12 months</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800 pb-3">
                  <span className="text-neutral-400">Housing</span>
                  <span className="text-white font-mono font-medium">Homeowner</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Family Support</span>
                  <span className="text-white font-mono font-medium">From strength</span>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-6 text-center">At age 40</p>
            </div>
          </div>

          {/* Letter Preview */}
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-8 mb-12">
            <p className="text-sm text-neutral-500 uppercase tracking-wide mb-4">
              A Letter From Your Future Self
            </p>
            <p className="text-neutral-300 italic leading-relaxed">
              "Dear present me, I'm writing this from a place I never thought I'd reach.
              The emergency fund that felt impossible? It's there. The family support that
              used to drain me? It now comes from a position of strength..."
            </p>
            <p className="text-neutral-500 text-sm mt-4 text-right">— You, in 10 years</p>
          </div>

          <div className="text-center">
            <p className="text-neutral-400 mb-6">
              The divergence point is often surprisingly small.
              <span className="text-white font-medium"> Just $200/month difference.</span>
            </p>
            <Button variant="secondary" size="lg">
              See Your Future
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
