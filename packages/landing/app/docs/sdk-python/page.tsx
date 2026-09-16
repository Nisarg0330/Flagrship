import { CodeBlock } from '@/components/CodeBlock';
import { Code, H2, H3, Note, P, Table, Title, Ul } from '@/components/docs';

export const metadata = { title: 'Python SDK · Flagrship Docs' };

export default function SdkPython() {
  return (
    <>
      <Title lede="The same SDK, in Python. Standard library only, thread-safe, and it passes the same conformance file as the JavaScript SDK line for line.">
        Python SDK
      </Title>

      <H2>Install</H2>
      <CodeBlock lang="shell" numbers={false} code={`$ pip install flagrship-sdk`} />
      <P>
        Python 3.9 or later. No dependencies: <Code>urllib</Code> for HTTP and <Code>threading</Code> for the poll loop.
      </P>

      <H2>Usage</H2>
      <CodeBlock
        lang="py"
        title="app.py"
        code={`import os
from flagrship import Flagrship

flags = Flagrship(
    api_key=os.environ["FLAGRSHIP_KEY"],
    defaults={"new-checkout": False},
)

# Blocks until the first sync attempt finishes. Never raises.
flags.ready()

if flags.is_enabled("new-checkout", user.id):
    show_new_checkout()`}
      />
      <P>Or as a context manager, which waits for <Code>ready()</Code> on entry and stops polling on exit:</P>
      <CodeBlock
        lang="py"
        numbers={false}
        code={`with Flagrship(api_key=key) as flags:
    if flags.is_enabled("new-checkout", user.id):
        show_new_checkout()`}
      />

      <H2>Constructor arguments</H2>
      <P>
        <Code>api_key</Code> is positional; everything else is keyword-only.
      </P>
      <Table
        head={['Argument', 'Type', 'Default', 'What it does']}
        mono={[0, 1, 2]}
        rows={[
          ['api_key', 'str', 'required', 'A read-scoped key for one environment.'],
          ['api_url', 'str', 'https://api.flagrship.dev', 'Override for self-hosted or local APIs.'],
          ['poll_interval', 'float', '30.0', 'Seconds between polls. 0 disables polling.'],
          ['defaults', 'Mapping[str, bool]', '{}', 'What is_enabled returns for unknown flags.'],
          ['on_update', 'Callable[[dict], None]', 'None', 'Called after every successful config change.'],
          ['on_error', 'Callable[[Exception], None]', 'None', 'Called when a sync fails. Last config keeps serving.'],
          ['transport', 'Callable', 'urllib', 'Injectable for tests. See the source for the signature.'],
        ]}
      />

      <H2>Methods</H2>

      <H3>ready(timeout=None)</H3>
      <P>
        Blocks until the first sync attempt finishes. Returns <Code>False</Code> only if <Code>timeout</Code> elapsed
        first. Never raises. The first sync runs on a background thread, so construction itself never blocks.
      </P>

      <H3>is_enabled(flag_key, user_id=None, default=None)</H3>
      <P>Same five-step evaluation as the JavaScript SDK:</P>
      <Ul>
        <li>
          Unknown flag → <Code>default</Code>, then <Code>defaults[flag_key]</Code>, then <Code>False</Code>
        </li>
        <li>Disabled → <Code>False</Code></li>
        <li>Rollout 100 → <Code>True</Code></li>
        <li>No user ID and rollout below 100 → <Code>False</Code></li>
        <li>
          Otherwise <Code>bucket(flag_key, user_id) &lt; rollout_percentage</Code>
        </li>
      </Ul>

      <H3>get_flag(flag_key)</H3>
      <P>
        A frozen <Code>FlagConfig</Code> dataclass, or <Code>None</Code>. Fields: <Code>key</Code>, <Code>enabled</Code>,{' '}
        <Code>rollout_percentage</Code>, <Code>targeting_rules</Code>.
      </P>

      <H3>all_flags()</H3>
      <P>A snapshot dict. Safe to iterate while polling continues.</P>

      <H3>refresh()</H3>
      <P>
        Sync now. Returns <Code>True</Code> if config changed. Never raises.
      </P>

      <H3>close()</H3>
      <P>Stop the poll thread. The last config stays in memory.</P>

      <H2>Threads</H2>
      <P>
        Evaluation is lock-free. Each successful sync replaces the whole config dict in a single assignment, which is
        atomic in CPython, so a reader on any thread sees either the old snapshot or the new one and never a partially
        written mix. A lock serialises writers only (the poll thread versus an explicit <Code>refresh()</Code>).
      </P>
      <P>
        Both background threads are daemon threads. Your process exits when your code finishes; the SDK never keeps it
        alive.
      </P>

      <Note tone="sand" title="On Windows, prefer 127.0.0.1 for local APIs">
        <Code>urllib</Code> resolves <Code>localhost</Code> to <Code>::1</Code> first and waits about two seconds before
        falling back to IPv4 if nothing is listening there. Use <Code>http://127.0.0.1:3000</Code> against a local API.
      </Note>

      <H2>Bucketing</H2>
      <CodeBlock
        lang="py"
        numbers={false}
        code={`from flagrship import bucket, murmurhash3_x86_32

bucket("new-checkout", "alice")             # 40
murmurhash3_x86_32("hello")                 # 613153351`}
      />
      <P>
        These return exactly what the JavaScript SDK returns for the same input. Both implementations are checked against
        the same fixture file on every commit.
      </P>
    </>
  );
}
