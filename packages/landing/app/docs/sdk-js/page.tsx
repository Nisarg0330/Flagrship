import { CodeBlock } from '@/components/CodeBlock';
import { Code, H2, H3, Note, P, Table, Title, Ul } from '@/components/docs';

export const metadata = { title: 'JavaScript SDK · Flagrship Docs' };

export default function SdkJs() {
  return (
    <>
      <Title lede="Fetch once, poll quietly, evaluate in memory. 2.1 KB gzipped, zero dependencies, Node 18 and later.">
        JavaScript SDK
      </Title>

      <H2>Install</H2>
      <CodeBlock lang="shell" numbers={false} code={`$ npm install @flagrship/sdk`} />
      <P>Ships CommonJS and ESM builds with TypeScript types. Works in Node, Bun, and Deno.</P>
      <Note tone="rose" title="Server-side only">
        The API key goes in the <Code>Authorization</Code> header of every request. Never ship it to a browser. If you need
        flags in a browser, evaluate on your server and pass the result down.
      </Note>

      <H2>Usage</H2>
      <CodeBlock
        lang="ts"
        title="app.ts"
        code={`import { Flagrship } from '@flagrship/sdk';

const flags = new Flagrship({
  apiKey: process.env.FLAGRSHIP_KEY,
  defaults: { 'new-checkout': false },
});

// Resolves after the first sync attempt, success or failure. Never rejects.
await flags.ready();

if (flags.isEnabled('new-checkout', user.id)) {
  showNewCheckout();
}`}
      />

      <H2>Constructor options</H2>
      <Table
        head={['Option', 'Type', 'Default', 'What it does']}
        mono={[0, 1, 2]}
        rows={[
          ['apiKey', 'string', 'required', 'A read-scoped key for one environment.'],
          ['apiUrl', 'string', 'https://api.flagrship.dev', 'Override for self-hosted or local APIs.'],
          ['pollInterval', 'number', '30000', 'Milliseconds between polls. 0 disables polling entirely.'],
          ['defaults', 'Record<string, boolean>', '{}', 'What isEnabled returns for flags the SDK has no config for.'],
          ['onUpdate', '(flags) => void', '—', 'Called after every successful config change, with a snapshot Map.'],
          ['onError', '(error) => void', '—', 'Called when a sync fails. The SDK keeps serving its last config regardless.'],
          ['fetch', 'typeof fetch', 'globalThis.fetch', 'Injectable for tests and non-standard runtimes.'],
        ]}
      />

      <H2>Methods</H2>

      <H3>ready()</H3>
      <P>
        Returns a promise that resolves after the first sync attempt. It never rejects. Await it once at startup if you
        want the first evaluation to reflect real config rather than defaults. If the API is unreachable, it still
        resolves, and <Code>onError</Code> is called.
      </P>

      <H3>isEnabled(flagKey, userId?, defaultValue?)</H3>
      <P>Synchronous, in-memory. The evaluation order:</P>
      <Ul>
        <li>
          Unknown flag → <Code>defaultValue</Code>, then <Code>options.defaults[flagKey]</Code>, then <Code>false</Code>
        </li>
        <li>Disabled → <Code>false</Code></li>
        <li>Rollout 100 → <Code>true</Code>, no user ID needed</li>
        <li>No user ID and rollout below 100 → <Code>false</Code> (cannot bucket without an identifier)</li>
        <li>
          Otherwise <Code>bucket(flagKey, userId) &lt; rolloutPercentage</Code>
        </li>
      </Ul>

      <H3>getFlag(flagKey)</H3>
      <P>
        The raw config object for a flag, or <Code>undefined</Code>. Useful for debugging and for showing rollout state
        in an admin UI.
      </P>
      <CodeBlock lang="json" numbers={false} code={`{
  "key": "new-checkout",
  "enabled": true,
  "rolloutPercentage": 25,
  "targetingRules": null
}`} />

      <H3>allFlags()</H3>
      <P>
        A snapshot <Code>Map</Code> of every flag the SDK currently knows about. Safe to iterate while polling continues.
      </P>

      <H3>refresh()</H3>
      <P>
        Sync now instead of waiting for the next poll. Resolves <Code>true</Code> if config changed, <Code>false</Code> on
        a 304 or a failure. Never rejects.
      </P>

      <H3>close()</H3>
      <P>Stop polling. The last config stays in memory and <Code>isEnabled</Code> keeps working.</P>

      <H2>Sync behaviour</H2>
      <P>
        The SDK sends <Code>If-None-Match</Code> with the last ETag on every poll. A <Code>304</Code> means nothing changed
        and the in-memory Map is left alone; <Code>onUpdate</Code> does not fire. A <Code>200</Code> replaces the whole Map
        in one assignment, so a concurrent <Code>isEnabled</Code> call sees either the old config or the new one, never
        a mix.
      </P>
      <P>
        The polling timer is <Code>unref()</Code>&apos;d. A script that creates an SDK instance and finishes its work exits
        normally; a long-running server keeps polling for as long as it is alive for other reasons.
      </P>

      <H2>Bucketing</H2>
      <P>
        Two helpers are exported so you can reproduce the SDK&apos;s decision anywhere, for example to show a user which
        cohort they are in.
      </P>
      <CodeBlock
        lang="ts"
        numbers={false}
        code={`import { bucket, murmurhash3_x86_32 } from '@flagrship/sdk';

bucket('new-checkout', 'alice');            // 40
murmurhash3_x86_32('hello');                // 613153351`}
      />
    </>
  );
}
