# Flagrship — Execution Plan v2

Supersedes the week-by-week schedule in *Flagrship Project Phases v1.0* and the
"what to build next" section of the *Claude Code Handoff*. The PRD and TRD stay
valid as specifications — this changes the **order and the scope**, not the product.

Date: 2026-09-15 · Author: plan revision after full doc + repo audit

---

## 1. Ground truth

### What actually exists

| Thing | State |
|---|---|
| npm workspace monorepo | ✅ `packages/{api,cli,dashboard,infra,sdk-js,sdk-python}` |
| `docker-compose.yml` | ✅ Postgres 16 + Redis 7, both healthy |
| `prisma/schema.prisma` | ✅ 7 models: Organization, User, Environment, ApiKey, Flag, FlagConfig, AuditLog |
| `packages/api/package.json` | ✅ deps declared (fastify 5, prisma 6, zod 3, ioredis 5, pino 9, murmurhash-js) |
| API source code | ❌ **nothing.** `src/lib`, `src/middleware`, `src/routes`, `src/types` are empty |
| Seed script | ❌ does not exist |
| Tests | ❌ none, vitest not configured |
| CLI / SDKs / dashboard / infra | ❌ empty directories |

### Corrections to the source documents

1. **Handoff §2.3 "API Server (Fastify — WRITTEN, NOT YET TESTED)" is false.** No
   endpoint exists. The first task is not "test the endpoints," it's "write them."
2. **Handoff §3 "Temporary Shortcuts to Replace"** describes `getOrCreateDemoOrg()`
   and `getOrCreateDemoUser()` — these don't exist. Don't write them. The seed
   script plus auth middleware land in the same two weeks, so there is never a
   window where the shortcut is needed.
3. **`API_KEY_SALT` in `.env` should be deleted.** API keys are 192 bits of
   `crypto.randomBytes` — a salt/pepper protects low-entropy secrets from rainbow
   tables, and buys nothing here. Keeping it means every deploy must carry the
   identical value forever or every issued key stops authenticating. Plain SHA-256
   is what Stripe, GitHub, and LaunchDarkly do with high-entropy tokens.
4. **Drop the `nanoid` dependency.** `crypto.randomBytes(24).toString('base64url')`
   is stdlib and is the key generator.
5. **`AuditLog.id` is uuid v4; TRD §3.2.7 specifies UUIDv7.** The
   `@@index([orgId, createdAt desc])` already serves timeline queries, so v4 is
   fine — amend the TRD, not the schema.
6. **Schema has no `webhooks` model** (TRD lists 8 tables, schema has 7). Correct —
   webhooks are Phase 4.
7. **Lock in one constraint now:** PRD §11.1 / TRD §11.1 promise the API never sees
   end-user identifiers. That means `GET /evaluate` must never accept a `userId`
   parameter. Bucketing is client-side, forever. It is easy to violate this by
   accident in week 4 and impossible to walk back later.

---

## 2. What changes, and why

The v1 plan spends four weeks building and deploying the API — including two days
of Terraform for RDS Multi-AZ, ElastiCache cluster mode, ECS Fargate, ALB, and
CloudFront — before a single line of CLI or SDK exists. Gate 1 forbids starting
the SDKs until the API is live on AWS staging.

That is eight weeks before anyone, including you, can see the product work.

**The new order closes the loop first.** The demo that sells Flagrship is three
commands long:

```
$ flagrship create new-checkout          # app prints: false
$ flagrship rollout new-checkout 100     # app prints: true
$ flagrship rollback new-checkout        # app prints: false
```

Everything else in the documents is scaffolding around that loop. Reach it on
localhost in ~4 weeks of work, then build the AWS stack underneath it, then recruit
beta users.

### The Gate 1 rule is inverted deliberately

v1 Gate 1 says *"do not start SDKs. API bugs are fatal."* The intent is right —
don't build on a broken API. But **a staging deploy is not validation; tests are.**
An integration suite driving create → enable → rollout → rollback → history against
a local Postgres catches strictly more than "it responded to curl on AWS." The new
gate keeps the intent and drops the AWS prerequisite.

### What gets cut from Phase 1, and the trigger to add it back

| Cut | Why now | Add when |
|---|---|---|
| **Redis cache on `/evaluate`** | A Postgres read of ~50 rows is sub-5ms at any load this year. The `flags:{org}:{env}` + 60s TTL + invalidate-on-every-mutation design adds a whole class of stale-config bugs — TRD §12.2 already lists "stale `/evaluate` data" as a *Critical* alert — to speed up something nobody can measure. An ETag on the response does more for real load than the cache would. | `/evaluate` p95 > 30ms under real traffic, or read replicas appear |
| **SSE real-time sync** | Requires Redis Pub/Sub for fan-out, which requires more than one API instance, which does not exist. 30-second polling with ETag/304 is fine for beta. | A beta team says 30s is too slow. Start with an in-process `EventEmitter`; add Redis Pub/Sub at instance #2 |
| **ElastiCache wired into the app** | Terraform provisions it in weeks 6–7, but the API stays Redis-free. Gate the module behind a `redis_enabled` variable, default off, so an idle cluster is not billed before anything reads from it. | Same trigger as the two rows above |
| **Datadog APM** | ECS ships CloudWatch logs for free, and Pino already writes structured JSON. Alerting presumes somebody is awake to be paged. | There is an on-call rotation |
| **`audit_logs` monthly partitioning** | Partitioning pays off around 50M rows. You will have ~thousands. | > 10M rows, or a paid tier needs enforced retention dropping |
| **500-fixture conformance suite** | The suite exists to keep N SDKs identical. With one SDK it tests only itself. | See week 5 — a ~30-fixture seed lands with the JS SDK, expands to 500 when Python arrives |
| **`keytar` OS-keychain storage** | Native dependency, three OS keychains to debug, on a Windows dev machine. A gitignored `.flagrship.yml` is what `npm` and `gh` do. | A beta user objects to the plaintext file |
| **`@fastify/rate-limit` backed by Redis** | One instance, authenticated endpoints only. The in-memory default costs one line when it is wanted. | The API is publicly reachable and unauthenticated traffic shows up |
| **Multivariate flags, webhooks, targeting rules, teams, dashboard** | Correctly scoped in the docs already | Phase 4+, unchanged |

Nothing on this list is cut from the *product*. Each one keeps its place in the
PRD/TRD and gains an explicit trigger, so "later" has a definition.

---

## 3. The plan

Weeks are renumbered from reality. Week 1 (schema + compose + workspace) is done.

### Week 2 — API core

The work the handoff claimed was finished.

- `src/lib/db.ts` — Prisma client singleton.
- `src/server.ts` — Fastify with `logger: true` (Pino is built in; no separate
  logger config). Global error handler emitting the TRD §4.4 envelope
  (`code`, `message`, `field`, `request_id`). `GET /health` verifying DB.
- `src/routes/flags.ts` — `POST /api/v1/flags` (auto-creates a `FlagConfig` for
  every environment), `GET /api/v1/flags` (filter `?env=`, `?search=`),
  `GET /api/v1/flags/:key`, `POST .../enable`, `.../disable`, `.../rollout`,
  `GET .../history`.
- Zod parse in each handler. No `fastify-type-provider-zod` — one dependency for
  what `schema.parse(req.body)` already does.
- **Every mutation wraps the config write and the audit row in one
  `prisma.$transaction`.** This is the one place in the plan where the lazy
  version is not acceptable: a mutation that lands without its audit row is a
  silent compliance hole, and TRD §12.2 rates audit-write failure *Critical*.
- `prisma/seed.ts` — one org, one admin user, three environments
  (production/staging/development), one API key per environment, printing the raw
  keys once.

**Check:** `test/flags.test.ts` — one vitest file driving create → enable →
rollout 25 → history against the local Postgres. Configure vitest here, with the
first test, as the tech-stack table says.

**Done when:** the full flag lifecycle passes locally and every mutation has a
matching audit row.

### Week 3 — Auth, rollback, lock

- `src/middleware/auth.ts` as a Fastify `onRequest` hook (Fastify's hook system is
  the middleware layer — no custom framework). Parse `Authorization: Bearer`,
  SHA-256 via `node:crypto`, look up `ApiKey` where not revoked and not expired,
  attach `{ orgId, envId, scopes }` to the request. Scope gate: `GET` → `read`,
  `POST` → `write`, lock/unlock/delete/keys → `admin`.
- `POST|GET|DELETE /api/v1/keys`. Format `sk_live_` / `sk_test_` / `sk_read_` /
  `sk_admin_` + `crypto.randomBytes(24).toString('base64url')`. Raw key returned
  exactly once; store `keyPrefix` (first 8) + `keyHash`.
- `POST /api/v1/flags/:key/rollback`.

  **Semantics — decide once, here:** rollback restores the `beforeState` of the
  most recent mutation on that flag+environment (enable, disable, *or* rollout),
  and is itself logged as `flag.rollback` with its own before/after. A second
  rollback therefore undoes the first. It is an **undo stack**, one rule, no
  special cases. Document it as "undo," not "revert to a known-good state" —
  people at 3am will assume whichever you write down, so write it down.

  Note this differs from TRD §4.3.2, which reads only the last `flag.rollout`
  entry. That version silently ignores a disable, and ping-pongs on the second
  call. Amend the TRD.
- `POST .../lock` (body: `reason`, admin scope) and `.../unlock` (admin).
  A locked config rejects enable/disable/rollout with `409` and includes
  `lock_reason` in the response body.

**Check:** extend the test file — missing key → 401, read key attempting a write
→ 403, locked flag → 409, rollback restores the prior percentage, second rollback
restores the one before that.

**Done when:** no route is reachable without a valid scoped key, and the demo-org
shortcut was never written.

### Week 4 — `/evaluate` + CLI

- `GET /api/v1/evaluate` — environment resolved from the API key. Returns
  `[{ key, enabled, rolloutPercentage, targetingRules }]`. Direct Postgres query,
  no cache. Set an `ETag` (hash of the serialized payload) and honour
  `If-None-Match` with `304`. **No `userId` parameter, ever** (see §1.7).
- `packages/cli` — TypeScript + esbuild single file, Commander. Commands:
  `init`, `create`, `list`, `enable`, `disable`, `rollout`, `rollback`, `status`,
  `log`. Global flags `--env`, `--json`. Key stored in a gitignored
  `.flagrship.yml`. Human table by default, colored output, 3 retries with
  exponential backoff.

**Check:** a CLI integration test running each command against the local API.

**Done when:** `flagrship create` → `flagrship rollout 25` → `flagrship status`
round-trips against localhost.

### Week 5 — JS SDK · **the loop closes**

- `packages/sdk-js` — `new Flagrship({ apiKey })`, fetch `/evaluate` on init,
  hold a `Map`, `isEnabled(key, userId, default?)` synchronous and in-memory.
- **MurmurHash3, 32-bit x86, seed 0, over UTF-8 `{flagKey}:{userId}`,
  bucket = hash % 100, ON when `bucket < rolloutPercentage`.** This is the single
  decision in the entire project that cannot be changed later — altering it
  re-buckets every user of every customer. Get it byte-exact against the
  reference implementation.
- **Write the fixture file here**, ~30 cases: boundaries 0/1/49/50/99/100, fixed
  user IDs with expected buckets, `null` userId at rollout < 100 → false, missing
  flag → default, disabled flag → false, archived flag → false, unicode flag key.
  Cheap now; it is the thing that makes the Python SDK a two-day job instead of a
  two-week debugging session.
- Polling sync with `If-None-Match`, default 30s, configurable.
- Graceful degradation: a failed init resolves to developer-supplied defaults and
  **never throws on the application boot path** (PRD §15 rates SDK-caused app
  failure *Critical*).

**GATE A — the demo.** `flagrship create x` → a Node app prints `false` →
`flagrship rollout x 100` → within one poll the same app prints `true` →
`flagrship rollback x` → `false`. Audit history shows all three actions with actor
and before/after. If this doesn't work, nothing after it matters.

### Weeks 6–7 — AWS infrastructure + CI/CD

The TRD §10.1 stack, built where it belongs: underneath an API that already has a
passing integration suite, rather than underneath an untested one.

Two weeks, not the two days v1 budgeted. VPC + RDS Multi-AZ + ElastiCache + ECS
Fargate + ALB + ACM + Route53 from scratch, solo, first time, is not a two-day task,
and pretending otherwise is how week 4 of the old plan quietly became week 6.

- **Switch from `prisma db push` to `prisma migrate` before the first deploy.**
  `db push` against a database holding real data is a data-loss tool. Generate the
  initial migration now, while the only data is seed data.
- Multi-stage `Dockerfile` for the API. Non-root user, `node:22-alpine`, production
  deps only in the final layer.
- `packages/infra/` Terraform per TRD §10.1: VPC with public/private subnets, RDS
  PostgreSQL 16 Multi-AZ, ECS Fargate service, ALB with an ACM certificate, Route53
  record. State in S3 with DynamoDB locking. DB and JWT secrets in AWS Secrets
  Manager.
- **ElastiCache Redis 7 goes in the Terraform, gated behind `redis_enabled`,
  default `false`.** The module is written now so it is one variable flip later; the
  cluster is not billed while nothing reads from it. The API stays Redis-free until
  the trigger in §2 fires.
- `prisma migrate deploy` as a pre-deploy step. ECS rolling deployment with health
  check validation and automatic rollback on failure.
- GitHub Actions: lint + type-check + test on PR. Build → push to ECR → deploy to
  staging on merge to main. Production behind a GitHub Environment manual approval.

**Check:** run the week 2–4 integration suite with its base URL pointed at the
staging ALB. Then deliberately push a broken health check and confirm ECS rolls the
deployment back instead of serving it — an untested rollback path is not a rollback
path.

### Week 8 — Python SDK + conformance

- `packages/sdk-python` — mirror of the JS SDK. `threading.Lock` around config
  access; evaluation lock-free against an atomically swapped snapshot.
- Runs the **same fixture file** as the JS SDK. The conformance suite now earns its
  existence — expand toward 500 cases as real edge cases surface.

**GATE B — Phase 2 complete.** Public API URL on AWS. CLI and both SDKs work against
it. Fixtures pass 100% in both languages. SDK init < 200ms.

### Weeks 9–10 — Docs, landing page, beta recruitment

v1 Phase 3 weeks 9–10, unchanged.

- Docs site (Nextra or Mintlify): Quickstart, CLI reference, SDK references, API
  reference, Concepts.
- `flagrship.dev` landing page: value prop, live code sample, CLI demo GIF, waitlist.
- Publish `@flagrship/cli` and `@flagrship/sdk` to npm, `flagrship-sdk` to PyPI.
  Homebrew tap.
- Recruit 10–15 beta teams. 1:1 onboarding calls. Log every friction point.

### Weeks 11–12 — Harden on real feedback

Deliberately unspecified. Fix the top 5 blockers beta users actually report, not the
5 the documents guessed at. This is also where the deferred list gets its first real
trigger — if beta teams complain about 30-second propagation, SSE gets built here,
and it gets built because somebody asked.

Then: rate limiting if the traffic warrants it, a k6 run to find the actual ceiling,
monitoring proportional to who is awake to read it.

### Phase 4 onward

The v1 plan's Phases 4, 5, and 6 (dashboard & teams · intelligence & safety · scale
& enterprise) stand as written. They are correctly ordered and correctly scoped;
they were never the problem. Revisit their week counts once there is real velocity
data from Phases 1–3 instead of estimates.

---

## 4. Revised gates

| Gate | Must be true | If not |
|---|---|---|
| **A** (end wk 5) | Create → rollout → SDK flips → rollback, end to end on localhost. Audit trail complete. Fixtures pass. | Do not deploy. Do not write the Python SDK. A second SDK built on a wrong hash is two SDKs to fix. |
| **B** (end wk 8) | API live on AWS. CLI + JS + Python all working against it. Conformance 100%. Migrations — not `db push` — in the deploy path. Rollback path tested. | Do not invite beta users. v1 was right: a broken first impression is permanent. |
| **C** (end wk 10) | Docs live, packages published, 10+ teams onboarded. | Extend recruitment. Do not start the dashboard. |
| **D** (Phase 4) | Unchanged from v1 Gate 4: dashboard handles flag management end to end, ≥1 paying customer, Stripe live. | Revenue validates demand. If nobody pays, re-examine the product, not the feature list. |

---

## 5. Summary of the change

| | v1 plan | v2 plan |
|---|---|---|
| First working demo | Week 8 | **Week 5** |
| AWS stack built | Week 4, under an untested API, 2 days budgeted | Weeks 6–7, under a tested API, 2 weeks budgeted |
| Redis in Phase 1 | Cache + Pub/Sub wired into the API | Provisioned behind a flag, unwired |
| Real-time in Phase 1 | SSE + Redis fan-out | Polling + ETag/304 |
| Conformance suite | 500 fixtures, week 7 | ~30 at SDK #1, 500 at SDK #2 |
| Monitoring in Phase 1 | Datadog APM + PagerDuty | CloudWatch + Pino |
| Weeks to beta users | 10 | 10 |

Same beta date, same shipped scope. The difference is that the product is
demonstrably working five weeks earlier, the AWS build happens underneath an API
with a passing test suite, and every deferred item carries a written trigger instead
of an implied "eventually."

---

## 6. Immediate next action

Write `packages/api/src/lib/db.ts` and `packages/api/src/server.ts`, then
`src/routes/flags.ts` — Week 2 above. There is no code to test yet, so testing the
endpoints cannot be the first task the way the handoff describes.

Extracted plain-text copies of all five source documents are in `_docs/` for
grep-ability.
