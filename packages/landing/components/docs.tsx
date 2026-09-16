import type { ReactNode } from 'react';
import { Tag } from './ui';

/* Prose primitives for the docs. Anchored headings, tables, callouts. */

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function Title({ children, lede }: { children: string; lede?: ReactNode }) {
  return (
    <header className="mb-10 border-b border-line pb-8">
      <h1 className="font-serif text-[clamp(34px,4.6vw,48px)] leading-[1.1] tracking-[-0.025em] text-ink text-balance">{children}</h1>
      {lede ? <p className="mt-4 max-w-[62ch] text-[17px] leading-[1.6] text-muted">{lede}</p> : null}
    </header>
  );
}

export function H2({ children }: { children: string }) {
  const id = slug(children);
  return (
    <h2 id={id} className="group mt-14 mb-4 scroll-mt-24 text-[22px] font-semibold tracking-[-0.015em] text-ink first:mt-0">
      <a href={`#${id}`} className="no-underline">
        {children}
        <span className="ml-2 text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
          #
        </span>
      </a>
    </h2>
  );
}

export function H3({ children }: { children: string }) {
  const id = slug(children);
  return (
    <h3 id={id} className="mt-9 mb-3 scroll-mt-24 text-[16px] font-semibold text-ink">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="my-4 max-w-[68ch] leading-[1.7] text-ink-2">{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.86em] text-ink">{children}</code>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-2">{children}</kbd>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="my-4 max-w-[68ch] list-disc space-y-2 pl-5 leading-[1.7] text-ink-2 marker:text-muted-2">{children}</ul>;
}

export function Ol({ children }: { children: ReactNode }) {
  return <ol className="my-4 max-w-[68ch] list-decimal space-y-2 pl-5 leading-[1.7] text-ink-2 marker:font-mono marker:text-xs marker:text-muted">{children}</ol>;
}

export function Note({ tone = 'sky', title, children }: { tone?: 'sky' | 'sand' | 'rose' | 'mint'; title: string; children: ReactNode }) {
  const bg = { sky: 'bg-sky-100', sand: 'bg-sand-100', rose: 'bg-rose-100', mint: 'bg-mint-100' }[tone];
  const fg = { sky: 'text-sky-700', sand: 'text-sand-700', rose: 'text-rose-700', mint: 'text-mint-700' }[tone];
  return (
    <aside className={`my-6 max-w-[68ch] rounded-lg ${bg} px-5 py-4`}>
      <div className={`text-[11px] font-medium uppercase tracking-[0.06em] ${fg}`}>{title}</div>
      <div className="mt-1.5 text-[15px] leading-[1.65] text-ink-2">{children}</div>
    </aside>
  );
}

export function Table({ head, rows, mono = [] }: { head: string[]; rows: ReactNode[][]; mono?: number[] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[520px] border-collapse text-[14px]">
        <thead>
          <tr className="bg-surface-2">
            {head.map((h) => (
              <th key={h} className="border-b border-line px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-3 align-top leading-[1.55] text-ink-2 ${mono.includes(j) ? 'whitespace-nowrap font-mono text-[13px] text-ink' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Method({ verb, path, scope }: { verb: 'GET' | 'POST' | 'DELETE'; path: string; scope: 'read' | 'write' | 'admin' | 'none' }) {
  const tone = { GET: 'mint', POST: 'sky', DELETE: 'rose' }[verb] as 'mint' | 'sky' | 'rose';
  return (
    <div className="mt-9 mb-3 flex flex-wrap items-center gap-3 border-t border-line pt-6">
      <Tag tone={tone}>{verb}</Tag>
      <code className="font-mono text-[15px] text-ink">{path}</code>
      {scope !== 'none' ? <span className="ml-auto text-xs text-muted">scope: <span className="font-mono">{scope}</span></span> : null}
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <div className="my-6 [counter-reset:step]">{children}</div>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative border-l border-line pb-8 pl-8 last:pb-0 [counter-increment:step] before:absolute before:-left-[13px] before:top-0 before:flex before:size-[26px] before:items-center before:justify-center before:rounded-full before:border before:border-line before:bg-surface before:font-mono before:text-[11px] before:text-muted before:content-[counter(step)]">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}
