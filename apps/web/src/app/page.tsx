import {
  Navigation,
  Hero,
  ProblemScroller,
  AgentShowcase,
  FutureSelfEngine,
  SimulatorBento,
  LetterFrom2034,
  Features,
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
        {/* The Fog Lifting */}
        <Hero />

        {/* Anxiety Scroller - Pain points transformed to clarity */}
        <ProblemScroller />

        {/* Agent Showcase - Meet the 5 AI agents */}
        <AgentShowcase />

        {/* Time-Travel Slider - Interactive financial projections */}
        <FutureSelfEngine />

        {/* What-If Bento - Scenario simulations */}
        <SimulatorBento />

        {/* Letter from Future Self - Emotional testimonial */}
        <LetterFrom2034 />

        {/* Features, Pricing, FAQ, CTA - Kept from original */}
        <Features />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
