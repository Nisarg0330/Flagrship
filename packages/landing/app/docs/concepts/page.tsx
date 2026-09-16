import { CodeBlock } from '@/components/CodeBlock';
import { Code, H2, Note, P, Table, Title, Ul } from '@/components/docs';

export const metadata = { title: 'Concepts · Flagrship Docs' };

export default function Concepts() {
  return (
    <>
      <Title lede="The five ideas the whole system is built on. Read this once and the rest of the docs are reference.">
        Concepts
      </Title>

      <H2>Flags, environments, and configs</H2>
      <P>
        A <strong>flag</strong> is a named switch, identified by a key like <Code>new-checkout</Code>. It exists once per
        organization. An <strong>environment</strong> is an isolated namespace: production, staging, development. A flag
        has one <strong>config</strong> per environment, and that config is where the state lives: enabled or not, rollout
        percentage, lock status.
      </P>
      <P>
        Creating a flag creates a config in every environment at once, disabled and at 0%. Enabling it in staging does
        nothing to production. The same flag, different state per environment.
      </P>

      <H2>The environment comes from the key</H2>
      <P>
        An API key is scoped to exactly one environment. There is no <Code>?env=</Code> parameter anywhere in the API. When
        you call with a staging key, you get staging. This is what makes a leaked staging key harmless to production, and
        it is why the CLI stores one key per environment and <Code>--env</Code> picks a key rather than sending a parameter.
      </P>
      <Table
        head={['Prefix', 'Scope', 'Typical use']}
        mono={[0, 1]}
        rows={[
          ['sk_read_', 'read', 'SDKs. Can fetch config, cannot change anything.'],
          ['sk_test_', 'read, write', 'CLI in non-production environments.'],
          ['sk_live_', 'read, write', 'CLI in production.'],
          ['sk_admin_', 'read, write, admin', 'Lock, unlock, archive, key management, CI pipelines.'],
        ]}
      />

      <H2>Deterministic bucketing</H2>
      <P>
        A percentage rollout does not pick users at random. Each user is placed in one of 100 buckets by hashing the flag
        key and the user ID together. A user is on when their bucket number is below the rollout percentage.
      </P>
      <CodeBlock
        lang="ts"
        numbers={false}
        code={`bucket = murmurhash3_x86_32("new-checkout:alice", seed = 0) % 100   // 40
on     = bucket < rolloutPercentage                                   // 40 < 25 → false
                                                                       // 40 < 50 → true`}
      />
      <P>Three things follow from this, and all of them matter:</P>
      <Ul>
        <li>
          <strong>Users never flicker.</strong> Alice is bucket 40 for <Code>new-checkout</Code> on every server, in every
          language, forever.
        </li>
        <li>
          <strong>Raising the percentage only adds users.</strong> Going from 25% to 50% keeps everyone who was in and adds
          buckets 25 through 49. Nobody who saw the feature loses it.
        </li>
        <li>
          <strong>Different flags get different cohorts.</strong> The flag key is part of the hash, so Alice is bucket 40
          for one flag and bucket 95 for another. Rolling out two flags at 25% does not give the same quarter of users
          both.
        </li>
      </Ul>
      <Note tone="sky" title="The hash is a contract">
        MurmurHash3, x86 32-bit, seed 0, over the UTF-8 bytes of <Code>flagKey:userId</Code>. Every SDK implements it
        identically and passes the same conformance file. It can never change, because changing it would re-bucket every
        user of every customer.
      </Note>
      <P>
        Because the hash runs inside the SDK, <strong>the API never sees a user ID</strong>. There is no endpoint that
        accepts one. Nothing to store, nothing to leak.
      </P>

      <H2>Rollback is an undo</H2>
      <P>
        <Code>rollback</Code> restores the state from before the most recent change to that flag in that environment, and
        records itself as a change. So a second rollback undoes the first. It is a one-deep undo stack, not a history
        walk and not a return to some blessed state.
      </P>
      <CodeBlock
        lang="shell"
        numbers={false}
        code={`$ flagrship rollout new-checkout 100     # 0 → 100
$ flagrship rollout new-checkout 50      # 100 → 50
$ flagrship rollback new-checkout        # 50 → 100   (undo the last change)
$ flagrship rollback new-checkout        # 100 → 50   (undo the undo)`}
      />
      <P>
        Lock and unlock are not part of the stack. They are deliberate admin decisions, and an undo should never quietly
        re-lock a flag someone chose to unlock.
      </P>

      <H2>Lock</H2>
      <P>
        A locked config rejects enable, disable, rollout, and rollback with a <Code>409</Code> that includes the reason.
        Locking requires an admin key and a reason; the reason is what everyone who bumps into the lock will read. Use it
        during incidents: the vulnerable code stays deployed but dormant, and nobody can turn it back on by accident until
        an admin unlocks it.
      </P>
      <P>
        Archiving a flag is refused while it is locked in <em>any</em> environment. Archiving evaluates to false everywhere,
        which is exactly what a lock exists to prevent.
      </P>

      <H2>Everything is audited</H2>
      <P>
        Every change writes an audit row in the same database transaction as the change itself. Who, when, before, after,
        and how (API key prefix, IP, request ID). If the audit write fails, the change does not happen. There is no code
        path that mutates a flag without leaving a row behind.
      </P>
      <P>
        Audit history is append-only. Revoking an API key does not delete it either; a revoked key is evidence of what
        happened during an incident.
      </P>

      <H2>What happens when the API is unreachable</H2>
      <P>
        The SDK fetches config at boot and polls afterwards. If the first fetch fails, <Code>ready()</Code> still
        resolves, and every flag evaluates to the default you wrote in code. If a later poll fails, the SDK keeps serving
        the last config it received. Evaluation is always in memory. Your application never blocks on Flagrship and never
        makes a network call per check.
      </P>
      <P>
        Polls carry an <Code>If-None-Match</Code> header with the last ETag. When nothing has changed, the API answers
        <Code>304</Code> with an empty body. Config crosses the wire once, then only when you change it.
      </P>
    </>
  );
}
