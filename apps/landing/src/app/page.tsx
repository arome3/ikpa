import {
  Navigation,
  Hero,
  Problem,
  Solution,
  Features,
  HowItWorks,
  FutureSelf,
  BuiltForAfrica,
  Testimonials,
  Pricing,
  FAQ,
  FinalCTA,
  Footer,
} from '@/components/sections';

export default function Home() {
  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <Features />
        <HowItWorks />
        <FutureSelf />
        <BuiltForAfrica />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
