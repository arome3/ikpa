import { Container, FadeIn } from '@/components/ui';

export function WhySection() {
  return (
    <section className="py-24 md:py-32 bg-cream">
      <Container size="md">
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-forest leading-snug">
              Standard budgeting apps tell you <em>what</em> to do.{' '}
              <span className="text-sage-600">Ikpa ensures you <em>do</em> it.</span>
            </h2>
            <p className="text-charcoal/60 text-lg md:text-xl mt-6 leading-relaxed">
              The gap between knowing and doing costs you thousands every year. Ikpa bridges it with real stakes, real accountability, and AI that adapts to your life.
            </p>
          </div>
        </FadeIn>
      </Container>
    </section>
  );
}
