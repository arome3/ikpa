'use client';

import { Landmark, Wallet, Banknote, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Container, FadeIn } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Integration {
  title: string;
  description: string;
  icon: LucideIcon;
}

const integrations: Integration[] = [
  {
    title: 'Bank Statement Import',
    description: 'Import statements from any bank — CSV, PDF, or even a screenshot. Your data, your control.',
    icon: Landmark,
  },
  {
    title: 'Crypto & Digital Assets',
    description: 'Log your stablecoin holdings and exchange balances alongside your traditional accounts.',
    icon: Wallet,
  },
  {
    title: 'Cash & Informal Income',
    description: 'Built for how money actually moves — log cash income, side hustles, and informal transactions with ease.',
    icon: Banknote,
  },
];

function TopographicPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.12] pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 400 400"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d={`M 0 ${30 + i * 28} Q 100 ${10 + i * 28}, 200 ${35 + i * 28} T 400 ${30 + i * 28}`}
          stroke="#4A7A55"
          strokeWidth="1.5"
          fill="none"
        />
      ))}
    </svg>
  );
}

function TriangleCorner() {
  return (
    <div
      className="absolute top-0 right-0 w-20 h-20 z-10"
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
    >
      <div className="w-full h-full bg-gradient-to-bl from-sage-300 to-sage-200" />
      <ArrowUpRight className="absolute top-2.5 right-2.5 w-4 h-4 text-forest" strokeWidth={2} />
    </div>
  );
}

function IntegrationCard({ integration, className }: { integration: Integration; className?: string }) {
  const Icon = integration.icon;

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden bg-[#F2FAF5] border border-sage-100 p-6 md:p-8 flex flex-col justify-between',
        className,
      )}
    >
      <TopographicPattern />
      <TriangleCorner />

      {/* Icon */}
      <div className="relative z-10">
        <Icon className="w-8 h-8 text-forest" strokeWidth={1.5} />
      </div>

      {/* Content — pushed to bottom */}
      <div className="relative z-10 mt-auto pt-8">
        <h3 className="font-serif text-xl font-semibold text-forest">{integration.title}</h3>
        <p className="text-sm text-charcoal/70 leading-relaxed mt-2">{integration.description}</p>
      </div>
    </div>
  );
}

export function Integrations() {
  return (
    <section className="py-20 md:py-32 bg-cream">
      <Container size="xl">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left column — headline */}
          <div className="lg:col-span-4 lg:sticky lg:top-32">
            <FadeIn>
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-forest leading-tight">
                Designed for how your
                <br className="hidden lg:block" />
                {' '}money actually moves.
              </h2>
            </FadeIn>
          </div>

          {/* Right column — bento grid */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tall card — spans 2 rows on md+ */}
              <FadeIn delay={0.1} className="md:row-span-2">
                <IntegrationCard
                  integration={integrations[0]}
                  className="h-full min-h-[280px] md:min-h-0"
                />
              </FadeIn>

              {/* Top-right card */}
              <FadeIn delay={0.2}>
                <IntegrationCard integration={integrations[1]} />
              </FadeIn>

              {/* Bottom-right card */}
              <FadeIn delay={0.3}>
                <IntegrationCard integration={integrations[2]} />
              </FadeIn>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
