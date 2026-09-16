import type { ReactNode } from 'react';

export type Lang = 'shell' | 'ts' | 'py' | 'log' | 'css' | 'json';

type Rule = [RegExp, string];

/**
 * Tailwind-docs style code window: dark surface, three dots, line numbers,
 * syntax colour. The snippets on this page are ours and fixed, so a handful
 * of regex rules per language does the job of a highlighting library.
 */
const RULES: Record<Lang, Rule[]> = {
  shell: [
    [/^\$ /, 'text-code-line select-none'],
    [/✓/, 'text-code-ok'],
    [/error:/, 'text-code-err'],
    [/"[^"]*"/, 'text-code-str'],
    [/--[a-z-]+/, 'text-code-fn'],
    [/\bOFF\b/, 'text-code-err'],
    [/\bON\b|\bLOCKED\b/, 'text-code-ok'],
    [/\b\d+%/, 'text-code-num'],
    [/(?<=^\$ )flagrship\b/, 'text-code-kw'],
  ],
  ts: [
    [/\/\/.*$/, 'text-code-cmt italic'],
    [/'[^']*'|"[^"]*"/, 'text-code-str'],
    [/\b(import|from|const|new|await|if|return|export)\b/, 'text-code-kw'],
    [/\b[A-Za-z_]\w*(?=\()/, 'text-code-fn'],
    [/\b[A-Z][A-Z_]+\b/, 'text-code-fn'],
    [/\b\d+\b/, 'text-code-num'],
  ],
  py: [
    [/#.*$/, 'text-code-cmt italic'],
    [/'[^']*'|"[^"]*"/, 'text-code-str'],
    [/\b(from|import|if|return|def|with|as)\b/, 'text-code-kw'],
    [/\b[A-Za-z_]\w*(?=\()/, 'text-code-fn'],
    [/\b[A-Z][A-Z_]+\b/, 'text-code-fn'],
    [/\b\d+\b/, 'text-code-num'],
  ],
  log: [
    [/^\d\d:\d\d:\d\d/, 'text-code-line'],
    [/↻ config updated/, 'text-code-cmt'],
    [/← changed/, 'text-code-num'],
    [/\btrue\b/, 'text-code-ok'],
    [/\bfalse\b/, 'text-code-err'],
    [/\(\d+%\)/, 'text-code-cmt'],
  ],
  json: [
    [/"[^"]*"(?=\s*:)/, 'text-code-fn'],
    [/"[^"]*"/, 'text-code-str'],
    [/\b(true|false|null)\b/, 'text-code-kw'],
    [/-?\b\d+(\.\d+)?\b/, 'text-code-num'],
  ],
  css: [
    [/\/\*.*?\*\//, 'text-code-cmt italic'],
    [/@[a-z]+/, 'text-code-kw'],
    [/--[a-z0-9-]+/, 'text-code-fn'],
    [/"[^"]*"/, 'text-code-str'],
    [/\b(oklch|var)\b/, 'text-code-kw'],
    [/#[0-9a-f]{3,8}\b|\b\d+(\.\d+)?(rem|px|%)?\b/, 'text-code-num'],
  ],
};

function tokenize(line: string, rules: Rule[]): ReactNode[] {
  // Each rule becomes exactly one capture group, so the index of the group
  // that matched is the index of the rule. Any groups inside a rule are made
  // non-capturing first, or they would shift the indices.
  const combined = new RegExp(
    rules.map(([r]) => `(${r.source.replace(/\((?!\?)/g, '(?:')})`).join('|'),
    'gm',
  );
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of line.matchAll(combined)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(line.slice(last, idx));
    const which = m.slice(1).findIndex((g) => g !== undefined);
    out.push(
      <span key={key++} className={rules[which][1]}>
        {m[0]}
      </span>,
    );
    last = idx + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeBlock({
  code,
  lang,
  title,
  highlight = [],
  numbers = true,
  className = '',
}: {
  code: string;
  lang: Lang;
  title?: string;
  /** 1-based line numbers to tint */
  highlight?: number[];
  numbers?: boolean;
  className?: string;
}) {
  const lines = code.replace(/\n$/, '').split('\n');
  const rules = RULES[lang];

  return (
    <div className={`overflow-hidden rounded-xl bg-code text-code-fg shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-16px_rgba(0,0,0,0.25)] ${className}`}>
      <div className="flex items-center gap-1.5 px-4 py-3">
        <i className="block size-2.5 rounded-full bg-code-dot" />
        <i className="block size-2.5 rounded-full bg-code-dot" />
        <i className="block size-2.5 rounded-full bg-code-dot" />
        {title ? <span className="ml-3 font-mono text-[11px] text-code-line">{title}</span> : null}
      </div>
      <pre className="overflow-x-auto px-4 pb-5 pt-1 font-mono text-[13px] leading-[1.75]">
        <code>
          {lines.map((line, i) => (
            <div
              key={i}
              className={`grid ${numbers ? 'grid-cols-[2.25rem_1fr]' : 'grid-cols-1'} ${
                highlight.includes(i + 1) ? 'bg-white/[0.04]' : ''
              } -mx-4 px-4`}
            >
              {numbers ? <span className="select-none text-code-line">{i + 1}</span> : null}
              <span className="whitespace-pre">{tokenize(line, rules)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
