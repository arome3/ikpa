'use client';

import { Container, SectionHeader } from '@/components/landing-ui';

const agents = [
  {
    name: 'Shark Auditor',
    defeats: 'Invisible Leakage',
    description: 'Hunts zombie subscriptions and forgotten recurring charges. Swipe left to cancel, right to keep.',
  },
  {
    name: 'GPS Re-Router',
    defeats: 'Failure Spiral',
    description: 'When you slip, it recalculates—never judges. "Here are 3 paths back on track by Friday."',
  },
  {
    name: 'Commitment Device',
    defeats: 'Commitment Decay',
    description: 'Creates real stakes through social accountability. Research shows this 3x success rates.',
  },
  {
    name: 'Future Self Simulator',
    defeats: 'Temporal Disconnect',
    description: 'Generates letters from your 60-year-old self. MIT research: users save 16% more.',
  },
  {
    name: 'Family & Values Manager',
    defeats: 'Cultural Blindness',
    description: 'Tracks family obligations without guilt. Supporting family is a value, not a budget leak.',
  },
];

export function Solution() {
  return (
    <section className="py-24 md:py-32 bg-white">
      <Container>
        <SectionHeader
          title="The Agent Orchestra"
          subtitle="Five specialized AI agents that collaborate to change your financial behavior—not just track it."
          eyebrow="The Solution"
        />

        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            {agents.map((agent, index) => (
              <div
                key={index}
                className="flex items-start gap-6 p-6 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-neutral-950 text-white flex items-center justify-center flex-shrink-0 text-sm font-mono">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-3 mb-1">
                    <h3 className="text-lg font-display font-semibold text-neutral-900">
                      {agent.name}
                    </h3>
                    <span className="text-xs text-neutral-400 uppercase tracking-wide">
                      defeats {agent.defeats}
                    </span>
                  </div>
                  <p className="text-neutral-600">
                    {agent.description}
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
