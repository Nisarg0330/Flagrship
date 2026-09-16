"""The Flagrship client. Mirrors packages/sdk-js/src/index.ts exactly.

Standard library only. `urllib` for HTTP, `threading` for the poll loop.
A flag SDK that pulls in `requests` doubles a customer's dependency surface
for one GET.
"""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional

from .hash import bucket

DEFAULT_API_URL = "https://api.flagrship.dev"
DEFAULT_POLL_INTERVAL = 30.0
DEFAULT_TIMEOUT = 10.0


@dataclass(frozen=True)
class FlagConfig:
    """The shape /evaluate returns per flag. Mirrors the API, never extended client-side."""

    key: str
    enabled: bool
    rollout_percentage: int
    targeting_rules: Any = None

    @classmethod
    def from_api(cls, raw: Mapping[str, Any]) -> "FlagConfig":
        return cls(
            key=raw["key"],
            enabled=bool(raw["enabled"]),
            rollout_percentage=int(raw["rolloutPercentage"]),
            targeting_rules=raw.get("targetingRules"),
        )


@dataclass
class _Response:
    """What a transport returns. Only the three things the SDK looks at."""

    status: int
    body: bytes
    etag: Optional[str]


Transport = Callable[[str, Mapping[str, str]], _Response]


def _urllib_transport(url: str, headers: Mapping[str, str]) -> _Response:
    req = urllib.request.Request(url, headers=dict(headers), method="GET")
    try:
        with urllib.request.urlopen(req, timeout=DEFAULT_TIMEOUT) as res:
            return _Response(res.status, res.read(), res.headers.get("ETag"))
    except urllib.error.HTTPError as err:
        # urllib raises on 304 and 4xx/5xx alike. 304 is not an error to us.
        return _Response(err.code, err.read() or b"", err.headers.get("ETag"))


class Flagrship:
    """Evaluate feature flags in-process. No network call per check.

    >>> flags = Flagrship(api_key="sk_read_...")
    >>> flags.ready()
    >>> if flags.is_enabled("new-checkout", user.id):
    ...     show_new_checkout()
    """

    def __init__(
        self,
        api_key: str,
        *,
        api_url: str = DEFAULT_API_URL,
        poll_interval: float = DEFAULT_POLL_INTERVAL,
        defaults: Optional[Mapping[str, bool]] = None,
        on_update: Optional[Callable[[Mapping[str, FlagConfig]], None]] = None,
        on_error: Optional[Callable[[Exception], None]] = None,
        transport: Optional[Transport] = None,
    ) -> None:
        if not api_key:
            raise ValueError("Flagrship: api_key is required.")

        self._api_key = api_key
        self._evaluate_url = f"{api_url.rstrip('/')}/api/v1/evaluate"
        self._poll_interval = poll_interval
        self._defaults = dict(defaults or {})
        self._on_update = on_update
        self._on_error = on_error
        self._transport = transport or _urllib_transport

        # Evaluation reads `_flags` without a lock. Sync replaces the whole dict
        # in one assignment, which is atomic in CPython, so a reader sees either
        # the old snapshot or the new one - never a half-written mix. The lock
        # only serialises writers (the poll thread vs. an explicit refresh()).
        self._flags: dict[str, FlagConfig] = {}
        self._etag: Optional[str] = None
        self._write_lock = threading.Lock()

        self._closed = threading.Event()
        self._ready = threading.Event()
        self._poll_thread: Optional[threading.Thread] = None

        # First sync runs on a background thread so construction never blocks
        # and never raises on a network failure. Call ready() to wait for it.
        threading.Thread(target=self._initial_sync, name="flagrship-init", daemon=True).start()

    # ── public ────────────────────────────────────────────────────────────

    def ready(self, timeout: Optional[float] = None) -> bool:
        """Block until the first sync attempt finishes, success or failure.

        Returns False only if `timeout` elapsed first. Never raises.
        """
        return self._ready.wait(timeout)

    def is_enabled(
        self, flag_key: str, user_id: Optional[str] = None, default: Optional[bool] = None
    ) -> bool:
        """The whole product, in one in-memory call.

        1. Unknown flag             -> default (or defaults[key], or False)
        2. Disabled                 -> False
        3. Rollout 100              -> True, no user needed
        4. No user_id, rollout < 100 -> False (cannot bucket without an identifier)
        5. bucket(key, user_id) < rollout_percentage

        Targeting rules are carried in the config but not evaluated yet (Phase 4).
        """
        flag = self._flags.get(flag_key)
        if flag is None:
            if default is not None:
                return default
            return self._defaults.get(flag_key, False)
        if not flag.enabled:
            return False
        if flag.rollout_percentage >= 100:
            return True
        if not user_id:
            return False
        return bucket(flag_key, user_id) < flag.rollout_percentage

    def get_flag(self, flag_key: str) -> Optional[FlagConfig]:
        return self._flags.get(flag_key)

    def all_flags(self) -> dict[str, FlagConfig]:
        """A snapshot. Safe to iterate while polling continues."""
        return dict(self._flags)

    def refresh(self) -> bool:
        """Sync now instead of waiting for the next poll. True if config changed."""
        try:
            return self._sync()
        except Exception as err:  # noqa: BLE001 - the SDK must never propagate
            self._report(err)
            return False

    def close(self) -> None:
        """Stop polling. The last config stays in memory and is_enabled() keeps working."""
        self._closed.set()

    def __enter__(self) -> "Flagrship":
        self.ready()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    # ── internal ──────────────────────────────────────────────────────────

    def _initial_sync(self) -> None:
        try:
            self._sync()
        except Exception as err:  # noqa: BLE001
            self._report(err)
        finally:
            self._ready.set()
            self._start_polling()

    def _start_polling(self) -> None:
        if self._closed.is_set() or self._poll_interval <= 0:
            return

        def loop() -> None:
            # Event.wait doubles as an interruptible sleep: close() wakes it.
            while not self._closed.wait(self._poll_interval):
                self.refresh()

        self._poll_thread = threading.Thread(target=loop, name="flagrship-poll", daemon=True)
        self._poll_thread.start()

    def _sync(self) -> bool:
        """One GET /evaluate. Sends the last ETag; 304 leaves config untouched."""
        headers = {"Authorization": f"Bearer {self._api_key}"}
        with self._write_lock:
            if self._etag:
                headers["If-None-Match"] = self._etag

            res = self._transport(self._evaluate_url, headers)

            if res.status == 304:
                return False
            if res.status < 200 or res.status >= 300:
                hint = " - check the API key" if res.status == 401 else ""
                raise RuntimeError(f"Flagrship: /evaluate returned {res.status}{hint}.")

            body = json.loads(res.body)
            raw_flags = body.get("flags") if isinstance(body, dict) else None
            if not isinstance(raw_flags, list):
                raise RuntimeError("Flagrship: /evaluate returned an unexpected shape.")

            self._flags = {f["key"]: FlagConfig.from_api(f) for f in raw_flags}
            self._etag = res.etag

        if self._on_update:
            self._on_update(self.all_flags())
        return True

    def _report(self, err: Exception) -> None:
        if self._on_error:
            self._on_error(err)
        # No handler: stay silent. A flag SDK that spams a customer's logs on
        # every network blip is worse than one that quietly serves cached config.
