"""MurmurHash3, x86 32-bit variant.

Austin Appleby's reference algorithm, public domain:
https://github.com/aappleby/smhasher

Implemented here rather than imported so that every SDK, in every language,
produces identical output for identical input. This file must stay
byte-for-byte compatible with packages/sdk-js/src/hash.ts.

Input is hashed as UTF-8 bytes. Python's `str.encode()` and JavaScript's
`TextEncoder` agree on that; a hash over code points would not.

Python integers are arbitrary-precision, so every multiply and rotate is
masked to 32 bits explicitly. Miss one mask and the hash silently diverges
from the JS SDK on inputs longer than a few bytes.
"""

_MASK = 0xFFFFFFFF
_C1 = 0xCC9E2D51
_C2 = 0x1B873593


def _rotl32(x: int, r: int) -> int:
    return ((x << r) | (x >> (32 - r))) & _MASK


def murmurhash3_x86_32(data: str | bytes, seed: int = 0) -> int:
    """Return the 32-bit MurmurHash3 of `data` as an unsigned int."""
    if isinstance(data, str):
        data = data.encode("utf-8")

    length = len(data)
    nblocks = length // 4
    h1 = seed & _MASK

    # Body: 4 bytes at a time, little-endian.
    for i in range(nblocks):
        p = i * 4
        k1 = data[p] | (data[p + 1] << 8) | (data[p + 2] << 16) | (data[p + 3] << 24)

        k1 = (k1 * _C1) & _MASK
        k1 = _rotl32(k1, 15)
        k1 = (k1 * _C2) & _MASK

        h1 ^= k1
        h1 = _rotl32(h1, 13)
        h1 = (h1 * 5 + 0xE6546B64) & _MASK

    # Tail: the 0-3 bytes that did not fill a block.
    tail = nblocks * 4
    k1 = 0
    remaining = length & 3
    if remaining == 3:
        k1 ^= data[tail + 2] << 16
    if remaining >= 2:
        k1 ^= data[tail + 1] << 8
    if remaining >= 1:
        k1 ^= data[tail]
        k1 = (k1 * _C1) & _MASK
        k1 = _rotl32(k1, 15)
        k1 = (k1 * _C2) & _MASK
        h1 ^= k1

    # Finalization: force all bits of the hash to avalanche.
    h1 ^= length
    h1 ^= h1 >> 16
    h1 = (h1 * 0x85EBCA6B) & _MASK
    h1 ^= h1 >> 13
    h1 = (h1 * 0xC2B2AE35) & _MASK
    h1 ^= h1 >> 16

    return h1


def bucket(flag_key: str, user_id: str) -> int:
    """Which of 100 buckets this user lands in for this flag. 0-99 inclusive.

    Seed 0 and the ":" separator are part of the cross-SDK contract and can
    never change.
    """
    return murmurhash3_x86_32(f"{flag_key}:{user_id}", 0) % 100
