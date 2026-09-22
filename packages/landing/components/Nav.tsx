'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Logo } from './ui';

export const REPO = 'https://github.com/Nisarg0330/Flagrship';

/** Live star count. Unauthenticated GitHub API allows 60 req/hr per IP; plenty for a nav badge. Renders nothing until it has a number. */
function Stars() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    fetch('https://api.github.com/repos/Nisarg0330/Flagrship')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setStars(j.stargazers_count))
      .catch(() => {});
  }, []);
  if (stars === null) return null;
  const label = stars >= 1000 ? `${(stars / 1000).toFixed(1)}K` : String(stars);
  return (
    <a href={REPO} className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-ink hover:bg-surface-2 sm:inline-flex">
      <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      {label}
      <span className="text-sand-700">★</span>
    </a>
  );
}

/** `D` opens the docs, `S` jumps to get started. Ignored while typing in a field. */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'd' || e.key === 'D') window.location.href = '/docs/';
      if (e.key === 's' || e.key === 'S') document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

const LINKS = [
  ['#features', 'Features'],
  ['#try', 'Demo'],
  ['#pricing', 'Pricing'],
  ['/docs/', 'Docs'],
];

export function Nav() {
  useHotkeys();
  return (
    <nav className="sticky top-0 z-20 bg-canvas/80 backdrop-blur-[14px]">
      <div className="mx-auto flex h-[64px] max-w-[1120px] items-center px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.01em] text-ink">
          <Logo />
          Flagrship
        </Link>
        <div className="ml-5">
          <Stars />
        </div>
        <div className="mx-auto hidden gap-8 text-sm text-muted md:flex">
          {LINKS.map(([href, label]) => (
            <a key={label} href={href} className="hover:text-ink">
              {label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button href="/docs/" variant="ghost" size="sm" kbd="D" className="hidden sm:inline-flex">
            Docs
          </Button>
          <Button href="#try" size="sm" kbd="S">
            Get started
          </Button>
        </div>
      </div>
    </nav>
  );
}
