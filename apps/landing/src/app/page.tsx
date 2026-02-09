import { Navigation, Hero, WhySection, SystemCore, BehavioralScience, Features, Integrations, Testimonials, FAQ, Footer } from '@/components/sections';

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <WhySection />
        <SystemCore />
        <BehavioralScience />
        <Features />
        <Integrations />
        <Testimonials />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
