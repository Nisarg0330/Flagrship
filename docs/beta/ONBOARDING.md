# Beta onboarding

One call per team, 30 minutes, same shape every time. The goal is not to
teach them Flagrship. It is to watch where they get stuck and write it down.

## Before the call

Reply to their beta request with three questions. Their answers decide what
you prepare:

1. Which language? (JavaScript or Python today. Anything else → they are a
   design partner for that SDK, not a beta user yet.)
2. What are your environments called? (Most say production/staging. Some say
   prod/dev/qa. Create the org with *their* names, not ours.)
3. What is the first feature you would put behind a flag? (This is the flag
   you create together on the call. A real one, not `test-flag`.)

Then, with the seed admin key:

```powershell
# One org per team. Environments in their words. Prints the keys once.
$env:DATABASE_URL = "<neon url>"
npx tsx packages/api/prisma/org.ts --name "Acme" --slug acme --email dev@acme.com --envs production,staging
```

Paste the keys into the call invite as a private note. Admin-scoped keys are
not minted for beta teams; lock, unlock and archive go through you.

## The call

**0–5 min — their setup, not ours.** Have them share their screen. Ask them to
open the repo where the feature lives. You are looking for: which CI, where
config lives, whether they already have a flag-shaped thing (an env var, a
config toggle) they are working around.

**5–10 min — install and init.** They type, you watch. Do not touch their
keyboard.

```
npm install -g @flagrship/cli
flagrship init --key <their staging write key>
flagrship list
```

Things that go wrong here, in order of frequency so far:
- Windows PowerShell: `.flagrship.json` lands in the wrong folder because they
  ran `init` from home. Ask them to `cd` into the repo first.
- They paste the key with the surrounding quotes from the invite.
- Corporate proxy: `init` times out. Note it, move on with `--api-url` later.

**10–20 min — the real flag.** Create the flag from question 3. Then the SDK
in their code, on a branch, around the actual feature. Aim to get to this
line in their file:

```ts
if (flags.isEnabled('<their-flag>', user.id)) {
```

Watch for: where they put `ready()` (should be app boot, once), whether they
try to pass an object instead of a user ID, whether they expect the flag to
exist per environment or globally.

**20–25 min — the loop.** With their app running locally:

```
flagrship rollout <flag> 100     # they watch it flip
flagrship rollback <flag>        # they watch it flip back
flagrship log <flag>
```

If it does not flip within 30 seconds, ask: is `pollInterval` set? Is the SDK
instance created once or per request? The second one is the common mistake.

**25–30 min — the question that matters.** "What would stop you from using
this on the feature you are actually shipping next week?" Write the answer
verbatim. Do not defend, do not explain. That sentence is the product roadmap.

## After the call

Within the hour, while it is fresh:

1. File every friction point as an issue with the `beta-feedback` label using
   the template. One issue per friction, not one issue per team.
2. Send them the read key for their production environment and one paragraph
   on what you changed because of the call, if anything.
3. Add them to the beta channel.

## What we are counting

The plan says "prioritise by frequency". After five calls, sort the
`beta-feedback` issues by how many teams hit each one. The top five are the
hardening backlog. Everything else waits.

## What we are not doing in beta

- Building features a single team asked for. Two teams is a pattern; one is
  an anecdote.
- Fixing things live on the call. Write it down, fix it after, tell them.
- Promising dates.
