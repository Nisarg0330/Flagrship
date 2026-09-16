# flagrship-sdk

```python
from flagrship import Flagrship

flags = Flagrship(api_key="sk_read_...")
flags.ready()

if flags.is_enabled("new-checkout", user.id):
    show_new_checkout()
```

Fetches config on init, polls with `If-None-Match`, evaluates in memory.
Never raises on the boot path: an unreachable API means defaults, not a crash.
Standard library only.
