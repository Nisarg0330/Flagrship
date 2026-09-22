'use client';

import { useState, type ReactNode } from 'react';

/** Strix's pill tabs. Renders the active panel only; panels are cheap static markup. */
export function Tabs({ items, variant = 'pill' }: { items: Array<{ label: ReactNode; panel: ReactNode }>; variant?: 'pill' | 'underline' }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className={variant === 'pill' ? 'grid gap-3 sm:grid-cols-3' : 'flex gap-5 border-b border-line'} role="tablist">
        {items.map((it, k) => {
          const on = k === i;
          const cls =
            variant === 'pill'
              ? `flex items-center gap-3 rounded-xl border px-5 py-4 text-left text-sm font-medium transition-colors ${on ? 'border-ink bg-surface text-ink' : 'border-line bg-surface/60 text-muted hover:text-ink'}`
              : `-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${on ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setI(k)} className={cls}>
              {it.label}
            </button>
          );
        })}
      </div>
      <div className="mt-5" role="tabpanel">
        {items[i].panel}
      </div>
    </div>
  );
}
