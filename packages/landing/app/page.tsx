import { Hero } from '@/components/Hero';
import { Nav } from '@/components/Nav';
import { Closing, Confidence, Faq, Footer, Incident, Platform, Pricing, TryIt } from '@/components/Sections';

export default function Page() {
  return (
    <>
      <Nav />
      <Hero />
      <Platform />
      <Incident />
      <Confidence />
      <TryIt />
      <Pricing />
      <Faq />
      <Closing />
      <Footer />
    </>
  );
}
