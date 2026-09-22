import { CodeBlock } from './CodeBlock';
import { REPO } from './Nav';
import { Reveal } from './Reveal';
import { Tabs } from './Tabs';
import { Button, Card, Check, Em, Eyebrow, H2, Icon, Lede, Panel, Tag, type IconName } from './ui';

const wrap = 'mx-auto max-w-[1120px] px-6';

/* ── product mockups ──────────────────────────────────────────────────────── */

/** A small "app window" for the mockups inside feature columns. */
function Window({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
        <span className="size-2 rounded-full bg-line-2" />
        <span className="size-2 rounded-full bg-line-2" />
        <span className="size-2 rounded-full bg-line-2" />
        <span className="ml-2 font-mono text-[11px] text-muted-2">{title}</span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

const FLAGS: Array<[string, 'on' | 'off' | 'lock', string, string]> = [
  ['checkout-v2', 'lock', '50%', '2h ago'],
  ['new-pricing', 'off', '—', '2h ago'],
  ['dark-mode', 'on', '100%', '1d ago'],
  ['new-checkout', 'on', '25%', '3m ago'],
];

function FlagTable() {
  return (
    <table className="w-full border-collapse font-mono text-[11px]">
      <thead>
        <tr className="text-[9px] tracking-[0.08em] text-muted-2">
          {['FLAG', 'STATE', 'ROLLOUT', 'CHANGED'].map((h) => (
            <th key={h} className="pb-2 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {FLAGS.map(([k, s, r, t]) => (
          <tr key={k} className="border-t border-line">
            <td className="py-2 text-ink">{k}</td>
            <td className="py-2">
              <span className="inline-flex items-center gap-1.5">
                <i className={`size-1.5 rounded-full ${s === 'off' ? 'bg-muted-2' : s === 'lock' ? 'bg-sand-700' : 'bg-mint-700'}`} />
                {s === 'lock' ? 'locked' : s}
              </span>
            </td>
            <td className="py-2 text-ink-2">{r}</td>
            <td className="py-2 text-muted">{t}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SdkCard() {
  return (
    <div className="font-mono text-[11px] leading-[1.7]">
      <div className="mb-2 flex items-center gap-2 text-[10px] text-muted-2">
        <span className="rounded border border-line px-1.5 py-0.5">app.ts</span>
        <span className="rounded border border-line px-1.5 py-0.5">app.py</span>
      </div>
      <div className="text-ink-2">
        <span className="text-sky-700">const</span> on = flags.<span className="text-ink">isEnabled</span>(
        <br />
        &nbsp;&nbsp;<span className="text-mint-700">&apos;new-checkout&apos;</span>, user.id
        <br />
        );
      </div>
      <div className="mt-2.5 rounded-lg border border-line bg-surface-2 p-2.5 text-[10px] text-muted">
        <div className="flex justify-between"><span>alice</span><span>bucket 40 · <b className="text-rose-700">out</b></span></div>
        <div className="flex justify-between"><span>carol</span><span>bucket 1 · <b className="text-mint-700">in</b></span></div>
        <div className="flex justify-between"><span>user-29</span><span>bucket 0 · <b className="text-mint-700">in</b></span></div>
      </div>
    </div>
  );
}

const AUDIT: Array<[string, string, string]> = [
  ['21s ago', 'rollback', '30% → 50%'],
  ['30s ago', 'rollout', '50% → 30%'],
  ['10m ago', 'unlock', 'checkout-v2'],
  ['10m ago', 'lock', 'CVE-2026-1234'],
];

function AuditTable() {
  return (
    <table className="w-full border-collapse font-mono text-[11px]">
      <thead>
        <tr className="text-[9px] tracking-[0.08em] text-muted-2">
          {['WHEN', 'ACTION', 'CHANGE'].map((h) => (
            <th key={h} className="pb-2 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {AUDIT.map(([w, a, c]) => (
          <tr key={w + a} className="border-t border-line">
            <td className="py-2 text-muted">{w}</td>
            <td className="py-2 text-ink">{a}</td>
            <td className="py-2 text-ink-2">{c}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── platform: three columns in a panel ───────────────────────────────────── */

const COLUMNS: Array<{ title: string; body: string; window: string; mock: React.ReactNode; tags: string[] }> = [
  { title: 'CLI', body: 'Create, roll out, lock and roll back from the terminal. Every command is one API call, and every call is audited.', window: 'flagrship list', mock: <FlagTable />, tags: ['npm', 'brew soon'] },
  { title: 'SDKs', body: 'JavaScript and Python. In-memory evaluation, no network call per check, the same bucket for the same user in both.', window: 'evaluate', mock: <SdkCard />, tags: ['node', 'python'] },
  { title: 'Audit & locks', body: 'Who changed what, and what it was before. Lock a flag with a reason and nobody moves it until an admin says so.', window: 'flagrship log', mock: <AuditTable />, tags: ['append-only'] },
];

export function Platform() {
  return (
    <section id="features" className="py-16 md:py-24">
      <div className={wrap}>
        <Panel>
          <Reveal className="text-center">
            <H2 className="mt-0">One flag. Every surface.</H2>
            <Lede className="mx-auto">The terminal, your code and the audit log all talk to one API. Nothing you do in one is hidden from the others.</Lede>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {COLUMNS.map((c, i) => (
              <Reveal key={c.title} index={i + 1} className="flex flex-col">
                <Window title={c.window}>{c.mock}</Window>
                <h3 className="mt-7 text-[22px] font-medium tracking-[-0.02em] text-ink">{c.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-muted">{c.body}</p>
                <div className="mt-4 flex gap-2 font-mono text-[11px] text-muted-2">
                  {c.tags.map((t) => (
                    <span key={t} className="rounded border border-line px-1.5 py-0.5">{t}</span>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

/* ── incident → rollback ──────────────────────────────────────────────────── */

const ROLLBACK = `$ flagrship status new-checkout
new-checkout  ON  100%  production  changed 4m ago by ci@
$ flagrship rollback new-checkout
✓ Rolled back new-checkout in production — ON   25%
$ flagrship log new-checkout --limit 2
21s ago  rollback  100% → 25%   nisarg@
4m ago   rollout    25% → 100%  ci@`;

const LOCK = `$ flagrship lock checkout-v2 --reason "CVE-2026-1234"
✓ Locked checkout-v2 in production
$ flagrship rollout checkout-v2 100
error: Flag "checkout-v2" is locked: CVE-2026-1234.
  An admin must unlock it first.`;

function FlagDetail() {
  return (
    <Card className="h-full p-6">
      <div className="font-mono text-[11px] text-muted-2">flags / checkout-v2</div>
      <h3 className="mt-2 text-[18px] font-medium tracking-[-0.01em] text-ink">Checkout v2</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <Tag tone="mint">on · 50%</Tag>
        <Tag tone="sand">locked</Tag>
        <Tag>production</Tag>
      </div>
      <dl className="mt-6 grid grid-cols-[110px_1fr] gap-y-3 text-[13px]">
        <dt className="text-muted">Lock reason</dt>
        <dd className="font-mono text-ink">CVE-2026-1234</dd>
        <dt className="text-muted">Locked by</dt>
        <dd className="text-ink-2">nisarg@ · 10m ago</dd>
        <dt className="text-muted">Last change</dt>
        <dd className="text-ink-2">rollout 30% → 50% · 21s ago</dd>
        <dt className="text-muted">Evaluations</dt>
        <dd className="text-ink-2">in-memory, 0 network calls</dd>
      </dl>
      <div className="mt-6 border-t border-line pt-4 text-[13px] leading-[1.6] text-muted">
        While locked, every mutation on this flag returns <span className="font-mono text-ink">409</span> with the reason. Archive is refused in every environment.
      </div>
    </Card>
  );
}

const PAIR: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'percent', title: 'Roll out by percentage', body: 'Users hash into 100 buckets. Raising the number moves the threshold, never the user, so nobody flickers between cohorts.' },
  { icon: 'undo', title: 'Roll back, one command', body: 'Rollback is an undo. It restores the state before the last change and logs itself, so a second rollback undoes the first.' },
];

export function Incident() {
  return (
    <section className="py-16 md:py-24">
      <div className={wrap}>
        <Reveal>
          <H2 className="mt-0">From incident to rollback in seconds</H2>
          <Lede>No redeploy, no hotfix branch, no 3am revert. The vulnerable code stays deployed but dormant.</Lede>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-[1fr_1.3fr]">
          <Reveal index={1}>
            <FlagDetail />
          </Reveal>
          <Reveal index={2}>
            <Card className="h-full p-6">
              <Tabs
                variant="underline"
                items={[
                  { label: 'Rollback', panel: <CodeBlock code={ROLLBACK} lang="shell" numbers={false} /> },
                  { label: 'Lock', panel: <CodeBlock code={LOCK} lang="shell" numbers={false} /> },
                ]}
              />
            </Card>
          </Reveal>
        </div>
        <div className="mt-16 grid gap-10 md:grid-cols-2">
          {PAIR.map((f, i) => (
            <Reveal key={f.title} index={i + 1}>
              <Icon name={f.icon} className="size-5 text-ink" />
              <h3 className="mt-4 text-[22px] font-medium tracking-[-0.02em] text-ink">{f.title}</h3>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-[1.6] text-muted">{f.body}</p>
            </Reveal>
          ))}
        </div>
        <Reveal index={3} className="mt-14 text-center">
          <Button href="#try" variant="ghost">
            Try free →
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

/* ── deploy with confidence: six cards in a panel ─────────────────────────── */

const SIX: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'list', title: 'Every change audited', body: 'The audit row is written in the same transaction as the change. There is no such thing as an unlogged mutation.' },
  { icon: 'lock', title: 'Locks stop bad rollouts', body: 'An admin locks a flag with a reason. Every mutation returns 409 with that reason until it is unlocked.' },
  { icon: 'hash', title: 'Same answer in every SDK', body: 'MurmurHash3 over flagKey:userId. Node and Python pass one shared conformance file, so a user never flips between services.' },
  { icon: 'shield', title: 'Never sees your users', body: 'Bucketing runs inside the SDK. The API has no endpoint that accepts a user ID, so there is nothing to leak.' },
  { icon: 'bolt', title: '304s, not bandwidth', body: 'Every config has an ETag. Unchanged polls return 304 with an empty body. Config crosses the wire once, then only when you change it.' },
  { icon: 'flag', title: 'Never blocks your boot', body: 'If Flagrship is unreachable the SDK keeps its last config or your in-code defaults. It never throws on the boot path.' },
];

export function Confidence() {
  return (
    <section className="py-16 md:py-24">
      <div className={wrap}>
        <Panel>
          <Reveal>
            <H2 className="mt-0">Deploy with confidence</H2>
            <Lede>Six rules the API enforces so you do not have to remember them at 3am.</Lede>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {SIX.map((f, i) => (
              <Reveal key={f.title} index={(i % 3) + 1}>
                <Card className="h-full p-6">
                  <Icon name={f.icon} className="size-5 text-ink" />
                  <h3 className="mt-5 text-[17px] font-medium tracking-[-0.01em] text-ink">{f.title}</h3>
                  <p className="mt-2 text-[14px] leading-[1.6] text-muted">{f.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 flex flex-wrap gap-3">
            <Button href="#try">Get started</Button>
            <Button href="/docs/concepts/" variant="ghost">
              Read the concepts →
            </Button>
          </Reveal>
        </Panel>
      </div>
    </section>
  );
}

/* ── try it: the big tabbed window ────────────────────────────────────────── */

// A real, read-only key to a real organization on the live API. It can list
// flags, read history, and drive the SDK. It cannot change anything - that is
// what the beta key is for.
export const DEMO_KEY = 'sk_read_9aY_NggYCzbqQe-tekXzbmojkqZfAr9J';

const TRY_CLI = `$ npm install -g @flagrship/cli
$ flagrship init --key ${DEMO_KEY}
✓ Saved production key to .flagrship.json
$ flagrship list
KEY           STATE            NAME              CHANGED
checkout-v2   ON   50% LOCKED  Checkout v2       2h ago
new-pricing   OFF              New Pricing Page  2h ago
dark-mode     ON  100%         Dark Mode         2h ago
new-checkout  ON   25%         New Checkout      2h ago
$ flagrship log new-checkout
$ flagrship rollout new-checkout 100
error: this key has scope "read"; rollout needs "write".`;

const TRY_JS = `import { Flagrship, bucket } from '@flagrship/sdk';

const flags = new Flagrship({
  apiKey: '${DEMO_KEY}',
});
await flags.ready();

// new-checkout is at 25%. Which side are you on?
bucket('new-checkout', 'alice');           // 40 → out
bucket('new-checkout', 'carol');           // 1  → in
flags.isEnabled('new-checkout', 'carol');  // true
flags.isEnabled('dark-mode', 'anyone');    // true`;

const TRY_PY = `from flagrship import Flagrship, bucket

flags = Flagrship(api_key="${DEMO_KEY}")
flags.ready()

# Same hash, same buckets, same answers as Node.
bucket("new-checkout", "alice")            # 40 → out
bucket("new-checkout", "carol")            # 1  → in
flags.is_enabled("new-checkout", "carol")  # True
flags.is_enabled("dark-mode", "anyone")    # True`;

const pill = (icon: IconName, label: string) => (
  <>
    <Icon name={icon} className="size-4" />
    {label}
  </>
);

export function TryIt() {
  return (
    <section id="try" className="scroll-mt-16 py-16 md:py-24">
      <div className={wrap}>
        <Reveal className="text-center">
          <H2 className="mt-0">Ship fast without a release</H2>
          <Lede className="mx-auto">
            A real key to a real organization on the live API. Read-only, no signup. Every line below runs right now.
          </Lede>
        </Reveal>
        <Reveal index={1} className="mt-12">
          <Tabs
            items={[
              { label: pill('terminal', 'CLI'), panel: <CodeBlock code={TRY_CLI} lang="shell" title="terminal" numbers={false} /> },
              { label: pill('js', 'JavaScript'), panel: <CodeBlock code={TRY_JS} lang="ts" title="app.ts" /> },
              { label: pill('python', 'Python'), panel: <CodeBlock code={TRY_PY} lang="py" title="app.py" /> },
            ]}
          />
        </Reveal>
        <Reveal index={2} className="mx-auto mt-10 flex max-w-[58ch] flex-col items-center gap-4 text-center">
          <p className="text-[15px] text-muted">
            The last CLI line is a scoped key doing its job. Want one that can flip flags?
          </p>
          <Button href="mailto:nisarg@flagrship.dev?subject=Flagrship%20beta%20key&body=Team%20size%3A%0ALanguage%3A%0AWhat%20we%27d%20flag%20first%3A">
            Ask for a beta key
          </Button>
        </Reveal>
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
    <section id="pricing" className="py-16 md:py-24">
      <div className={wrap}>
        <Reveal className="text-center">
          <Eyebrow>Pricing</Eyebrow>
          <H2>
            Per seat. <Em>Never per user.</Em>
          </H2>
          <Lede className="mx-auto">No MAU meter. Your bill does not grow because your product did.</Lede>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} index={i}>
              <Card className={`flex h-full flex-col ${p.primary ? 'border-ink' : ''}`}>
                <Tag tone={p.tone}>{p.name}</Tag>
                <div className="mt-4 mb-1 text-[44px] leading-none tracking-[-0.03em] text-ink">
                  {p.price}
                  {p.unit ? <small className="text-[13px] tracking-normal text-muted">{p.unit}</small> : null}
                </div>
                <p className="mt-2 text-sm leading-[1.55] text-muted">{p.blurb}</p>
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
    <section id="faq" className="py-16 md:py-24">
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
    <section className="py-24 md:py-36">
      <div className={`${wrap} text-center`}>
        <Reveal>
          <h2 className="text-[clamp(44px,7vw,84px)] font-normal leading-[1.02] tracking-[-0.04em] text-ink text-balance">Ship your first flag today</h2>
        </Reveal>
        <Reveal index={1}>
          <Lede className="mx-auto mt-6">Install the CLI, create a flag, add three lines to your app. Five minutes, no dashboard signup.</Lede>
        </Reveal>
        <Reveal index={2} className="mt-9 flex flex-wrap justify-center gap-3">
          <Button href="#try" kbd="S">
            Get started
          </Button>
          <Button href="/docs/quickstart/" variant="ghost" kbd="D">
            Read the docs
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

const FOOT = [
  ['Docs', '/docs/'],
  ['GitHub', REPO],
  ['npm', 'https://www.npmjs.com/package/@flagrship/cli'],
  ['PyPI', 'https://pypi.org/project/flagrship-sdk/'],
  ['nisarg@flagrship.dev', 'mailto:nisarg@flagrship.dev'],
];

export function Footer() {
  return (
    <footer className="border-t border-line py-10 text-[13px] text-muted">
      <div className={`${wrap} flex flex-wrap justify-between gap-5`}>
        <div>Flagrship · Ship without a release.</div>
        <div className="flex flex-wrap gap-7">
          {FOOT.map(([l, href]) => (
            <a key={l} href={href} className="hover:text-ink">
              {l}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
