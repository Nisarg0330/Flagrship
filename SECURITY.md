# Security

How Flagrship is built, what it deliberately does not do, and where to send a
report. Written to be checked against the code rather than believed.

## Reporting a vulnerability

Email **nisarg@flagrship.dev** with steps to reproduce. Please do not open a
public issue for anything exploitable. Expect a first reply within 72 hours.

Flagrship is in public beta and run by one person. There is no bug bounty yet.
Credit in the release notes if you want it.

## Authentication and authorization

**A key is 24 bytes from `crypto.randomBytes`, base64url-encoded, behind a
prefix** (`sk_read_`, `sk_test_`, `sk_live_`, `sk_admin_`). Only a plain
SHA-256 of the key is stored. No salt: a salt defends low-entropy secrets, and
192 bits is not low entropy — it would only guarantee that every deployment
must carry the identical salt forever or all issued keys stop working.

**Keys are looked up by unique index on the hash**, so there is no
string comparison to time and no way to enumerate keys through response timing.

**Every route under `/api/v1` is authenticated.** That is enforced by Fastify
encapsulation — the auth hook is registered on the `/api/v1` scope, so a new
route is authenticated by existing, not by being added to a list somebody has
to remember to update. `/health` is outside that scope and is the only public
route.

**Scopes are checked on the server, per request.** The HTTP method implies the
minimum (`GET` needs `read`, anything else needs `write`), and admin-only
routes — lock, unlock, archive, and all key management — carry an explicit
`requireScope('admin')`. Scopes are normalized on issue so that `admin` implies
`write` implies `read`, which means every downstream check is a plain
membership test and no key can exist in a state like admin-without-read.

**Revocation is immediate and permanent.** Revoked keys are not deleted — a
revoked key is evidence — but they stop authenticating on the next request.
Expiry is checked on the same path.

## Environment isolation

**The environment is derived from the API key and is never a parameter.** There
is no endpoint that accepts an environment, an org ID, or a user ID as input.
A staging key cannot read or write production because there is nothing to
tamper with: the key's `envId` is the query.

Every query is scoped by both `orgId` and `envId` from the authenticated
context, including the lookups behind rollback, history, and archive.

**Creating a key puts it in the calling key's own environment.** An admin key
cannot name a different one. That was possible until the September 2026 review
and was fixed: it made a staging admin key a route to a production key, which
is the exact boundary the rest of the API keeps. Bootstrapping the first key
for a brand new environment is a server-side operation, not an API call.

**End-user identifiers never reach the API.** Bucketing is MurmurHash3 over
`flagKey:userId` inside the SDK, on your servers. `GET /evaluate` takes no
parameters at all. There is nothing to leak because nothing is sent, and this
is a permanent constraint, not a default.

## Auditing

Every mutation writes its audit row **in the same database transaction** as the
change. There is no code path that alters a flag without a row recording who,
when, before, and after. If the audit write fails, the change does not happen.
Rollback and lock are themselves audited.

## Error handling

Any 5xx is replaced with `"Something went wrong on our end."` plus a request
ID. Database errors, stack traces, hostnames, and file paths never reach a
client; they go to the structured log. Deliberate 4xx messages are written to
tell a developer what they did wrong and carry no internal detail.

`401` is the same message for an unknown key and a revoked one. Telling an
attacker which of their guesses was a real-but-revoked key is free information.

## Rate limiting

600 requests per minute per IP across every endpoint, including `/health`,
returning `429` / `RATE_LIMITED`. The limiter runs as a root-level hook, ahead
of authentication, so an unauthenticated flood is rejected without a database
lookup.

This is an abuse and availability control, not the defence against key
guessing — at 192 bits of entropy, guessing is not a threat a rate limit
meaningfully changes.

The counter is in-process. With more than one API instance a client gets the
limit times the instance count; the fix is the plugin's Redis store, and the
trigger is the second instance.

## Transport and headers

TLS terminates at the platform edge (Render today, an ALB later).
`TRUST_PROXY` is the **number of proxy hops**, not a boolean, so per-IP
limiting sees the real client rather than the proxy. It defaults to 0, meaning
no proxy is trusted and only the socket address counts.

This distinction is the whole thing: Render appends to `X-Forwarded-For`
instead of replacing it, so "trust every hop" would make the app read the
left-most entry — whatever the client wrote — and the rate limit could be
bypassed by rotating one header. A hop count makes the app walk in from the
socket and stop at the address the proxy observed, which a client cannot forge.
Regression tests in `packages/api/test/security.test.ts` assert that rotating a
spoofed `X-Forwarded-For` does not buy a fresh allowance.

Responses carry `x-content-type-options: nosniff`, `x-frame-options: DENY`, and
`referrer-policy: no-referrer`. CORS is disabled: this is a server-to-server
API and no browser should be calling it with a key.

## The CLI

**`init` will not hand your key to an arbitrary host.** It refuses any
`--api-url` that is not `flagrship.dev`, a subdomain of it, or a loopback
address, and refuses plain `http` to anything remote — before the key leaves
the machine, because a warning printed afterwards is a receipt. Self-hosting
uses `--allow-custom-host`, which is deliberately something a victim would have
to paste knowingly.

**The key does not have to appear in argv.** `--key -` reads stdin and
`$FLAGRSHIP_API_KEY` is the fallback, so it need not be visible to `ps` or land
in shell history.

**`.flagrship.json` is written `0600`** and added to `.gitignore`
automatically. `--verbose` prints method, URL, and status only — never the key,
the authorization header, or a body.

## What Flagrship deliberately does not do yet

Listed because a security posture with no gaps in it is not a real one.

| Not done | Why, and what would change it |
|---|---|
| **Keys stored in plain text on disk** | A gitignored `0600` file is what `npm` and `gh` do. It protects against a committed key and other accounts on a shared machine, not against malware running as you. OS keychain integration means a native dependency and three keychains to debug; the trigger is a user asking for it. Mitigation today is that keys are cheap to revoke and rotate. |
| **No short-lived tokens** | Keys are long-lived and revocable. OAuth-style token exchange needs an identity provider, which arrives with the dashboard. |
| **Rate limiting is per instance** | See above. Redis store at instance #2. |
| **No automated key rotation** | Rotation is manual: issue a new key, deploy, revoke the old one. Worth automating when someone has enough keys to lose track. |
| **No anomaly detection or alerting on failed auth** | `last_used_at` is recorded per key and 401s are logged, but nothing watches them. Alerting presumes someone is awake to read it; the trigger is an on-call rotation. |
| **No blocking dependency gate in CI** | Dependabot runs weekly and every update PR runs the full suite. A blocking `npm audit` step is deliberately absent: it would fail today on advisories that live entirely in build and test tooling and cannot be fixed without a breaking major, so it would be ignored within a week. It goes in when it can be green. Static analysis (CodeQL) is not set up yet. |
| **No penetration test** | Nobody independent has tried to break it. A real audit should go route by route rather than read this file. |
| **Public demo key** | The read-only key on the landing page is intentional and points at a demo organization. It can read and cannot change anything. |

## Dependencies

The runtime footprint is deliberately small: Fastify, Prisma, Zod, Pino and the
Fastify CORS and rate-limit plugins on the server; one dependency in the CLI;
**zero** in both SDKs. Known advisories at the time of writing are in dev-only
tooling (Vitest, the esbuild dev server, the Prisma CLI's config parser) and
are not reachable from a request.

## Verifying any of this

The claims above have runnable checks, not just prose:

```
npm test            # 220 tests: API, CLI, JavaScript SDK, Python SDK
```

`packages/api/test/security.test.ts` covers rate limiting, the response
headers, and the environment boundary on key creation.
`packages/api/test/week3.test.ts` covers scope gating, lock enforcement, and
the audit trail. `packages/cli/test/cli.test.ts` covers the `--api-url` guard,
including lookalike hosts, the file mode, and that `--verbose` never prints a
key.
