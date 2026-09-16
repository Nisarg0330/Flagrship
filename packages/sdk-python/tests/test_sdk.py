"""Sync behaviour with a scripted transport. Mirrors sdk-js/test/sdk.test.ts."""

import json
import threading
import time

import pytest

from flagrship import FlagConfig, Flagrship
from flagrship.client import _Response

ON = {"key": "f", "enabled": True, "rolloutPercentage": 100, "targetingRules": None}
OFF = {"key": "f", "enabled": False, "rolloutPercentage": 0, "targetingRules": None}


class Scripted:
    """Replays a script of responses and records what it was sent."""

    def __init__(self, *steps):
        self.steps = list(steps)
        self.calls: list[tuple[str, dict]] = []
        self._i = 0
        self._lock = threading.Lock()

    def __call__(self, url, headers):
        with self._lock:
            self.calls.append((url, dict(headers)))
            step = self.steps[min(self._i, len(self.steps) - 1)]
            self._i += 1
        if isinstance(step, Exception):
            raise step
        status, flags, etag = step
        body = b"" if status == 304 else json.dumps({"flags": flags}).encode()
        return _Response(status, body, etag)


def make(script, **kw):
    sdk = Flagrship(api_key=kw.pop("api_key", "k"), poll_interval=kw.pop("poll_interval", 0), transport=script, **kw)
    assert sdk.ready(timeout=5)
    return sdk


# ── construction ──────────────────────────────────────────────────────────


def test_requires_api_key():
    with pytest.raises(ValueError, match="api_key is required"):
        Flagrship(api_key="")


def test_sends_bearer_to_evaluate():
    s = Scripted((200, [], None))
    make(s, api_key="sk_read_x", api_url="http://api.test/")
    url, headers = s.calls[0]
    assert url == "http://api.test/api/v1/evaluate"
    assert headers["Authorization"] == "Bearer sk_read_x"


# ── graceful degradation ──────────────────────────────────────────────────


def test_ready_never_raises_when_first_sync_fails():
    errors = []
    sdk = make(Scripted(ConnectionError("ECONNREFUSED")), on_error=errors.append)
    assert sdk.all_flags() == {}
    assert str(errors[0]) == "ECONNREFUSED"


def test_serves_defaults_until_a_sync_succeeds():
    s = Scripted(ConnectionError("down"), (200, [ON], None))
    sdk = make(s, defaults={"f": True, "g": False})
    assert sdk.is_enabled("f") is True  # from defaults
    assert sdk.is_enabled("g") is False
    assert sdk.is_enabled("h") is False  # no default at all

    assert sdk.refresh() is True
    assert sdk.is_enabled("f") is True  # now from real config
    assert sdk.get_flag("f") == FlagConfig("f", True, 100, None)


def test_keeps_last_good_config_when_a_later_sync_fails():
    sdk = make(Scripted((200, [ON], None), (500, [], None)))
    assert sdk.refresh() is False
    assert sdk.is_enabled("f") is True


def test_names_401_as_a_key_problem():
    errors = []
    make(Scripted((401, [], None)), api_key="bad", on_error=errors.append)
    assert "401" in str(errors[0]) and "check the API key" in str(errors[0])


def test_explicit_default_beats_configured_default():
    sdk = make(Scripted((200, [], None)), defaults={"f": True})
    assert sdk.is_enabled("f", default=False) is False


# ── ETag sync ─────────────────────────────────────────────────────────────


def test_sends_if_none_match_and_leaves_config_alone_on_304():
    s = Scripted((200, [ON], '"v1"'), (304, [], None))
    updates = []
    sdk = make(s, on_update=lambda m: updates.append(len(m)))

    assert sdk.refresh() is False
    assert "If-None-Match" not in s.calls[0][1]
    assert s.calls[1][1]["If-None-Match"] == '"v1"'
    assert sdk.is_enabled("f") is True
    assert updates == [1]  # once, not for the 304


def test_replaces_config_and_updates_etag_on_200():
    s = Scripted((200, [ON], '"v1"'), (200, [OFF], '"v2"'), (304, [], None))
    sdk = make(s)
    assert sdk.is_enabled("f") is True

    assert sdk.refresh() is True
    assert sdk.is_enabled("f") is False

    sdk.refresh()
    assert s.calls[2][1]["If-None-Match"] == '"v2"'


def test_drops_flags_that_disappear():
    sdk = make(Scripted((200, [ON], None), (200, [], None)))
    sdk.refresh()
    assert sdk.get_flag("f") is None
    assert sdk.all_flags() == {}


# ── polling ───────────────────────────────────────────────────────────────


def test_polls_at_interval_and_stops_on_close():
    s = Scripted((200, [ON], '"v1"'), (304, [], None))
    sdk = make(s, poll_interval=0.05)
    time.sleep(0.3)
    polled = len(s.calls)
    assert polled >= 3, f"expected several polls, got {polled}"

    sdk.close()
    time.sleep(0.2)
    assert len(s.calls) <= polled + 1  # at most one in-flight poll after close


def test_does_not_poll_when_interval_is_zero():
    s = Scripted((200, [], None))
    make(s, poll_interval=0)
    time.sleep(0.15)
    assert len(s.calls) == 1


def test_context_manager_waits_for_ready_and_closes():
    s = Scripted((200, [ON], None))
    with Flagrship(api_key="k", poll_interval=0.05, transport=s) as sdk:
        assert sdk.is_enabled("f") is True
    assert sdk._closed.is_set()


# ── thread safety ─────────────────────────────────────────────────────────


def test_readers_never_see_a_torn_config():
    """Hammer is_enabled() from many threads while refresh() swaps config.

    Each swap is between two internally consistent states, so every read must
    return one of the two valid answers - never a KeyError, never a mix.
    """
    a = [{"key": "f", "enabled": True, "rolloutPercentage": 100, "targetingRules": None}]
    b = [{"key": "f", "enabled": False, "rolloutPercentage": 0, "targetingRules": None}]
    flip = [a, b]
    state = {"i": 0}

    def transport(url, headers):
        state["i"] ^= 1
        return _Response(200, json.dumps({"flags": flip[state["i"]]}).encode(), None)

    sdk = make(transport)
    stop = threading.Event()
    failures = []

    def reader():
        while not stop.is_set():
            try:
                assert sdk.is_enabled("f", "u") in (True, False)
                sdk.get_flag("f")
            except Exception as err:  # noqa: BLE001
                failures.append(err)

    readers = [threading.Thread(target=reader) for _ in range(8)]
    for t in readers:
        t.start()
    for _ in range(200):
        sdk.refresh()
    stop.set()
    for t in readers:
        t.join()

    assert failures == []
