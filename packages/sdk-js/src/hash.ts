/**
 * MurmurHash3, x86 32-bit variant. Austin Appleby's reference algorithm,
 * public domain: https://github.com/aappleby/smhasher
 *
 * Implemented here rather than imported because (a) the SDK has a 15 KB budget
 * and (b) every SDK in every language must produce identical output for
 * identical input. A 40-line function you can read is easier to keep identical
 * than a dependency you cannot.
 *
 * Input is hashed as UTF-8 bytes. That matters for non-ASCII flag keys and
 * user IDs: `murmurhash-js` on npm hashes UTF-16 code units and would disagree
 * with Python's `bytes` on anything outside ASCII.
 */
export function murmurhash3_x86_32(input: string, seed = 0): number {
  const data = new TextEncoder().encode(input);
  const len = data.length;
  const nblocks = len >>> 2;

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  let h1 = seed >>> 0;

  // Body: 4 bytes at a time, little-endian.
  for (let i = 0; i < nblocks; i++) {
    const p = i * 4;
    let k1 = (data[p] | (data[p + 1] << 8) | (data[p + 2] << 16) | (data[p + 3] << 24)) >>> 0;

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) >>> 0;
  }

  // Tail: the 0-3 bytes that did not fill a block.
  const tail = nblocks * 4;
  let k1 = 0;
  switch (len & 3) {
    case 3:
      k1 ^= data[tail + 2] << 16;
    // falls through
    case 2:
      k1 ^= data[tail + 1] << 8;
    // falls through
    case 1:
      k1 ^= data[tail];
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }

  // Finalization: force all bits of the hash to avalanche.
  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

/**
 * Which of 100 buckets this user lands in for this flag. 0-99 inclusive.
 * Seed is 0 and the separator is ":" - both are part of the cross-SDK contract
 * and can never change.
 */
export function bucket(flagKey: string, userId: string): number {
  return murmurhash3_x86_32(`${flagKey}:${userId}`, 0) % 100;
}
