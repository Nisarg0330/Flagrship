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

export function Button({
  href,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
}: {
  href: string;
  variant?: 'primary' | 'ghost';
  size?: 'md' | 'sm';
  children: ReactNode;
  className?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[background-color,transform,border-color] duration-200 active:scale-[0.98]';
  const sizes = size === 'sm' ? 'px-3.5 py-2 text-[13px]' : 'px-[18px] py-[11px] text-sm';
  const variants =
    variant === 'primary'
      ? 'bg-ink text-white hover:bg-[#333333]'
      : 'bg-surface text-ink border border-line hover:border-[#d6d6d6]';
  return (
    <a href={href} className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
    </a>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{children}</div>;
}

export function H2({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`mt-3.5 mb-4 font-serif text-[clamp(32px,4.4vw,48px)] leading-[1.1] tracking-[-0.025em] text-ink text-balance ${className}`}>
      {children}
    </h2>
  );
}

export function Em({ children }: { children: ReactNode }) {
  return <em className="italic text-muted">{children}</em>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-7 transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${className}`}>
      {children}
    </div>
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
