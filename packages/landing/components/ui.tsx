import type { ReactNode } from 'react';

type Tone = 'neutral' | 'mint' | 'rose' | 'sky' | 'sand';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border border-line',
  mint: 'bg-mint-100 text-mint-700',
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700',
  sand: 'bg-sand-100 text-sand-700',
};

export function Tag({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.05em] ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Keyboard hint, Strix-style, sitting inside a button. */
export function Kbd({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={`kbd ${dark ? 'bg-white/15 text-white/80' : 'border border-line bg-surface-2 text-muted'}`}>{children}</span>;
}

export function Button({
  href,
  variant = 'primary',
  size = 'md',
  kbd,
  children,
  className = '',
}: {
  href: string;
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'sm';
  kbd?: string;
  children: ReactNode;
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,transform,border-color] duration-200 active:scale-[0.98]';
  const sizes = size === 'sm' ? 'px-3.5 py-2 text-[13px]' : 'px-[18px] py-[11px] text-sm';
  const variants =
    variant === 'primary'
      ? 'bg-ink text-white hover:bg-[#333333]'
      : 'bg-surface text-ink border border-line hover:border-line-2';
  return (
    <a href={href} className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
      {kbd ? <Kbd dark={variant === 'primary'}>{kbd}</Kbd> : null}
    </a>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{children}</div>;
}

/** Section headline. Strix uses a large, regular-weight sans; the contrast comes from size, not weight. */
export function H2({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`mt-3.5 mb-4 text-[clamp(34px,4.6vw,52px)] font-normal leading-[1.08] tracking-[-0.03em] text-ink text-balance ${className}`}>
      {children}
    </h2>
  );
}

export function Em({ children }: { children: ReactNode }) {
  return <span className="text-muted">{children}</span>;
}

export function Lede({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`max-w-[58ch] text-[17px] leading-[1.55] text-muted ${className}`}>{children}</p>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-7 transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
  );
}

/** Strix's lit slab. Sections that want to read as one object go inside. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel px-6 py-14 md:px-14 md:py-20 ${className}`}>{children}</div>;
}

/* Small line icons for feature cards. 20px, 1.5 stroke, the same family Strix uses. */
const PATHS = {
  flag: 'M5 21V4m0 0h10l-2 3.5L15 11H5',
  percent: 'M19 5 5 19M7.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  undo: 'M4 10h11a5 5 0 0 1 0 10h-3M4 10l4-4M4 10l4 4',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  list: 'M4 6h16M4 12h16M4 18h10',
  hash: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16',
  bolt: 'M13 3 4 14h7l-1 7 9-11h-7l1-7Z',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z',
  code: 'm8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14',
  terminal: 'm5 8 4 4-4 4M11 16h8',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5Zm0 16h16',
  rocket: 'M5 15l-1 4 4-1M9 15l-4-4c2-5 6-8 12-8-0 6-3 10-8 12ZM14 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  python: 'M12 3c-4 0-4 2-4 3v2h5v1H6c-1 0-3 1-3 4s2 4 3 4h2v-2c0-2 1-3 3-3h5c1 0 2-1 2-2V6c0-2-2-3-6-3Zm-2 2.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5ZM16 9v2c0 2-1 3-3 3H8c-1 0-2 1-2 2v2c0 2 2 3 6 3s6-1 6-3v-2h-5v-1h7c1 0 3-1 3-4s-2-4-3-4h-4Zm-2 9.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z',
  js: 'M4 4h16v16H4zM9 12v5a2 2 0 0 1-4 0M16 11.5c-2 0-2.5 1-2.5 1.5 0 2 4 1 4 3 0 1-1 1.5-2 1.5s-2-.5-2-1.5',
  api: 'M4 12h4m8 0h4M8 12a4 4 0 0 1 8 0 4 4 0 0 1-8 0Z',
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Check() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="mt-1 size-3.5 flex-none" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="#111" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[22px]" aria-hidden="true">
      <path d="M5 3v18" stroke="#111" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M5 4h11.5l-2.5 4 2.5 4H5" stroke="#111" strokeWidth="1.75" strokeLinejoin="round" fill="#111" />
    </svg>
  );
}
