# @flagrship/cli

Manage feature flags from the terminal. Ship without a release.

```
npm install -g @flagrship/cli

export FLAGRSHIP_API_KEY=sk_test_your_key   # keeps it out of shell history
flagrship init
flagrship create new-checkout
flagrship enable new-checkout
flagrship rollout new-checkout 25
flagrship rollback new-checkout
flagrship log new-checkout
```

One key per environment in a gitignored `.flagrship.json`, written `0600`.
`--env` selects a key; the server never takes an environment parameter.
`--json` for scripts.

`init` sends your key to whatever `--api-url` names, so it refuses any host
that is not `flagrship.dev` or a local address, and refuses plain `http` to a
remote host. Self-hosting is `--allow-custom-host`. If someone sends you an
`init` command carrying that flag, do not run it.

Docs: https://github.com/Nisarg0330/Flagrship
