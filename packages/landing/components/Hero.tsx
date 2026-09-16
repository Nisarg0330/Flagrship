'use client';

import { useState } from 'react';
import { Reveal } from './Reveal';
import { Button, Tag } from './ui';

const INSTALL = 'npm install -g @flagrship/cli';

function Node({
  name,
  meta,
  side,
  off = false,
  className,
  delay,
}: {
  name: string;
  meta: string;
  side: 'left' | 'right';
  off?: boolean;
  className: string;
  delay?: string;
}) {
  const dot = (
    <i className={`size-[7px] flex-none rounded-full ${off ? 'border-[1.5px] border-muted-2 bg-transparent' : 'bg-ink'}`} />
  );
  const line = (
    <i className={`absolute top-1/2 h-px w-[90px] bg-line ${side === 'left' ? '-right-[100px]' : '-left-[100px]'}`} />
  );
  return (
    <div
      className={`float absolute hidden items-center gap-2 font-mono text-xs text-muted md:flex ${className}`}
      style={delay ? { animationDelay: delay } : undefined}
    >
      {side === 'left' ? dot : line}
      <div>
        <b className="font-medium text-ink">{name}</b>
        <br />
        {meta}
      </div>
      {side === 'left' ? line : dot}
    </div>
  );
}

function CopyButton() {
  const [label, setLabel] = useState('Copy');
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(INSTALL);
          setLabel('Copied');
        } catch {
          setLabel('Select to copy');
        }
        setTimeout(() => setLabel('Copy'), 1600);
      }}
      className="rounded border border-line bg-surface-2 px-2.5 py-1.5 font-sans text-xs text-muted hover:text-ink"
    >
      {label}
    </button>
  );
}

export function Hero() {
  return (
    <header className="relative pb-18 pt-24">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="relative isolate flex min-h-0 flex-col items-center justify-center text-center md:min-h-[520px]">
          <span className="hairline absolute inset-y-0 left-[38%] -z-10 hidden w-px md:block" aria-hidden="true" />
          <span className="hairline absolute inset-y-0 left-[62%] -z-10 hidden w-px md:block" aria-hidden="true" />

          <Node name="new-checkout" meta="staging · 25%" side="left" className="left-[8%] top-[6%]" />
          <Node name="dark-mode" meta="production · 100%" side="right" className="right-[9%] top-[12%]" delay="-3s" />
          <Node name="new-pricing" meta="production · off" side="left" off className="bottom-[14%] left-[6%]" delay="-5s" />
          <Node name="checkout-v2" meta="locked · CVE-2026-1234" side="right" className="bottom-[10%] right-[7%]" delay="-7s" />

          <Reveal>
            <Tag>Public beta · JavaScript and Python</Tag>
          </Reveal>
          <Reveal index={1}>
            <h1 className="mx-auto mt-[22px] mb-5 max-w-[16ch] font-serif text-[clamp(44px,7.2vw,88px)] leading-[1.05] tracking-[-0.03em] text-ink text-balance">
              Ship without <em className="italic text-muted">a release.</em>
            </h1>
          </Reveal>
          <Reveal index={2}>
            <p className="mx-auto max-w-[54ch] text-lg leading-[1.55] text-muted">
              Deploy code dark. Roll it out to 1% of users. Roll it back in one command, from the terminal, in seconds. No
              redeploy, no hotfix branch, no 3am revert.
            </p>
          </Reveal>
          <Reveal index={3} className="mt-[34px] flex flex-wrap justify-center gap-3">
            <Button href="#loop">Install the CLI</Button>
            <Button href="#" variant="ghost">
              Read the docs
            </Button>
          </Reveal>
          <Reveal index={4} className="mt-7 inline-flex items-center gap-3 rounded-md border border-line bg-surface py-2 pl-3.5 pr-2 font-mono text-[13px]">
            <span className="text-muted-2">$</span>
            <span className="text-ink">{INSTALL}</span>
            <CopyButton />
          </Reveal>
        </div>

        <Reveal className="mt-16 flex flex-wrap justify-center gap-9 text-[13px] text-muted-2">
          <span className="flex items-center gap-2"><span className="font-mono text-muted">npm</span> JavaScript · Node 18+</span>
          <span className="flex items-center gap-2"><span className="font-mono text-muted">pip</span> Python 3.9+</span>
          <span className="flex items-center gap-2"><span className="font-mono text-muted">brew</span> CLI</span>
          <span className="flex items-center gap-2"><span className="font-mono text-muted">go</span> planned</span>
        </Reveal>
      </div>
    </header>
  );
}
