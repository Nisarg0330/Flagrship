import { CodeBlock } from '@/components/CodeBlock';
import { Code, H2, Method, Note, P, Table, Title } from '@/components/docs';

export const metadata = { title: 'HTTP API · Flagrship Docs' };

const FLAG = `{
  "key": "new-checkout",
  "name": "New Checkout",
  "description": null,
  "flagType": "BOOLEAN",
  "environment": "staging",
  "enabled": true,
  "rolloutPercentage": 25,
  "targetingRules": null,
  "locked": false,
  "lockReason": null,
  "createdAt": "2026-09-15T14:40:54.203Z",
  "updatedAt": "2026-09-15T23:04:44.330Z"
}`;

export default function Api() {
  return (
    <>
      <Title lede="The CLI, the SDKs, and the dashboard are all clients of this API. Anything they can do, you can do with curl.">
        HTTP API
      </Title>

      <H2>Base URL and authentication</H2>
      <CodeBlock lang="shell" numbers={false} code={`https://api.flagrship.dev/api/v1`} />
      <P>
        Every request under <Code>/api/v1</Code> carries an API key as a bearer token. The key determines the organization,
        the environment, and what you are allowed to do. There is no environment parameter anywhere; the key is the
        environment.
      </P>
      <CodeBlock lang="shell" numbers={false} code={`$ curl https://api.flagrship.dev/api/v1/flags \\\n    -H "Authorization: Bearer sk_test_your_staging_key"`} />
      <Table
        head={['Scope', 'Grants', 'Key prefixes']}
        mono={[0, 2]}
        rows={[
          ['read', 'GET on everything, including /evaluate', 'sk_read_'],
          ['write', 'read, plus POST on flags: create, enable, disable, rollout, rollback', 'sk_test_, sk_live_'],
          ['admin', 'write, plus lock, unlock, archive, and key management', 'sk_admin_'],
        ]}
      />

      <H2>Errors</H2>
      <P>Every error has the same shape. The request ID is also in the response headers; quote it when asking for help.</P>
      <CodeBlock
        lang="json"
        code={`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Rollout percentage must be between 0 and 100.",
    "field": "percentage",
    "request_id": "5608458f-925f-4a86-9d83-8d92a49b22c5"
  }
}`}
      />
      <Table
        head={['Status', 'Code', 'When']}
        mono={[0, 1]}
        rows={[
          ['400', 'VALIDATION_ERROR', 'Bad body, missing field, out-of-range value. field names the offender.'],
          ['401', 'UNAUTHORIZED', 'Missing, unknown, revoked, or expired key.'],
          ['403', 'FORBIDDEN', 'The key lacks the scope this endpoint needs.'],
          ['404', 'NOT_FOUND', 'No such flag, key, or environment in this organization.'],
          ['409', 'CONFLICT', 'Duplicate flag key, locked flag, nothing to roll back, already revoked.'],
          ['500', 'INTERNAL_ERROR', 'Our fault. The request ID is in the body.'],
        ]}
      />
      <Note tone="sky" title="Empty bodies are fine">
        A <Code>POST</Code> with <Code>Content-Type: application/json</Code> and no body is accepted. Most HTTP clients send
        that header by default, and <Code>enable</Code> has nothing to say.
      </Note>

      <H2>Flags</H2>

      <Method verb="POST" path="/flags" scope="write" />
      <P>Create a flag. It exists in every environment at once, disabled and at 0%.</P>
      <CodeBlock lang="json" numbers={false} code={`{
  "key": "new-checkout",
  "name": "New Checkout",
  "description": "optional",
  "flagType": "BOOLEAN"
}`} />
      <P>
        <Code>key</Code>: 3–120 lowercase letters, digits, hyphens; must start and end alphanumeric. Returns{' '}
        <Code>201</Code> with the flag as seen from the key&apos;s environment.
      </P>
      <CodeBlock lang="json" title="response" code={FLAG} />

      <Method verb="GET" path="/flags" scope="read" />
      <P>
        Every active flag in the environment, newest first. <Code>?search=</Code> filters by key or name. Returns{' '}
        <Code>{'{ environment, flags: [...] }'}</Code>.
      </P>

      <Method verb="GET" path="/flags/:key" scope="read" />
      <P>One flag, with its config for this environment. 404 if it does not exist or is archived.</P>

      <Method verb="POST" path="/flags/:key/enable" scope="write" />
      <P>Sets enabled. Rollout percentage is preserved. No body.</P>

      <Method verb="POST" path="/flags/:key/disable" scope="write" />
      <P>Clears enabled and resets rollout to 0. The previous percentage survives in the audit log. No body.</P>

      <Method verb="POST" path="/flags/:key/rollout" scope="write" />
      <CodeBlock lang="json" numbers={false} code={`{ "percentage": 25 }`} />
      <P>Integer 0–100. The flag must be enabled first, or you get a 400 that says so.</P>

      <Method verb="POST" path="/flags/:key/rollback" scope="write" />
      <P>
        Restore the state from before the most recent change in this environment, and record the rollback as a change of
        its own. A second call undoes the first. 409 if there is nothing to roll back to. No body.
      </P>

      <Method verb="POST" path="/flags/:key/lock" scope="admin" />
      <CodeBlock lang="json" numbers={false} code={`{ "reason": "CVE-2026-1234" }`} />
      <P>
        Reason is required, 1–500 characters. While locked, enable, disable, rollout, and rollback return 409 with the
        reason in the message. 409 if already locked.
      </P>

      <Method verb="POST" path="/flags/:key/unlock" scope="admin" />
      <P>Clears the lock. 409 if not locked. No body.</P>

      <Method verb="DELETE" path="/flags/:key" scope="admin" />
      <P>
        Archive (soft delete). The flag disappears from <Code>/flags</Code> and <Code>/evaluate</Code> immediately; its
        history stays. Refused with 409 while the flag is locked in any environment.
      </P>

      <Method verb="GET" path="/flags/:key/history" scope="read" />
      <P>The last 50 audit entries for the flag, newest first.</P>
      <CodeBlock
        lang="json"
        code={`{
  "flag": "new-checkout",
  "entries": [
    {
      "action": "flag.rollout",
      "environment": "staging",
      "actor": { "name": "Nisarg Patel", "email": "nisarg@flagrship.dev", "via": "api_key" },
      "before": { "enabled": true, "rolloutPercentage": 0, "locked": false, "lockReason": null },
      "after":  { "enabled": true, "rolloutPercentage": 25, "locked": false, "lockReason": null },
      "metadata": { "keyPrefix": "sk_test_75GA", "ip": "127.0.0.1", "requestId": "…" },
      "at": "2026-09-15T14:40:54.741Z"
    }
  ]
}`}
      />

      <H2>SDK sync</H2>

      <Method verb="GET" path="/evaluate" scope="read" />
      <P>
        Every active flag&apos;s config for the key&apos;s environment, in the shape the SDKs consume. This endpoint has no
        parameters. It never accepts a user identifier; bucketing happens in the SDK.
      </P>
      <CodeBlock
        lang="json"
        code={`{
  "environment": "staging",
  "flags": [
    { "key": "dark-mode", "enabled": true, "rolloutPercentage": 100, "targetingRules": null },
    { "key": "new-checkout", "enabled": true, "rolloutPercentage": 25, "targetingRules": null }
  ]
}`}
      />
      <P>
        The response carries a strong <Code>ETag</Code>. Send it back as <Code>If-None-Match</Code> and you get a{' '}
        <Code>304</Code> with no body when nothing has changed.
      </P>
      <CodeBlock
        lang="shell"
        numbers={false}
        code={`$ curl -i https://api.flagrship.dev/api/v1/evaluate \\
    -H "Authorization: Bearer sk_read_…" \\
    -H 'If-None-Match: "kM3Qn8tYw2xZa1bC4dE5fG6hI7j"'
HTTP/1.1 304 Not Modified
etag: "kM3Qn8tYw2xZa1bC4dE5fG6hI7j"
cache-control: private, no-cache`}
      />

      <H2>API keys</H2>
      <P>All three require an admin key.</P>

      <Method verb="POST" path="/keys" scope="admin" />
      <CodeBlock lang="json" numbers={false} code={`{
  "name": "CI reader",
  "environment": "production",
  "scopes": ["read"]
}`} />
      <P>
        <Code>environment</Code> defaults to the calling key&apos;s. Scopes are hierarchical: <Code>admin</Code> implies{' '}
        <Code>write</Code> implies <Code>read</Code>. The response includes the raw key <strong>once</strong>; only its
        SHA-256 hash is stored.
      </P>
      <CodeBlock
        lang="json"
        title="response"
        code={`{
  "id": "b4dd593e-efdc-4553-aecf-c3b0edb21ff2",
  "name": "CI reader",
  "environment": "production",
  "scopes": ["read"],
  "keyPrefix": "sk_read_your",
  "createdAt": "2026-09-15T22:20:46.831Z",
  "key": "sk_read_your_new_key_shown_once"
}`}
      />

      <Method verb="GET" path="/keys" scope="admin" />
      <P>Every key in the organization with prefix, scopes, environment, last use, and whether it is still active. Never the key itself.</P>

      <Method verb="DELETE" path="/keys/:id" scope="admin" />
      <P>Revoke. The key stops authenticating immediately. It is not deleted; revoked keys are evidence. 409 if already revoked.</P>

      <H2>Health</H2>
      <Method verb="GET" path="/health" scope="none" />
      <P>
        Public, no key needed. Runs a real query, so a dead database connection fails it. Path is <Code>/health</Code>,
        not under <Code>/api/v1</Code>.
      </P>
      <CodeBlock lang="json" numbers={false} code={`{ "status": "ok", "uptime": 3.63 }`} />
    </>
  );
}
