'use client';

import { Award, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Container, FadeIn } from '@/components/ui';

export function Hero() {
  return (
    <>
      <section className="relative min-h-screen flex items-center pt-20 md:pt-24 overflow-hidden bg-cream">
        {/* Watercolor splash — top-left */}
        <img
          src="/header-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute -top-[200px] -left-[180px] w-[700px] mix-blend-multiply pointer-events-none z-0 select-none"
          draggable={false}
        />

        {/* Watercolor splash — bottom-right (flipped) */}
        <img
          src="/header-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute -bottom-[200px] -right-[180px] w-[600px] rotate-180 mix-blend-multiply pointer-events-none z-0 select-none"
          draggable={false}
        />

        <Container className="relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Split-color headline */}
            <FadeIn duration={1.5}>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight">
                <span className="text-[#0F172A]">Make your money </span>
                <span className="text-olive">follow through.</span>
              </h1>
            </FadeIn>

            {/* Subheadline with Award icon — vertically centered */}
            <FadeIn delay={0.15} duration={1.5}>
              <div className="flex items-start justify-center gap-3 mt-6 text-gray-600 max-w-2xl mx-auto">
                <Award className="w-5 h-5 text-green-700 flex-shrink-0 mt-1" />
                <p className="text-lg font-medium text-left">
                  92% of financial resolutions fail — not from lack of knowledge,
                  but lost accountability. AI agents that fix that with real
                  stakes and zero judgment.
                </p>
              </div>
            </FadeIn>

            {/* Custom buttons */}
            <FadeIn delay={0.3} duration={1.5}>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                {/* Primary — deep green with arrow circle */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-3 bg-[#064E3B] text-white font-semibold rounded-full px-8 py-4 text-lg shadow-lg shadow-[#064E3B]/20 transition-colors hover:bg-[#053D2E] focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50"
                >
                  Meet Your AI Agents
                  <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center ml-2">
                    <ArrowRight className="w-3 h-3 text-white" />
                  </div>
                </motion.button>

                {/* Secondary — transparent border */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center font-semibold rounded-full px-8 py-4 text-lg border-2 border-gray-200 text-forest transition-colors hover:bg-sage-50 focus:outline-none focus:ring-2 focus:ring-sage-500/50"
                >
                  See How It Works
                </motion.button>
              </div>
            </FadeIn>
          </div>
        </Container>
      </section>

      {/* Floating context pill — fixed to viewport bottom center */}
      <FadeIn delay={0.45} duration={1.5} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md border border-gray-200/50 shadow-sm rounded-full px-4 py-1.5">
          <Sparkles className="w-3 h-3 text-green-600 flex-shrink-0" />
          <span className="text-xs font-mono text-gray-500 tracking-wide uppercase whitespace-nowrap">
            Ikpa-Context-Core: Behavioral Model v2.0 active
          </span>
        </div>
      </FadeIn>
    </>
  );
}
