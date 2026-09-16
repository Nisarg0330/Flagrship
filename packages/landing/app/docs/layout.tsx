import Link from 'next/link';
import { DocsNav } from '@/components/DocsNav';
import { Button, Logo } from '@/components/ui';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="sticky top-0 z-10 border-b border-line bg-canvas/80 backdrop-blur-[14px]">
        <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-ink">
              <Logo />
              Flagrship
            </Link>
            <span className="hidden text-muted-2 md:inline">/</span>
            <span className="hidden text-sm text-muted md:inline">Docs</span>
          </div>
          <div className="flex items-center gap-[18px] text-sm">
            <a href="https://github.com/Nisarg0330/Flagrship" className="text-muted hover:text-ink">
              GitHub
            </a>
            <Button href="/#pricing" size="sm">
              Get started
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-10 md:grid-cols-[220px_1fr] md:py-14">
        <aside className="md:sticky md:top-[84px] md:self-start">
          <DocsNav />
        </aside>
        <main className="min-w-0 max-w-[760px]">{children}</main>
      </div>

      <footer className="mt-20 border-t border-line py-10 text-[13px] text-muted">
        <div className="mx-auto max-w-[1240px] px-6">Flagrship · Ship without a release.</div>
      </footer>
    </>
  );
}
