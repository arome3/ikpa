'use client';

import { useState } from 'react';
import { Container, SectionHeader, FadeIn } from '@/components/ui';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'Is Ikpa a bank or fintech?',
    answer:
      'No. Ikpa is a financial intelligence platform. We never touch your money, hold funds, or process transactions. We provide clarity, education, and guidance.',
  },
  {
    question: 'Do I need to connect my bank account?',
    answer:
      'No. All data entry is manual, which means you stay in complete control. We designed it this way intentionally—low data anxiety, high data accuracy.',
  },
  {
    question: 'How is Ikpa different from other finance apps?',
    answer:
      'Other apps track what already happened. Ikpa changes what happens next — with behavioral tools, AI coaching, and real accountability built in.',
  },
  {
    question: 'What about family obligations? Other apps ignore this.',
    answer:
      'Ikpa treats family support as a feature, not a bug. We help you plan for obligations while still building personal wealth—no guilt, no judgment.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Yes. Bank-level encryption. No data selling. No third-party access without your explicit consent. Your financial information stays yours.',
  },
  {
    question: 'What countries does Ikpa support?',
    answer:
      'Available worldwide. Ikpa supports all major currencies — USD, GBP, EUR, and many more.',
  },
  {
    question: 'How does the AI work?',
    answer:
      'Ikpa uses advanced AI to understand your specific financial situation and give you clear, actionable guidance — no jargon, no generic tips.',
  },
  {
    question: 'Can I use Ikpa if my income is irregular?',
    answer:
      "Yes. Ikpa was designed specifically for irregular income. We don't assume a fixed monthly salary—we model your actual earning patterns.",
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onClick,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-b border-sage-100 last:border-0">
      <button
        className="w-full py-6 flex items-center justify-between text-left"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span className="text-lg font-medium text-forest pr-8">{question}</span>
        <svg
          className={cn(
            'w-5 h-5 text-sage-500 flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 pb-6' : 'max-h-0'
        )}
      >
        <p className="text-charcoal/70 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-32 bg-cream">
      <Container size="md">
        <FadeIn>
          <SectionHeader title="Frequently asked questions" />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-sage-100">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
