'use client';

import { useState } from 'react';
import { Container, SectionHeader } from '@/components/ui';

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
    question: 'How is Ikpa different from PiggyVest or Cowrywise?',
    answer:
      "Those are investment and savings platforms—they hold your money. Ikpa is the layer before that: understanding where you stand, what your options are, and which path makes sense for your situation.",
  },
  {
    question: 'What about family obligations? Other apps ignore this.',
    answer:
      'Ikpa treats family support as a feature, not a bug. Your "Dependency Ratio" is a core metric. We help you plan for obligations while still building personal wealth.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Yes. Bank-level encryption. No data selling. No third-party access without your explicit consent. Your financial information stays yours.',
  },
  {
    question: 'What countries does Ikpa support?',
    answer:
      "We're launching first in Nigeria, with Ghana, Kenya, and South Africa following. The app supports NGN, GHS, KES, ZAR, and USD.",
  },
  {
    question: 'How does the AI work?',
    answer:
      'Ikpa uses Claude, an advanced AI model, to provide personalized explanations and recommendations. The AI understands African financial context and responds in plain language.',
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
    <div className="border-b border-primary-100 last:border-0">
      <button
        className="w-full py-6 flex items-center justify-between text-left"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span className="text-lg font-medium text-primary-900 pr-8">{question}</span>
        <svg
          className={`w-5 h-5 text-primary-500 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 pb-6' : 'max-h-0'
        }`}
      >
        <p className="text-primary-600 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 md:py-32 bg-primary-50">
      <Container size="md">
        <SectionHeader title="Questions answered" />

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-primary-100">
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
      </Container>
    </section>
  );
}
