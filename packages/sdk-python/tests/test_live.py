"""Gate A for Python, against a running API.

Skipped unless FLAGRSHIP_LIVE_KEY (a write-scoped key) is set. Run with the
API up:

    FLAGRSHIP_LIVE_KEY=sk_test_... FLAGRSHIP_API_URL=http://127.0.0.1:3000 pytest tests/test_live.py

Creates a flag with a unique key, drives it through rollout and rollback, and
proves the SDK sees each change through /evaluate. Archives the flag after.
"""

import json
import os
import time
import urllib.request

import pytest

from flagrship import Flagrship, bucket

KEY = os.environ.get("FLAGRSHIP_LIVE_KEY")
# 127.0.0.1, not localhost: on Windows urllib tries ::1 first and waits ~2s
# before falling back, because the dev API binds IPv4 only.
API = os.environ.get("FLAGRSHIP_API_URL", "http://127.0.0.1:3000")
FLAG = f"py-gate-a-{int(time.time())}"

pytestmark = pytest.mark.skipif(not KEY, reason="FLAGRSHIP_LIVE_KEY not set")


def post(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{API}/api/v1{path}",
        data=data,
        method="POST",
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())


@pytest.fixture(scope="module")
def flag():
    post("/flags", {"key": FLAG, "name": "Python Gate A"})
    yield FLAG
    # Leave the org tidy. Archive needs admin; if the key is only write-scoped
    # the flag stays, harmlessly disabled.
    try:
        req = urllib.request.Request(
            f"{API}/api/v1/flags/{FLAG}", method="DELETE", headers={"Authorization": f"Bearer {KEY}"}
        )
        urllib.request.urlopen(req)
    except Exception:  # noqa: BLE001
        pass


def test_gate_a(flag):
    sdk = Flagrship(api_key=KEY, api_url=API, poll_interval=0)
    assert sdk.ready(timeout=10)
    assert sdk.get_flag(flag) is not None, "SDK did not receive the new flag"
    assert sdk.is_enabled(flag, "user-1") is False  # app prints: False

    post(f"/flags/{flag}/enable")
    post(f"/flags/{flag}/rollout", {"percentage": 100})
    assert sdk.refresh() is True
    assert sdk.is_enabled(flag, "user-1") is True  # app prints: True

    post(f"/flags/{flag}/rollback")  # undo: 100 -> 0
    assert sdk.refresh() is True
    assert sdk.get_flag(flag).rollout_percentage == 0
    assert sdk.is_enabled(flag, "user-1") is False  # app prints: False

    sdk.close()


def test_partial_rollout_matches_buckets(flag):
    post(f"/flags/{flag}/rollout", {"percentage": 50})
    sdk = Flagrship(api_key=KEY, api_url=API, poll_interval=0)
    assert sdk.ready(timeout=10)

    # Pick two users on either side of the line using the same hash the server
    # never sees. If this passes, JS and Python would agree on these users too.
    inside = next(f"u{i}" for i in range(1000) if bucket(flag, f"u{i}") < 50)
    outside = next(f"u{i}" for i in range(1000) if bucket(flag, f"u{i}") >= 50)
    assert sdk.is_enabled(flag, inside) is True
    assert sdk.is_enabled(flag, outside) is False
    assert sdk.is_enabled(flag, None) is False
    sdk.close()


def test_second_poll_is_a_304(flag):
    statuses = []
    from flagrship.client import _urllib_transport

    def spy(url, headers):
        res = _urllib_transport(url, headers)
        statuses.append(res.status)
        return res

    sdk = Flagrship(api_key=KEY, api_url=API, poll_interval=0, transport=spy)
    assert sdk.ready(timeout=10)
    assert sdk.refresh() is False
    assert statuses == [200, 304]
    sdk.close()
