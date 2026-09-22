'use client';

import { useState } from 'react';
import { REPO } from './Nav';
import { Reveal } from './Reveal';
import { Icon } from './ui';

const INSTALL = 'npm install -g @flagrship/cli';

function InstallBox() {
  const [label, setLabel] = useState('Copy');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL);
      setLabel('Copied');
    } catch {
      setLabel('Select to copy');
    }
    setTimeout(() => setLabel('Copy'), 1600);
  };
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2 sm:flex-row">
      <div className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 font-mono text-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <span className="text-muted-2">$</span>
        <span className="truncate text-ink">{INSTALL}</span>
        <button type="button" onClick={copy} className="ml-auto text-xs text-muted hover:text-ink">
          {label}
        </button>
      </div>
      <a href="#try" className="inline-flex items-center justify-center rounded-xl bg-ink px-6 py-3.5 text-sm font-medium text-white hover:bg-[#333]">
        Get started
      </a>
    </div>
  );
}

const WORKS_WITH: Array<[string, string]> = [
  ['npm', '@flagrship/cli · @flagrship/sdk'],
  ['pip', 'flagrship-sdk'],
  ['node', '18 and newer'],
  ['python', '3.9 and newer'],
  ['api', 'REST · any language'],
];

export function Hero() {
  return (
    <header className="relative overflow-hidden pt-24 pb-16 md:pt-32">
      {/* Strix's radial bloom behind the headline, in our warm palette. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.9),rgba(255,255,255,0))]"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-[1120px] px-6 text-center">
        <Reveal>
          <h1 className="mx-auto max-w-[18ch] text-[clamp(42px,6.4vw,76px)] font-normal leading-[1.06] tracking-[-0.035em] text-ink text-balance">
            Ship without
            <br />
            a release.
          </h1>
        </Reveal>
        <Reveal index={1}>
          <p className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-[1.55] text-muted md:text-[19px]">
            Feature flags from the terminal. Deploy dark, roll out by percentage, roll back in one command.
          </p>
        </Reveal>
        <Reveal index={2} className="mt-10">
          <InstallBox />
        </Reveal>

        <Reveal index={3} className="mt-20">
          <p className="text-sm text-muted">Available today</p>
          <div className="mx-auto mt-7 flex max-w-[900px] flex-wrap justify-center gap-x-12 gap-y-6">
            {WORKS_WITH.map(([name, detail]) => (
              <div key={name} className="flex items-center gap-2.5">
                <span className="font-mono text-[15px] font-medium text-ink">{name}</span>
                <span className="text-[13px] text-muted-2">{detail}</span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal index={4} className="mt-16">
          <a href={REPO} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-medium text-ink hover:border-line-2">
            <Icon name="code" className="size-4 text-muted" />
            Flagrship is open source
            <span className="text-muted">·</span>
            <span className="text-muted">CLI and SDKs, MIT</span>
          </a>
        </Reveal>
      </div>
    </header>
  );
}
