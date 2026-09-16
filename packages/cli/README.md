# @flagrship/cli

Manage feature flags from the terminal. Ship without a release.

```
npm install -g @flagrship/cli

flagrship init --key sk_test_your_key --api-url https://your-api.example.com
flagrship create new-checkout
flagrship enable new-checkout
flagrship rollout new-checkout 25
flagrship rollback new-checkout
flagrship log new-checkout
```

One key per environment in a gitignored `.flagrship.json`. `--env` selects a
key; the server never takes an environment parameter. `--json` for scripts.

Docs: https://github.com/Nisarg0330/Flagrship
