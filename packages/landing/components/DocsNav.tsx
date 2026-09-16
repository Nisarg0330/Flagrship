'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const DOCS = [
  { group: 'Start', items: [['/docs/quickstart', 'Quickstart'], ['/docs/concepts', 'Concepts']] },
  { group: 'Reference', items: [['/docs/cli', 'CLI'], ['/docs/sdk-js', 'JavaScript SDK'], ['/docs/sdk-python', 'Python SDK'], ['/docs/api', 'HTTP API']] },
] as const;

export function DocsNav() {
  const path = usePathname();
  return (
    <nav className="text-sm">
      {DOCS.map(({ group, items }) => (
        <div key={group} className="mb-7">
          <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-2">{group}</div>
          {items.map(([href, label]) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`block rounded-md px-3 py-1.5 transition-colors ${
                  active ? 'bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
