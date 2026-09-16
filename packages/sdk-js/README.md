# @flagrship/sdk

Evaluate feature flags in-process. Fetch once, poll quietly, no network call
per check. 2 KB gzipped, zero dependencies, Node 18+.

```ts
import { Flagrship } from '@flagrship/sdk';

const flags = new Flagrship({ apiKey: process.env.FLAGRSHIP_KEY });
await flags.ready();

if (flags.isEnabled('new-checkout', user.id)) {
  showNewCheckout();
}
```

Never throws on your boot path: if the API is unreachable, flags evaluate to
the defaults you pass in and the SDK keeps serving its last config.

Server-side only. The API key must never ship to a browser.

Docs: https://github.com/Nisarg0330/Flagrship
