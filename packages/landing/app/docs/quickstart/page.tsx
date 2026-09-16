import { CodeBlock } from '@/components/CodeBlock';
import { Code, Note, P, Step, Steps, Title, Ul } from '@/components/docs';

export const metadata = { title: 'Quickstart · Flagrship Docs' };

export default function Quickstart() {
  return (
    <>
      <Title lede="Install the CLI, create a flag, add a few lines to your app, and watch it flip. About five minutes.">
        Quickstart
      </Title>

      <Steps>
        <Step title="Install the CLI">
          <CodeBlock lang="shell" numbers={false} code={`$ npm install -g @flagrship/cli\n$ flagrship --version\n0.0.1`} />
        </Step>

        <Step title="Point it at your environment">
          <P>
            You need an API key for one environment. Keys are scoped to a single environment on the server, so a staging key
            can never read production. <Code>init</Code> verifies the key against the API and learns which environment it
            belongs to.
          </P>
          <CodeBlock
            lang="shell"
            numbers={false}
            code={`$ flagrship init --key sk_test_your_staging_key
✓ Saved staging key to /your/project/.flagrship.json
✓ Added .flagrship.json to .gitignore
  Default environment: staging`}
          />
          <Note tone="sand" title="Keys never get committed">
            <Code>init</Code> writes the key to <Code>.flagrship.json</Code> and appends that file to <Code>.gitignore</Code> in
            the same directory. Run <Code>init</Code> again with a second key to add another environment.
          </Note>
        </Step>

        <Step title="Create a flag">
          <P>A new flag exists in every environment at once, disabled and at 0%. Nothing changes for anyone yet.</P>
          <CodeBlock lang="shell" numbers={false} code={`$ flagrship create new-checkout --description "Rewritten checkout flow"\n✓ Created new-checkout in staging — OFF`} />
        </Step>

        <Step title="Add the SDK to your app">
          <P>
            The SDK fetches config once at boot, then polls. Every <Code>isEnabled</Code> call after that is an in-memory
            lookup. Use a read-scoped key here; it cannot change anything if it leaks.
          </P>
          <div className="grid gap-4">
            <div>
              <CodeBlock lang="shell" numbers={false} code={`$ npm install @flagrship/sdk`} className="mb-3" />
              <CodeBlock
                lang="ts"
                title="app.ts"
                code={`import { Flagrship } from '@flagrship/sdk';

const flags = new Flagrship({
  apiKey: process.env.FLAGRSHIP_KEY,
});
await flags.ready();

if (flags.isEnabled('new-checkout', user.id)) {
  showNewCheckout();
}`}
              />
            </div>
            <div>
              <CodeBlock lang="shell" numbers={false} code={`$ pip install flagrship-sdk`} className="mb-3" />
              <CodeBlock
                lang="py"
                title="app.py"
                code={`from flagrship import Flagrship

flags = Flagrship(api_key=os.environ["FLAGRSHIP_KEY"])
flags.ready()

if flags.is_enabled("new-checkout", user.id):
    show_new_checkout()`}
              />
            </div>
          </div>
        </Step>

        <Step title="Roll it out">
          <P>
            Enable the flag, then set a percentage. Users are hashed into 100 buckets; a user is on when their bucket is below
            the percentage. The same user always gets the same answer.
          </P>
          <CodeBlock
            lang="shell"
            numbers={false}
            code={`$ flagrship enable new-checkout
✓ Enabled new-checkout in staging — ON    0%
$ flagrship rollout new-checkout 25
✓ Rolled out new-checkout in staging — ON   25%`}
          />
          <P>Within one poll (30 seconds by default) every running instance of your app sees the change.</P>
        </Step>

        <Step title="Roll it back">
          <P>
            <Code>rollback</Code> undoes the most recent change. It is an undo, not a revert to some saved state: run it twice
            and you are back where you started.
          </P>
          <CodeBlock lang="shell" numbers={false} code={`$ flagrship rollback new-checkout\n✓ Rolled back new-checkout in staging — ON    0%`} />
        </Step>

        <Step title="See who did what">
          <CodeBlock
            lang="shell"
            numbers={false}
            code={`$ flagrship log new-checkout
WHEN     ACTION    CHANGE                      BY
8s ago   rollback  25% -> 0%                   you@example.com via api_key
21s ago  rollout   0% -> 25%                   you@example.com via api_key
30s ago  enabled   off -> 0%                   you@example.com via api_key
1m ago   created   created as "New Checkout"   you@example.com via api_key`}
          />
        </Step>
      </Steps>

      <P>That is the whole loop. From here:</P>
      <Ul>
        <li>
          <a href="/docs/concepts" className="underline decoration-line underline-offset-4 hover:decoration-ink">Concepts</a> explains
          environments, bucketing, and why rollback is an undo.
        </li>
        <li>
          <a href="/docs/cli" className="underline decoration-line underline-offset-4 hover:decoration-ink">CLI reference</a> has every
          command and flag.
        </li>
        <li>
          <a href="/docs/api" className="underline decoration-line underline-offset-4 hover:decoration-ink">HTTP API</a> if you want to
          call it from CI or a script.
        </li>
      </Ul>
    </>
  );
}
