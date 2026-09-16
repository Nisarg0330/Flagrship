"""Runs conformance/conformance.json at the repo root - the same file the JS SDK
runs. If a case fails here, fix the SDK, never the fixture. If JS and Python
disagree on a single case, that is a bug in one of them, and it is the most
important bug in the project.
"""

import json
from pathlib import Path

import pytest

from flagrship import Flagrship, bucket, murmurhash3_x86_32
from flagrship.client import _Response

FIXTURES = json.loads(
    (Path(__file__).resolve().parents[3] / "conformance" / "conformance.json").read_text("utf-8")
)


def sdk_with(flags: list) -> Flagrship:
    """A Flagrship whose first sync returns exactly these flags, with polling off."""
    body = json.dumps({"environment": "test", "flags": flags}).encode()
    sdk = Flagrship(
        api_key="sk_read_fixture",
        poll_interval=0,
        transport=lambda url, headers: _Response(200, body, '"fixture"'),
    )
    assert sdk.ready(timeout=5)
    return sdk


@pytest.mark.parametrize("case", FIXTURES["hashVectors"], ids=lambda c: repr(c["input"]))
def test_hash_vectors(case):
    assert murmurhash3_x86_32(case["input"], case["seed"]) == case["expected"]


@pytest.mark.parametrize("case", FIXTURES["buckets"], ids=lambda c: f"{c['flagKey']}:{c['userId']}")
def test_buckets(case):
    assert bucket(case["flagKey"], case["userId"]) == case["expected"]


@pytest.mark.parametrize("case", FIXTURES["evaluations"], ids=lambda c: c["name"])
def test_evaluations(case):
    sdk = sdk_with(case["flags"])
    result = sdk.is_enabled(case["flagKey"], case["userId"], case["default"])
    assert result is case["expected"]


def test_case_counts():
    # Bump when adding cases. Stops a bad merge from silently dropping half the file.
    assert len(FIXTURES["evaluations"]) >= 24
    assert len(FIXTURES["buckets"]) >= 15
    assert len(FIXTURES["hashVectors"]) >= 8
