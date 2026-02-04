'use client';

import { Container, SectionHeader } from '@/components/landing-ui';

const testimonials = [
  {
    quote: "The Shark Auditor found $312 in subscriptions I'd forgotten about. That's real money back.",
    author: 'Chris A.',
    role: 'Product Designer',
  },
  {
    quote: "The Family & Values Manager changed my life. Supporting my parents is now part of my plan, not a 'budget leak'.",
    author: 'Amanda K.',
    role: 'Freelance Consultant',
  },
  {
    quote: "I overspent at a wedding. The GPS Re-Router gave me three paths back on track. No shame. Just solutions.",
    author: 'Kevin M.',
    role: 'Software Developer',
  },
];

export function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-neutral-50">
      <Container>
        <SectionHeader
          title="Real stories"
          subtitle="Early users changing their relationship with money."
          eyebrow="Testimonials"
        />

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-neutral-200 p-8"
            >
              <p className="text-neutral-700 leading-relaxed mb-6">
                "{testimonial.quote}"
              </p>
              <div>
                <p className="font-medium text-neutral-900">{testimonial.author}</p>
                <p className="text-sm text-neutral-500">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
