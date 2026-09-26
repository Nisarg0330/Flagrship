'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PAGES, TABS, tabFor } from './docs-nav';
import { REPO } from './Nav';
import { Icon, Kbd, Logo } from './ui';

/* ── sidebar ─────────────────────────────────────────────────────────────── */

export function Sidebar() {
  const path = usePathname();
  const active = tabFor(path);
  return (
    <aside className="hidden w-[260px] flex-none border-r border-line bg-canvas md:block">
      <div className="sticky top-0 flex h-screen flex-col px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.01em] text-ink">
          <Logo />
          Flagrship
        </Link>
        <div className="mt-5">
          <Search />
        </div>
        <div className="mt-5 flex flex-col gap-1 text-sm">
          <a href={REPO} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-muted hover:bg-surface hover:text-ink">
            <Icon name="code" className="size-4" /> GitHub
          </a>
          <a href="https://www.npmjs.com/package/@flagrship/cli" className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-muted hover:bg-surface hover:text-ink">
            <Icon name="terminal" className="size-4" /> npm
          </a>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto text-sm">
          {active.groups.map(({ group, items }) => (
            <div key={group} className="mb-6">
              <div className="mb-1.5 px-2 text-[13px] font-medium text-ink">{group}</div>
              {items.map(({ href, label }) => {
                const on = path === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative block border-l py-1.5 pl-4 transition-colors ${on ? 'border-ink font-medium text-ink' : 'border-line text-muted hover:border-line-2 hover:text-ink'}`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <a href="/#try" className="flex items-center justify-between border-t border-line pt-4 text-[13px] text-muted hover:text-ink">
          Try the live demo <span aria-hidden="true">↗</span>
        </a>
      </div>
    </aside>
  );
}

/* ── top tabs ────────────────────────────────────────────────────────────── */

export function TopTabs() {
  const path = usePathname();
  const active = tabFor(path);
  return (
    <div className="sticky top-0 z-10 flex items-center gap-6 border-b border-line bg-canvas/80 px-6 backdrop-blur-[14px] md:px-10">
      <Link href="/" className="flex items-center gap-2 py-3.5 font-semibold text-ink md:hidden">
        <Logo /> Flagrship
      </Link>
      {TABS.map((t) => (
        <Link
          key={t.tab}
          href={t.groups[0].items[0].href}
          className={`-mb-px border-b-2 py-3.5 text-sm font-medium transition-colors ${t === active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
        >
          {t.tab}
        </Link>
      ))}
      <div className="ml-auto md:hidden">
        <Search compact />
      </div>
    </div>
  );
}

/* ── search (Ctrl K) ─────────────────────────────────────────────────────── */

type Entry = { href: string; title: string; heading: string };

export function Search({ compact = false }: { compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState<Entry[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (compact) return; // the sidebar instance owns the hotkey; the mobile one is button-only
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);

  const open = () => {
    if (!index.length) fetch('/search.json').then((r) => r.json()).then(setIndex).catch(() => {});
    setQ('');
    setSel(0);
    ref.current?.showModal();
    input.current?.focus();
  };

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length
    ? index.filter((e) => terms.every((t) => `${e.title} ${e.heading}`.toLowerCase().includes(t))).slice(0, 12)
    : PAGES.map((p) => ({ href: p.href, title: p.label, heading: '' }));

  const go = (href: string) => {
    ref.current?.close();
    window.location.href = href;
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={
          compact
            ? 'rounded-md p-2 text-muted hover:text-ink'
            : 'flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted hover:border-line-2'
        }
        aria-label="Search docs"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        {compact ? null : (
          <>
            Search…
            <span className="ml-auto flex gap-1">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </>
        )}
      </button>

      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current.close()}
        className="m-0 w-full max-w-[600px] rounded-xl border border-line bg-surface p-0 shadow-[0_24px_60px_rgba(0,0,0,0.12)] backdrop:bg-ink/30 backdrop:backdrop-blur-[2px] open:fixed open:left-1/2 open:top-[12vh] open:-translate-x-1/2"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, hits.length - 1));
              if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0));
              if (e.key === 'Enter' && hits[sel]) go(hits[sel].href);
            }}
            placeholder="Search the docs…"
            className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted-2"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {hits.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted">No results for “{q}”</li> : null}
          {hits.map((h, i) => (
            <li key={h.href}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => go(h.href)}
                className={`flex w-full items-baseline gap-2 rounded-md px-3 py-2 text-left text-sm ${i === sel ? 'bg-surface-2 text-ink' : 'text-ink-2'}`}
              >
                {h.heading ? (
                  <>
                    <span className="text-muted">{h.title}</span>
                    <span className="text-muted-2">›</span>
                    <span>{h.heading}</span>
                  </>
                ) : (
                  <span className="font-medium">{h.title}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}

/* ── on this page ────────────────────────────────────────────────────────── */

export function OnThisPage() {
  const [heads, setHeads] = useState<Array<{ id: string; text: string }>>([]);
  const [active, setActive] = useState('');
  const path = usePathname();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLHeadingElement>('main h2[id]'));
    setHeads(els.map((h) => ({ id: h.id, text: h.textContent?.replace(/#$/, '').trim() ?? '' })));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [path]);

  if (!heads.length) return null;
  return (
    <nav className="text-[13px]">
      <div className="mb-3 flex items-center gap-2 font-medium text-ink">
        <Icon name="list" className="size-3.5" /> On this page
      </div>
      {heads.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          className={`block border-l py-1 pl-3 transition-colors ${active === h.id ? 'border-ink text-ink' : 'border-line text-muted hover:text-ink'}`}
        >
          {h.text}
        </a>
      ))}
    </nav>
  );
}

/* ── prev / next ─────────────────────────────────────────────────────────── */

export function Pager() {
  const path = usePathname();
  const i = PAGES.findIndex((p) => p.href === path);
  if (i < 0) return null;
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  const cls = 'flex flex-col gap-1 rounded-xl border border-line bg-surface px-5 py-4 text-sm hover:border-line-2';
  return (
    <div className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className={cls}>
          <span className="text-xs text-muted">Previous</span>
          <span className="font-medium text-ink">← {prev.label}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className={`${cls} text-right`}>
          <span className="text-xs text-muted">Next</span>
          <span className="font-medium text-ink">{next.label} →</span>
        </Link>
      ) : null}
    </div>
  );
}
