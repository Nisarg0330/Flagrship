import { CodeBlock } from '@/components/CodeBlock';
import { Cards, H2, P, Table, Title, Ul } from '@/components/docs';

export const metadata = { title: 'Docs · Flagrship' };

const LOOP = `$ flagrship create new-checkout
✓ Created new-checkout in staging — OFF
$ flagrship rollout new-checkout 25
✓ Rolled out new-checkout in staging — ON   25%
$ flagrship rollback new-checkout
✓ Rolled back new-checkout in staging — OFF`;

export default function Intro() {
  return (
    <>
      <Title lede="Feature flags for teams that ship often. Deploy code dark, roll it out by percentage, roll it back in one command.">
        Introduction
      </Title>

      <P>
        Flagrship is a REST API, a CLI, and SDKs for JavaScript and Python. The flag is the release mechanism: your code
        ships through CI as usual and does nothing until you say so. Rollback is one command and every SDK picks it up
        within a poll.
      </P>

      <CodeBlock code={LOOP} lang="shell" title="terminal" numbers={false} />

      <Cards
        items={[
          { href: '/docs/quickstart/', icon: 'rocket', title: 'Quickstart', body: 'Install the CLI and flip your first flag in about five minutes.' },
          { href: '/docs/cli/', icon: 'terminal', title: 'CLI reference', body: 'Every command, every option, and how the config file works.' },
          { href: '/docs/sdk-js/', icon: 'js', title: 'JavaScript SDK', body: '2 KB, zero dependencies, synchronous evaluation.' },
          { href: '/docs/sdk-python/', icon: 'python', title: 'Python SDK', body: 'Stdlib only, thread-safe, same buckets as Node.' },
        ]}
      />

      <H2>What it does</H2>
      <Ul>
        <li><b className="text-ink">Percentage rollouts</b> — users hash into 100 buckets; raise the number and more of them see the feature, never in a different order.</li>
        <li><b className="text-ink">Rollback as undo</b> — restores the state before the last change and logs itself, so a second rollback undoes the first.</li>
        <li><b className="text-ink">Locks</b> — an admin locks a flag with a reason. Every mutation returns 409 until it is unlocked.</li>
        <li><b className="text-ink">Audit trail</b> — every change writes who, when, before and after in the same transaction.</li>
      </Ul>

      <H2>How it is built</H2>
      <Table
        head={['Piece', 'What it is']}
        mono={[0]}
        rows={[
          ['API', 'Fastify on Postgres. Environment comes from the API key, never a parameter.'],
          ['CLI', 'A thin client over the API. One command, one call, one audit row.'],
          ['SDKs', 'Fetch config once, poll with an ETag, evaluate in memory. Never a network call per check.'],
          ['Bucketing', 'MurmurHash3 over flagKey:userId, inside the SDK. The API never sees a user ID.'],
        ]}
      />

      <H2>Where to go next</H2>
      <Cards
        items={[
          { href: '/docs/concepts/', icon: 'hash', title: 'Concepts', body: 'The five ideas the system is built on. Read once; the rest is reference.' },
          { href: '/docs/api/', icon: 'api', title: 'HTTP API', body: 'Anything the CLI can do, curl can do.' },
        ]}
      />
    </>
  );
}
