# Show HN draft

For the public beta, not the private one. Written now while the technical
story is fresh; revise with what beta teams actually said.

HN respects specifics and distrusts adjectives. Every sentence below is a
fact about the code or a decision with a reason. No "seamless", no "powerful".

---

**Title:** Show HN: Flagrship – feature flags with a CLI, an undo-stack rollback, and a 2 KB SDK

**Body:**

I built a feature flag service because every team I have been on either paid
LaunchDarkly prices for three flags or grew a `config.yml` with `enable_new_checkout: false` in it and a Slack message saying "don't touch that".

Flagrship is the small middle: a REST API, a CLI, and SDKs for JavaScript and
Python. You deploy code dark, roll it out by percentage, roll it back from the
terminal.

    npm install -g @flagrship/cli
    flagrship create new-checkout
    flagrship rollout new-checkout 25
    flagrship rollback new-checkout

Things I think are worth arguing about:

**Rollback is an undo, not a revert.** It restores the state before the most
recent change and logs itself as a change, so a second rollback undoes the
first. I went back and forth on this. "Revert to last known good" sounds
better until you try to define "known good" at 3am. Undo has one rule.

**The API never sees a user ID.** Bucketing is MurmurHash3 over
`flagKey:userId` inside the SDK; `/evaluate` has no parameters at all. There
is nothing to leak because nothing is sent. This also means the same user
gets the same answer from a Node service and a Python service, which is
enforced by both SDKs passing one JSON fixture file.

**No Redis.** `/evaluate` is a Postgres read with a strong ETag. The SDK
polls every 30s with `If-None-Match` and gets a 304 with an empty body when
nothing changed. Config crosses the wire once, then only when you change it.
I have a written trigger for when to add a cache and it has not fired.

**Locks.** An admin can lock a flag with a reason. Every mutation on it
returns 409 with that reason in the message. Archive is refused while locked
in any environment, because archiving evaluates to false everywhere and that
is exactly what a lock exists to prevent. This came from a real incident on a
previous team where someone re-enabled the thing we were containing.

**Every mutation writes its audit row in the same transaction.** There is no
code path that changes a flag without a row saying who, when, before, after.
If the audit write fails the change does not happen.

Things I am less sure about and would like to hear from you on:

- 30-second polling. Real-time via SSE is designed, not built. Is 30s too slow
  for a kill switch? My instinct is that if you need sub-second, you need a
  circuit breaker, not a flag.
- The CLI stores keys in a gitignored JSON file, one per environment. keytar
  felt like a native-dependency tax for a problem nobody has complained about
  yet.
- Pricing is per seat, never per MAU. I do not know if that survives contact
  with a team that has 200 engineers and 30 users.

Try it without signing up: there is a read-only key on the landing page that
points at a real org on the live API. `flagrship list`, `flagrship log`, and
the SDK all work against it. `rollout` will refuse you with a scope error,
which is the point.

Stack: Fastify + Prisma on Postgres, esbuild for the CLI, Next.js static
export for the site. Source is on GitHub; the CLI and SDKs are MIT.

https://flagrship.dev

---

## Before posting

- [ ] Replace "beta teams said" placeholders with real quotes from the
      friction log
- [ ] Confirm the demo key still works and the demo org is tidy
- [ ] Post Tuesday–Thursday, 8–10am ET
- [ ] Be at the keyboard for six hours after. Answer every comment, especially
      the hostile ones, with a specific fact
- [ ] Do not edit the post after the first hour. Corrections go in comments
