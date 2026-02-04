'use client';

import { useEffect, useRef, useState } from 'react';
import { Container, SectionHeader } from '@/components/landing-ui';

const faqs = [
  {
    question: 'What makes IKPA different from other finance apps?',
    answer:
      'Most apps track your money—IKPA changes your behavior. Instead of one generic AI, we deploy 5 specialized agents: Shark Auditor hunts subscriptions, GPS Re-Router helps you recover from slips, Commitment Device creates accountability, Future Self Simulator connects you to your future, and Family Values Manager handles cultural obligations. We focus on behavior change, not just numbers.',
  },
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
      'Ikpa treats family support as a feature, not a bug. We embrace Ubuntu philosophy—"I am because we are." Your Family Values Manager tracks obligations without guilt and helps you plan for them while still building personal wealth.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Yes. Bank-level encryption. No data selling. No third-party access without your explicit consent. Your financial information stays yours.',
  },
  {
    question: 'How does the AI work?',
    answer:
      'Ikpa deploys 5 specialized AI agents, each designed to defeat a specific reason why financial resolutions fail: Shark Auditor finds forgotten subscriptions, GPS Re-Router helps you recover from slips without judgment, Commitment Device creates real stakes through social accountability, Future Self Simulator writes letters from your 60-year-old self, and Family Values Manager handles cultural obligations. All agents are powered by Claude and use G-Eval to ensure empathetic, culturally sensitive advice.',
  },
  {
    question: 'What countries does Ikpa support?',
    answer:
      "We're launching first in Nigeria, with Ghana, Kenya, and South Africa following. The app supports NGN, GHS, KES, ZAR, and USD.",
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
  index,
  isVisible,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  index: number;
  isVisible: boolean;
}) {
  return (
    <div
      className={`
        border-b border-primary-100 last:border-0
        transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      style={{ transitionDelay: `${index * 75}ms` }}
    >
      <button
        className={`
          w-full py-6 flex items-center justify-between text-left
          group transition-all duration-300
          ${isOpen ? 'pb-4' : ''}
        `}
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4">
          {/* Golden accent line */}
          <div
            className={`
              w-1 h-6 rounded-full transition-all duration-300
              ${isOpen ? 'bg-gold-500 h-8' : 'bg-transparent group-hover:bg-gold-200'}
            `}
          />
          <span
            className={`
              text-lg font-display font-medium pr-8 transition-colors duration-300
              ${isOpen ? 'text-gold-600' : 'text-primary-900 group-hover:text-primary-700'}
            `}
          >
            {question}
          </span>
        </div>
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
            transition-all duration-300
            ${isOpen ? 'bg-gold-100 text-gold-600 rotate-180' : 'bg-primary-50 text-primary-500'}
            group-hover:bg-gold-50 group-hover:text-gold-500
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Answer with grid transition for smooth height animation */}
      <div
        className={`
          grid transition-all duration-300 ease-out
          ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}
        `}
      >
        <div className="overflow-hidden">
          <div className="pl-5 pb-6">
            <p className="text-primary-600 leading-relaxed pl-4 border-l-2 border-primary-100">
              {answer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 md:py-32 bg-sage relative overflow-hidden">
      {/* Subtle Kente diagonal */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 60px,
            rgba(6, 78, 59, 0.02) 60px,
            rgba(6, 78, 59, 0.02) 61px
          )`,
        }}
      />

      <Container size="md" className="relative z-10">
        <SectionHeader title="Questions answered" eyebrow="FAQ" />

        <div
          className={`
            bg-white rounded-2xl p-6 md:p-8 shadow-card border border-primary-100
            transition-all duration-700
            ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              index={index}
              isVisible={isVisible}
            />
          ))}
        </div>

        {/* Still have questions? */}
        <div
          className={`
            text-center mt-10
            transition-all duration-500
            ${isVisible ? 'opacity-100' : 'opacity-0'}
          `}
          style={{ transitionDelay: '600ms' }}
        >
          <p className="text-primary-600">
            Still have questions?{' '}
            <a href="mailto:hello@ikpa.app" className="text-gold-600 hover:text-gold-700 font-medium">
              Reach out to us
            </a>
          </p>
        </div>
      </Container>
    </section>
  );
}
