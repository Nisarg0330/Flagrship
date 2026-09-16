'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Fade-and-lift on entering the viewport. IntersectionObserver, never a scroll listener. */
export function Reveal({
  children,
  index = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  /** stagger step; each step adds 80ms */
  index?: number;
  className?: string;
  as?: 'div' | 'section' | 'header' | 'span';
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('in');
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // @ts-expect-error - ref type varies with Tag; all are HTMLElement
    <Tag ref={ref} className={`reveal ${className}`} style={{ '--i': index } as React.CSSProperties}>
      {children}
    </Tag>
  );
}
