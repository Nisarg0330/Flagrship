import { CodeBlock } from './CodeBlock';
import { Reveal } from './Reveal';
import { Button, Card, Check, Em, Eyebrow, H2, Logo, Tag } from './ui';

const wrap = 'mx-auto max-w-[1120px] px-6';

/* ── nav ─────────────────────────────────────────────────────────────────── */

export function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-canvas/80 backdrop-blur-[14px]">
      <div className={`${wrap} flex h-[60px] items-center justify-between`}>
        <a href="#" className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-ink">
          <Logo />
          Flagrship
        </a>
        <div className="hidden gap-7 text-sm text-muted md:flex">
          {[
            ['#loop', 'How it works'],
            ['#sdk', 'SDKs'],
            ['#pricing', 'Pricing'],
            ['#faq', 'FAQ'],
            ['/docs', 'Docs'],
          ].map(([href, label]) => (
            <a key={label} href={href} className="hover:text-ink">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-[18px] text-sm">
          <a href="https://github.com/Nisarg0330/Flagrship" className="text-muted hover:text-ink">
            GitHub
          </a>
          <Button href="#try" size="sm">
            Get started
          </Button>
        </div>
      </div>
    </nav>
  );
}

/* ── the loop ─────────────────────────────────────────────────────────────── */

const TERMINAL = `$ flagrship create new-checkout
✓ Created new-checkout in staging — OFF
$ flagrship rollout new-checkout 25
✓ Rolled out new-checkout in staging — ON   25%
$ flagrship rollout new-checkout 100
✓ Rolled out new-checkout in staging — ON  100%
$ flagrship rollback new-checkout
✓ Rolled back new-checkout in staging — ON   25%`;

const APP_LOG = `19:38:24  isEnabled = false  (0%)
19:38:25  isEnabled = false  (0%)
  ↻ config updated
19:38:27  isEnabled = true   (100%)  ← changed
19:38:28  isEnabled = true   (100%)
  ↻ config updated
19:38:30  isEnabled = false  (0%)    ← changed`;

export function Loop() {
  return (
    <section id="loop" className="py-28">
      <div className={wrap}>
        <Reveal className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <H2>
            Three commands. <Em>One flag.</Em>
          </H2>
          <p className="mx-auto max-w-[56ch] text-[17px] text-muted">
            The flag is the release mechanism. Your code ships through CI as usual and does nothing until you say so.
          </p>
        </Reveal>

        <div className="dots mt-12 grid items-start gap-5 rounded-2xl p-2 md:grid-cols-[1.15fr_1fr] md:p-5">
          <Reveal index={1}>
            <CodeBlock code={TERMINAL} lang="shell" title="terminal" highlight={[7, 8]} />
            <p className="px-1 pt-3 text-[13px] text-muted">
              Every command is a single API call. Every call is audited with who, when, before and after.
            </p>
          </Reveal>
          <Reveal index={2}>
            <CodeBlock code={APP_LOG} lang="log" title="your application" numbers={false} />
            <p className="px-1 pt-3 text-[13px] text-muted">
              The SDK polls with <code className="font-mono text-[0.92em]">If-None-Match</code>. Unchanged config is a 304 and
              transfers nothing.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── try it ───────────────────────────────────────────────────────────────── */

// A real, read-only key to a real organization on the live API. It can list
// flags, read history, and drive the SDK. It cannot change anything - that is
// what the beta key is for.
export const DEMO_KEY = 'sk_read_9aY_NggYCzbqQe-tekXzbmojkqZfAr9J';

const TRY = `$ npm install -g @flagrship/cli
$ flagrship init \
    --key ${DEMO_KEY}
✓ Saved production key to .flagrship.json
$ flagrship list
KEY           STATE            NAME              CHANGED
checkout-v2   ON   50% LOCKED  Checkout v2       2h ago
new-pricing   OFF              New Pricing Page  2h ago
dark-mode     ON  100%         Dark Mode         2h ago
new-checkout  ON   25%         New Checkout      2h ago
$ flagrship log new-checkout
$ flagrship status checkout-v2`;

const TRY_SDK = `import { Flagrship, bucket } from '@flagrship/sdk';

const flags = new Flagrship({
  apiKey: '${DEMO_KEY}',
});
await flags.ready();

// new-checkout is at 25%. Which side are you on?
bucket('new-checkout', 'alice');           // 40 → out
bucket('new-checkout', 'carol');           // 1  → in
flags.isEnabled('new-checkout', 'carol');  // true
flags.isEnabled('dark-mode', 'anyone');    // true`;

export function TryIt() {
  return (
    <section id="try" className="pb-28">
      <div className={wrap}>
        <Reveal className="text-center">
          <Eyebrow>Try it in 60 seconds</Eyebrow>
          <H2>
            A real key. <Em>A real organization.</Em>
          </H2>
          <p className="mx-auto max-w-[58ch] text-[17px] text-muted">
            No signup. This key is read-only, so you can see everything and change nothing. Every line below runs
            against the live API right now.
          </p>
        </Reveal>

        <div className="dots mt-12 grid items-start gap-5 rounded-2xl p-2 md:grid-cols-2 md:p-5">
          <Reveal index={1}>
            <CodeBlock code={TRY} lang="shell" title="terminal" numbers={false} />
          </Reveal>
          <Reveal index={2}>
            <CodeBlock code={TRY_SDK} lang="ts" title="node" numbers={false} />
          </Reveal>
        </div>

        <Reveal index={3} className="mx-auto mt-8 flex max-w-[58ch] flex-col items-center gap-4 text-center">
          <p className="text-[15px] text-muted">
            Try <code className="font-mono text-[0.9em]">flagrship rollout new-checkout 100</code> and read the error. That
            is a scoped key doing its job. Want one that can flip flags?
          </p>
          <Button href="mailto:nisarg@flagrship.dev?subject=Flagrship%20beta%20key&body=Team%20size%3A%0ALanguage%3A%0AWhat%20we%27d%20flag%20first%3A">
            Ask for a beta key
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

/* ── bento ────────────────────────────────────────────────────────────────── */

const LOCK = `$ flagrship lock checkout-v2 --reason "CVE-2026-1234"
$ flagrship rollout checkout-v2 50
error: Flag "checkout-v2" is locked: CVE-2026-1234.
  An admin must unlock it first.`;

const AUDIT = [
  ['21s ago', 'rollback', '30% → 50%'],
  ['30s ago', 'rollout', '50% → 30%'],
  ['10m ago', 'unlocked', 'unlocked'],
  ['10m ago', 'locked', 'CVE-2026-1234'],
];

const USERS: Array<[string, number]> = [
  ['alice', 40],
  ['carol', 1],
  ['user-53', 49],
  ['user-29', 0],
];

function Ring({ pct }: { pct: number }) {
  const c = 2 * Math.PI * 44;
  return (
    <div className="relative size-[180px]" aria-label={`${pct} percent rollout`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="#EAEAEA" strokeWidth="6" />
        <circle cx="50" cy="50" r="44" fill="none" stroke="#111111" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="font-display font-semibold text-[40px] leading-none tracking-[-0.04em] text-ink">{pct}%</b>
        <span className="mt-1.5 text-[11px] uppercase tracking-[0.06em] text-muted">rollout</span>
      </div>
    </div>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="mt-[18px] mb-1.5 font-display font-semibold text-[56px] leading-none tracking-[-0.04em] text-ink">
      {value}
      <small className="ml-1.5 font-sans text-sm tracking-normal text-muted">{unit}</small>
    </div>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2 text-sm leading-[1.55] text-muted">{children}</p>
);
const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-3.5 text-[15px] font-semibold tracking-[-0.005em] text-ink">{children}</h3>
);

export function Bento() {
  const pct = 25;
  return (
    <section className="pb-28">
      <div className={wrap}>
        <Reveal>
          <Eyebrow>Built for on-call</Eyebrow>
          <H2>
            Deterministic, auditable, <Em>and fast enough to forget about.</Em>
          </H2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-3 md:row-span-2">
            <Card className="h-full">
              <Tag tone="sky">Deterministic rollouts</Tag>
              <H3>The same user gets the same answer. Every time, in every language.</H3>
              <P>
                Users are hashed into 100 buckets. Raising the percentage moves the threshold, never the user, so nobody
                flickers in and out of a cohort.
              </P>
              <div className="mt-7 grid items-center gap-7 sm:grid-cols-[180px_1fr]">
                <Ring pct={pct} />
                <div className="flex flex-col gap-2">
                  {USERS.map(([u, b]) => (
                    <div key={u} className="flex items-center justify-between gap-3 whitespace-nowrap rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-ink-2">
                      <span>
                        <span className="text-muted">{u}</span> · bucket {b}
                      </span>
                      <Tag tone={b < pct ? 'mint' : 'rose'}>{b < pct ? 'in' : 'out'}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal index={1} className="md:col-span-3">
            <Card>
              <Tag>Evaluation</Tag>
              <Stat value="< 1" unit="ms" />
              <P>In-memory lookup and a 32-bit hash. No network call per check, ever. The API is the control plane, never the hot path.</P>
            </Card>
          </Reveal>

          <Reveal index={2} className="md:col-span-3">
            <Card>
              <Tag>SDK size</Tag>
              <Stat value="2.1" unit="KB gzipped" />
              <P>Zero dependencies in JavaScript and Python. The hash is 40 lines you can read, and both SDKs pass the same conformance file.</P>
            </Card>
          </Reveal>

          <Reveal index={1} className="md:col-span-3">
            <Card>
              <Tag>Audit trail</Tag>
              <H3>Who changed what, and what it was before.</H3>
              <table className="mt-[18px] w-full border-collapse font-mono text-xs">
                <thead>
                  <tr>
                    {['WHEN', 'ACTION', 'CHANGE', 'BY'].map((h) => (
                      <th key={h} className="border-b border-line pb-2 pr-2.5 text-left text-[10px] font-medium tracking-[0.06em] text-muted-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AUDIT.map(([when, action, change]) => (
                    <tr key={when + action}>
                      <td className="border-b border-line py-2 pr-2.5 text-muted last:border-0">{when}</td>
                      <td className="border-b border-line py-2 pr-2.5 text-ink-2">{action}</td>
                      <td className="border-b border-line py-2 pr-2.5 text-ink-2">{change}</td>
                      <td className="border-b border-line py-2 pr-2.5 text-muted">nisarg@</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <P>Append-only. The audit row is written in the same transaction as the change, so there is no such thing as an unlogged mutation.</P>
            </Card>
          </Reveal>

          <Reveal index={2} className="md:col-span-3">
            <Card>
              <Tag tone="sand">Incidents</Tag>
              <H3>Lock a flag. Nobody can touch it until an admin says so.</H3>
              <CodeBlock code={LOCK} lang="shell" numbers={false} className="mt-[18px]" />
              <P>The vulnerable code stays deployed but dormant. Patch it on your own schedule.</P>
            </Card>
          </Reveal>

          <Reveal className="md:col-span-6">
            <Card>
              <div className="grid items-center gap-8 md:grid-cols-[1fr_1.4fr]">
                <div>
                  <Tag tone="mint">Cheap to poll</Tag>
                  <H3>3,600 polls an hour, and only the first one carries a body.</H3>
                  <P>
                    Every response has an ETag. The SDK sends it back on the next poll; if nothing changed, the API answers
                    304 with an empty body. Flag config crosses the wire once, then only when you change it.
                  </P>
                </div>
                <div className="flex flex-col gap-2 font-mono text-xs">
                  {[
                    ['200', 100, '3.8 KB'],
                    ['304', 0, '0 B'],
                    ['304', 0, '0 B'],
                    ['304', 0, '0 B'],
                    ['304', 0, '0 B'],
                  ].map(([st, w, label], i) => (
                    <div key={i} className="grid grid-cols-[52px_1fr_60px] items-center gap-3">
                      <span className="text-muted">{st}</span>
                      <div className="relative h-1.5 overflow-hidden rounded-[3px] bg-line">
                        <i className="absolute inset-y-0 left-0 rounded-[3px] bg-ink" style={{ width: w ? `${w}%` : '2px' }} />
                      </div>
                      <span className="text-muted">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── sdk ──────────────────────────────────────────────────────────────────── */

const TS = `import { Flagrship } from '@flagrship/sdk';

const flags = new Flagrship({
  apiKey: process.env.FLAGRSHIP_KEY,
});
await flags.ready();

if (flags.isEnabled('new-checkout', user.id)) {
  showNewCheckout();
}`;

const PY = `from flagrship import Flagrship

flags = Flagrship(api_key=os.environ["FLAGRSHIP_KEY"])
flags.ready()

if flags.is_enabled("new-checkout", user.id):
    show_new_checkout()`;

export function Sdk() {
  return (
    <section id="sdk" className="pb-28">
      <div className={wrap}>
        <Reveal className="text-center">
          <Eyebrow>SDKs</Eyebrow>
          <H2>
            A handful of lines. <Em>Same behaviour in every language.</Em>
          </H2>
          <p className="mx-auto max-w-[56ch] text-[17px] text-muted">
            Initialise once at boot. If Flagrship is unreachable, your app keeps its last config and never blocks on us.
          </p>
        </Reveal>
        <div className="dots mt-12 grid gap-5 rounded-2xl p-2 md:grid-cols-2 md:p-5">
          <Reveal index={1}>
            <CodeBlock code={TS} lang="ts" title="app.ts" />
          </Reveal>
          <Reveal index={2}>
            <CodeBlock code={PY} lang="py" title="app.py" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── pricing ──────────────────────────────────────────────────────────────── */

const PLANS = [
  {
    tone: 'neutral' as const,
    name: 'Free',
    price: '$0',
    unit: '',
    blurb: 'For side projects and small teams. Permanent, not a trial.',
    items: ['10 flags, 3 environments, 3 seats', 'JavaScript and Python SDKs', 'Percentage rollouts, rollback, lock', '7 days of audit history'],
    cta: 'Start free',
    href: '#try',
    primary: false,
  },
  {
    tone: 'mint' as const,
    name: 'Pro',
    price: '$29',
    unit: ' / seat / month',
    blurb: 'For teams that ship every day and want to know who flipped what.',
    items: ['Unlimited flags, environments, seats', 'Attribute-based targeting', '90 days of audit history', 'Google and GitHub sign-in, email support'],
    cta: 'Start Pro',
    href: 'mailto:nisarg@flagrship.dev?subject=Flagrship%20Pro',
    primary: true,
  },
  {
    tone: 'neutral' as const,
    name: 'Enterprise',
    price: 'Custom',
    unit: '',
    blurb: 'For compliance requirements and a named person to call.',
    items: ['SAML and OIDC single sign-on', 'Unlimited audit retention and export', 'Data residency: US, EU, Canada', '99.95% SLA, dedicated support'],
    cta: 'Talk to us',
    href: 'mailto:nisarg@flagrship.dev?subject=Flagrship%20Enterprise',
    primary: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="pb-28">
      <div className={wrap}>
        <Reveal className="text-center">
          <Eyebrow>Pricing</Eyebrow>
          <H2>
            Per seat. <Em>Never per user.</Em>
          </H2>
          <p className="mx-auto max-w-[56ch] text-[17px] text-muted">No MAU meter. Your bill does not grow because your product did.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} index={i}>
              <Card className={`flex h-full flex-col ${p.primary ? 'border-ink' : ''}`}>
                <Tag tone={p.tone}>{p.name}</Tag>
                <div className="mt-3.5 mb-0.5 font-display font-semibold text-[44px] leading-none tracking-[-0.04em] text-ink">
                  {p.price}
                  {p.unit ? <small className="font-sans text-[13px] tracking-normal text-muted">{p.unit}</small> : null}
                </div>
                <P>{p.blurb}</P>
                <ul className="my-[22px] mb-[26px] flex flex-col gap-[9px] text-sm text-ink-2">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2.5">
                      <Check />
                      {it}
                    </li>
                  ))}
                </ul>
                <Button href={p.href} variant={p.primary ? 'primary' : 'ghost'} className="mt-auto w-full">
                  {p.cta}
                </Button>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── faq ──────────────────────────────────────────────────────────────────── */

const FAQ = [
  ['Does Flagrship see my users?', 'No. The user ID is hashed inside the SDK, on your servers. The API has no endpoint that accepts a user identifier, so there is nothing to leak and nothing to store.'],
  ['What happens if Flagrship is down?', 'Your application keeps serving the last config it received. If it never received one, flags evaluate to the defaults you wrote in code. The SDK never throws on your boot path and never makes a network call per evaluation.'],
  ['How is rollback different from a git revert?', 'A revert is a new commit, a CI run, and a deploy, which is 15 to 60 minutes and several people. Rollback is one API call that restores the previous flag state, and every SDK picks it up within one poll. It is an undo: run it twice and you are back where you started.'],
  ['Why the CLI and not a dashboard?', 'Engineers live in the terminal, and a flag change is a one-line command there. The dashboard is coming for the people who do not, and it talks to the same API. Nothing you do in one is hidden from the other.'],
  ['Can I self-host it?', 'The CLI and both SDKs are open source. The hosted API is what you pay for. Self-hosting is on the list; tell us if it is the thing standing between you and trying it.'],
];

export function Faq() {
  return (
    <section id="faq" className="pb-28">
      <div className="mx-auto max-w-[880px] px-6">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
          <H2>The ones we get asked first.</H2>
        </Reveal>
        <Reveal index={1} className="mt-10 border-t border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-[22px] text-[17px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <span className="relative size-[18px] flex-none" aria-hidden="true">
                  <i className="absolute left-1/2 top-1/2 h-[1.5px] w-3.5 -translate-x-1/2 -translate-y-1/2 bg-ink" />
                  <i className="absolute left-1/2 top-1/2 h-3.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-ink transition-transform duration-200 group-open:scale-y-0" />
                </span>
              </summary>
              <div className="max-w-[64ch] pb-6 text-[15px] leading-[1.6] text-muted">{a}</div>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ── closing + footer ─────────────────────────────────────────────────────── */

export function Closing() {
  return (
    <section className="pb-28">
      <div className={wrap}>
        <Reveal>
          <Card className="px-10 py-14 text-center">
            <H2 className="mt-0">
              First flag live in <Em>five minutes.</Em>
            </H2>
            <p className="mx-auto max-w-[56ch] text-[17px] text-muted">
              Install the CLI, create a flag, add three lines to your app. No dashboard signup required to start.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href="#try">Install the CLI</Button>
              <Button href="/docs/quickstart" variant="ghost">
                Read the quickstart
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line py-10 text-[13px] text-muted">
      <div className={`${wrap} flex flex-wrap justify-between gap-5`}>
        <div>Flagrship · Ship without a release.</div>
        <div className="flex gap-7">
          {[
            ['Docs', '/docs'],
            ['GitHub', 'https://github.com/Nisarg0330/Flagrship'],
            ['Status', '#'],
            ['Privacy', '#'],
            ['nisarg@flagrship.dev', 'mailto:nisarg@flagrship.dev'],
          ].map(([l, href]) => (
            <a key={l} href={href} className="hover:text-ink">
              {l}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
