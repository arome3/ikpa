import { Container, SectionHeader, Button } from '@/components/ui';

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
  return (
    <section id="pricing" className="py-20 md:py-32 bg-white">
      <Container>
        <SectionHeader
          title="Simple pricing. No hidden fees."
          subtitle="Ikpa makes money from subscriptions, not from selling your data or pushing financial products."
        />

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? 'bg-gradient-to-b from-primary-600 to-primary-700 text-white shadow-xl scale-105'
                  : 'bg-white border-2 border-primary-100'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-accent text-white text-sm font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3
                  className={`text-xl font-bold mb-1 ${
                    plan.popular ? 'text-white' : 'text-primary-900'
                  }`}
                >
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? 'text-primary-200' : 'text-primary-500'}`}>
                  {plan.description}
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  <span
                    className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-primary-900'}`}
                  >
                    {plan.price}
                  </span>
                  <span className={`${plan.popular ? 'text-primary-200' : 'text-primary-500'}`}>
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <svg
                      className={`w-5 h-5 flex-shrink-0 ${
                        plan.popular ? 'text-accent' : 'text-emerald-500'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span
                      className={`text-sm ${plan.popular ? 'text-primary-100' : 'text-primary-600'}`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? 'primary' : 'outline'}
                fullWidth
                className={plan.popular ? '' : 'border-primary-300 text-primary-700 hover:bg-primary-50'}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* Currency Note */}
        <p className="text-center text-primary-500 text-sm mt-8">
          Prices shown are for Nigeria. Equivalent pricing available in GHS, KES, and ZAR.
        </p>
      </Container>
    </section>
  );
}
