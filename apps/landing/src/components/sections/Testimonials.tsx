import { Container, SectionHeader } from '@/components/ui';

const testimonials = [
  {
    quote:
      "I finally understand where my money goes. For the first time, I can see exactly what happens if I keep doing what I'm doing—and it was the wake-up call I needed.",
    author: 'Chidi A.',
    role: 'Product Designer',
    location: 'Lagos',
  },
  {
    quote:
      "The family support tracking changed everything. I used to feel guilty about helping my parents. Now I plan for it, and I'm building wealth at the same time.",
    author: 'Amara K.',
    role: 'Freelance Consultant',
    location: 'Accra',
  },
  {
    quote:
      "I have three income sources and no two months look the same. Ikpa is the first app that actually works for how I earn.",
    author: 'Kwame M.',
    role: 'Software Developer',
    location: 'Nairobi',
  },
];

const stats = [
  { value: '30%', label: 'average increase in savings rate after 3 months' },
  { value: '40%', label: 'of users report reduced financial stress' },
  { value: '70%', label: 'pass financial literacy check after using Ikpa' },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-32 bg-primary-50">
      <Container>
        <SectionHeader title="What early users say" />

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 shadow-sm border border-primary-100 relative"
            >
              {/* Quote Icon */}
              <div className="absolute -top-4 left-8">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>
              </div>

              <blockquote className="text-primary-700 leading-relaxed mb-6 pt-4">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-200 flex items-center justify-center">
                  <span className="text-primary-600 font-semibold text-sm">
                    {testimonial.author.split(' ').map((n) => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-primary-900">{testimonial.author}</p>
                  <p className="text-sm text-primary-500">
                    {testimonial.role}, {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats Block */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 md:p-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <p className="text-4xl md:text-5xl font-bold text-accent mb-2">{stat.value}</p>
                <p className="text-primary-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
