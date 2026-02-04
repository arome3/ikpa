'use client';

import { useEffect, useRef, useState } from 'react';
import { Container, SectionHeader, Button } from '@/components/landing-ui';

const plans = [
  {
    name: 'Free',
    description: 'For getting started',
    price: '₦0',
    period: '/month',
    features: [
      'Cash Flow Score',
      'Basic expense tracking',
      '3 active goals',
      'Limited AI interactions',
    ],
    cta: 'Get Started',
    popular: false,
  },
  {
    name: 'Pro',
    description: 'For building wealth',
    price: '₦2,500',
    period: '/month',
    features: [
      'Everything in Free',
      'Unlimited goals',
      'Full AI coach access',
      'Future Self Engine',
      'Advanced simulations',
      'Pattern detection alerts',
    ],
    cta: 'Join Waitlist',
    popular: true,
  },
  {
    name: 'Premium',
    description: 'For serious planners',
    price: '₦5,000',
    period: '/month',
    features: [
      'Everything in Pro',
      'Priority AI responses',
      'Multi-year projections',
      'Family financial planning',
      'Export and reporting',
    ],
    cta: 'Join Waitlist',
    popular: false,
  },
];

export function Pricing() {
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="pricing"
      ref={sectionRef}
      className="py-20 md:py-32 bg-cream relative overflow-hidden"
    >
      {/* Subtle pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(245, 158, 11, 0.03) 0%, transparent 50%)`,
        }}
      />

      <Container className="relative z-10">
        <SectionHeader
          title="Simple pricing. No hidden fees."
          subtitle="Ikpa makes money from subscriptions, not from selling your data or pushing financial products."
          eyebrow="Pricing"
        />

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = plan.popular;
            const isHovered = hoveredCard === index;

            return (
              <div
                key={index}
                className={`
                  relative
                  transition-all duration-500 ease-out
                  ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}
                  ${isPopular ? 'md:-mt-4 md:mb-4' : ''}
                `}
                style={{ transitionDelay: `${index * 150}ms` }}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                    <span className="bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-bold px-5 py-1.5 rounded-full shadow-gold">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Card */}
                <div
                  className={`
                    relative rounded-2xl p-8 h-full flex flex-col
                    transition-all duration-300
                    ${
                      isPopular
                        ? 'bg-white border-2 border-gold-400 shadow-gold-lg'
                        : 'bg-white border border-primary-100 shadow-card hover:shadow-card-hover'
                    }
                    ${isHovered && !isPopular ? 'border-primary-200' : ''}
                  `}
                >
                  {/* Golden glow for popular */}
                  {isPopular && (
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400 rounded-2xl blur opacity-20 -z-10" />
                  )}

                  {/* Header */}
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-display font-bold text-primary-900 mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-sm text-primary-500 mb-6">{plan.description}</p>

                    {/* Price */}
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl md:text-5xl font-mono font-bold text-primary-900">
                        {plan.price}
                      </span>
                      <span className="text-primary-500">{plan.period}</span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className={`
                          flex items-start gap-3
                          transition-all duration-300
                          ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
                        `}
                        style={{
                          transitionDelay: `${index * 150 + featureIndex * 50 + 200}ms`,
                        }}
                      >
                        <div
                          className={`
                            w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                            transition-all duration-300
                            ${
                              isPopular
                                ? 'bg-gold-100 text-gold-600'
                                : 'bg-primary-100 text-primary-600'
                            }
                            ${isHovered ? 'scale-110' : ''}
                          `}
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <span className="text-sm text-primary-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    variant={isPopular ? 'primary' : 'outline'}
                    fullWidth
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Currency Note */}
        <p
          className={`
            text-center text-primary-500 text-sm mt-10
            transition-all duration-500
            ${isVisible ? 'opacity-100' : 'opacity-0'}
          `}
          style={{ transitionDelay: '600ms' }}
        >
          Prices shown are for Nigeria. Equivalent pricing available in GHS, KES, and ZAR.
        </p>
      </Container>
    </section>
  );
}
