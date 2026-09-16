import { CodeBlock } from '@/components/CodeBlock';
import { Code, H2, H3, Note, P, Table, Title } from '@/components/docs';

export const metadata = { title: 'CLI · Flagrship Docs' };

export default function Cli() {
  return (
    <>
      <Title lede="Every command, every flag, and how the config file works. The CLI is a thin client over the HTTP API; nothing here is hidden from the API or the dashboard.">
        CLI reference
      </Title>

      <H2>Install</H2>
      <CodeBlock lang="shell" numbers={false} code={`$ npm install -g @flagrship/cli\n$ flagrship --help`} />
      <P>Requires Node 20.12 or later. A single 121 KB file with one dependency.</P>

      <H2>Global options</H2>
      <P>These work on every command.</P>
      <Table
        head={['Option', 'What it does']}
        mono={[0]}
        rows={[
          ['-e, --env <name>', <>Target a different environment. Selects the key stored for that environment in <Code>.flagrship.json</Code>; there is no way to send an environment to the server.</>],
          ['--json', 'Print the raw API response as JSON instead of a table. For scripts.'],
          ['--verbose', 'Print each request and response status to stderr.'],
          ['-v, --version', 'Print the CLI version.'],
        ]}
      />

      <H2>Commands</H2>

      <H3>init</H3>
      <P>
        Store an API key. The CLI calls the API to verify the key and learn which environment it belongs to, then writes
        the config file and adds it to <Code>.gitignore</Code>. Run it once per environment.
      </P>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship init --key <api-key> [--api-url <url>] [--default]`} />
      <Table
        head={['Option', 'What it does']}
        mono={[0]}
        rows={[
          ['-k, --key <api-key>', 'Required. The key to store.'],
          ['--api-url <url>', <>API base URL. Default <Code>https://api.flagrship.dev</Code>. Use <Code>http://127.0.0.1:3000</Code> against a local API.</>],
          ['--default', "Make this key's environment the default. The first key stored is the default automatically."],
        ]}
      />

      <H3>create</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship create <key> [--name <name>] [--description <text>]`} />
      <P>
        Creates the flag in every environment, disabled and at 0%. The key must be 3 to 120 characters of lowercase
        letters, digits, and hyphens, starting and ending alphanumeric. If you omit <Code>--name</Code>, it is derived
        from the key: <Code>new-checkout</Code> becomes <Code>New Checkout</Code>.
      </P>

      <H3>list</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship list [--search <text>]\n$ flagrship ls`} />
      <P>Every flag in the current environment, with state and last change. <Code>--search</Code> matches key or name.</P>
      <CodeBlock
        lang="shell"
        numbers={false}
        code={`KEY           STATE      NAME          CHANGED
dark-mode     ON    0%   Dark Mode     1h ago
new-checkout  ON   25%   New Checkout  12s ago`}
      />

      <H3>status</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship status <key>`} />
      <P>Full state for one flag in the current environment, including lock reason if locked.</P>

      <H3>enable / disable</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship enable <key>\n$ flagrship disable <key>`} />
      <P>
        <Code>enable</Code> preserves the rollout percentage: a flag that was at 25% comes back at 25%.{' '}
        <Code>disable</Code> is the kill switch and resets the percentage to 0. The previous percentage is in the audit
        log, which is what <Code>rollback</Code> reads.
      </P>

      <H3>rollout</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship rollout <key> <percentage>`} />
      <P>
        Set the percentage of users who see the flag, 0 to 100. The flag must be enabled first. The CLI validates the
        number before making a request.
      </P>

      <H3>rollback</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship rollback <key>`} />
      <P>
        Undo the most recent change to this flag in this environment. A second rollback undoes the first. Refused with a
        409 if the flag has never been changed.
      </P>

      <H3>lock / unlock</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship lock <key> --reason <text>\n$ flagrship unlock <key>`} />
      <P>
        Both require an admin key. A locked flag rejects every other mutation with a message that includes the reason.
        Locking an already-locked flag is a 409, as is unlocking one that is not locked.
      </P>

      <H3>log</H3>
      <CodeBlock lang="shell" numbers={false} code={`$ flagrship log <key>`} />
      <P>The last 50 audit entries for the flag, newest first: when, action, what changed, and who did it.</P>

      <H2>The config file</H2>
      <P>
        <Code>.flagrship.json</Code> lives in your project root and the CLI finds it by walking up from the current
        directory, the same way git finds <Code>.git</Code>. It holds one key per environment.
      </P>
      <CodeBlock
        lang="json"
        title=".flagrship.json"
        code={`{
  "apiUrl": "https://api.flagrship.dev",
  "defaultEnvironment": "staging",
  "keys": {
    "staging": "sk_test_your_staging_key",
    "production": "sk_live_your_production_key"
  }
}`}
      />
      <Note tone="rose" title="This file contains secrets">
        <Code>init</Code> adds it to <Code>.gitignore</Code> automatically. If you copy the file somewhere, treat it like a
        password.
      </Note>

      <H2>Errors and exit codes</H2>
      <P>
        Every failure exits with code 1 and a one-line message on stderr. API errors are printed verbatim with the request
        ID, so support can find the exact request.
      </P>
      <CodeBlock
        lang="shell"
        numbers={false}
        code={`$ flagrship rollout new-checkout 50
error: Flag "new-checkout" is locked: CVE-2026-1234. An admin must unlock it first.
  request id: 6d5ea4be-705c-45ef-afe7-2a6d65b1bef5`}
      />
      <P>
        Network failures and 5xx responses are retried three times with backoff (1s, 2s, 4s). 4xx responses are never
        retried: the request itself is wrong, and three more copies of it will not help.
      </P>
    </>
  );
}
