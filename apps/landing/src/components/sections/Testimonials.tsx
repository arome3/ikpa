'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Container, FadeIn } from '@/components/ui';

const testimonials = [
  {
    headline: 'Ikpa stopped my 2 AM spending.',
    quote:
      "Ikpa found $380 in forgotten subscriptions I didn't even know I was paying for. But the real game-changer was the accountability feature — knowing my friends would see if I missed my savings goal made me actually stick to it.",
    name: 'Tunde A.',
    role: 'Product Designer',
    initials: 'TA',
  },
  {
    headline: 'Finally understood my cash flow.',
    quote:
      "Irregular income made budgeting impossible. Ikpa didn't just track my expenses — it made sense of my irregular income so I could actually plan ahead. I've saved more this year than in the last three combined.",
    name: 'Amara O.',
    role: 'Digital Marketer',
    initials: 'AO',
  },
  {
    headline: 'Behavioral nudges that actually work.',
    quote:
      "I used to pull money out of my savings for risky trades. The 'Future Self' visualization stopped that. Seeing how a small withdrawal ruined my 5-year projection was a wake-up call.",
    name: 'David K.',
    role: 'Software Engineer',
    initials: 'DK',
  },
];

const logos = ['Flutterwave', 'Paystack', 'MTN', 'PiggyVest', 'Google'];

export function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: direction === 'left' ? -496 : 496,
      behavior: 'smooth',
    });
  };

  return (
    <section className="bg-cream py-20 md:py-32">
      <Container size="xl">
        {/* Header row */}
        <FadeIn>
          <div className="flex items-end justify-between mb-10">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-forest">
              Real results from real members.
            </h2>

            <div className="hidden md:flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => scroll('left')}
                className="w-12 h-12 rounded-full bg-[#064E3B] text-white flex items-center justify-center transition-colors hover:bg-[#053D2E] focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => scroll('right')}
                className="w-12 h-12 rounded-full bg-[#064E3B] text-white flex items-center justify-center transition-colors hover:bg-[#053D2E] focus:outline-none focus:ring-2 focus:ring-[#064E3B]/50"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </FadeIn>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar"
        >
          {testimonials.map((t, i) => (
            <FadeIn key={t.name} direction="left" delay={i * 0.1}>
              <div className="w-[480px] flex-shrink-0 snap-start bg-white rounded-2xl p-8 shadow-sm border border-sage-100 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-forest">
                    {t.headline}
                  </h3>
                  <p className="text-charcoal/70 leading-relaxed mt-4">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-sage-100">
                  <div className="w-10 h-10 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center text-sm font-semibold">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-forest text-sm">
                      {t.name}
                    </p>
                    <p className="text-charcoal/50 text-sm">{t.role}</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Logo strip */}
        <FadeIn delay={0.3}>
          <div className="mt-16 pt-8 border-t border-sage-100">
            <p className="text-sm text-charcoal/40 text-center mb-6">
              Trusted by professionals at
            </p>
            <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap">
              {logos.map((logo) => (
                <span
                  key={logo}
                  className="font-bold text-xl text-charcoal/20 select-none"
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
