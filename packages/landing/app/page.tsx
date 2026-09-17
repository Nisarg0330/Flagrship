import { Hero } from '@/components/Hero';
import { Bento, Closing, Faq, Footer, Loop, Nav, Pricing, Sdk, TryIt } from '@/components/Sections';

function Ambient() {
  const blob =
    'absolute size-[70vw] max-h-[900px] max-w-[900px] rounded-full will-change-transform bg-[radial-gradient(circle,rgba(180,150,110,0.10)_0%,rgba(180,150,110,0)_70%)]';
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <span className={`${blob} drift -right-[20vw] -top-[25vw]`} />
      <span className={`${blob} drift-2 -left-[30vw] top-[40vh] opacity-60`} />
    </div>
  );
}

export default function Page() {
  return (
    <>
      <Ambient />
      <div className="relative z-[1]">
        <Nav />
        <Hero />
        <Loop />
        <TryIt />
        <Bento />
        <Sdk />
        <Pricing />
        <Faq />
        <Closing />
        <Footer />
      </div>
    </>
  );
}
