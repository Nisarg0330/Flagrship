"""Flagrship SDK - evaluate feature flags in-process, no network call per check."""

from .client import FlagConfig, Flagrship
from .hash import bucket, murmurhash3_x86_32

__all__ = ["Flagrship", "FlagConfig", "bucket", "murmurhash3_x86_32"]
__version__ = "0.0.1"
